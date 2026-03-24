import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Shield, Search, RefreshCw, AlertTriangle, Plus, Pencil, Trash2 } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  claimed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUSES = ["all", "active", "expired", "cancelled", "claimed"] as const;

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "insurance_policy", entity_id: entityId, details });
  }
}

export default function AdminInsuranceManagement() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ phone: "", plan_name: "", plan_type: "life", premium: "", coverage_amount: "", duration_months: "12" });
  const [editDialog, setEditDialog] = useState<{ policy: any; premium: string; coverage_amount: string; duration_months: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("insurance_policies").select("*").order("created_at", { ascending: false }).limit(300);
    setPolicies(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = policies.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.plan_name?.toLowerCase().includes(search.toLowerCase()) && !p.user_id?.includes(search)) return false;
    return true;
  });

  const stats = {
    total: policies.length,
    active: policies.filter(p => p.status === "active").length,
    expired: policies.filter(p => p.status === "expired").length,
    totalPremiums: policies.reduce((s, p) => s + Number(p.premium), 0),
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  const cancelPolicy = async (id: string) => {
    const policy = policies.find(p => p.id === id);
    const { error } = await supabase.from("insurance_policies").update({ status: "cancelled" as any }).eq("id", id);
    if (!error) await auditLog("insurance_cancel", id, { plan_name: policy?.plan_name, previous_status: policy?.status });
    if (error) { toast.error(error.message); return; }
    toast.success("Policy cancelled");
    fetchData();
  };

  const handleCreate = async () => {
    const { phone, plan_name, plan_type, premium, coverage_amount, duration_months } = createForm;
    if (!phone || !plan_name || !premium || !coverage_amount) { toast.error("All fields required"); return; }
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("user_id").eq("phone", phone.replace(/\D/g, "")).maybeSingle();
    if (!profile) { toast.error("User not found"); setSaving(false); return; }
    const dur = Number(duration_months);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + dur);
    const { data: created, error } = await supabase.from("insurance_policies").insert({
      user_id: profile.user_id, plan_name, plan_type, premium: Number(premium), coverage_amount: Number(coverage_amount), duration_months: dur, expires_at: expiresAt.toISOString(), status: "active" as any,
    }).select().single();
    if (!error && created) await auditLog("insurance_create", created.id, { plan_name, plan_type, premium, coverage_amount, user_id: profile.user_id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy created");
    setCreateOpen(false);
    setCreateForm({ phone: "", plan_name: "", plan_type: "life", premium: "", coverage_amount: "", duration_months: "12" });
    fetchData();
  };

  const handleEdit = async () => {
    if (!editDialog) return;
    const { policy, premium, coverage_amount, duration_months } = editDialog;
    setSaving(true);
    const dur = Number(duration_months);
    const expiresAt = new Date(policy.purchased_at || policy.created_at);
    expiresAt.setMonth(expiresAt.getMonth() + dur);
    const { error } = await supabase.from("insurance_policies").update({
      premium: Number(premium), coverage_amount: Number(coverage_amount), duration_months: dur, expires_at: expiresAt.toISOString(),
    }).eq("id", policy.id);
    if (!error) await auditLog("insurance_edit", policy.id, { previous: { premium: policy.premium, coverage_amount: policy.coverage_amount, duration_months: policy.duration_months }, new: { premium, coverage_amount, duration_months: dur } });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy updated");
    setEditDialog(null);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const { error } = await supabase.from("insurance_policies").delete().eq("id", deleteTarget.id);
    if (!error) await auditLog("insurance_delete", deleteTarget.id, { plan_name: deleteTarget.plan_name, status: deleteTarget.status, user_id: deleteTarget.user_id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy deleted");
    setDeleteTarget(null);
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Policies", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Expired", value: stats.expired },
          { label: "Premiums Collected", value: `৳${stats.totalPremiums.toLocaleString()}` },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by plan name or user ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {STATUSES.map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize h-8 text-xs">{s}</Button>
        ))}
        <Button size="sm" variant="ghost" onClick={fetchData}><RefreshCw className="w-4 h-4" /></Button>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Create Policy</Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Insurance Policies</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Premium</TableHead>
                  <TableHead className="text-xs">Coverage</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Expires</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No policies found</TableCell></TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id} className={isExpiringSoon(p.expires_at) ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                    <TableCell className="text-xs font-mono">{p.user_id?.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs font-semibold">{p.plan_name}</TableCell>
                    <TableCell className="text-xs capitalize">{p.plan_type}</TableCell>
                    <TableCell className="text-xs">৳{Number(p.premium).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">৳{Number(p.coverage_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{p.duration_months}mo</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[p.status] ?? ""}`}>{p.status}</Badge>
                        {isExpiringSoon(p.expires_at) && <AlertTriangle className="w-3 h-3 text-yellow-600" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.status === "active" && (
                          <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => cancelPolicy(p.id)}>Cancel</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setEditDialog({ policy: p, premium: String(p.premium), coverage_amount: String(p.coverage_amount), duration_months: String(p.duration_months) })}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        {["cancelled", "expired"].includes(p.status) && (
                          <Button size="sm" variant="ghost" className="h-6 px-1 text-destructive" onClick={() => setDeleteTarget(p)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Insurance Policy</DialogTitle>
            <DialogDescription>Issue a new policy for a user</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="User phone" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
            <Input placeholder="Plan name" value={createForm.plan_name} onChange={e => setCreateForm(f => ({ ...f, plan_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={createForm.plan_type} onChange={e => setCreateForm(f => ({ ...f, plan_type: e.target.value }))}>
                <option value="life">Life</option>
                <option value="health">Health</option>
                <option value="accident">Accident</option>
                <option value="device">Device</option>
              </select>
              <Input placeholder="Duration (months)" type="number" value={createForm.duration_months} onChange={e => setCreateForm(f => ({ ...f, duration_months: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Premium (৳)" type="number" value={createForm.premium} onChange={e => setCreateForm(f => ({ ...f, premium: e.target.value }))} />
              <Input placeholder="Coverage (৳)" type="number" value={createForm.coverage_amount} onChange={e => setCreateForm(f => ({ ...f, coverage_amount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editDialog} onOpenChange={v => !v && setEditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Policy</DialogTitle>
            <DialogDescription>Update premium, coverage, and duration</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Premium (৳)" type="number" value={editDialog?.premium ?? ""} onChange={e => editDialog && setEditDialog({ ...editDialog, premium: e.target.value })} />
            <Input placeholder="Coverage (৳)" type="number" value={editDialog?.coverage_amount ?? ""} onChange={e => editDialog && setEditDialog({ ...editDialog, coverage_amount: e.target.value })} />
            <Input placeholder="Duration (months)" type="number" value={editDialog?.duration_months ?? ""} onChange={e => editDialog && setEditDialog({ ...editDialog, duration_months: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete the "{deleteTarget?.plan_name}" policy? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{saving ? "Deleting…" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
