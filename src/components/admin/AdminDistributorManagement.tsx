import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Users, RefreshCw, ToggleRight, UserPlus, Pencil, Trash2, Loader2, PauseCircle, CheckCircle, XCircle, Save, X } from "lucide-react";
import { signUpWithPhonePassword, pinToPassword } from "@/lib/auth";
import { toast } from "sonner";

interface Distributor {
  id: string;
  user_id: string;
  business_name: string;
  commission_rate: number;
  max_float: number;
  status: string;
  territory: string[] | null;
  parent_id: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  hold: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export default function AdminDistributorManagement() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDist, setSelectedDist] = useState<Distributor | null>(null);
  const [linkedAgents, setLinkedAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ phone: "", business_name: "", territory: "", commission_rate: "2", max_float: "1000000" });

  // Edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ business_name: "", commission_rate: "", max_float: "", territory: "" });
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Distributor | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("distributors").select("*").order("created_at", { ascending: false }).limit(200);
    setDistributors((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("admin-dist-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "distributors" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const setStatus = async (d: Distributor, newStatus: string) => {
    const { error } = await supabase.from("distributors").update({ status: newStatus as any }).eq("id", d.id);
    if (error) { toast.error("Failed to update status"); return; }
    // Audit
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({
        actor_id: session.user.id, action: `distributor_${newStatus}`, entity_type: "distributor", entity_id: d.id,
        details: { business_name: d.business_name, previous_status: d.status },
      }).then();
    }
    toast.success(`Distributor ${newStatus}`);
    load();
  };

  const openDetail = async (d: Distributor) => {
    setSelectedDist(d);
    setAgentsLoading(true);
    const { data } = await supabase.from("agents").select("id, business_name, status, user_id, commission_earned").eq("distributor_id", d.id);
    setLinkedAgents(data ?? []);
    setAgentsLoading(false);
  };

  // Create distributor
  const handleCreate = async () => {
    const phone = createForm.phone.replace(/\D/g, "").replace(/^88/, "");
    if (!/^01[3-9]\d{8}$/.test(phone)) { toast.error("Enter a valid 11-digit BD phone"); return; }
    if (!createForm.business_name.trim()) { toast.error("Business name required"); return; }
    setCreating(true);
    try {
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      const { data: authData } = await signUpWithPhonePassword(phone, pinToPassword(pin), { display_name: createForm.business_name });
      if (!authData?.user) throw new Error("Account creation failed");
      const userId = authData.user.id;
      await supabase.from("profiles").update({ name: createForm.business_name, phone }).eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role: "distributor" } as any);
      await supabase.from("distributors").insert({
        user_id: userId,
        business_name: createForm.business_name.trim(),
        territory: createForm.territory ? createForm.territory.split(",").map(t => t.trim()).filter(Boolean) : null,
        commission_rate: parseFloat(createForm.commission_rate) || 2,
        max_float: parseInt(createForm.max_float) || 1000000,
        status: "active" as any,
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "distributor_created", entity_type: "distributor", entity_id: userId, details: { business_name: createForm.business_name } }).then();
      }
      toast.success(`Distributor created! Temp PIN: ${pin}`, { duration: 10000 });
      setCreateOpen(false);
      setCreateForm({ phone: "", business_name: "", territory: "", commission_rate: "2", max_float: "1000000" });
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create distributor");
    } finally { setCreating(false); }
  };

  // Start editing
  const startEdit = (d: Distributor) => {
    setEditingId(d.id);
    setEditForm({
      business_name: d.business_name,
      commission_rate: String(d.commission_rate),
      max_float: String(d.max_float),
      territory: d.territory?.join(", ") || "",
    });
  };

  // Save edit
  const saveEdit = async (d: Distributor) => {
    setSaving(true);
    const { error } = await supabase.from("distributors").update({
      business_name: editForm.business_name.trim(),
      commission_rate: parseFloat(editForm.commission_rate) || d.commission_rate,
      max_float: parseInt(editForm.max_float) || d.max_float,
      territory: editForm.territory ? editForm.territory.split(",").map(t => t.trim()).filter(Boolean) : null,
    }).eq("id", d.id);
    if (error) { toast.error("Failed to save"); } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "distributor_edited", entity_type: "distributor", entity_id: d.id, details: { changes: editForm } }).then();
      }
      toast.success("Distributor updated");
    }
    setSaving(false);
    setEditingId(null);
    load();
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Remove distributor row, role, then deactivate
    await supabase.from("distributors").delete().eq("id", deleteTarget.id);
    await supabase.from("user_roles").delete().eq("user_id", deleteTarget.user_id).eq("role", "distributor" as any);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      supabase.from("audit_logs").insert({ actor_id: session.user.id, action: "distributor_deleted", entity_type: "distributor", entity_id: deleteTarget.id, details: { business_name: deleteTarget.business_name } }).then();
    }
    toast.success("Distributor deleted");
    setDeleteTarget(null);
    setDeleting(false);
    load();
  };

  // Bulk actions
  const bulkSetStatus = async (status: string) => {
    setBulkLoading(true);
    const targets = distributors.filter(d => selectedIds.has(d.id));
    await Promise.allSettled(targets.map(d => supabase.from("distributors").update({ status: status as any }).eq("id", d.id)));
    toast.success(`${targets.length} distributors set to ${status}`);
    setSelectedIds(new Set());
    setBulkLoading(false);
    load();
  };

  const activeCount = distributors.filter(d => d.status === "active").length;
  const holdCount = distributors.filter(d => d.status === "hold").length;
  const suspendedCount = distributors.filter(d => d.status === "suspended").length;

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-foreground">{distributors.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
          <div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold text-emerald-600">{activeCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><PauseCircle className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-xs text-muted-foreground">On Hold</p><p className="text-xl font-bold text-amber-600">{holdCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><XCircle className="w-5 h-5 text-red-500" /></div>
          <div><p className="text-xs text-muted-foreground">Suspended</p><p className="text-xl font-bold text-red-600">{suspendedCount}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Distributors</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1"><UserPlus className="w-4 h-4" /> Create</Button>
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Bulk bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-4 py-2 bg-muted/50 border-b border-border">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button size="sm" variant="default" className="text-xs h-7" onClick={() => bulkSetStatus("active")} disabled={bulkLoading}>Activate</Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => bulkSetStatus("hold")} disabled={bulkLoading}>Hold</Button>
              <Button size="sm" variant="destructive" className="text-xs h-7" onClick={() => bulkSetStatus("suspended")} disabled={bulkLoading}>Suspend</Button>
            </div>
          )}
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={distributors.length > 0 && selectedIds.size === distributors.length} onCheckedChange={() => {
                      if (selectedIds.size === distributors.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(distributors.map(d => d.id)));
                    }} />
                  </TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead className="text-center">Commission</TableHead>
                  <TableHead className="text-center">Max Float</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributors.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No distributors</TableCell></TableRow>
                ) : distributors.map(d => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(d.id)} onCheckedChange={() => {
                        setSelectedIds(prev => { const n = new Set(prev); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; });
                      }} />
                    </TableCell>
                    {editingId === d.id ? (
                      <>
                        <TableCell><Input value={editForm.business_name} onChange={e => setEditForm(f => ({ ...f, business_name: e.target.value }))} className="h-8 text-sm" /></TableCell>
                        <TableCell><Input value={editForm.territory} onChange={e => setEditForm(f => ({ ...f, territory: e.target.value }))} placeholder="DHK, CTG" className="h-8 text-sm" /></TableCell>
                        <TableCell><Input type="number" value={editForm.commission_rate} onChange={e => setEditForm(f => ({ ...f, commission_rate: e.target.value }))} className="h-8 text-sm w-20 mx-auto text-center" /></TableCell>
                        <TableCell><Input type="number" value={editForm.max_float} onChange={e => setEditForm(f => ({ ...f, max_float: e.target.value }))} className="h-8 text-sm w-28 mx-auto text-center" /></TableCell>
                        <TableCell className="text-center"><Badge className={`text-xs ${STATUS_COLORS[d.status] || ""}`}>{d.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => saveEdit(d)} disabled={saving}><Save className="w-3 h-3" /> Save</Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium text-foreground">{d.business_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.territory?.join(", ") || "—"}</TableCell>
                        <TableCell className="text-center font-mono text-sm">{d.commission_rate}%</TableCell>
                        <TableCell className="text-center font-mono text-sm">৳{d.max_float.toLocaleString()}</TableCell>
                        <TableCell className="text-center"><Badge className={`text-xs ${STATUS_COLORS[d.status] || ""}`}>{d.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openDetail(d)}>View</Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                            {d.status === "active" && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600" onClick={() => setStatus(d, "hold")}>Hold</Button>
                            )}
                            <Button size="sm" variant={d.status === "suspended" ? "default" : "destructive"} className="h-7 text-xs" onClick={() => setStatus(d, d.status === "suspended" ? "active" : "suspended")}>
                              {d.status === "suspended" ? "Activate" : "Suspend"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget(d)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedDist} onOpenChange={() => setSelectedDist(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedDist?.business_name}</SheetTitle>
            <SheetDescription>Distributor details & linked agents</SheetDescription>
          </SheetHeader>
          {selectedDist && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Status</p><Badge className={STATUS_COLORS[selectedDist.status]}>{selectedDist.status}</Badge></div>
                <div><p className="text-muted-foreground">Commission</p><p className="font-medium text-foreground">{selectedDist.commission_rate}%</p></div>
                <div><p className="text-muted-foreground">Max Float</p><p className="font-medium text-foreground">৳{selectedDist.max_float.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Territory</p><p className="font-medium text-foreground">{selectedDist.territory?.join(", ") || "—"}</p></div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Linked Agents ({linkedAgents.length})</p>
                {agentsLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : linkedAgents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No agents linked</p>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {linkedAgents.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-sm font-medium text-foreground">{a.business_name || a.id.slice(0, 8)}</span>
                          <Badge variant={a.status === "active" ? "default" : "destructive"} className="text-xs">{a.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Distributor</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
            <div><Label>Phone Number *</Label><Input placeholder="01XXXXXXXXX" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9]/g, "").slice(0, 11) }))} /></div>
            <div><Label>Business Name *</Label><Input placeholder="Distribution company name" value={createForm.business_name} onChange={e => setCreateForm(f => ({ ...f, business_name: e.target.value }))} /></div>
            <div><Label>Territory (comma separated)</Label><Input placeholder="DHK, CTG, SYL" value={createForm.territory} onChange={e => setCreateForm(f => ({ ...f, territory: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Commission Rate (%)</Label><Input type="number" value={createForm.commission_rate} onChange={e => setCreateForm(f => ({ ...f, commission_rate: e.target.value }))} /></div>
              <div><Label>Max Float (৳)</Label><Input type="number" value={createForm.max_float} onChange={e => setCreateForm(f => ({ ...f, max_float: e.target.value }))} /></div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating || !createForm.phone || !createForm.business_name.trim()}>
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : "Create Distributor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Distributor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteTarget?.business_name}</strong>? This will remove their distributor role and record. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
