import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Megaphone, Info, AlertTriangle, Wrench, CheckCircle } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const typeOptions = [
  { value: "info", label: "Info", icon: Info, color: "bg-blue-100 text-blue-700" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "bg-amber-100 text-amber-700" },
  { value: "maintenance", label: "Maintenance", icon: Wrench, color: "bg-orange-100 text-orange-700" },
  { value: "success", label: "Success", icon: CheckCircle, color: "bg-emerald-100 text-emerald-700" },
];

const emptyForm = { title: "", message: "", type: "info", priority: 0, starts_at: "", ends_at: "", is_active: true };

export default function AdminAnnouncementManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_announcements")
      .select("*")
      .order("priority", { ascending: false });
    if (data) setItems(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({
      title: a.title,
      message: a.message,
      type: a.type,
      priority: a.priority,
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : "",
      ends_at: a.ends_at ? a.ends_at.slice(0, 16) : "",
      is_active: a.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.message.trim()) { toast.error("Title and message required"); return; }
    const payload: any = {
      title: form.title,
      message: form.message,
      type: form.type,
      priority: form.priority,
      is_active: form.is_active,
      starts_at: form.starts_at || new Date().toISOString(),
      ends_at: form.ends_at || null,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      const { error } = await supabase.from("platform_announcements").update(payload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      toast.success("Announcement updated");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id;
      const { error } = await supabase.from("platform_announcements").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Announcement created");
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("platform_announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const toggleActive = async (id: string, val: boolean) => {
    await supabase.from("platform_announcements").update({ is_active: val, updated_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const activeCount = items.filter(i => i.is_active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Platform Announcements</h2>
          <Badge variant="secondary">{activeCount} Active</Badge>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No announcements yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map(a => {
            const t = typeOptions.find(o => o.value === a.type) || typeOptions[0];
            const TIcon = t.icon;
            const isExpired = a.ends_at && new Date(a.ends_at) < new Date();
            return (
              <Card key={a.id} className={`${!a.is_active || isExpired ? "opacity-60" : ""}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${t.color}`}><TIcon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{a.title}</span>
                      <Badge variant="outline" className="text-xs">{t.label}</Badge>
                      <Badge variant="outline" className="text-xs">P{a.priority}</Badge>
                      {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.starts_at && `From: ${new Date(a.starts_at).toLocaleDateString()}`}
                      {a.ends_at && ` · Until: ${new Date(a.ends_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={a.is_active} onCheckedChange={(v) => toggleActive(a.id, v)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Announcement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Message</Label><Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label><Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: +e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} /></div>
              <div><Label>Ends</Label><Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editId ? "Update" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
