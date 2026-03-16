
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, Calendar, Palette } from "lucide-react";

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
  theme_palette: Record<string, string>;
  body_pattern: string;
}

type ThemePalette = Record<string, string>;

const PALETTE_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "Main brand color HSL" },
  { key: "primary-foreground", label: "Primary FG", hint: "Text on primary" },
  { key: "background", label: "Background", hint: "App background HSL" },
  { key: "foreground", label: "Foreground", hint: "Main text color HSL" },
  { key: "card", label: "Card", hint: "Card background HSL" },
  { key: "card-foreground", label: "Card FG", hint: "Card text HSL" },
  { key: "muted", label: "Muted", hint: "Muted background HSL" },
  { key: "muted-foreground", label: "Muted FG", hint: "Muted text HSL" },
  { key: "border", label: "Border", hint: "Border color HSL" },
  { key: "ring", label: "Ring", hint: "Focus ring HSL" },
  { key: "accent", label: "Accent", hint: "Accent color HSL" },
  { key: "accent-foreground", label: "Accent FG", hint: "Text on accent" },
];

const GRADIENT_FIELDS: { key: string; label: string }[] = [
  { key: "gradient-hero", label: "Hero Gradient" },
  { key: "gradient-primary", label: "Primary Gradient" },
  { key: "shadow-glow", label: "Glow Shadow" },
];

interface PresetData {
  name: string;
  emoji: string;
  greeting: string;
  gradient: string;
  accent: string;
  effect: string;
  palette: ThemePalette;
  body_pattern: string;
}

