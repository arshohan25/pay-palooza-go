import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Truck, Pencil } from "lucide-react";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "courier_provider", entity_id: entityId, details });
  }
}

export default function AdminCourierProviders() {
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", logo_url: "", tracking_url_template: "" });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", logo_url: "", tracking_url_template: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("courier_providers").select("*").order("created_at", { ascending: false });
    setProviders(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const { data, error } = await supabase.from("courier_providers").insert({
      name: form.name.trim(),
      logo_url: form.logo_url.trim() || null,
      tracking_url_template: form.tracking_url_template.trim() || null,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Courier added");
    if (data) await auditLog("courier_created", data.id, { name: form.name.trim() });
    setForm({ name: "", logo_url: "", tracking_url_template: "" });
    setShowCreate(false);
    load();
  };

  const toggle = async (id: string, current: boolean) => {
    await supabase.from("courier_providers").update({ is_active: !current }).eq("id", id);
    toast.success(current ? "Deactivated" : "Activated");
    await auditLog("courier_toggled", id, { is_active: !current });
    load();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("courier_providers").delete().eq("id", deleteTarget.id);
    toast.success("Courier deleted");
    await auditLog("courier_deleted", deleteTarget.id, { name: deleteTarget.name });
    setDeleteTarget(null);
    load();
  };

  const openEdit = (p: any) => {
    setEditTarget(p);
    setEditForm({ name: p.name, logo_url: p.logo_url || "", tracking_url_template: p.tracking_url_template || "" });
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm.name.trim()) { toast.error("Name is required"); return; }
    const { error } = await supabase.from("courier_providers").update({
      name: editForm.name.trim(),
      logo_url: editForm.logo_url.trim() || null,
      tracking_url_template: editForm.tracking_url_template.trim() || null,
    }).eq("id", editTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Courier updated");
    await auditLog("courier_updated", editTarget.id, { name: editForm.name.trim() });
    setEditTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{providers.length} courier providers</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> Add Courier
        </Button>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {showCreate && (
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <Input placeholder="Courier name (e.g. Pathao)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Logo URL (optional)" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} />
            <Input placeholder="Tracking URL template (use {tracking_id})" value={form.tracking_url_template} onChange={e => setForm({ ...form, tracking_url_template: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" onClick={create}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : providers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No courier providers yet</div>
      ) : (
        <div className="space-y-2">
          {providers.map(p => (
            <Card key={p.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">{p.name}</p>
                  {p.tracking_url_template && (
                    <p className="text-xs text-muted-foreground truncate">{p.tracking_url_template}</p>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Switch checked={p.is_active} onCheckedChange={() => toggle(p.id, p.is_active)} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(p)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this courier provider.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Courier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Courier name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            <Input placeholder="Logo URL (optional)" value={editForm.logo_url} onChange={e => setEditForm({ ...editForm, logo_url: e.target.value })} />
            <Input placeholder="Tracking URL template" value={editForm.tracking_url_template} onChange={e => setEditForm({ ...editForm, tracking_url_template: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
