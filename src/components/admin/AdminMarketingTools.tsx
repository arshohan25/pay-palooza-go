import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Megaphone, Plus, Tag, Percent, Gift, Pencil, Trash2, Copy, Calendar, Rocket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "marketing", entity_id: entityId, details });
  }
}
type SubTab = "promo" | "cashback" | "campaigns";

interface PromoCode {
  id: string; code: string; description: string | null;
  discount_type: string; discount_value: number;
  min_amount: number; max_discount: number | null;
  usage_limit: number | null; used_count: number;
  applies_to: string; is_active: boolean;
  starts_at: string | null; expires_at: string | null;
  created_at: string;
}

interface CashbackRule {
  id: string; name: string; txn_type: string;
  min_amount: number; max_amount: number | null;
  cashback_type: string; cashback_value: number;
  max_cashback: number | null; daily_limit: number;
  is_active: boolean; starts_at: string | null; expires_at: string | null;
  created_at: string;
}

interface Campaign {
  id: string; name: string; description: string | null;
  status: string; starts_at: string | null; ends_at: string | null;
  promo_ids: string[]; cashback_ids: string[];
  created_by: string | null; created_at: string; updated_at: string;
}

const TXN_TYPES = ["send", "payment", "recharge", "paybill", "cashin", "cashout", "addmoney", "banktransfer"];