const PRESETS: Record<string, PresetData> = {
  ramadan: {
    name: "Ramadan Mubarak", emoji: "🌙",
    greeting: "Ramadan Mubarak! Wishing you a blessed month 🌙",
    gradient: "linear-gradient(135deg, hsl(245 60% 18%), hsl(270 50% 25%), hsl(220 50% 15%))",
    accent: "hsl(270 60% 55%)", effect: "crescents", body_pattern: "crescents",
    palette: {
      "primary": "270 60% 55%", "primary-foreground": "0 0% 100%",
      "background": "245 30% 12%", "foreground": "240 20% 92%",
      "card": "250 25% 16%", "card-foreground": "240 20% 92%",
      "muted": "250 20% 20%", "muted-foreground": "240 15% 56%",
      "border": "250 18% 22%", "ring": "270 60% 55%",
      "accent": "45 80% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(270 60% 30%) 0%, hsl(250 50% 20%) 60%, hsl(230 45% 15%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(270 60% 45%), hsl(250 50% 35%))",
      "shadow-glow": "0 0 0 1px hsl(270 60% 55% / 0.1), 0 4px 24px -4px hsl(270 60% 55% / 0.3)",
    },
  },
  eid_fitr: {
    name: "Eid Ul Fitr", emoji: "☪️",
    greeting: "Eid Mubarak! May your celebrations be joyful ☪️",
    gradient: "linear-gradient(135deg, hsl(160 60% 20%), hsl(170 50% 28%))",
    accent: "hsl(160 60% 45%)", effect: "sparkles", body_pattern: "sparkles",
    palette: {
      "primary": "160 60% 45%", "primary-foreground": "0 0% 100%",
      "background": "170 30% 10%", "foreground": "160 20% 92%",
      "card": "168 25% 14%", "card-foreground": "160 20% 92%",
      "muted": "168 20% 18%", "muted-foreground": "160 15% 56%",
      "border": "168 18% 20%", "ring": "160 60% 45%",
      "accent": "45 90% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(160 60% 30%) 0%, hsl(170 50% 22%) 60%, hsl(45 70% 30%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(160 60% 40%), hsl(170 50% 30%))",
      "shadow-glow": "0 0 0 1px hsl(160 60% 45% / 0.1), 0 4px 24px -4px hsl(160 60% 45% / 0.3)",
    },
  },
  eid_adha: {
    name: "Eid Ul Adha", emoji: "🐑",
    greeting: "Eid Ul Adha Mubarak! Blessed sacrifice 🐑",
    gradient: "linear-gradient(135deg, hsl(35 70% 25%), hsl(25 60% 30%))",
    accent: "hsl(35 70% 50%)", effect: "stars", body_pattern: "stars",
    palette: {
      "primary": "35 70% 50%", "primary-foreground": "0 0% 100%",
      "background": "30 25% 10%", "foreground": "35 20% 92%",
      "card": "32 22% 14%", "card-foreground": "35 20% 92%",
      "muted": "32 18% 18%", "muted-foreground": "30 15% 56%",
      "border": "32 15% 20%", "ring": "35 70% 50%",
      "accent": "45 80% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(35 70% 35%) 0%, hsl(25 60% 22%) 60%, hsl(20 50% 15%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(35 70% 45%), hsl(25 60% 35%))",
      "shadow-glow": "0 0 0 1px hsl(35 70% 50% / 0.1), 0 4px 24px -4px hsl(35 70% 50% / 0.3)",
    },
  },
  pohela_boishakh: {
    name: "Pohela Boishakh", emoji: "🎨",
    greeting: "শুভ নববর্ষ! Happy Bangla New Year 🎨",
    gradient: "linear-gradient(135deg, hsl(0 70% 40%), hsl(30 80% 50%))",
    accent: "hsl(0 70% 50%)", effect: "petals", body_pattern: "petals",
    palette: {
      "primary": "0 70% 50%", "primary-foreground": "0 0% 100%",
      "background": "35 40% 94%", "foreground": "0 30% 15%",
      "card": "35 35% 97%", "card-foreground": "0 30% 15%",
      "muted": "35 30% 90%", "muted-foreground": "0 15% 45%",
      "border": "35 25% 85%", "ring": "0 70% 50%",
      "accent": "30 80% 50%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(0 70% 45%) 0%, hsl(20 75% 42%) 50%, hsl(40 80% 50%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(0 70% 48%), hsl(15 75% 42%))",
      "shadow-glow": "0 0 0 1px hsl(0 70% 50% / 0.1), 0 4px 24px -4px hsl(0 70% 50% / 0.25)",
    },
  },
  new_year: {
    name: "Happy New Year", emoji: "🎆",
    greeting: "Happy New Year! Cheers to new beginnings 🎆",
    gradient: "linear-gradient(135deg, hsl(220 80% 15%), hsl(260 60% 20%), hsl(300 50% 18%))",
    accent: "hsl(45 90% 55%)", effect: "fireworks", body_pattern: "fireworks",
    palette: {
      "primary": "230 80% 50%", "primary-foreground": "0 0% 100%",
      "background": "225 40% 8%", "foreground": "220 20% 92%",
      "card": "225 35% 12%", "card-foreground": "220 20% 92%",
      "muted": "225 30% 16%", "muted-foreground": "220 15% 56%",
      "border": "225 25% 18%", "ring": "230 80% 50%",
      "accent": "45 90% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(230 80% 35%) 0%, hsl(260 60% 25%) 60%, hsl(300 50% 20%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(230 80% 45%), hsl(260 60% 35%))",
      "shadow-glow": "0 0 0 1px hsl(230 80% 50% / 0.1), 0 4px 24px -4px hsl(230 80% 50% / 0.3)",
    },
  },
  christmas: {
    name: "Merry Christmas", emoji: "🎄",
    greeting: "Merry Christmas! Season's Greetings 🎄",
    gradient: "linear-gradient(135deg, hsl(0 70% 30%), hsl(140 60% 25%))",
    accent: "hsl(0 70% 50%)", effect: "snow", body_pattern: "snow",
    palette: {
      "primary": "0 70% 45%", "primary-foreground": "0 0% 100%",
      "background": "150 30% 10%", "foreground": "140 20% 92%",
      "card": "148 25% 14%", "card-foreground": "140 20% 92%",
      "muted": "148 20% 18%", "muted-foreground": "140 15% 56%",
      "border": "148 18% 20%", "ring": "0 70% 45%",
      "accent": "140 60% 40%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(0 70% 35%) 0%, hsl(140 60% 25%) 60%, hsl(150 40% 15%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(0 70% 40%), hsl(140 50% 30%))",
      "shadow-glow": "0 0 0 1px hsl(0 70% 45% / 0.1), 0 4px 24px -4px hsl(0 70% 45% / 0.3)",
    },
  },
  victory_day: {
    name: "Victory Day", emoji: "🇧🇩",
    greeting: "Happy Victory Day! 16th December 🇧🇩",
    gradient: "linear-gradient(135deg, hsl(150 80% 25%), hsl(0 70% 40%))",
    accent: "hsl(150 80% 40%)", effect: "confetti", body_pattern: "confetti",
    palette: {
      "primary": "150 80% 35%", "primary-foreground": "0 0% 100%",
      "background": "155 35% 8%", "foreground": "150 20% 92%",
      "card": "153 30% 12%", "card-foreground": "150 20% 92%",
      "muted": "153 25% 16%", "muted-foreground": "150 15% 56%",
      "border": "153 20% 18%", "ring": "150 80% 35%",
      "accent": "0 70% 50%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(150 80% 30%) 0%, hsl(0 70% 35%) 60%, hsl(155 35% 12%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(150 80% 32%), hsl(155 60% 22%))",
      "shadow-glow": "0 0 0 1px hsl(150 80% 35% / 0.1), 0 4px 24px -4px hsl(150 80% 35% / 0.3)",
    },
  },
  independence_day: {
    name: "Independence Day", emoji: "🇧🇩",
    greeting: "Happy Independence Day! 26th March 🇧🇩",
    gradient: "linear-gradient(135deg, hsl(150 80% 25%), hsl(45 90% 50%))",
    accent: "hsl(150 80% 40%)", effect: "confetti", body_pattern: "confetti",
    palette: {
      "primary": "150 80% 35%", "primary-foreground": "0 0% 100%",
      "background": "155 35% 8%", "foreground": "150 20% 92%",
      "card": "153 30% 12%", "card-foreground": "150 20% 92%",
      "muted": "153 25% 16%", "muted-foreground": "150 15% 56%",
      "border": "153 20% 18%", "ring": "150 80% 35%",
      "accent": "45 90% 50%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(150 80% 30%) 0%, hsl(45 90% 42%) 60%, hsl(155 35% 12%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(150 80% 32%), hsl(155 60% 22%))",
      "shadow-glow": "0 0 0 1px hsl(150 80% 35% / 0.1), 0 4px 24px -4px hsl(150 80% 35% / 0.3)",
    },
  },
  durga_puja: {
    name: "Durga Puja", emoji: "🪷",
    greeting: "Shubho Durga Puja! 🪷",
    gradient: "linear-gradient(135deg, hsl(330 60% 30%), hsl(45 80% 45%))",
    accent: "hsl(330 60% 50%)", effect: "leaves", body_pattern: "leaves",
    palette: {
      "primary": "330 60% 50%", "primary-foreground": "0 0% 100%",
      "background": "340 30% 12%", "foreground": "330 20% 92%",
      "card": "338 25% 16%", "card-foreground": "330 20% 92%",
      "muted": "338 20% 20%", "muted-foreground": "330 15% 56%",
      "border": "338 18% 22%", "ring": "330 60% 50%",
      "accent": "45 80% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(330 60% 38%) 0%, hsl(340 50% 28%) 60%, hsl(45 70% 35%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(330 60% 45%), hsl(340 50% 35%))",
      "shadow-glow": "0 0 0 1px hsl(330 60% 50% / 0.1), 0 4px 24px -4px hsl(330 60% 50% / 0.3)",
    },
  },
  arabic_new_year: {
    name: "Hijri New Year", emoji: "🕌",
    greeting: "Happy Islamic New Year! 🕌",
    gradient: "linear-gradient(135deg, hsl(150 50% 18%), hsl(160 40% 25%))",
    accent: "hsl(150 50% 40%)", effect: "stars", body_pattern: "stars",
    palette: {
      "primary": "150 50% 40%", "primary-foreground": "0 0% 100%",
      "background": "155 30% 10%", "foreground": "150 20% 92%",
      "card": "153 25% 14%", "card-foreground": "150 20% 92%",
      "muted": "153 20% 18%", "muted-foreground": "150 15% 56%",
      "border": "153 18% 20%", "ring": "150 50% 40%",
      "accent": "45 70% 50%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(150 50% 28%) 0%, hsl(160 40% 20%) 60%, hsl(155 35% 12%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(150 50% 35%), hsl(160 40% 25%))",
      "shadow-glow": "0 0 0 1px hsl(150 50% 40% / 0.1), 0 4px 24px -4px hsl(150 50% 40% / 0.3)",
    },
  },
  custom: {
    name: "", emoji: "🎉", greeting: "",
    gradient: "linear-gradient(135deg, hsl(200 60% 20%), hsl(220 50% 30%))",
    accent: "hsl(200 60% 50%)", effect: "none", body_pattern: "none",
    palette: {},
  },
};

