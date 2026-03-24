import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Route, Plus, Copy, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details });
  }
}

type SubTab = "routing" | "payment_links";

interface RoutingRule {
  key: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}

const ROUTING_RULES: RoutingRule[] = [
  { key: "routing_failover", label: "Failover Enabled", description: "Automatically route to next gateway if primary fails", defaultChecked: true },
  { key: "routing_amount_based", label: "Amount-based Routing", description: "Route large transactions (৳50K+) to specific gateway", defaultChecked: false },
  { key: "routing_load_balance", label: "Load Balancing", description: "Distribute load across multiple gateways", defaultChecked: false },
];

export default function AdminSmartRouting() {
  const [subTab, setSubTab] = useState<SubTab>("routing");
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [routingToggles, setRoutingToggles] = useState<Record<string, boolean>>({});
  const [routingLoading, setRoutingLoading] = useState(true);

  // Payment links from DB
  const [paymentLinks, setPaymentLinks] = useState<any[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: "", amount: "", description: "", maxUses: "", expiresAt: "" });
  const [creating, setCreating] = useState(false);
  const [deleteLinkTarget, setDeleteLinkTarget] = useState<any>(null);
  const [editLinkTarget, setEditLinkTarget] = useState<any>(null);
  const [editLinkForm, setEditLinkForm] = useState({ title: "", amount: "", description: "" });

  const loadGateways = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("payment_gateways").select("*").order("sort_order", { ascending: true });
    setGateways(data ?? []);
    setLoading(false);
  }, []);

  const loadRoutingRules = useCallback(async () => {
    setRoutingLoading(true);
    const keys = ROUTING_RULES.map(r => r.key);
    const { data } = await supabase.from("global_feature_toggles").select("feature_key, is_enabled").in("feature_key", keys);
    const map: Record<string, boolean> = {};
    for (const rule of ROUTING_RULES) {
      const found = data?.find(d => d.feature_key === rule.key);
      map[rule.key] = found ? found.is_enabled : rule.defaultChecked;
    }
    setRoutingToggles(map);
    setRoutingLoading(false);
  }, []);

  const loadPaymentLinks = useCallback(async () => {
    setLinksLoading(true);
    const { data } = await supabase.from("payment_links").select("*").order("created_at", { ascending: false });
    setPaymentLinks(data ?? []);
    setLinksLoading(false);
  }, []);

  useEffect(() => { loadGateways(); loadRoutingRules(); }, [loadGateways, loadRoutingRules]);
  useEffect(() => { if (subTab === "payment_links") loadPaymentLinks(); }, [subTab, loadPaymentLinks]);

  const toggleRoutingRule = async (key: string, newVal: boolean) => {
    setRoutingToggles(p => ({ ...p, [key]: newVal }));
    const rule = ROUTING_RULES.find(r => r.key === key)!;
    // Upsert into global_feature_toggles
    const { data: existing } = await supabase.from("global_feature_toggles").select("id").eq("feature_key", key).maybeSingle();
    if (existing) {
      await supabase.from("global_feature_toggles").update({ is_enabled: newVal, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("global_feature_toggles").insert({ feature_key: key, label: rule.label, description: rule.description, is_enabled: newVal });
    }
    toast.success(`${rule.label} ${newVal ? "enabled" : "disabled"}`);
    await auditLog("routing_rule_toggled", "global_feature_toggle", key, { is_enabled: newVal });
  };

  const updatePriority = async (id: string, newOrder: number) => {
    const { error } = await supabase.from("payment_gateways").update({ sort_order: newOrder }).eq("id", id);
    if (error) { toast.error("Failed to update priority"); return; }
    toast.success("Priority updated");
    loadGateways();
  };

  const toggleGateway = async (id: string, current: boolean) => {
    const { error } = await supabase.from("payment_gateways").update({ is_enabled: !current }).eq("id", id);
    if (error) { toast.error("Failed to toggle"); return; }
    toast.success(`Gateway ${!current ? "enabled" : "disabled"}`);
    loadGateways();
  };

  const generateShortCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "PAY-";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const createPaymentLink = async () => {
    if (!linkForm.title) { toast.error("Title required"); return; }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("payment_links").insert({
        title: linkForm.title,
        amount: linkForm.amount ? Number(linkForm.amount) : null,
        description: linkForm.description || null,
        short_code: generateShortCode(),
        max_uses: linkForm.maxUses ? Number(linkForm.maxUses) : null,
        expires_at: linkForm.expiresAt ? new Date(linkForm.expiresAt).toISOString() : null,
        created_by: session?.user?.id || null,
      });
      if (error) throw error;
      setShowLinkForm(false);
      setLinkForm({ title: "", amount: "", description: "", maxUses: "", expiresAt: "" });
      toast.success("Payment link created");
      await auditLog("payment_link_created", "payment_link", "new", { title: linkForm.title });
      loadPaymentLinks();
    } catch {
      toast.error("Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from("payment_links").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Link deleted");
    loadPaymentLinks();
  };

  const toggleLink = async (id: string, current: boolean) => {
    await supabase.from("payment_links").update({ is_active: !current }).eq("id", id);
    toast.success(`Link ${!current ? "activated" : "deactivated"}`);
    loadPaymentLinks();
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${code}`);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Route className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Smart Routing & Payment Links</h2>
      </div>

      <div className="flex gap-2">
        <Button variant={subTab === "routing" ? "default" : "outline"} size="sm" onClick={() => setSubTab("routing")}>Gateway Routing</Button>
        <Button variant={subTab === "payment_links" ? "default" : "outline"} size="sm" onClick={() => setSubTab("payment_links")}>Payment Links</Button>
      </div>

      {subTab === "routing" && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Routing Priority</CardTitle>
              <p className="text-xs text-muted-foreground">Transactions route to the highest-priority enabled gateway. Lower number = higher priority.</p>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Priority</TableHead>
                        <TableHead>Gateway</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gateways.map((gw) => (
                        <TableRow key={gw.id}>
                          <TableCell>
                            <Input
                              type="number" min={0}
                              value={gw.sort_order}
                              onChange={(e) => updatePriority(gw.id, Number(e.target.value))}
                              className="w-16 h-7 text-xs text-center"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-foreground">{gw.display_name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{gw.provider}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={gw.is_enabled ? "secondary" : "outline"} className={`text-[10px] ${gw.is_enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : ""}`}>
                              {gw.is_enabled ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch checked={gw.is_enabled} onCheckedChange={() => toggleGateway(gw.id, gw.is_enabled)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Routing Rules</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {routingLoading ? (
                <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                ROUTING_RULES.map(rule => (
                  <div key={rule.key} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{rule.label}</span>
                      <Switch checked={routingToggles[rule.key] ?? rule.defaultChecked} onCheckedChange={(v) => toggleRoutingRule(rule.key, v)} />
                    </div>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {subTab === "payment_links" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowLinkForm(true)}><Plus className="w-3.5 h-3.5 mr-1.5" /> Create Link</Button>
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {linksLoading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead className="hidden md:table-cell">Code</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentLinks.map(link => (
                        <TableRow key={link.id}>
                          <TableCell className="font-medium text-foreground text-sm">{link.title}</TableCell>
                          <TableCell className="text-sm">{link.amount ? `৳${Number(link.amount).toLocaleString()}` : "Custom"}</TableCell>
                          <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-[9px] font-mono">{link.short_code}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{link.used_count}{link.max_uses ? `/${link.max_uses}` : ""}</TableCell>
                          <TableCell>
                            <Badge variant={link.is_active ? "secondary" : "outline"} className="text-[10px] cursor-pointer" onClick={() => toggleLink(link.id, link.is_active)}>
                              {link.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyLink(link.short_code)}><Copy className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => deleteLink(link.id)}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paymentLinks.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payment links yet</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showLinkForm} onOpenChange={setShowLinkForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Payment Link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Title</Label><Input value={linkForm.title} onChange={e => setLinkForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Monthly Subscription" /></div>
            <div><Label className="text-xs">Amount (leave empty for custom)</Label><Input type="number" value={linkForm.amount} onChange={e => setLinkForm(p => ({ ...p, amount: e.target.value }))} placeholder="৳0.00" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={linkForm.description} onChange={e => setLinkForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Max Uses</Label><Input type="number" value={linkForm.maxUses} onChange={e => setLinkForm(p => ({ ...p, maxUses: e.target.value }))} placeholder="Unlimited" /></div>
              <div><Label className="text-xs">Expires At</Label><Input type="date" value={linkForm.expiresAt} onChange={e => setLinkForm(p => ({ ...p, expiresAt: e.target.value }))} /></div>
            </div>
            <Button className="w-full" onClick={createPaymentLink} disabled={creating}>{creating ? "Creating…" : "Create Link"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
