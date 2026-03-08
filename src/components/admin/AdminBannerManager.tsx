import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, GripVertical, Image } from "lucide-react";
import { toast } from "sonner";
import { icons } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  icon: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
  expires_at: string | null;
  created_at: string;
}

const ICON_OPTIONS = ["Gift", "Zap", "Star", "Heart", "ShieldCheck", "Sparkles", "Trophy", "Megaphone", "PartyPopper", "Rocket", "Tag", "Percent", "BadgeDollarSign", "Crown"];

const emptyForm = {
  title: "",
  subtitle: "",
  badge_text: "Limited Offer",
  icon: "Gift",
  gradient_from: "#0ea5e9",
  gradient_to: "#06b6d4",
  link_url: "",
  is_active: true,
  sort_order: 0,
  expires_at: "",
};

export default function AdminBannerManager() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("promo_banners")
      .select("*")
      .order("sort_order");
    setBanners((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm, sort_order: banners.length });
    setDialogOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditId(b.id);
    setForm({
      title: b.title,
      subtitle: b.subtitle || "",
      badge_text: b.badge_text || "",
      icon: b.icon || "Gift",
      gradient_from: b.gradient_from || "#0ea5e9",
      gradient_to: b.gradient_to || "#06b6d4",
      link_url: b.link_url || "",
      is_active: b.is_active,
      sort_order: b.sort_order,
      expires_at: b.expires_at ? b.expires_at.slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      badge_text: form.badge_text.trim() || null,
      icon: form.icon,
      gradient_from: form.gradient_from,
      gradient_to: form.gradient_to,
      link_url: form.link_url.trim() || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };

    if (editId) {
      const { error } = await supabase.from("promo_banners").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Banner updated");
    } else {
      const { error } = await supabase.from("promo_banners").insert(payload);
      if (error) toast.error(error.message); else toast.success("Banner created");
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const deleteBanner = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("promo_banners").delete().eq("id", deleteId);
    if (error) toast.error(error.message); else toast.success("Banner deleted");
    setDeleteId(null);
    load();
  };

  const toggleActive = async (b: Banner) => {
    await supabase.from("promo_banners").update({ is_active: !b.is_active }).eq("id", b.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Image className="w-5 h-5" /> Promo Banners
        </h2>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" /> Add Banner</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading…</div>
      ) : banners.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No banners yet. Add your first promo banner above.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => {
            const IconComp = (icons as any)[b.icon || "Gift"] || icons.Gift;
            return (
              <Card key={b.id} className="overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${b.gradient_from}, ${b.gradient_to})` }}
                  >
                    <IconComp className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.subtitle || "No subtitle"}</p>
                  </div>
                  <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {b.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                  <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Banner" : "Add Banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Invite Friends & Earn ৳50" />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Optional description" />
            </div>
            <div>
              <Label>Badge Text</Label>
              <Input value={form.badge_text} onChange={(e) => setForm({ ...form, badge_text: e.target.value })} placeholder="Limited Offer" />
            </div>
            <div>
              <Label>Icon</Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {ICON_OPTIONS.map((name) => {
                  const IC = (icons as any)[name];
                  return IC ? (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm({ ...form, icon: name })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${form.icon === name ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                    >
                      <IC className="w-4 h-4" />
                    </button>
                  ) : null;
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gradient From</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={form.gradient_from} onChange={(e) => setForm({ ...form, gradient_from: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={form.gradient_from} onChange={(e) => setForm({ ...form, gradient_from: e.target.value })} className="text-xs" />
                </div>
              </div>
              <div>
                <Label>Gradient To</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={form.gradient_to} onChange={(e) => setForm({ ...form, gradient_to: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                  <Input value={form.gradient_to} onChange={(e) => setForm({ ...form, gradient_to: e.target.value })} className="text-xs" />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div>
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div
                className="rounded-xl p-4 mt-1"
                style={{ background: `linear-gradient(135deg, ${form.gradient_from}, ${form.gradient_to})` }}
              >
                {form.badge_text && <span className="inline-block bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">{form.badge_text}</span>}
                <p className="text-white text-sm font-bold">{form.title || "Banner Title"}</p>
                {form.subtitle && <p className="text-white/80 text-xs mt-0.5">{form.subtitle}</p>}
              </div>
            </div>
            <div>
              <Label>Link URL (optional)</Label>
              <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Expires At</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Banner?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBanner}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
