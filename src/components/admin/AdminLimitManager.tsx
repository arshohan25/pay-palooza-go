import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Search, Trash2, RotateCcw, Users, Store, UserCheck, History, Pencil, X, Check } from "lucide-react";
import MerchantLimitsTab from "./MerchantLimitsTab";
import LimitAuditTab from "./LimitAuditTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface LimitRow {
  id: string;
  txn_type: string;
  period: string;
  max_amount: number;
  max_count: number;
  applies_to: string;
  is_active: boolean;
}

interface OverrideRow {
  id: string;
  target_user_id: string;
  txn_type: string;
  period: string;
  max_amount: number | null;
  max_count: number | null;
  reason: string | null;
  set_by: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  profile_name?: string;
  profile_phone?: string;
}

const TXN_TYPES = ["send", "cashin", "cashout", "addmoney", "payment", "recharge", "paybill", "banktransfer"];
const TXN_LABELS: Record<string, string> = {
  send: "Send Money", cashin: "Cash In", cashout: "Cash Out", addmoney: "Add Money",
  payment: "Payment", recharge: "Recharge", paybill: "Pay Bill", banktransfer: "Bank Transfer",
};
const ROLE_LABELS: Record<string, string> = { user: "User", merchant: "Merchant", agent: "Agent" };

