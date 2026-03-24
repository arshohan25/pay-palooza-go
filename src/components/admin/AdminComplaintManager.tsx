import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "support_complaint", entity_id: entityId, details
    });
  }
}

export default function AdminComplaintManager() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("support_complaints").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setComplaints(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateComplaint = async (id: string, updates: Record<string, any>) => {
    setSaving(true);
    const old = selected;
    const { error } = await supabase.from("support_complaints").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await auditLog("complaint_updated", id, { old_status: old?.status, new_status: updates.status, priority: updates.priority });
      toast.success("Complaint updated");
      await fetch();
      setSelected(null);
    }
    setSaving(false);
  };

  const deleteComplaint = async (id: string) => {
    const { error } = await supabase.from("support_complaints").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await auditLog("complaint_deleted", id, {});
    toast.success("Complaint deleted");
    setSelected(null);
    fetch();
  };

  const counts = {
    open: complaints.filter(c => c.status === "open").length,
    in_progress: complaints.filter(c => c.status === "in_progress").length,
    resolved: complaints.filter(c => c.status === "resolved").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Complaint Manager</h3>
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw size={14} className="mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{counts.open}</p>
          <p className="text-xs text-muted-foreground">Open</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{counts.in_progress}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{counts.resolved}</p>
          <p className="text-xs text-muted-foreground">Resolved</p>
        </CardContent></Card>
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : complaints.length === 0 ? (
        <p className="text-sm text-muted-foreground">No complaints found</p>
      ) : (
        <div className="space-y-2">
          {complaints.map(c => (
            <Card key={c.id} className="border border-border/50 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => { setSelected(c); setNotes(c.resolution_notes ?? ""); }}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{c.complaint_number}</span>
                  <div className="flex gap-1 items-center">
                    <Badge className={`text-[10px] ${PRIORITY_COLORS[c.priority] ?? ""}`}>{c.priority}</Badge>
                    <Badge className={`text-[10px] ${STATUS_COLORS[c.status] ?? ""}`}>{c.status}</Badge>
                    {c.status === "resolved" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={e => e.stopPropagation()}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Complaint?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove complaint {c.complaint_number}.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteComplaint(c.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground">{c.subject}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Complaint: {selected?.complaint_number}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Subject:</span> <span className="text-foreground font-medium">{selected.subject}</span></div>
              <div><span className="text-muted-foreground">Description:</span> <p className="text-foreground mt-1">{selected.description || "—"}</p></div>
              <div className="flex gap-2">
                <Badge className={PRIORITY_COLORS[selected.priority] ?? ""}>{selected.priority}</Badge>
                <Badge className={STATUS_COLORS[selected.status] ?? ""}>{selected.status}</Badge>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Update Status</label>
                <Select value={selected.status} onValueChange={(v) => setSelected({ ...selected, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Update Priority</label>
                <Select value={selected.priority} onValueChange={(v) => setSelected({ ...selected, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Resolution Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button disabled={saving} onClick={() => updateComplaint(selected.id, { status: selected.status, priority: selected.priority, resolution_notes: notes })}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
