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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LimitRow {
  id: string;
  txn_type: string;
  period: string;
  max_amount: number;
  max_count: number;
  applies_to: string;
  is_active: boolean;
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
    const { error } = await supabase.from("transaction_limits")
      .update({ ...changes, updated_at: new Date().toISOString(), updated_by: session?.user?.id } as any)
      .eq("id", row.id);
    if (error) toast.error("Failed to save");
    else {
      toast.success("Limit updated");
      await supabase.from("audit_logs").insert({
        actor_id: session?.user?.id!,
        action: "limit_updated",
        entity_type: "limits",
        entity_id: row.id,
        details: {
          txn_type: row.txn_type, period: row.period, applies_to: row.applies_to,
          old_max_amount: row.max_amount, new_max_amount: changes.max_amount ?? row.max_amount,
          old_max_count: row.max_count, new_max_count: changes.max_count ?? row.max_count,
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
                  <td className="px-3 py-2.5"><Badge variant="outline" className="capitalize text-xs">{row.period}</Badge></td>
                  <td className="px-3 py-2.5">
                    <Input type="number" className="h-8 w-28" value={edit.max_amount ?? row.max_amount}
                      onChange={e => handleEdit(row.id, "max_amount", e.target.value)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input type="number" className="h-8 w-20" value={edit.max_count ?? row.max_count}
                      onChange={e => handleEdit(row.id, "max_count", e.target.value)} />
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
// User Overrides Tab — Effective Limits Table
// ═══════════════════════════════════════
interface EffectiveLimit {
  txn_type: string;
  period: string;
  max_amount: number;
  max_count: number;
  source: "default" | "custom";
  override_id?: string;
}

function UserOverridesTab() {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [effectiveLimits, setEffectiveLimits] = useState<EffectiveLimit[]>([]);
  const [loadingLimits, setLoadingLimits] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ max_amount: "", max_count: "", reason: "", expires_at: "" });
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

  const loadEffectiveLimits = useCallback(async (userId: string) => {
    setLoadingLimits(true);
    const { data: globals } = await supabase.from("transaction_limits")
      .select("txn_type, period, max_amount, max_count")
      .eq("applies_to", "user").eq("is_active", true);

    const { data: overrides, error } = await supabase.from("user_limit_overrides")
      .select("id, txn_type, period, max_amount, max_count, expires_at")
      .eq("target_user_id", userId).eq("is_active", true);

    if (error) { console.error("Failed to load overrides:", error); toast.error("Failed to load overrides"); }

    const result: EffectiveLimit[] = [];
    const now = new Date();

    for (const txn of TXN_TYPES) {
      for (const period of ["daily", "monthly"]) {
        const global = (globals ?? []).find(g => g.txn_type === txn && g.period === period);
        const override = (overrides ?? []).find(o =>
          o.txn_type === txn && o.period === period &&
          (!o.expires_at || new Date(o.expires_at) >= now)
        );

        if (override) {
          result.push({
            txn_type: txn, period,
            max_amount: override.max_amount != null ? Number(override.max_amount) : (global ? Number(global.max_amount) : 0),
            max_count: override.max_count != null ? Number(override.max_count) : (global ? Number(global.max_count) : 0),
            source: "custom", override_id: override.id,
          });
        } else {
          result.push({
            txn_type: txn, period,
            max_amount: global ? Number(global.max_amount) : 0,
            max_count: global ? Number(global.max_count) : 0,
            source: "default",
          });
        }
      }
    }

    setEffectiveLimits(result);
    setLoadingLimits(false);
  }, []);

  const selectUser = async (user: any) => {
    setSelectedUser(user);
    setSearchResults([]);
    setEditingKey(null);
    await loadEffectiveLimits(user.user_id);
  };

  const startEdit = (limit: EffectiveLimit) => {
    setEditingKey(`${limit.txn_type}-${limit.period}`);
    setEditForm({ max_amount: String(limit.max_amount), max_count: String(limit.max_count), reason: "", expires_at: "" });
  };

  const cancelEdit = () => { setEditingKey(null); };

  const saveEdit = async (limit: EffectiveLimit) => {
    if (!selectedUser) return;
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) { toast.error("Session expired — please re-login"); setSaving(false); return; }

    const { error } = await supabase.from("user_limit_overrides")
      .upsert({
        target_user_id: selectedUser.user_id,
        txn_type: limit.txn_type,
        period: limit.period,
        max_amount: editForm.max_amount ? Number(editForm.max_amount) : null,
        max_count: editForm.max_count ? Number(editForm.max_count) : null,
        reason: editForm.reason || null,
        set_by: session.user.id,
        expires_at: editForm.expires_at || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "target_user_id,txn_type,period" });

    if (error) { console.error("Override save failed:", error); toast.error("Failed: " + error.message); }
    else {
      toast.success(`${TXN_LABELS[limit.txn_type]} ${limit.period} limit updated`);
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id, action: "limit_override_created", entity_type: "limits",
        details: {
          txn_type: limit.txn_type, period: limit.period,
          old_max_amount: limit.max_amount, new_max_amount: Number(editForm.max_amount) || null,
          old_max_count: limit.max_count, new_max_count: Number(editForm.max_count) || null,
          target_name: selectedUser.name, target_phone: selectedUser.phone,
          reason: editForm.reason || null,
        },
      });
      setEditingKey(null);
      await loadEffectiveLimits(selectedUser.user_id);
    }
    setSaving(false);
  };

  const resetToDefault = async (limit: EffectiveLimit) => {
    if (!limit.override_id) return;
    const { error } = await supabase.from("user_limit_overrides")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", limit.override_id);
    if (error) { console.error("Reset failed:", error); toast.error("Failed: " + error.message); return; }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id, action: "limit_override_removed", entity_type: "limits",
        entity_id: limit.override_id,
        details: { txn_type: limit.txn_type, period: limit.period, target_name: selectedUser?.name, target_phone: selectedUser?.phone },
      });
    }
    toast.success(`${TXN_LABELS[limit.txn_type]} ${limit.period} reset to default`);
    if (selectedUser) await loadEffectiveLimits(selectedUser.user_id);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Search by phone or name..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} className="flex-1" />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

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

      {selectedUser && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{selectedUser.name || selectedUser.phone} — Effective Limits</CardTitle>
            <p className="text-xs text-muted-foreground">Click Edit to increase or decrease any limit. Custom overrides are highlighted.</p>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLimits ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Period</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Max Amount (৳)</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Max Txns</th>
                      <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Source</th>
                      <th className="px-3 py-2 font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveLimits.map(limit => {
                      const key = `${limit.txn_type}-${limit.period}`;
                      const isEditing = editingKey === key;
                      return (
                        <tr key={key} className={`border-t border-border/50 ${limit.source === "custom" ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                          <td className="px-3 py-2.5 font-medium">{TXN_LABELS[limit.txn_type] || limit.txn_type}</td>
                          <td className="px-3 py-2.5"><Badge variant="outline" className="capitalize text-xs">{limit.period}</Badge></td>
                          <td className="px-3 py-2.5">
                            {isEditing ? (
                              <Input type="number" className="h-8 w-28" value={editForm.max_amount}
                                onChange={e => setEditForm(f => ({ ...f, max_amount: e.target.value }))} autoFocus />
                            ) : (
                              <span>{limit.max_amount === 0 ? "No Limit" : `৳${limit.max_amount.toLocaleString()}`}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {isEditing ? (
                              <Input type="number" className="h-8 w-20" value={editForm.max_count}
                                onChange={e => setEditForm(f => ({ ...f, max_count: e.target.value }))} />
                            ) : (
                              <span>{limit.max_count === 0 ? "∞" : limit.max_count}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={limit.source === "custom" ? "default" : "secondary"} className="text-xs">
                              {limit.source === "custom" ? "Custom" : "Default"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1">
                              {isEditing ? (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => saveEdit(limit)} disabled={saving}>
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-green-600" />}
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => startEdit(limit)} title="Edit limit">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  {limit.source === "custom" && (
                                    <Button size="sm" variant="ghost" onClick={() => resetToDefault(limit)} title="Reset to default">
                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {editingKey && (
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Optional: Add a reason or expiry for this override</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Reason</Label><Input value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. VIP user request" className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Expires At</Label><Input type="date" value={editForm.expires_at} onChange={e => setEditForm(f => ({ ...f, expires_at: e.target.value }))} className="h-8 text-sm" /></div>
            </div>
          </CardContent>
        </Card>
      )}
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

  // Multi-user selection state
  const [userSearch, setUserSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [applyMode, setApplyMode] = useState<"all" | "selected">("all");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const searchUsers = async () => {
    if (!userSearch.trim()) return;
    setSearchingUsers(true);
    const q = userSearch.trim();
    let query = supabase.from("profiles").select("user_id, name, phone, status");
    if (targetRole === "merchant") {
      const { data: merchants } = await supabase.from("merchants").select("user_id").eq("status", "active");
      const mIds = (merchants ?? []).map(m => m.user_id);
      if (mIds.length) query = query.in("user_id", mIds);
      else { setUserSearchResults([]); setSearchingUsers(false); return; }
    } else if (targetRole === "agent") {
      const { data: agents } = await supabase.from("agents").select("user_id").eq("status", "active");
      const aIds = (agents ?? []).map(a => a.user_id);
      if (aIds.length) query = query.in("user_id", aIds);
      else { setUserSearchResults([]); setSearchingUsers(false); return; }
    }
    const { data } = await query.or(`phone.ilike.%${q}%,name.ilike.%${q}%`).eq("status", "active").limit(15);
    setUserSearchResults((data ?? []).filter(u => !selectedUsers.some(s => s.user_id === u.user_id)));
    setSearchingUsers(false);
  };

  const addUser = (user: any) => {
    setSelectedUsers(prev => [...prev, user]);
    setUserSearchResults(prev => prev.filter(u => u.user_id !== user.user_id));
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.user_id !== userId));
  };

  const getTargetUserIds = async (): Promise<string[]> => {
    if (applyMode === "selected") return selectedUsers.map(u => u.user_id);
    if (targetRole === "user") {
      const { data } = await supabase.from("profiles").select("user_id").eq("status", "active");
      return (data ?? []).map(p => p.user_id);
    } else if (targetRole === "merchant") {
      const { data } = await supabase.from("merchants").select("user_id").eq("status", "active");
      return (data ?? []).map(m => m.user_id);
    } else {
      const { data } = await supabase.from("agents").select("user_id").eq("status", "active");
      return (data ?? []).map(a => a.user_id);
    }
  };

  const applyBulk = async () => {
    setConfirmOpen(false);
    setProcessing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const userIds = await getTargetUserIds();

    let success = 0, fail = 0;
    for (const uid of userIds) {
      const payload = {
        target_user_id: uid, txn_type: txnType, period,
        max_amount: maxAmount ? Number(maxAmount) : null,
        max_count: maxCount ? Number(maxCount) : null,
        reason: reason || `Bulk ${targetRole} limit update`,
        set_by: session?.user?.id!, is_active: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("user_limit_overrides").upsert(payload, { onConflict: "target_user_id,txn_type,period" });
      if (error) fail++; else success++;
    }

    toast.success(`Applied to ${success} ${targetRole}s${fail ? `, ${fail} failed` : ""}`);
    await supabase.from("audit_logs").insert({
      actor_id: session?.user?.id!,
      action: "bulk_limit_override", entity_type: "limits",
      details: { target_role: targetRole, txn_type: txnType, period, max_amount: maxAmount, max_count: maxCount, affected: success, mode: applyMode, selected_count: applyMode === "selected" ? selectedUsers.length : undefined },
    });
    setProcessing(false);
  };

  const resetBulk = async () => {
    setProcessing(true);
    const userIds = await getTargetUserIds();
    for (const uid of userIds) {
      await supabase.from("user_limit_overrides")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("target_user_id", uid);
    }
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("audit_logs").insert({
      actor_id: session?.user?.id!,
      action: "bulk_limit_reset", entity_type: "limits",
      details: { target_role: targetRole, affected: userIds.length, mode: applyMode },
    });
    toast.success(`Reset overrides for ${userIds.length} ${targetRole}s`);
    setProcessing(false);
  };

  const targetLabel = applyMode === "selected" ? `${selectedUsers.length} Selected` : `All ${ROLE_LABELS[targetRole]}s`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Bulk Apply Limit Override</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Role filter */}
          <div className="flex gap-2 flex-wrap">
            {(["user", "merchant", "agent"] as const).map(role => (
              <Button key={role} variant={targetRole === role ? "default" : "outline"} size="sm" onClick={() => { setTargetRole(role); setSelectedUsers([]); setUserSearchResults([]); }}>
                {ROLE_LABELS[role]}s
              </Button>
            ))}
          </div>

          {/* Apply mode toggle */}
          <div className="flex gap-2">
            <Button variant={applyMode === "all" ? "default" : "outline"} size="sm" onClick={() => setApplyMode("all")}>
              <Users className="w-3.5 h-3.5 mr-1" /> Apply to All
            </Button>
            <Button variant={applyMode === "selected" ? "default" : "outline"} size="sm" onClick={() => setApplyMode("selected")}>
              <UserCheck className="w-3.5 h-3.5 mr-1" /> Select Users
            </Button>
          </div>

          {/* User search + selection */}
          {applyMode === "selected" && (
            <div className="space-y-3 p-3 rounded-lg border border-dashed border-border">
              <div className="flex gap-2">
                <Input placeholder={`Search ${ROLE_LABELS[targetRole]}s by name/phone…`} value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchUsers()} className="flex-1 h-9" />
                <Button size="sm" onClick={searchUsers} disabled={searchingUsers} className="h-9">
                  {searchingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              {/* Search results */}
              {userSearchResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-border bg-background p-1">
                  {userSearchResults.map(u => (
                    <button key={u.user_id} onClick={() => addUser(u)}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted/50 flex items-center justify-between">
                      <span>{u.name || "Unnamed"} <span className="text-muted-foreground text-xs">({u.phone})</span></span>
                      <Badge variant="outline" className="text-[10px]">+ Add</Badge>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected chips */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map(u => (
                    <Badge key={u.user_id} variant="secondary" className="text-xs gap-1 pr-1">
                      {u.name || u.phone}
                      <button onClick={() => removeUser(u.user_id)} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {selectedUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Search and select specific users above</p>}
            </div>
          )}

          {/* Limit config form */}
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

          {/* Confirmation + actions */}
          {confirmOpen && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Apply <span className="text-primary">{TXN_LABELS[txnType]} {period}</span> limit to <span className="font-bold">{targetLabel}</span>?
              </p>
              {maxAmount && <p className="text-xs text-muted-foreground">Max Amount: ৳{Number(maxAmount).toLocaleString()}</p>}
              {maxCount && <p className="text-xs text-muted-foreground">Max Txns: {maxCount}</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={applyBulk} disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Confirm
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {!confirmOpen && (
            <div className="flex gap-2">
              <Button onClick={() => {
                if (applyMode === "selected" && selectedUsers.length === 0) { toast.error("Select at least one user"); return; }
                setConfirmOpen(true);
              }} disabled={processing}>
                Apply to {targetLabel}
              </Button>
              <Button variant="outline" onClick={resetBulk} disabled={processing}>
                <RotateCcw className="w-4 h-4 mr-1" />Reset {targetLabel} Overrides
              </Button>
            </div>
          )}
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
