import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Search, ChevronDown, ChevronUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MERCHANT_TXN_TYPES = ["payment", "send", "cashout", "banktransfer", "recharge", "paybill"];
const TXN_LABELS: Record<string, string> = {
  send: "Send Money", cashin: "Cash In", cashout: "Cash Out", addmoney: "Add Money",
  payment: "Payment", recharge: "Recharge", paybill: "Pay Bill", banktransfer: "Bank Transfer",
};
const CATEGORY_COLORS: Record<string, string> = {
  retail: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  restaurant: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  grocery: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pharmacy: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  transport: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  education: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  utility: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

interface MerchantWithProfile {
  id: string;
  user_id: string;
  business_name: string;
  category: string;
  status: string;
  phone?: string;
  name?: string;
}

interface OverrideRow {
  id: string;
  txn_type: string;
  period: string;
  max_amount: number | null;
  max_count: number | null;
  reason: string | null;
  expires_at: string | null;
}

interface DefaultLimit {
  txn_type: string;
  period: string;
  max_amount: number;
  max_count: number;
}

export default function MerchantLimitsTab() {
  const [merchants, setMerchants] = useState<MerchantWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [defaults, setDefaults] = useState<DefaultLimit[]>([]);
  const [loadingLimits, setLoadingLimits] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMerchant, setDialogMerchant] = useState<MerchantWithProfile | null>(null);
  const [form, setForm] = useState({ txn_type: "payment", period: "daily", max_amount: "", max_count: "", reason: "", expires_at: "" });
  const [saving, setSaving] = useState(false);

  const fetchMerchants = useCallback(async () => {
    const { data: merchantData } = await supabase.from("merchants").select("id, user_id, business_name, category, status").order("business_name");
    if (!merchantData?.length) { setMerchants([]); setLoading(false); return; }

    const userIds = merchantData.map(m => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, phone, name").in("user_id", userIds);
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));

    setMerchants(merchantData.map(m => ({
      ...m,
      phone: profileMap.get(m.user_id)?.phone,
      name: profileMap.get(m.user_id)?.name,
    })));
    setLoading(false);
  }, []);

  const fetchDefaults = useCallback(async () => {
    const { data } = await supabase.from("transaction_limits" as any).select("txn_type, period, max_amount, max_count").eq("applies_to", "merchant").eq("is_active", true);
    setDefaults((data as any[]) ?? []);
  }, []);

  useEffect(() => { fetchMerchants(); fetchDefaults(); }, [fetchMerchants, fetchDefaults]);

  const expandMerchant = async (merchant: MerchantWithProfile) => {
    if (expandedId === merchant.id) { setExpandedId(null); return; }
    setExpandedId(merchant.id);
    setLoadingLimits(true);
    const { data } = await supabase.from("user_limit_overrides").select("id, txn_type, period, max_amount, max_count, reason, expires_at")
      .eq("target_user_id", merchant.user_id).eq("is_active", true);
    setOverrides((data as any[]) ?? []);
    setLoadingLimits(false);
  };

  const getEffective = (txnType: string, period: string) => {
    const ov = overrides.find(o => o.txn_type === txnType && o.period === period);
    const def = defaults.find(d => d.txn_type === txnType && d.period === period);
    if (ov) return { amount: ov.max_amount, count: ov.max_count, source: "override" as const, overrideId: ov.id };
    if (def) return { amount: def.max_amount, count: def.max_count, source: "default" as const, overrideId: null };
    return { amount: null, count: null, source: "none" as const, overrideId: null };
  };

  const openAddDialog = (merchant: MerchantWithProfile) => {
    setDialogMerchant(merchant);
    setForm({ txn_type: "payment", period: "daily", max_amount: "", max_count: "", reason: "", expires_at: "" });
    setShowDialog(true);
  };

  const saveOverride = async () => {
    if (!dialogMerchant) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const payload = {
      target_user_id: dialogMerchant.user_id,
      txn_type: form.txn_type,
      period: form.period,
      max_amount: form.max_amount ? Number(form.max_amount) : null,
      max_count: form.max_count ? Number(form.max_count) : null,
      reason: form.reason || null,
      set_by: session?.user?.id,
      expires_at: form.expires_at || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("user_limit_overrides").upsert(payload, { onConflict: "target_user_id,txn_type,period" });
    if (error) toast.error("Failed: " + error.message);
    else { toast.success("Override saved"); setShowDialog(false); await expandMerchant(dialogMerchant); }
    setSaving(false);
  };

  const removeOverride = async (overrideId: string, merchant: MerchantWithProfile) => {
    await supabase.from("user_limit_overrides").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", overrideId);
    toast.success("Override removed");
    await expandMerchant(merchant);
  };

  const resetAllOverrides = async (merchant: MerchantWithProfile) => {
    await supabase.from("user_limit_overrides")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("target_user_id", merchant.user_id);
    toast.success("All overrides reset to defaults");
    await expandMerchant(merchant);
  };

  const filtered = merchants.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.business_name.toLowerCase().includes(q) || m.phone?.includes(q) || m.name?.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Search by business name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
        <Button variant="outline" size="icon" onClick={fetchMerchants}><Search className="w-4 h-4" /></Button>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No merchants found</p>
      )}

      <div className="space-y-2">
        {filtered.map(merchant => {
          const isExpanded = expandedId === merchant.id;
          return (
            <Collapsible key={merchant.id} open={isExpanded} onOpenChange={() => expandMerchant(merchant)}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{merchant.business_name}</p>
                        <p className="text-xs text-muted-foreground">{merchant.phone || "No phone"}{merchant.name ? ` · ${merchant.name}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={`text-xs ${CATEGORY_COLORS[merchant.category] || CATEGORY_COLORS.other}`}>{merchant.category}</Badge>
                      <Badge variant={merchant.status === "active" ? "default" : "secondary"} className="text-xs capitalize">{merchant.status}</Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    {loadingLimits ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Effective Limits</p>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => openAddDialog(merchant)}><Plus className="w-3.5 h-3.5 mr-1" />Override</Button>
                            <Button size="sm" variant="ghost" onClick={() => resetAllOverrides(merchant)}><RotateCcw className="w-3.5 h-3.5 mr-1" />Reset All</Button>
                          </div>
                        </div>

                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="text-left px-2.5 py-1.5 font-semibold text-muted-foreground">Type</th>
                                <th className="text-left px-2.5 py-1.5 font-semibold text-muted-foreground">Period</th>
                                <th className="text-left px-2.5 py-1.5 font-semibold text-muted-foreground">Max Amount</th>
                                <th className="text-left px-2.5 py-1.5 font-semibold text-muted-foreground">Max Txns</th>
                                <th className="text-left px-2.5 py-1.5 font-semibold text-muted-foreground">Source</th>
                                <th className="px-2.5 py-1.5"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {MERCHANT_TXN_TYPES.flatMap(txn =>
                                (["daily", "monthly"] as const).map(period => {
                                  const eff = getEffective(txn, period);
                                  if (eff.source === "none") return null;
                                  return (
                                    <tr key={`${txn}-${period}`} className="border-t border-border/50">
                                      <td className="px-2.5 py-2 font-medium">{TXN_LABELS[txn] || txn}</td>
                                      <td className="px-2.5 py-2 capitalize">{period}</td>
                                      <td className="px-2.5 py-2">{eff.amount != null ? `৳${Number(eff.amount).toLocaleString()}` : "—"}</td>
                                      <td className="px-2.5 py-2">{eff.count ?? "—"}</td>
                                      <td className="px-2.5 py-2">
                                        <Badge variant={eff.source === "override" ? "default" : "outline"} className="text-[10px]">
                                          {eff.source === "override" ? "Override" : "Default"}
                                        </Badge>
                                      </td>
                                      <td className="px-2.5 py-2">
                                        {eff.source === "override" && eff.overrideId && (
                                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => removeOverride(eff.overrideId!, merchant)}>
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                          </Button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              ).filter(Boolean)}
                              {MERCHANT_TXN_TYPES.every(txn =>
                                ["daily", "monthly"].every(period => getEffective(txn, period).source === "none")
                              ) && (
                                <tr><td colSpan={6} className="px-2.5 py-4 text-center text-muted-foreground">No limits configured</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Add Override Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set Merchant Limit Override — {dialogMerchant?.business_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Transaction Type</Label>
                <Select value={form.txn_type} onValueChange={v => setForm(f => ({ ...f, txn_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MERCHANT_TXN_TYPES.map(t => <SelectItem key={t} value={t}>{TXN_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period</Label>
                <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Max Amount (৳)</Label><Input type="number" value={form.max_amount} onChange={e => setForm(f => ({ ...f, max_amount: e.target.value }))} placeholder="Leave empty for no limit" /></div>
              <div><Label>Max Transactions</Label><Input type="number" value={form.max_count} onChange={e => setForm(f => ({ ...f, max_count: e.target.value }))} placeholder="Leave empty for no limit" /></div>
            </div>
            <div><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Optional reason" rows={2} /></div>
            <div><Label>Expires At (optional)</Label><Input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveOverride} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
