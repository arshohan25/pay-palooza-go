
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, Calendar } from "lucide-react";

interface FestivalTheme {
  id: string;
  name: string;
  preset_key: string;
  greeting_text: string;
  accent_color: string | null;
  emoji: string;
  overlay_effect: string;
  banner_gradient: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const PRESETS: Record<string, { name: string; emoji: string; greeting: string; gradient: string; accent: string; effect: string }> = {
  ramadan: { name: "Ramadan Mubarak", emoji: "🌙", greeting: "Ramadan Mubarak! Wishing you a blessed month 🌙", gradient: "linear-gradient(135deg, hsl(245 60% 18%), hsl(270 50% 25%), hsl(220 50% 15%))", accent: "hsl(270 60% 55%)", effect: "crescents" },
  eid_fitr: { name: "Eid Ul Fitr", emoji: "☪️", greeting: "Eid Mubarak! May your celebrations be joyful ☪️", gradient: "linear-gradient(135deg, hsl(160 60% 20%), hsl(170 50% 28%))", accent: "hsl(160 60% 45%)", effect: "stars" },
  eid_adha: { name: "Eid Ul Adha", emoji: "🐑", greeting: "Eid Ul Adha Mubarak! Blessed sacrifice 🐑", gradient: "linear-gradient(135deg, hsl(35 70% 25%), hsl(25 60% 30%))", accent: "hsl(35 70% 50%)", effect: "stars" },
  new_year: { name: "Happy New Year", emoji: "🎆", greeting: "Happy New Year! Cheers to new beginnings 🎆", gradient: "linear-gradient(135deg, hsl(220 80% 15%), hsl(260 60% 20%), hsl(300 50% 18%))", accent: "hsl(45 90% 55%)", effect: "fireworks" },
  pohela_boishakh: { name: "Pohela Boishakh", emoji: "🎨", greeting: "শুভ নববর্ষ! Happy Bangla New Year 🎨", gradient: "linear-gradient(135deg, hsl(0 70% 40%), hsl(30 80% 50%))", accent: "hsl(0 70% 50%)", effect: "petals" },
  arabic_new_year: { name: "Hijri New Year", emoji: "🕌", greeting: "Happy Islamic New Year! 🕌", gradient: "linear-gradient(135deg, hsl(150 50% 18%), hsl(160 40% 25%))", accent: "hsl(150 50% 40%)", effect: "stars" },
  victory_day: { name: "Victory Day", emoji: "🇧🇩", greeting: "Happy Victory Day! 16th December 🇧🇩", gradient: "linear-gradient(135deg, hsl(150 80% 25%), hsl(0 70% 40%))", accent: "hsl(150 80% 40%)", effect: "confetti" },
  independence_day: { name: "Independence Day", emoji: "🇧🇩", greeting: "Happy Independence Day! 26th March 🇧🇩", gradient: "linear-gradient(135deg, hsl(150 80% 25%), hsl(45 90% 50%))", accent: "hsl(150 80% 40%)", effect: "confetti" },
  durga_puja: { name: "Durga Puja", emoji: "🪷", greeting: "Shubho Durga Puja! 🪷", gradient: "linear-gradient(135deg, hsl(330 60% 30%), hsl(45 80% 45%))", accent: "hsl(330 60% 50%)", effect: "leaves" },
  christmas: { name: "Merry Christmas", emoji: "🎄", greeting: "Merry Christmas! Season's Greetings 🎄", gradient: "linear-gradient(135deg, hsl(0 70% 30%), hsl(140 60% 25%))", accent: "hsl(0 70% 50%)", effect: "snow" },
  custom: { name: "", emoji: "🎉", greeting: "", gradient: "linear-gradient(135deg, hsl(200 60% 20%), hsl(220 50% 30%))", accent: "hsl(200 60% 50%)", effect: "none" },
};

const EFFECTS = ["none", "stars", "lanterns", "confetti", "snow", "fireworks"];

const emptyForm = (): Omit<FestivalTheme, "id" | "created_at" | "updated_at" | "created_by"> => ({
  name: "", preset_key: "custom", greeting_text: "", accent_color: null, emoji: "🎉",
  overlay_effect: "none", banner_gradient: null, is_active: false, starts_at: null, ends_at: null,
});

export default function AdminFestivalThemes() {
  const [themes, setThemes] = useState<FestivalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FestivalTheme | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<FestivalTheme | null>(null);

  const fetchThemes = async () => {
    setLoading(true);
    const { data } = await supabase.from("festival_themes").select("*").order("created_at", { ascending: false });
    setThemes((data as FestivalTheme[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchThemes(); }, []);

  const applyPreset = (key: string) => {
    const p = PRESETS[key];
    if (!p) return;
    setForm(f => ({
      ...f,
      preset_key: key,
      name: p.name || f.name,
      emoji: p.emoji,
      greeting_text: p.greeting || f.greeting_text,
      banner_gradient: p.gradient,
      accent_color: p.accent,
      overlay_effect: p.effect,
    }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (t: FestivalTheme) => {
    setEditing(t);
    setForm({
      name: t.name, preset_key: t.preset_key, greeting_text: t.greeting_text,
      accent_color: t.accent_color, emoji: t.emoji, overlay_effect: t.overlay_effect,
      banner_gradient: t.banner_gradient, is_active: t.is_active,
      starts_at: t.starts_at, ends_at: t.ends_at,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.greeting_text.trim()) { toast.error("Greeting text is required"); return; }

    // If activating, deactivate others first
    if (form.is_active) {
      await supabase.from("festival_themes").update({ is_active: false, updated_at: new Date().toISOString() } as any).eq("is_active", true);
    }

    const payload = { ...form, updated_at: new Date().toISOString() };

    if (editing) {
      const { error } = await supabase.from("festival_themes").update(payload as any).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Theme updated");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("festival_themes").insert({ ...payload, created_by: user?.id } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Theme created");
    }
    setDialogOpen(false);
    fetchThemes();
  };

  const toggleActive = async (t: FestivalTheme) => {
    if (!t.is_active) {
      await supabase.from("festival_themes").update({ is_active: false, updated_at: new Date().toISOString() } as any).eq("is_active", true);
    }
    await supabase.from("festival_themes").update({ is_active: !t.is_active, updated_at: new Date().toISOString() } as any).eq("id", t.id);
    toast.success(t.is_active ? "Theme deactivated" : "Theme activated");
    fetchThemes();
  };

  const deleteTheme = async (id: string) => {
    await supabase.from("festival_themes").delete().eq("id", id);
    toast.success("Theme deleted");
    fetchThemes();
  };

  const getStatus = (t: FestivalTheme) => {
    if (t.is_active) return "active";
    if (t.starts_at && new Date(t.starts_at) > new Date()) return "scheduled";
    return "inactive";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Festival Themes</h2>
          <p className="text-sm text-muted-foreground">Manage seasonal UI themes for the user app</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1" /> New Theme</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : themes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No festival themes yet. Create one to get started!</CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {themes.map(t => {
            const status = getStatus(t);
            return (
              <Card key={t.id} className={`relative overflow-hidden transition-all ${status === "active" ? "ring-2 ring-primary" : ""}`}>
                {/* Mini gradient preview */}
                <div className="h-16 w-full flex items-center justify-center text-2xl" style={{ background: t.banner_gradient || "hsl(var(--muted))" }}>
                  <span className="drop-shadow-lg text-3xl">{t.emoji}</span>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{t.greeting_text}</p>
                    </div>
                    <Badge variant={status === "active" ? "default" : status === "scheduled" ? "secondary" : "outline"}>
                      {status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{t.overlay_effect}</Badge>
                    <Badge variant="outline" className="text-xs">{t.preset_key}</Badge>
                    {t.starts_at && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{new Date(t.starts_at).toLocaleDateString()}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                    <span className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Inactive"}</span>
                    <div className="flex-1" />
                    <Button size="icon" variant="ghost" onClick={() => { setPreviewTheme(t); setPreviewOpen(true); }}><Eye className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Edit2 className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteTheme(t.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Theme" : "Create Theme"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Preset</Label>
              <Select value={form.preset_key} onValueChange={v => { setForm(f => ({ ...f, preset_key: v })); applyPreset(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRESETS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.emoji} {v.name || "Custom"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Festival name" />
              </div>
              <div>
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🎉" />
              </div>
            </div>
            <div>
              <Label>Greeting Text</Label>
              <Input value={form.greeting_text} onChange={e => setForm(f => ({ ...f, greeting_text: e.target.value }))} placeholder="Greeting message…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Accent Color</Label>
                <Input value={form.accent_color || ""} onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))} placeholder="hsl(270 60% 55%)" />
              </div>
              <div>
                <Label>Overlay Effect</Label>
                <Select value={form.overlay_effect} onValueChange={v => setForm(f => ({ ...f, overlay_effect: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EFFECTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Banner Gradient (CSS)</Label>
              <Input value={form.banner_gradient || ""} onChange={e => setForm(f => ({ ...f, banner_gradient: e.target.value }))} placeholder="linear-gradient(…)" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starts At</Label>
                <Input type="datetime-local" value={form.starts_at?.slice(0, 16) || ""} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </div>
              <div>
                <Label>Ends At</Label>
                <Input type="datetime-local" value={form.ends_at?.slice(0, 16) || ""} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </div>
            </div>

            {/* Live Preview */}
            <div>
              <Label className="mb-2 block">Preview</Label>
              <div className="rounded-xl overflow-hidden" style={{ background: form.banner_gradient || "hsl(var(--muted))" }}>
                <div className="px-4 py-5 text-center">
                  <span className="text-3xl block mb-1">{form.emoji}</span>
                  <p className="text-white font-semibold text-sm drop-shadow">{form.greeting_text || "Your greeting here…"}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="rounded-xl overflow-hidden" style={{ background: previewTheme?.banner_gradient || "hsl(var(--muted))" }}>
            <div className="px-6 py-8 text-center">
              <span className="text-5xl block mb-3">{previewTheme?.emoji}</span>
              <p className="text-white font-bold text-lg drop-shadow">{previewTheme?.greeting_text}</p>
              <p className="text-white/70 text-xs mt-2">Effect: {previewTheme?.overlay_effect}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
