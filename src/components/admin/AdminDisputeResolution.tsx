import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Scale, Eye, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";

interface Dispute {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  complainant_id: string;
  transaction_id: string | null;
  resolution_notes: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  under_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-muted text-muted-foreground",
};

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "dispute", entity_id: entityId, details
    });
  }
}

export default function AdminDisputeResolution() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Dispute | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ phone: "", subject: "", description: "", transaction_id: "" });
  const [creating, setCreating] = useState(false);
  const { visible: realtimeVisible, flash: realtimeFlash } = useRealtimeIndicator();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("disputes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setDisputes((data as Dispute[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-disputes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, () => {
        load();
        realtimeFlash();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const openView = (d: Dispute) => {
    setViewing(d);
    setNewStatus(d.status);
    setNotes(d.resolution_notes ?? "");
  };

  const handleUpdate = async () => {
    if (!viewing) return;
    const update: Record<string, unknown> = { status: newStatus, resolution_notes: notes || null };
    if (newStatus === "resolved" || newStatus === "rejected") {
      update.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase.from("disputes").update(update).eq("id", viewing.id);
    if (error) { toast.error("Update failed"); return; }
    await auditLog("dispute_status_update", viewing.id, { old_status: viewing.status, new_status: newStatus });
    toast.success("Dispute updated");
    setViewing(null);
    load();
  };

  const handleCreate = async () => {
    if (!createForm.subject.trim() || !createForm.phone.trim()) { toast.error("Phone and subject required"); return; }
    setCreating(true);
    // Find user by phone
    const { data: profile } = await supabase.from("profiles").select("user_id").eq("phone", createForm.phone.trim()).maybeSingle();
    if (!profile) { toast.error("User not found with that phone"); setCreating(false); return; }
    const { data, error } = await supabase.from("disputes").insert({
      complainant_id: profile.user_id,
      subject: createForm.subject.trim(),
      description: createForm.description.trim() || null,
      transaction_id: createForm.transaction_id.trim() || null,
    }).select("id").single();
    if (error) { toast.error(error.message); setCreating(false); return; }
    await auditLog("dispute_created", data.id, { complainant_phone: createForm.phone, subject: createForm.subject });
    toast.success("Dispute created");
    setCreateForm({ phone: "", subject: "", description: "", transaction_id: "" });
    setShowCreate(false);
    setCreating(false);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("disputes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await auditLog("dispute_deleted", id, {});
    toast.success("Dispute deleted");
    setViewing(null);
    load();
  };

  const filtered = filter === "all" ? disputes : disputes.filter(d => d.status === filter);
  const openCount = disputes.filter(d => d.status === "open").length;
  const reviewCount = disputes.filter(d => d.status === "under_review").length;

  return (
    <div className="space-y-4">
      <RealtimeUpdateIndicator visible={realtimeVisible} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" /> Dispute Resolution
          </h3>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {reviewCount} under review
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create Dispute</Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Disputes</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Subject</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Txn ID</th>
                  <th className="text-left px-4 py-3 font-medium">Filed</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate">{d.subject}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[d.status] ?? ""}`}>
                        {d.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground hidden md:table-cell">
                      {d.transaction_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openView(d)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {(d.status === "resolved" || d.status === "rejected") && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Dispute?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently remove this dispute record.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(d.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12">
              <Scale className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No disputes found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View/Update Dialog */}
      <Dialog open={!!viewing} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute Details</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-muted-foreground text-xs">Subject</Label>
                <p className="font-medium text-foreground">{viewing.subject}</p>
              </div>
              {viewing.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">Description</Label>
                  <p className="text-sm text-foreground">{viewing.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Complainant</Label>
                  <p className="font-mono text-xs">{viewing.complainant_id.slice(0, 12)}…</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Transaction</Label>
                  <p className="font-mono text-xs">{viewing.transaction_id?.slice(0, 12) ?? "N/A"}</p>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resolution Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about the resolution…" />
              </div>
              <Button className="w-full" onClick={handleUpdate}>Update Dispute</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dispute Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Dispute</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>User Phone</Label>
              <Input placeholder="01XXXXXXXXX" value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} />
            </div>
            <div>
              <Label>Subject</Label>
              <Input placeholder="Dispute subject" value={createForm.subject} onChange={e => setCreateForm({ ...createForm, subject: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Details…" value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Transaction ID (optional)</Label>
              <Input placeholder="Transaction UUID" value={createForm.transaction_id} onChange={e => setCreateForm({ ...createForm, transaction_id: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={creating} onClick={handleCreate}>{creating ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