export default function AdminMarketingTools() {
  const [subTab, setSubTab] = useState<SubTab>("promo");
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [cashbacks, setCashbacks] = useState<CashbackRule[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [showCashbackForm, setShowCashbackForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [editingCashback, setEditingCashback] = useState<CashbackRule | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);

  const [promoForm, setPromoForm] = useState({ code: "", description: "", discountType: "flat", discountValue: "", minAmount: "0", maxDiscount: "", usageLimit: "", appliesTo: "all", isActive: true, expiresAt: "" });
  const [cashbackForm, setCashbackForm] = useState({ name: "", txnType: "send", minAmount: "0", maxAmount: "", cashbackType: "flat", cashbackValue: "", maxCashback: "", dailyLimit: "1", isActive: true, expiresAt: "" });
  const [campaignForm, setCampaignForm] = useState({ name: "", description: "", status: "draft", startsAt: "", endsAt: "", promoIds: [] as string[], cashbackIds: [] as string[] });

  const loadPromos = useCallback(async () => {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    setPromos((data as PromoCode[]) ?? []);
  }, []);

  const loadCashbacks = useCallback(async () => {
    const { data } = await supabase.from("cashback_rules").select("*").order("created_at", { ascending: false });
    setCashbacks((data as CashbackRule[]) ?? []);
  }, []);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns((data as Campaign[]) ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPromos(), loadCashbacks(), loadCampaigns()]).finally(() => setLoading(false));
  }, [loadPromos, loadCashbacks, loadCampaigns]);

  useEffect(() => {
    const ch = supabase.channel("marketing-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "promo_codes" }, () => loadPromos())
      .on("postgres_changes", { event: "*", schema: "public", table: "cashback_rules" }, () => loadCashbacks())
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => loadCampaigns())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadPromos, loadCashbacks, loadCampaigns]);

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "EZP-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setPromoForm(f => ({ ...f, code }));
  };

  const openEditPromo = (p: PromoCode) => {
    setEditingPromo(p);
    setPromoForm({
      code: p.code, description: p.description || "", discountType: p.discount_type,
      discountValue: String(p.discount_value), minAmount: String(p.min_amount),
      maxDiscount: p.max_discount != null ? String(p.max_discount) : "",
      usageLimit: p.usage_limit != null ? String(p.usage_limit) : "",
      appliesTo: p.applies_to || "all", isActive: p.is_active,
      expiresAt: p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 10) : "",
    });
    setShowPromoForm(true);
  };

  const savePromo = async () => {
    if (!promoForm.code || !promoForm.discountValue) { toast.error("Code and value required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {
        code: promoForm.code.toUpperCase(), description: promoForm.description || null,
        discount_type: promoForm.discountType, discount_value: Number(promoForm.discountValue),
        min_amount: Number(promoForm.minAmount) || 0, max_discount: promoForm.maxDiscount ? Number(promoForm.maxDiscount) : null,
        usage_limit: promoForm.usageLimit ? Number(promoForm.usageLimit) : null,
        applies_to: promoForm.appliesTo, is_active: promoForm.isActive,
        expires_at: promoForm.expiresAt ? new Date(promoForm.expiresAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      if (editingPromo) {
        const { error } = await supabase.from("promo_codes").update(payload).eq("id", editingPromo.id);
        if (error) throw error;
        toast.success("Promo code updated");
        await auditLog("promo_updated", editingPromo.id, { code: promoForm.code });
      } else {
        payload.created_by = session?.user?.id;
        const { error } = await supabase.from("promo_codes").insert(payload);
        if (error) throw error;
        toast.success("Promo code created");
        await auditLog("promo_created", "new", { code: promoForm.code });
      }
      setShowPromoForm(false); setEditingPromo(null); loadPromos();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deletePromo = async (id: string) => {
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Promo code deleted"); await auditLog("promo_deleted", id, {}); loadPromos(); }
  };

  const togglePromo = async (id: string, active: boolean) => {
    await supabase.from("promo_codes").update({ is_active: !active } as any).eq("id", id);
    await auditLog("promo_toggled", id, { is_active: !active });
    loadPromos();
  };

  const openEditCashback = (c: CashbackRule) => {
    setEditingCashback(c);
    setCashbackForm({
      name: c.name, txnType: c.txn_type,
      minAmount: String(c.min_amount), maxAmount: c.max_amount != null ? String(c.max_amount) : "",
      cashbackType: c.cashback_type, cashbackValue: String(c.cashback_value),
      maxCashback: c.max_cashback != null ? String(c.max_cashback) : "",
      dailyLimit: String(c.daily_limit), isActive: c.is_active,
      expiresAt: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 10) : "",
    });
    setShowCashbackForm(true);
  };

  const saveCashback = async () => {
    if (!cashbackForm.name || !cashbackForm.cashbackValue) { toast.error("Name and value required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {
        name: cashbackForm.name, txn_type: cashbackForm.txnType,
        min_amount: Number(cashbackForm.minAmount) || 0, max_amount: cashbackForm.maxAmount ? Number(cashbackForm.maxAmount) : null,
        cashback_type: cashbackForm.cashbackType, cashback_value: Number(cashbackForm.cashbackValue),
        max_cashback: cashbackForm.maxCashback ? Number(cashbackForm.maxCashback) : null,
        daily_limit: Number(cashbackForm.dailyLimit) || 1, is_active: cashbackForm.isActive,
        expires_at: cashbackForm.expiresAt ? new Date(cashbackForm.expiresAt).toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      if (editingCashback) {
        const { error } = await supabase.from("cashback_rules").update(payload).eq("id", editingCashback.id);
        if (error) throw error;
        toast.success("Cashback rule updated");
        await auditLog("cashback_updated", editingCashback.id, { name: cashbackForm.name });
      } else {
        payload.created_by = session?.user?.id;
        const { error } = await supabase.from("cashback_rules").insert(payload);
        if (error) throw error;
        toast.success("Cashback rule created");
        await auditLog("cashback_created", "new", { name: cashbackForm.name });
      }
      setShowCashbackForm(false); setEditingCashback(null); loadCashbacks();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteCashback = async (id: string) => {
    const { error } = await supabase.from("cashback_rules").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Cashback rule deleted"); await auditLog("cashback_deleted", id, {}); loadCashbacks(); }
  };

  const toggleCashback = async (id: string, active: boolean) => {
    await supabase.from("cashback_rules").update({ is_active: !active } as any).eq("id", id);
    await auditLog("cashback_toggled", id, { is_active: !active });
    loadCashbacks();
  };

  // Campaign CRUD
  const openEditCampaign = (c: Campaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name, description: c.description || "", status: c.status,
      startsAt: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 10) : "",
      endsAt: c.ends_at ? new Date(c.ends_at).toISOString().slice(0, 10) : "",
      promoIds: c.promo_ids || [], cashbackIds: c.cashback_ids || [],
    });
    setShowCampaignForm(true);
  };

  const saveCampaign = async () => {
    if (!campaignForm.name) { toast.error("Campaign name required"); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: any = {
        name: campaignForm.name, description: campaignForm.description || null,
        status: campaignForm.status,
        starts_at: campaignForm.startsAt ? new Date(campaignForm.startsAt).toISOString() : null,
        ends_at: campaignForm.endsAt ? new Date(campaignForm.endsAt).toISOString() : null,
        promo_ids: campaignForm.promoIds, cashback_ids: campaignForm.cashbackIds,
        updated_at: new Date().toISOString(),
      };
      if (editingCampaign) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editingCampaign.id);
        if (error) throw error;
        toast.success("Campaign updated");
        await auditLog("campaign_updated", editingCampaign.id, { name: campaignForm.name });
      } else {
        payload.created_by = session?.user?.id;
        const { error } = await supabase.from("campaigns").insert(payload);
        if (error) throw error;
        toast.success("Campaign created");
        await auditLog("campaign_created", "new", { name: campaignForm.name });
      }
      setShowCampaignForm(false); setEditingCampaign(null); loadCampaigns();
    } catch (err: any) { toast.error(err.message || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Campaign deleted"); loadCampaigns(); }
  };

  const toggleCampaignStatus = async (c: Campaign) => {
    const newStatus = c.status === "active" ? "draft" : "active";
    await supabase.from("campaigns").update({ status: newStatus, updated_at: new Date().toISOString() } as any).eq("id", c.id);
    loadCampaigns();
  };

  const getLinkedRedemptions = (c: Campaign) => {
    return promos.filter(p => c.promo_ids?.includes(p.id)).reduce((s, p) => s + p.used_count, 0);
  };

  const statusColor = (s: string) => {
    if (s === "active") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
    if (s === "ended") return "bg-muted text-muted-foreground";
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" /> Marketing Tools
        </h3>
        <p className="text-sm text-muted-foreground">Manage promo codes, cashback rules, and campaigns</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={subTab === "promo" ? "default" : "outline"} size="sm" onClick={() => setSubTab("promo")}><Tag className="w-4 h-4 mr-1" /> Promo Codes</Button>
        <Button variant={subTab === "cashback" ? "default" : "outline"} size="sm" onClick={() => setSubTab("cashback")}><Gift className="w-4 h-4 mr-1" /> Cashback Rules</Button>
        <Button variant={subTab === "campaigns" ? "default" : "outline"} size="sm" onClick={() => setSubTab("campaigns")}><Rocket className="w-4 h-4 mr-1" /> Campaigns</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Active Promos</p><p className="text-xl font-bold text-primary">{promos.filter(p => p.is_active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total Redemptions</p><p className="text-xl font-bold text-foreground">{promos.reduce((s, p) => s + p.used_count, 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Active Cashback</p><p className="text-xl font-bold text-emerald-600">{cashbacks.filter(c => c.is_active).length}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Campaigns</p><p className="text-xl font-bold text-foreground">{campaigns.filter(c => c.status === "active").length} active</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* PROMO CODES TAB */}
          {subTab === "promo" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setEditingPromo(null); setPromoForm({ code: "", description: "", discountType: "flat", discountValue: "", minAmount: "0", maxDiscount: "", usageLimit: "", appliesTo: "all", isActive: true, expiresAt: "" }); setShowPromoForm(true); }}>
                  <Plus className="w-4 h-4 mr-1" /> New Promo
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[450px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead>Min Amount</TableHead>
                          <TableHead className="text-center">Used</TableHead>
                          <TableHead>Applies To</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {promos.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No promo codes yet</TableCell></TableRow>
                        ) : promos.map(p => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <code className="font-mono text-sm font-bold text-foreground">{p.code}</code>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(p.code); toast.success("Copied"); }}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {p.discount_type === "percent" ? `${p.discount_value}%` : `৳${p.discount_value}`}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">৳{Number(p.min_amount).toLocaleString()}</TableCell>
                            <TableCell className="text-center font-mono">{p.used_count}{p.usage_limit ? `/${p.usage_limit}` : ""}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{p.applies_to}</Badge></TableCell>
                            <TableCell>
                              <Switch checked={p.is_active} onCheckedChange={() => togglePromo(p.id, p.is_active)} />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPromo(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePromo(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CASHBACK RULES TAB */}
          {subTab === "cashback" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => { setEditingCashback(null); setCashbackForm({ name: "", txnType: "send", minAmount: "0", maxAmount: "", cashbackType: "flat", cashbackValue: "", maxCashback: "", dailyLimit: "1", isActive: true, expiresAt: "" }); setShowCashbackForm(true); }}>
                  <Plus className="w-4 h-4 mr-1" /> New Rule
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[450px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Txn Type</TableHead>
                          <TableHead>Cashback</TableHead>
                          <TableHead>Min/Max Amount</TableHead>
                          <TableHead className="text-center">Daily Limit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashbacks.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No cashback rules yet</TableCell></TableRow>
                        ) : cashbacks.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs capitalize">{c.txn_type}</Badge></TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {c.cashback_type === "percent" ? `${c.cashback_value}%` : `৳${c.cashback_value}`}
                                {c.max_cashback ? ` (max ৳${c.max_cashback})` : ""}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              ৳{Number(c.min_amount).toLocaleString()} — {c.max_amount ? `৳${Number(c.max_amount).toLocaleString()}` : "∞"}
                            </TableCell>
                            <TableCell className="text-center font-mono">{c.daily_limit}</TableCell>
                            <TableCell>
                              <Switch checked={c.is_active} onCheckedChange={() => toggleCashback(c.id, c.is_active)} />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCashback(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCashback(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {/* CAMPAIGNS TAB */}
          {subTab === "campaigns" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" onClick={() => {
                  setEditingCampaign(null);
                  setCampaignForm({ name: "", description: "", status: "draft", startsAt: "", endsAt: "", promoIds: [], cashbackIds: [] });
                  setShowCampaignForm(true);
                }}>
                  <Plus className="w-4 h-4 mr-1" /> New Campaign
                </Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[450px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Date Range</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Promos</TableHead>
                          <TableHead className="text-center">Cashback</TableHead>
                          <TableHead className="text-center">Redemptions</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No campaigns yet</TableCell></TableRow>
                        ) : campaigns.map(c => (
                          <TableRow key={c.id}>
                            <TableCell>
                              <p className="font-medium text-foreground">{c.name}</p>
                              {c.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.description}</p>}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {c.starts_at ? format(new Date(c.starts_at), "MMM d") : "—"}
                              {" → "}
                              {c.ends_at ? format(new Date(c.ends_at), "MMM d") : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${statusColor(c.status)}`}>{c.status}</Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono">{c.promo_ids?.length || 0}</TableCell>
                            <TableCell className="text-center font-mono">{c.cashback_ids?.length || 0}</TableCell>
                            <TableCell className="text-center font-mono">{getLinkedRedemptions(c)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleCampaignStatus(c)} title={c.status === "active" ? "Deactivate" : "Activate"}>
                                  <Rocket className={`w-3.5 h-3.5 ${c.status === "active" ? "text-emerald-600" : "text-muted-foreground"}`} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCampaign(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCampaign(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Promo Code Form Dialog */}
      <Dialog open={showPromoForm} onOpenChange={v => { if (!v) { setShowPromoForm(false); setEditingPromo(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingPromo ? "Edit Promo Code" : "Create Promo Code"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input value={promoForm.code} onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="EZP-XXXXXX" />
                {!editingPromo && <Button variant="outline" size="sm" onClick={generateCode}>Generate</Button>}
              </div>
            </div>
            <div><Label>Description</Label><Input value={promoForm.description} onChange={e => setPromoForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <Select value={promoForm.discountType} onValueChange={v => setPromoForm(f => ({ ...f, discountType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat (৳)</SelectItem>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Value</Label><Input type="number" value={promoForm.discountValue} onChange={e => setPromoForm(f => ({ ...f, discountValue: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Min Amount</Label><Input type="number" value={promoForm.minAmount} onChange={e => setPromoForm(f => ({ ...f, minAmount: e.target.value }))} /></div>
              <div><Label>Max Discount</Label><Input type="number" value={promoForm.maxDiscount} onChange={e => setPromoForm(f => ({ ...f, maxDiscount: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Usage Limit</Label><Input type="number" value={promoForm.usageLimit} onChange={e => setPromoForm(f => ({ ...f, usageLimit: e.target.value }))} placeholder="Unlimited" /></div>
              <div><Label>Expires</Label><Input type="date" value={promoForm.expiresAt} onChange={e => setPromoForm(f => ({ ...f, expiresAt: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Applies To</Label>
              <Select value={promoForm.appliesTo} onValueChange={v => setPromoForm(f => ({ ...f, appliesTo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="send">Send Money</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="recharge">Recharge</SelectItem>
                  <SelectItem value="addmoney">Add Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={promoForm.isActive} onCheckedChange={v => setPromoForm(f => ({ ...f, isActive: v }))} />
            </div>
            <Button className="w-full" onClick={savePromo} disabled={saving}>{saving ? "Saving…" : editingPromo ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cashback Rule Form Dialog */}
      <Dialog open={showCashbackForm} onOpenChange={v => { if (!v) { setShowCashbackForm(false); setEditingCashback(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCashback ? "Edit Cashback Rule" : "Create Cashback Rule"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Rule Name</Label><Input value={cashbackForm.name} onChange={e => setCashbackForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Recharge Cashback 5%" /></div>
            <div>
              <Label>Transaction Type</Label>
              <Select value={cashbackForm.txnType} onValueChange={v => setCashbackForm(f => ({ ...f, txnType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TXN_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cashback Type</Label>
                <Select value={cashbackForm.cashbackType} onValueChange={v => setCashbackForm(f => ({ ...f, cashbackType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat (৳)</SelectItem>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Value</Label><Input type="number" value={cashbackForm.cashbackValue} onChange={e => setCashbackForm(f => ({ ...f, cashbackValue: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Min Amount</Label><Input type="number" value={cashbackForm.minAmount} onChange={e => setCashbackForm(f => ({ ...f, minAmount: e.target.value }))} /></div>
              <div><Label>Max Amount</Label><Input type="number" value={cashbackForm.maxAmount} onChange={e => setCashbackForm(f => ({ ...f, maxAmount: e.target.value }))} placeholder="No limit" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Max Cashback</Label><Input type="number" value={cashbackForm.maxCashback} onChange={e => setCashbackForm(f => ({ ...f, maxCashback: e.target.value }))} placeholder="No cap" /></div>
              <div><Label>Daily Limit</Label><Input type="number" value={cashbackForm.dailyLimit} onChange={e => setCashbackForm(f => ({ ...f, dailyLimit: e.target.value }))} /></div>
            </div>
            <div><Label>Expires</Label><Input type="date" value={cashbackForm.expiresAt} onChange={e => setCashbackForm(f => ({ ...f, expiresAt: e.target.value }))} /></div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={cashbackForm.isActive} onCheckedChange={v => setCashbackForm(f => ({ ...f, isActive: v }))} />
            </div>
            <Button className="w-full" onClick={saveCashback} disabled={saving}>{saving ? "Saving…" : editingCashback ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Form Dialog */}
      <Dialog open={showCampaignForm} onOpenChange={v => { if (!v) { setShowCampaignForm(false); setEditingCampaign(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCampaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Campaign Name</Label><Input value={campaignForm.name} onChange={e => setCampaignForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Eid Mega Sale" /></div>
            <div><Label>Description</Label><Textarea value={campaignForm.description} onChange={e => setCampaignForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional description..." /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Status</Label>
                <Select value={campaignForm.status} onValueChange={v => setCampaignForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Start Date</Label><Input type="date" value={campaignForm.startsAt} onChange={e => setCampaignForm(f => ({ ...f, startsAt: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={campaignForm.endsAt} onChange={e => setCampaignForm(f => ({ ...f, endsAt: e.target.value }))} /></div>
            </div>

            {/* Link Promo Codes */}
            {promos.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link Promo Codes</Label>
                <ScrollArea className="max-h-[120px] border rounded-lg p-2">
                  {promos.map(p => (
                    <label key={p.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                      <Checkbox
                        checked={campaignForm.promoIds.includes(p.id)}
                        onCheckedChange={(checked) => {
                          setCampaignForm(f => ({
                            ...f,
                            promoIds: checked ? [...f.promoIds, p.id] : f.promoIds.filter(id => id !== p.id),
                          }));
                        }}
                      />
                      <code className="font-mono text-xs">{p.code}</code>
                      <span className="text-xs text-muted-foreground">
                        ({p.discount_type === "percent" ? `${p.discount_value}%` : `৳${p.discount_value}`})
                      </span>
                    </label>
                  ))}
                </ScrollArea>
              </div>
            )}

            {/* Link Cashback Rules */}
            {cashbacks.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Link Cashback Rules</Label>
                <ScrollArea className="max-h-[120px] border rounded-lg p-2">
                  {cashbacks.map(c => (
                    <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                      <Checkbox
                        checked={campaignForm.cashbackIds.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setCampaignForm(f => ({
                            ...f,
                            cashbackIds: checked ? [...f.cashbackIds, c.id] : f.cashbackIds.filter(id => id !== c.id),
                          }));
                        }}
                      />
                      <span className="text-xs">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({c.cashback_type === "percent" ? `${c.cashback_value}%` : `৳${c.cashback_value}`})
                      </span>
                    </label>
                  ))}
                </ScrollArea>
              </div>
            )}

            <Button className="w-full" onClick={saveCampaign} disabled={saving}>{saving ? "Saving…" : editingCampaign ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