// ═══════════════════════════════════════
// Global Defaults Tab
// ═══════════════════════════════════════
function GlobalDefaultsTab() {
  const [limits, setLimits] = useState<LimitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<LimitRow>>>({});
  const [roleFilter, setRoleFilter] = useState("user");

  const fetchLimits = useCallback(async () => {
    const { data } = await supabase.from("transaction_limits").select("*").order("txn_type");
    setLimits((data ?? []) as LimitRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLimits(); }, [fetchLimits]);

  const handleEdit = (id: string, field: string, value: string) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: Number(value) || 0 } }));
  };

  const handleSave = async (row: LimitRow) => {
    const changes = edits[row.id];
    if (!changes) return;
    setSaving(row.id);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("transaction_limits" as any)
      .update({ ...changes, updated_at: new Date().toISOString(), updated_by: session?.user?.id } as any)
      .eq("id", row.id);
    if (error) toast.error("Failed to save");
    else {
      toast.success("Limit updated");
      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: session?.user?.id!,
        action: "limit_updated",
        entity_type: "limits",
        entity_id: row.id,
        details: {
          txn_type: row.txn_type,
          period: row.period,
          applies_to: row.applies_to,
          old_max_amount: row.max_amount,
          new_max_amount: changes.max_amount ?? row.max_amount,
          old_max_count: row.max_count,
          new_max_count: changes.max_count ?? row.max_count,
        },
      });
      setEdits(prev => { const n = { ...prev }; delete n[row.id]; return n; });
      await fetchLimits();
    }
    setSaving(null);
  };

  const filtered = limits.filter(l => l.applies_to === roleFilter);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["user", "merchant", "agent"] as const).map(role => (
          <Button key={role} variant={roleFilter === role ? "default" : "outline"} size="sm" onClick={() => setRoleFilter(role)}>
            {role === "user" ? <Users className="w-4 h-4 mr-1" /> : role === "merchant" ? <Store className="w-4 h-4 mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
            {ROLE_LABELS[role]}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Type</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Period</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Max Amount (৳)</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Max Txns</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => {
              const edit = edits[row.id] ?? {};
              const isDirty = Object.keys(edit).length > 0;
              return (
                <tr key={row.id} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{TXN_LABELS[row.txn_type] || row.txn_type}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="capitalize text-xs">{row.period}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      className="h-8 w-28"
                      value={edit.max_amount ?? row.max_amount}
                      onChange={e => handleEdit(row.id, "max_amount", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      className="h-8 w-20"
                      value={edit.max_count ?? row.max_count}
                      onChange={e => handleEdit(row.id, "max_count", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {isDirty && (
                      <Button size="sm" variant="default" onClick={() => handleSave(row)} disabled={saving === row.id}>
                        {saving === row.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No limits configured for {ROLE_LABELS[roleFilter]}s</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// User Overrides Tab
// ═══════════════════════════════════════
function UserOverridesTab() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ txn_type: "send", period: "daily", max_amount: "", max_count: "", reason: "", expires_at: "" });
  const [saving, setSaving] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const q = search.trim();
    const { data } = await supabase.from("profiles").select("user_id, name, phone, balance, status")
      .or(`phone.ilike.%${q}%,name.ilike.%${q}%`).limit(10);
    setSearchResults(data ?? []);
    setSearching(false);
  };

  const selectUser = async (user: any) => {
    setSelectedUser(user);
    setSearchResults([]);
    const { data, error } = await supabase.from("user_limit_overrides").select("*")
      .eq("target_user_id", user.user_id).eq("is_active", true);
    if (error) { console.error("Failed to load overrides:", error); toast.error("Failed to load overrides: " + error.message); }
    setOverrides((data as any[]) ?? []);
  };

  const addOverride = async () => {
    if (!selectedUser) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) { toast.error("Session expired — please re-login"); setSaving(false); return; }
    const payload = {
      target_user_id: selectedUser.user_id,
      txn_type: form.txn_type,
      period: form.period,
      max_amount: form.max_amount ? Number(form.max_amount) : null,
      max_count: form.max_count ? Number(form.max_count) : null,
      reason: form.reason || null,
      set_by: session.user.id,
      expires_at: form.expires_at || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("user_limit_overrides").upsert(payload, { onConflict: "target_user_id,txn_type,period" });
    if (error) { console.error("Override upsert failed:", error); toast.error("Failed: " + error.message); }
    else {
      toast.success("Override saved");
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "limit_override_created",
        entity_type: "limits",
        details: {
          txn_type: form.txn_type,
          period: form.period,
          max_amount: form.max_amount || null,
          max_count: form.max_count || null,
          target_name: selectedUser.name,
          target_phone: selectedUser.phone,
          reason: form.reason || null,
        },
      });
      setShowDialog(false);
      setForm({ txn_type: "send", period: "daily", max_amount: "", max_count: "", reason: "", expires_at: "" });
      await selectUser(selectedUser);
    }
    setSaving(false);
  };

  const removeOverride = async (id: string) => {
    const { error } = await supabase.from("user_limit_overrides").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { console.error("Remove override failed:", error); toast.error("Failed: " + error.message); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "limit_override_removed",
        entity_type: "limits",
        entity_id: id,
        details: {
          target_name: selectedUser?.name,
          target_phone: selectedUser?.phone,
        },
      });
    }
    toast.success("Override removed");
    if (selectedUser) await selectUser(selectedUser);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <Input placeholder="Search by phone or name..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} className="flex-1" />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <Card>
          <CardContent className="p-2 space-y-1">
            {searchResults.map(u => (
              <button key={u.user_id} onClick={() => selectUser(u)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/50 flex items-center justify-between">
                <span className="font-medium text-sm">{u.name || "Unnamed"} <span className="text-muted-foreground">({u.phone})</span></span>
                <Badge variant="outline" className="text-xs">{u.status}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selected user overrides */}
      {selectedUser && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{selectedUser.name || selectedUser.phone} — Limit Overrides</CardTitle>
              <Button size="sm" onClick={() => setShowDialog(true)}><Plus className="w-4 h-4 mr-1" /> Add Override</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {overrides.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No active overrides — using global defaults</p>}
            {overrides.map(ov => (
              <div key={ov.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{TXN_LABELS[ov.txn_type] || ov.txn_type} <Badge variant="outline" className="ml-1 text-xs capitalize">{ov.period}</Badge></p>
                  <p className="text-xs text-muted-foreground">
                    {ov.max_amount != null && `৳${Number(ov.max_amount).toLocaleString()} max`}
                    {ov.max_amount != null && ov.max_count != null && " · "}
                    {ov.max_count != null && `${ov.max_count} txns`}
                    {ov.reason && ` — ${ov.reason}`}
                    {ov.expires_at && ` · Expires ${new Date(ov.expires_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeOverride(ov.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Add Override Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Limit Override</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Transaction Type</Label>
                <Select value={form.txn_type} onValueChange={v => setForm(f => ({ ...f, txn_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TXN_TYPES.map(t => <SelectItem key={t} value={t}>{TXN_LABELS[t]}</SelectItem>)}
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
              <div><Label>Max Amount (৳)</Label><Input type="number" value={form.max_amount} onChange={e => setForm(f => ({ ...f, max_amount: e.target.value }))} placeholder="Leave empty for no change" /></div>
              <div><Label>Max Transactions</Label><Input type="number" value={form.max_count} onChange={e => setForm(f => ({ ...f, max_count: e.target.value }))} placeholder="Leave empty for no change" /></div>
            </div>
            <div><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Optional reason" rows={2} /></div>
            <div><Label>Expires At (optional)</Label><Input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={addOverride} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════
// Bulk Actions Tab
// ═══════════════════════════════════════
function BulkActionsTab() {
  const [targetRole, setTargetRole] = useState("user");
  const [txnType, setTxnType] = useState("send");
  const [period, setPeriod] = useState("daily");
  const [maxAmount, setMaxAmount] = useState("");
  const [maxCount, setMaxCount] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const applyBulk = async () => {
    setProcessing(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    // Get all user_ids for the target role
    let userIds: string[] = [];
    if (targetRole === "user") {
      const { data } = await supabase.from("profiles").select("user_id").eq("status", "active");
      userIds = (data ?? []).map(p => p.user_id);
    } else if (targetRole === "merchant") {
      const { data } = await supabase.from("merchants").select("user_id").eq("status", "active");
      userIds = (data ?? []).map(m => m.user_id);
    } else {
      const { data } = await supabase.from("agents").select("user_id").eq("status", "active");
      userIds = (data ?? []).map(a => a.user_id);
    }

    let success = 0, fail = 0;
    for (const uid of userIds) {
      const payload = {
        target_user_id: uid,
        txn_type: txnType,
        period,
        max_amount: maxAmount ? Number(maxAmount) : null,
        max_count: maxCount ? Number(maxCount) : null,
        reason: reason || `Bulk ${targetRole} limit update`,
        set_by: session?.user?.id,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("user_limit_overrides").upsert(payload, { onConflict: "target_user_id,txn_type,period" });
      if (error) fail++; else success++;
    }

    toast.success(`Applied to ${success} ${targetRole}s${fail ? `, ${fail} failed` : ""}`);

    // Audit log
    await supabase.from("audit_logs").insert({
      actor_id: session?.user?.id!,
      action: "bulk_limit_override",
      entity_type: "limits",
      details: { target_role: targetRole, txn_type: txnType, period, max_amount: maxAmount, max_count: maxCount, affected: success },
    });

    setProcessing(false);
  };

  const resetBulk = async () => {
    setProcessing(true);
    let userIds: string[] = [];
    if (targetRole === "user") {
      const { data } = await supabase.from("profiles").select("user_id");
      userIds = (data ?? []).map(p => p.user_id);
    } else if (targetRole === "merchant") {
      const { data } = await supabase.from("merchants").select("user_id");
      userIds = (data ?? []).map(m => m.user_id);
    } else {
      const { data } = await supabase.from("agents").select("user_id");
      userIds = (data ?? []).map(a => a.user_id);
    }

    // Deactivate all overrides for these users
    for (const uid of userIds) {
      await supabase.from("user_limit_overrides")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("target_user_id", uid);
    }

    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("audit_logs").insert({
      actor_id: session?.user?.id!,
      action: "bulk_limit_reset",
      entity_type: "limits",
      details: { target_role: targetRole, affected: userIds.length },
    });

    toast.success(`Reset all overrides for ${userIds.length} ${targetRole}s`);
    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Bulk Apply Limit Override</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["user", "merchant", "agent"] as const).map(role => (
              <Button key={role} variant={targetRole === role ? "default" : "outline"} size="sm" onClick={() => setTargetRole(role)}>
                {ROLE_LABELS[role]}s
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Transaction Type</Label>
              <Select value={txnType} onValueChange={setTxnType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TXN_TYPES.map(t => <SelectItem key={t} value={t}>{TXN_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max Amount (৳)</Label><Input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} /></div>
            <div><Label>Max Transactions</Label><Input type="number" value={maxCount} onChange={e => setMaxCount(e.target.value)} /></div>
          </div>
          <div><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for bulk change" /></div>
          <div className="flex gap-2">
            <Button onClick={applyBulk} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Apply to All {ROLE_LABELS[targetRole]}s
            </Button>
            <Button variant="outline" onClick={resetBulk} disabled={processing}>
              <RotateCcw className="w-4 h-4 mr-1" />Reset All {ROLE_LABELS[targetRole]} Overrides
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
export default function AdminLimitManager() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Transaction Limit Management</h2>
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="global">Global Defaults</TabsTrigger>
          <TabsTrigger value="overrides">User Overrides</TabsTrigger>
          <TabsTrigger value="merchant"><Store className="w-3.5 h-3.5 mr-1 inline" />Merchant</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Actions</TabsTrigger>
          <TabsTrigger value="audit"><History className="w-3.5 h-3.5 mr-1 inline" />Audit Trail</TabsTrigger>
        </TabsList>
        <TabsContent value="global"><GlobalDefaultsTab /></TabsContent>
        <TabsContent value="overrides"><UserOverridesTab /></TabsContent>
        <TabsContent value="merchant"><MerchantLimitsTab /></TabsContent>
        <TabsContent value="bulk"><BulkActionsTab /></TabsContent>
        <TabsContent value="audit"><LimitAuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