const EFFECTS = ["none", "stars", "lanterns", "confetti", "snow", "fireworks", "petals", "crescents", "hearts", "leaves", "sparkles"];
const BODY_PATTERNS = ["none", "stars", "crescents", "petals", "snow", "confetti", "fireworks", "sparkles", "leaves", "hearts"];

interface FormState {
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
  theme_palette: ThemePalette;
  body_pattern: string;
}

const emptyForm = (): FormState => ({
  name: "", preset_key: "custom", greeting_text: "", accent_color: null, emoji: "🎉",
  overlay_effect: "none", banner_gradient: null, is_active: false, starts_at: null, ends_at: null,
  theme_palette: {}, body_pattern: "none",
});

export default function AdminFestivalThemes() {
  const [themes, setThemes] = useState<FestivalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FestivalTheme | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<FestivalTheme | null>(null);

  const fetchThemes = async () => {
    setLoading(true);
    const { data } = await supabase.from("festival_themes").select("*").order("created_at", { ascending: false });
    setThemes((data as unknown as FestivalTheme[]) || []);
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
      theme_palette: { ...p.palette },
      body_pattern: p.body_pattern,
    }));
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDialogOpen(true); };

  const openEdit = (t: FestivalTheme) => {
    setEditing(t);
    setForm({
      name: t.name, preset_key: t.preset_key, greeting_text: t.greeting_text,
      accent_color: t.accent_color, emoji: t.emoji, overlay_effect: t.overlay_effect,
      banner_gradient: t.banner_gradient, is_active: t.is_active,
      starts_at: t.starts_at, ends_at: t.ends_at,
      theme_palette: t.theme_palette || {},
      body_pattern: t.body_pattern || "none",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.greeting_text.trim()) { toast.error("Greeting text is required"); return; }

    if (form.is_active) {
      await supabase.from("festival_themes").update({ is_active: false, updated_at: new Date().toISOString() } as any).eq("is_active", true);
    }

    const payload = {
      name: form.name, preset_key: form.preset_key, greeting_text: form.greeting_text,
      accent_color: form.accent_color, emoji: form.emoji, overlay_effect: form.overlay_effect,
      banner_gradient: form.banner_gradient, is_active: form.is_active,
      starts_at: form.starts_at, ends_at: form.ends_at,
      theme_palette: form.theme_palette, body_pattern: form.body_pattern,
      updated_at: new Date().toISOString(),
    };

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

  const updatePaletteField = (key: string, value: string) => {
    setForm(f => ({ ...f, theme_palette: { ...f.theme_palette, [key]: value } }));
  };

  const paletteCount = Object.keys(form.theme_palette).filter(k => form.theme_palette[k]).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Festival Themes</h2>
          <p className="text-sm text-muted-foreground">Full-app seasonal theming — colors, gradients, particles</p>
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
            const hasPalette = t.theme_palette && Object.keys(t.theme_palette).length > 0;
            return (
              <Card key={t.id} className={`relative overflow-hidden transition-all ${status === "active" ? "ring-2 ring-primary" : ""}`}>
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
                    {hasPalette && <Badge variant="outline" className="text-xs"><Palette className="w-3 h-3 mr-0.5" />Full Palette</Badge>}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Theme" : "Create Theme"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1">Basic</TabsTrigger>
              <TabsTrigger value="palette" className="flex-1">
                <Palette className="w-3.5 h-3.5 mr-1" />Palette{paletteCount > 0 && ` (${paletteCount})`}
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
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
                <p className="text-xs text-muted-foreground mt-1">Selecting a preset auto-fills the full color palette</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Festival name" /></div>
                <div><Label>Emoji</Label><Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🎉" /></div>
              </div>
              <div><Label>Greeting Text</Label><Input value={form.greeting_text} onChange={e => setForm(f => ({ ...f, greeting_text: e.target.value }))} placeholder="Greeting message…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Overlay Effect</Label>
                  <Select value={form.overlay_effect} onValueChange={v => setForm(f => ({ ...f, overlay_effect: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{EFFECTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Body Pattern</Label>
                  <Select value={form.body_pattern} onValueChange={v => setForm(f => ({ ...f, body_pattern: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BODY_PATTERNS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Banner Gradient (CSS)</Label><Input value={form.banner_gradient || ""} onChange={e => setForm(f => ({ ...f, banner_gradient: e.target.value }))} placeholder="linear-gradient(…)" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Starts At</Label><Input type="datetime-local" value={form.starts_at?.slice(0, 16) || ""} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
                <div><Label>Ends At</Label><Input type="datetime-local" value={form.ends_at?.slice(0, 16) || ""} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
              </div>
            </TabsContent>

            <TabsContent value="palette" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Override CSS variables to transform the entire app's appearance. HSL format: <code className="text-xs bg-muted px-1 rounded">270 60% 55%</code></p>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Color Variables</h3>
                <div className="grid grid-cols-2 gap-3">
                  {PALETTE_FIELDS.map(f => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={form.theme_palette[f.key] || ""}
                          onChange={e => updatePaletteField(f.key, e.target.value)}
                          placeholder={f.hint}
                          className="text-xs"
                        />
                        {form.theme_palette[f.key] && (
                          <div
                            className="w-6 h-6 rounded-md border border-border shrink-0"
                            style={{ background: `hsl(${form.theme_palette[f.key]})` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Gradients & Shadows</h3>
                <div className="space-y-3">
                  {GRADIENT_FIELDS.map(f => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        value={form.theme_palette[f.key] || ""}
                        onChange={e => updatePaletteField(f.key, e.target.value)}
                        placeholder={f.key.includes("gradient") ? "linear-gradient(…)" : "0 0 0 1px hsl(…)"}
                        className="text-xs"
                      />
                      {form.theme_palette[f.key] && f.key.includes("gradient") && (
                        <div className="h-4 rounded mt-1" style={{ background: form.theme_palette[f.key] }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4 space-y-4">
              {/* Banner preview */}
              <div>
                <Label className="mb-2 block">Banner Preview</Label>
                <div className="rounded-xl overflow-hidden" style={{ background: form.banner_gradient || "hsl(var(--muted))" }}>
                  <div className="px-4 py-5 text-center">
                    <span className="text-3xl block mb-1">{form.emoji}</span>
                    <p className="text-white font-semibold text-sm drop-shadow">{form.greeting_text || "Your greeting here…"}</p>
                  </div>
                </div>
              </div>

              {/* Palette preview */}
              {paletteCount > 0 && (
                <div>
                  <Label className="mb-2 block">Palette Preview</Label>
                  <div
                    className="rounded-xl p-4 space-y-3 border"
                    style={{
                      background: form.theme_palette.background ? `hsl(${form.theme_palette.background})` : undefined,
                      color: form.theme_palette.foreground ? `hsl(${form.theme_palette.foreground})` : undefined,
                      borderColor: form.theme_palette.border ? `hsl(${form.theme_palette.border})` : undefined,
                    }}
                  >
                    <div
                      className="rounded-lg p-3"
                      style={{
                        background: form.theme_palette["gradient-hero"] || form.theme_palette["gradient-primary"] || (form.theme_palette.primary ? `hsl(${form.theme_palette.primary})` : undefined),
                      }}
                    >
                      <p className="text-white text-sm font-bold">৳ 12,450.00</p>
                      <p className="text-white/70 text-xs">Available Balance</p>
                    </div>
                    <div
                      className="rounded-lg p-3"
                      style={{
                        background: form.theme_palette.card ? `hsl(${form.theme_palette.card})` : undefined,
                        color: form.theme_palette["card-foreground"] ? `hsl(${form.theme_palette["card-foreground"]})` : undefined,
                      }}
                    >
                      <p className="text-sm font-semibold">Card Element</p>
                      <p className="text-xs opacity-60">Sample card content</p>
                    </div>
                    <div className="flex gap-2">
                      <div
                        className="rounded-md px-3 py-1.5 text-xs font-medium"
                        style={{
                          background: form.theme_palette.primary ? `hsl(${form.theme_palette.primary})` : undefined,
                          color: form.theme_palette["primary-foreground"] ? `hsl(${form.theme_palette["primary-foreground"]})` : "#fff",
                        }}
                      >
                        Primary Button
                      </div>
                      <div
                        className="rounded-md px-3 py-1.5 text-xs font-medium"
                        style={{
                          background: form.theme_palette.accent ? `hsl(${form.theme_palette.accent})` : undefined,
                          color: form.theme_palette["accent-foreground"] ? `hsl(${form.theme_palette["accent-foreground"]})` : "#fff",
                        }}
                      >
                        Accent Button
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
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
              {previewTheme?.theme_palette && Object.keys(previewTheme.theme_palette).length > 0 && (
                <p className="text-white/70 text-xs mt-1">🎨 Full palette: {Object.keys(previewTheme.theme_palette).length} overrides</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
