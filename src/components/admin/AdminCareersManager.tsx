import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Briefcase, Users, ChevronDown, ChevronUp, Pencil } from "lucide-react";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "job_listing", entity_id: entityId, details
    });
  }
}

export default function AdminCareersManager() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [applications, setApplications] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState({ title: "", department: "", location: "Bangladesh", type: "full-time", description: "", requirements: "" });
  const [editingJob, setEditingJob] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", department: "", location: "", type: "", description: "", requirements: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("job_listings").select("*").order("created_at", { ascending: false });
    setJobs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const { data, error } = await supabase.from("job_listings").insert({
      title: form.title.trim(),
      department: form.department.trim() || null,
      location: form.location.trim(),
      type: form.type,
      description: form.description.trim() || null,
      requirements: form.requirements.trim() || null,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await auditLog("job_created", data.id, { title: form.title });
    toast.success("Job posted");
    setForm({ title: "", department: "", location: "Bangladesh", type: "full-time", description: "", requirements: "" });
    setShowCreate(false);
    load();
  };

  const toggle = async (id: string, current: boolean) => {
    await supabase.from("job_listings").update({ is_active: !current }).eq("id", id);
    await auditLog("job_toggled", id, { is_active: !current });
    toast.success(current ? "Job hidden" : "Job published");
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("job_listings").delete().eq("id", id);
    await auditLog("job_deleted", id, {});
    toast.success("Job deleted");
    load();
  };

  const openEdit = (j: any) => {
    setEditingJob(j);
    setEditForm({
      title: j.title ?? "",
      department: j.department ?? "",
      location: j.location ?? "",
      type: j.type ?? "full-time",
      description: j.description ?? "",
      requirements: j.requirements ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingJob) return;
    const { error } = await supabase.from("job_listings").update({
      title: editForm.title.trim(),
      department: editForm.department.trim() || null,
      location: editForm.location.trim(),
      type: editForm.type,
      description: editForm.description.trim() || null,
      requirements: editForm.requirements.trim() || null,
    }).eq("id", editingJob.id);
    if (error) { toast.error(error.message); return; }
    await auditLog("job_edited", editingJob.id, { title: editForm.title });
    toast.success("Job updated");
    setEditingJob(null);
    load();
  };

  const loadApps = async (jobId: string) => {
    if (expandedJob === jobId) { setExpandedJob(null); return; }
    const { data } = await supabase.from("job_applications").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
    setApplications(prev => ({ ...prev, [jobId]: data ?? [] }));
    setExpandedJob(jobId);
  };

  const updateAppStatus = async (appId: string, jobId: string, status: string) => {
    await supabase.from("job_applications").update({ status }).eq("id", appId);
    await auditLog("application_" + status, appId, { job_id: jobId });
    toast.success(`Marked as ${status}`);
    loadApps(jobId);
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    shortlisted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{jobs.length} job listings</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> Post Job
        </Button>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {showCreate && (
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Job title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
              <Input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
            <Textarea placeholder="Job description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
            <Textarea placeholder="Requirements (one per line)" value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={create}>Publish</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No job listings yet</div>
      ) : (
        <div className="space-y-2">
          {jobs.map(j => (
            <Card key={j.id} className="border shadow-sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{j.title}</p>
                    <p className="text-xs text-muted-foreground">{j.department || "—"} · {j.location} · {j.type}</p>
                  </div>
                  <Switch checked={j.is_active} onCheckedChange={() => toggle(j.id, j.is_active)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(j)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadApps(j.id)}>
                    {expandedJob === j.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Job Listing?</AlertDialogTitle>
                        <AlertDialogDescription>"{j.title}" and all associated applications will be affected.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(j.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {expandedJob === j.id && (
                  <div className="pl-6 space-y-2 pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {applications[j.id]?.length || 0} applications
                    </p>
                    {(applications[j.id] || []).map(a => (
                      <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground">{a.applicant_name}</p>
                          <p className="text-[10px] text-muted-foreground">{a.applicant_phone} · {a.applicant_email || "—"}</p>
                          {a.cover_note && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.cover_note}</p>}
                        </div>
                        <Badge className={`text-[10px] ${STATUS_COLORS[a.status] || ""}`}>{a.status}</Badge>
                        {a.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => updateAppStatus(a.id, j.id, "shortlisted")}>Shortlist</Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => updateAppStatus(a.id, j.id, "rejected")}>Reject</Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {(applications[j.id] || []).length === 0 && (
                      <p className="text-xs text-muted-foreground">No applications yet</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Job Dialog */}
      <Dialog open={!!editingJob} onOpenChange={o => !o && setEditingJob(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Job title" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Department" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
              <Input placeholder="Location" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
            </div>
            <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
            <Textarea placeholder="Job description" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            <Textarea placeholder="Requirements" value={editForm.requirements} onChange={e => setEditForm({ ...editForm, requirements: e.target.value })} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingJob(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
