
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
    accent: "hsl(270 60% 55%)", effect: "crescents", body_pattern: "arabesque",
    palette: {
      // Light mode
      "primary": "270 60% 50%", "primary-foreground": "0 0% 100%",
      "background": "260 25% 95%", "foreground": "250 30% 12%",
      "card": "265 20% 98%", "card-foreground": "250 30% 12%",
      "muted": "260 18% 91%", "muted-foreground": "250 15% 45%",
      "border": "260 16% 86%", "ring": "270 60% 50%",
      "accent": "45 80% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(270 60% 42%) 0%, hsl(250 50% 32%) 60%, hsl(230 45% 22%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(270 60% 48%), hsl(250 50% 38%))",
      "shadow-glow": "0 0 0 1px hsl(270 60% 50% / 0.12), 0 4px 24px -4px hsl(270 60% 50% / 0.25)",
      // Dark mode
      "dark-primary": "270 60% 58%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "245 30% 10%", "dark-foreground": "240 20% 93%",
      "dark-card": "250 25% 14%", "dark-card-foreground": "240 20% 93%",
      "dark-muted": "250 20% 18%", "dark-muted-foreground": "240 15% 58%",
      "dark-border": "250 18% 20%", "dark-ring": "270 60% 58%",
      "dark-accent": "45 80% 55%", "dark-accent-foreground": "0 0% 100%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(270 60% 28%) 0%, hsl(250 50% 18%) 60%, hsl(230 45% 12%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(270 60% 44%), hsl(250 50% 34%))",
      "dark-shadow-glow": "0 0 0 1px hsl(270 60% 58% / 0.15), 0 4px 24px -4px hsl(270 60% 58% / 0.35)",
    },
  },
  eid_fitr: {
    name: "Eid Ul Fitr", emoji: "☪️",
    greeting: "Eid Mubarak! May your celebrations be joyful ☪️",
    gradient: "linear-gradient(135deg, hsl(160 60% 30%), hsl(170 50% 38%), hsl(45 70% 45%))",
    accent: "hsl(160 60% 45%)", effect: "sparkles", body_pattern: "lanterns",
    palette: {
      "primary": "160 60% 40%", "primary-foreground": "0 0% 100%",
      "background": "165 20% 95%", "foreground": "160 30% 10%",
      "card": "165 18% 98%", "card-foreground": "160 30% 10%",
      "muted": "165 15% 91%", "muted-foreground": "160 12% 45%",
      "border": "165 14% 86%", "ring": "160 60% 40%",
      "accent": "45 90% 52%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(160 60% 36%) 0%, hsl(170 50% 28%) 60%, hsl(45 70% 38%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(160 60% 38%), hsl(170 50% 30%))",
      "shadow-glow": "0 0 0 1px hsl(160 60% 40% / 0.12), 0 4px 24px -4px hsl(160 60% 40% / 0.22)",
      "dark-primary": "160 60% 48%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "170 30% 8%", "dark-foreground": "160 20% 93%",
      "dark-card": "168 25% 12%", "dark-card-foreground": "160 20% 93%",
      "dark-muted": "168 20% 16%", "dark-muted-foreground": "160 15% 58%",
      "dark-border": "168 18% 18%", "dark-ring": "160 60% 48%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(160 60% 28%) 0%, hsl(170 50% 20%) 60%, hsl(45 70% 28%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(160 60% 38%), hsl(170 50% 28%))",
      "dark-shadow-glow": "0 0 0 1px hsl(160 60% 48% / 0.15), 0 4px 24px -4px hsl(160 60% 48% / 0.35)",
    },
  },
  eid_adha: {
    name: "Eid Ul Adha", emoji: "🐑",
    greeting: "Eid Ul Adha Mubarak! Blessed sacrifice 🐑",
    gradient: "linear-gradient(135deg, hsl(35 70% 35%), hsl(25 60% 42%))",
    accent: "hsl(35 70% 50%)", effect: "stars", body_pattern: "mosque",
    palette: {
      "primary": "35 70% 46%", "primary-foreground": "0 0% 100%",
      "background": "38 25% 95%", "foreground": "32 30% 12%",
      "card": "38 20% 98%", "card-foreground": "32 30% 12%",
      "muted": "38 18% 91%", "muted-foreground": "32 12% 45%",
      "border": "38 14% 86%", "ring": "35 70% 46%",
      "accent": "45 80% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(35 70% 40%) 0%, hsl(25 60% 30%) 60%, hsl(20 50% 22%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(35 70% 44%), hsl(25 60% 36%))",
      "shadow-glow": "0 0 0 1px hsl(35 70% 46% / 0.12), 0 4px 24px -4px hsl(35 70% 46% / 0.22)",
      "dark-primary": "35 70% 52%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "30 25% 8%", "dark-foreground": "35 20% 93%",
      "dark-card": "32 22% 12%", "dark-card-foreground": "35 20% 93%",
      "dark-muted": "32 18% 16%", "dark-muted-foreground": "30 15% 58%",
      "dark-border": "32 15% 18%", "dark-ring": "35 70% 52%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(35 70% 32%) 0%, hsl(25 60% 20%) 60%, hsl(20 50% 14%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(35 70% 42%), hsl(25 60% 32%))",
      "dark-shadow-glow": "0 0 0 1px hsl(35 70% 52% / 0.15), 0 4px 24px -4px hsl(35 70% 52% / 0.35)",
    },
  },
  pohela_boishakh: {
    name: "Pohela Boishakh", emoji: "🎨",
    greeting: "শুভ নববর্ষ! Happy Bangla New Year 🎨",
    gradient: "linear-gradient(135deg, hsl(0 70% 45%), hsl(30 80% 50%))",
    accent: "hsl(0 70% 50%)", effect: "petals", body_pattern: "rangoli",
    palette: {
      "primary": "0 70% 48%", "primary-foreground": "0 0% 100%",
      "background": "35 40% 96%", "foreground": "0 30% 12%",
      "card": "35 35% 99%", "card-foreground": "0 30% 12%",
      "muted": "35 30% 92%", "muted-foreground": "0 15% 45%",
      "border": "35 25% 87%", "ring": "0 70% 48%",
      "accent": "30 80% 50%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(0 70% 45%) 0%, hsl(20 75% 42%) 50%, hsl(40 80% 50%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(0 70% 46%), hsl(15 75% 40%))",
      "shadow-glow": "0 0 0 1px hsl(0 70% 48% / 0.1), 0 4px 24px -4px hsl(0 70% 48% / 0.22)",
      "dark-primary": "0 70% 55%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "15 25% 9%", "dark-foreground": "20 20% 93%",
      "dark-card": "15 22% 13%", "dark-card-foreground": "20 20% 93%",
      "dark-muted": "15 18% 17%", "dark-muted-foreground": "15 12% 58%",
      "dark-border": "15 15% 19%", "dark-ring": "0 70% 55%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(0 70% 38%) 0%, hsl(20 75% 32%) 50%, hsl(40 80% 38%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(0 70% 42%), hsl(15 75% 35%))",
      "dark-shadow-glow": "0 0 0 1px hsl(0 70% 55% / 0.15), 0 4px 24px -4px hsl(0 70% 55% / 0.3)",
    },
  },
  new_year: {
    name: "Happy New Year", emoji: "🎆",
    greeting: "Happy New Year! Cheers to new beginnings 🎆",
    gradient: "linear-gradient(135deg, hsl(220 80% 22%), hsl(260 60% 28%), hsl(300 50% 25%))",
    accent: "hsl(45 90% 55%)", effect: "fireworks", body_pattern: "fireworks",
    palette: {
      "primary": "230 80% 48%", "primary-foreground": "0 0% 100%",
      "background": "228 22% 95%", "foreground": "225 30% 12%",
      "card": "228 20% 98%", "card-foreground": "225 30% 12%",
      "muted": "228 16% 91%", "muted-foreground": "225 12% 45%",
      "border": "228 14% 86%", "ring": "230 80% 48%",
      "accent": "45 90% 55%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(230 80% 38%) 0%, hsl(260 60% 30%) 60%, hsl(300 50% 24%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(230 80% 44%), hsl(260 60% 36%))",
      "shadow-glow": "0 0 0 1px hsl(230 80% 48% / 0.12), 0 4px 24px -4px hsl(230 80% 48% / 0.22)",
      "dark-primary": "230 80% 55%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "225 40% 7%", "dark-foreground": "220 20% 93%",
      "dark-card": "225 35% 11%", "dark-card-foreground": "220 20% 93%",
      "dark-muted": "225 30% 15%", "dark-muted-foreground": "220 15% 58%",
      "dark-border": "225 25% 17%", "dark-ring": "230 80% 55%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(230 80% 30%) 0%, hsl(260 60% 22%) 60%, hsl(300 50% 18%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(230 80% 42%), hsl(260 60% 32%))",
      "dark-shadow-glow": "0 0 0 1px hsl(230 80% 55% / 0.15), 0 4px 24px -4px hsl(230 80% 55% / 0.35)",
    },
  },
  christmas: {
    name: "Merry Christmas", emoji: "🎄",
    greeting: "Merry Christmas! Season's Greetings 🎄",
    gradient: "linear-gradient(135deg, hsl(0 70% 35%), hsl(140 60% 30%))",
    accent: "hsl(0 70% 50%)", effect: "snow", body_pattern: "snow",
    palette: {
      "primary": "0 70% 44%", "primary-foreground": "0 0% 100%",
      "background": "145 18% 95%", "foreground": "148 28% 12%",
      "card": "145 15% 98%", "card-foreground": "148 28% 12%",
      "muted": "145 14% 91%", "muted-foreground": "148 10% 45%",
      "border": "145 12% 86%", "ring": "0 70% 44%",
      "accent": "140 60% 38%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(0 70% 38%) 0%, hsl(140 60% 28%) 60%, hsl(150 40% 18%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(0 70% 40%), hsl(140 50% 32%))",
      "shadow-glow": "0 0 0 1px hsl(0 70% 44% / 0.1), 0 4px 24px -4px hsl(0 70% 44% / 0.22)",
      "dark-primary": "0 70% 50%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "150 30% 8%", "dark-foreground": "140 20% 93%",
      "dark-card": "148 25% 12%", "dark-card-foreground": "140 20% 93%",
      "dark-muted": "148 20% 16%", "dark-muted-foreground": "140 15% 58%",
      "dark-border": "148 18% 18%", "dark-ring": "0 70% 50%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(0 70% 32%) 0%, hsl(140 60% 22%) 60%, hsl(150 40% 14%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(0 70% 38%), hsl(140 50% 28%))",
      "dark-shadow-glow": "0 0 0 1px hsl(0 70% 50% / 0.15), 0 4px 24px -4px hsl(0 70% 50% / 0.35)",
    },
  },
  victory_day: {
    name: "Victory Day", emoji: "🇧🇩",
    greeting: "Happy Victory Day! 16th December 🇧🇩",
    gradient: "linear-gradient(135deg, hsl(150 80% 30%), hsl(0 70% 40%))",
    accent: "hsl(150 80% 40%)", effect: "confetti", body_pattern: "confetti",
    palette: {
      "primary": "150 80% 32%", "primary-foreground": "0 0% 100%",
      "background": "152 18% 95%", "foreground": "155 28% 12%",
      "card": "152 15% 98%", "card-foreground": "155 28% 12%",
      "muted": "152 14% 91%", "muted-foreground": "150 10% 45%",
      "border": "152 12% 86%", "ring": "150 80% 32%",
      "accent": "0 70% 48%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(150 80% 28%) 0%, hsl(0 70% 35%) 60%, hsl(155 35% 15%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(150 80% 30%), hsl(155 60% 22%))",
      "shadow-glow": "0 0 0 1px hsl(150 80% 32% / 0.1), 0 4px 24px -4px hsl(150 80% 32% / 0.22)",
      "dark-primary": "150 80% 40%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "155 35% 7%", "dark-foreground": "150 20% 93%",
      "dark-card": "153 30% 11%", "dark-card-foreground": "150 20% 93%",
      "dark-muted": "153 25% 15%", "dark-muted-foreground": "150 15% 58%",
      "dark-border": "153 20% 17%", "dark-ring": "150 80% 40%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(150 80% 25%) 0%, hsl(0 70% 30%) 60%, hsl(155 35% 10%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(150 80% 28%), hsl(155 60% 18%))",
      "dark-shadow-glow": "0 0 0 1px hsl(150 80% 40% / 0.15), 0 4px 24px -4px hsl(150 80% 40% / 0.35)",
    },
  },
  independence_day: {
    name: "Independence Day", emoji: "🇧🇩",
    greeting: "Happy Independence Day! 26th March 🇧🇩",
    gradient: "linear-gradient(135deg, hsl(150 80% 30%), hsl(45 90% 50%))",
    accent: "hsl(150 80% 40%)", effect: "confetti", body_pattern: "confetti",
    palette: {
      "primary": "150 80% 32%", "primary-foreground": "0 0% 100%",
      "background": "152 18% 95%", "foreground": "155 28% 12%",
      "card": "152 15% 98%", "card-foreground": "155 28% 12%",
      "muted": "152 14% 91%", "muted-foreground": "150 10% 45%",
      "border": "152 12% 86%", "ring": "150 80% 32%",
      "accent": "45 90% 50%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(150 80% 28%) 0%, hsl(45 90% 42%) 60%, hsl(155 35% 15%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(150 80% 30%), hsl(155 60% 22%))",
      "shadow-glow": "0 0 0 1px hsl(150 80% 32% / 0.1), 0 4px 24px -4px hsl(150 80% 32% / 0.22)",
      "dark-primary": "150 80% 40%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "155 35% 7%", "dark-foreground": "150 20% 93%",
      "dark-card": "153 30% 11%", "dark-card-foreground": "150 20% 93%",
      "dark-muted": "153 25% 15%", "dark-muted-foreground": "150 15% 58%",
      "dark-border": "153 20% 17%", "dark-ring": "150 80% 40%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(150 80% 25%) 0%, hsl(45 90% 35%) 60%, hsl(155 35% 10%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(150 80% 28%), hsl(155 60% 18%))",
      "dark-shadow-glow": "0 0 0 1px hsl(150 80% 40% / 0.15), 0 4px 24px -4px hsl(150 80% 40% / 0.35)",
    },
  },
  durga_puja: {
    name: "Durga Puja", emoji: "🪷",
    greeting: "Shubho Durga Puja! 🪷",
    gradient: "linear-gradient(135deg, hsl(330 60% 38%), hsl(45 80% 48%))",
    accent: "hsl(330 60% 50%)", effect: "leaves", body_pattern: "leaves",
    palette: {
      "primary": "330 60% 48%", "primary-foreground": "0 0% 100%",
      "background": "335 18% 95%", "foreground": "338 28% 12%",
      "card": "335 15% 98%", "card-foreground": "338 28% 12%",
      "muted": "335 14% 91%", "muted-foreground": "335 10% 45%",
      "border": "335 12% 86%", "ring": "330 60% 48%",
      "accent": "45 80% 52%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(330 60% 42%) 0%, hsl(340 50% 32%) 60%, hsl(45 70% 38%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(330 60% 44%), hsl(340 50% 36%))",
      "shadow-glow": "0 0 0 1px hsl(330 60% 48% / 0.1), 0 4px 24px -4px hsl(330 60% 48% / 0.22)",
      "dark-primary": "330 60% 55%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "340 30% 10%", "dark-foreground": "330 20% 93%",
      "dark-card": "338 25% 14%", "dark-card-foreground": "330 20% 93%",
      "dark-muted": "338 20% 18%", "dark-muted-foreground": "330 15% 58%",
      "dark-border": "338 18% 20%", "dark-ring": "330 60% 55%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(330 60% 35%) 0%, hsl(340 50% 25%) 60%, hsl(45 70% 30%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(330 60% 42%), hsl(340 50% 32%))",
      "dark-shadow-glow": "0 0 0 1px hsl(330 60% 55% / 0.15), 0 4px 24px -4px hsl(330 60% 55% / 0.35)",
    },
  },
  arabic_new_year: {
    name: "Hijri New Year", emoji: "🕌",
    greeting: "Happy Islamic New Year! 🕌",
    gradient: "linear-gradient(135deg, hsl(150 50% 25%), hsl(160 40% 32%))",
    accent: "hsl(150 50% 40%)", effect: "stars", body_pattern: "stars",
    palette: {
      "primary": "150 50% 38%", "primary-foreground": "0 0% 100%",
      "background": "152 18% 95%", "foreground": "155 25% 12%",
      "card": "152 15% 98%", "card-foreground": "155 25% 12%",
      "muted": "152 14% 91%", "muted-foreground": "150 10% 45%",
      "border": "152 12% 86%", "ring": "150 50% 38%",
      "accent": "45 70% 48%", "accent-foreground": "0 0% 100%",
      "gradient-hero": "linear-gradient(150deg, hsl(150 50% 32%) 0%, hsl(160 40% 24%) 60%, hsl(155 35% 16%) 100%)",
      "gradient-primary": "linear-gradient(135deg, hsl(150 50% 35%), hsl(160 40% 28%))",
      "shadow-glow": "0 0 0 1px hsl(150 50% 38% / 0.1), 0 4px 24px -4px hsl(150 50% 38% / 0.22)",
      "dark-primary": "150 50% 45%", "dark-primary-foreground": "0 0% 100%",
      "dark-background": "155 30% 8%", "dark-foreground": "150 20% 93%",
      "dark-card": "153 25% 12%", "dark-card-foreground": "150 20% 93%",
      "dark-muted": "153 20% 16%", "dark-muted-foreground": "150 15% 58%",
      "dark-border": "153 18% 18%", "dark-ring": "150 50% 45%",
      "dark-gradient-hero": "linear-gradient(150deg, hsl(150 50% 26%) 0%, hsl(160 40% 18%) 60%, hsl(155 35% 10%) 100%)",
      "dark-gradient-primary": "linear-gradient(135deg, hsl(150 50% 32%), hsl(160 40% 22%))",
      "dark-shadow-glow": "0 0 0 1px hsl(150 50% 45% / 0.15), 0 4px 24px -4px hsl(150 50% 45% / 0.35)",
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
  const [previewDark, setPreviewDark] = useState(false);

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

            <TabsContent value="preview" className="mt-4 space-y-2">
              {/* Light / Dark toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Live Preview</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{previewDark ? "Dark" : "Light"}</span>
                  <Switch checked={previewDark} onCheckedChange={setPreviewDark} />
                </div>
              </div>

              {/* Phone mockup */}
              {(() => {
                const p = (key: string): string | undefined => {
                  if (previewDark) {
                    const dk = form.theme_palette[`dark-${key}`] || form.theme_palette[`dark_${key}`];
                    if (dk) return dk;
                  }
                  return form.theme_palette[key];
                };
                const hsl = (key: string) => p(key) ? `hsl(${p(key)})` : undefined;
                const bg = hsl("background") || (previewDark ? "#0a0a0a" : "#fafafa");
                const fg = hsl("foreground") || (previewDark ? "#fafafa" : "#0a0a0a");
                const primary = hsl("primary") || "hsl(var(--primary))";
                const primaryFg = hsl("primary-foreground") || "#fff";
                const card = hsl("card") || (previewDark ? "#111" : "#fff");
                const cardFg = hsl("card-foreground") || fg;
                const muted = hsl("muted") || (previewDark ? "#222" : "#eee");
                const mutedFg = hsl("muted-foreground") || (previewDark ? "#888" : "#666");
                const heroGrad = p("gradient-hero") || p("gradient-primary") || (p("primary") ? `linear-gradient(135deg, hsl(${p("primary")}), hsl(${p("primary")} / 0.7))` : primary);
                const glowShadow = p("shadow-glow") || `0 4px 20px ${primary}40`;
                const border = hsl("border") || (previewDark ? "#333" : "#ddd");

                return (
                  <div className="flex justify-center">
                    <div
                      className="relative rounded-[2rem] border-[3px] border-foreground/20 overflow-hidden shadow-xl"
                      style={{ width: 280, height: 520, background: bg }}
                    >
                      {/* Status bar */}
                      <div className="flex items-center justify-between px-5 pt-2 pb-1" style={{ color: fg }}>
                        <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.7 }}>9:41</span>
                        <div className="flex items-center gap-1" style={{ opacity: 0.5 }}>
                          <div style={{ width: 12, height: 7, border: `1px solid ${fg}`, borderRadius: 2, position: "relative" }}>
                            <div style={{ position: "absolute", inset: 1, background: fg, borderRadius: 1 }} />
                          </div>
                        </div>
                      </div>

                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-2" style={{ color: fg }}>
                        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.5 }}>EasyPay</span>
                        <div className="flex items-center gap-2">
                          <div style={{ width: 18, height: 18, borderRadius: 9, background: muted }} />
                          <div style={{ width: 18, height: 18, borderRadius: 9, background: muted }} />
                        </div>
                      </div>

                      {/* Festival banner */}
                      {(form.greeting_text || form.emoji) && (
                        <div className="mx-3 mb-2 rounded-xl overflow-hidden" style={{ background: form.banner_gradient || primary }}>
                          <div className="px-3 py-2.5 flex items-center gap-2">
                            <span style={{ fontSize: 18 }}>{form.emoji}</span>
                            <p style={{ color: "#fff", fontSize: 10, fontWeight: 600, textShadow: "0 1px 2px rgba(0,0,0,0.3)", flex: 1 }}>
                              {form.greeting_text || "Your greeting…"}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Balance card */}
                      <div
                        className="mx-3 mb-3 rounded-2xl overflow-hidden"
                        style={{ background: heroGrad, boxShadow: glowShadow, padding: "14px 14px 12px" }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Welcome Back</p>
                            <p style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>Demo User</p>
                          </div>
                          <div style={{ width: 22, height: 22, borderRadius: 8, background: "rgba(255,255,255,0.15)" }} />
                        </div>
                        <p style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Available Balance</p>
                        <p style={{ fontSize: 22, color: "#fff", fontWeight: 800, letterSpacing: -0.5 }}>
                          <span style={{ fontSize: 14, opacity: 0.7 }}>৳ </span>12,450.00
                        </p>
                      </div>

                      {/* Quick actions */}
                      <div className="flex justify-around mx-3 mb-3">
                        {["Send", "Cash Out", "Pay Bill", "Recharge"].map(label => (
                          <div key={label} className="flex flex-col items-center gap-1">
                            <div style={{ width: 32, height: 32, borderRadius: 12, background: primary, opacity: 0.9 }} />
                            <span style={{ fontSize: 8, color: fg, fontWeight: 600, opacity: 0.7 }}>{label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Transaction list */}
                      <div className="mx-3 rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
                        {[
                          { name: "Send Money", amount: "- ৳500", neg: true },
                          { name: "Add Money", amount: "+ ৳2,000", neg: false },
                          { name: "Mobile Recharge", amount: "- ৳100", neg: true },
                        ].map((tx, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2"
                            style={{ borderBottom: i < 2 ? `1px solid ${border}` : "none" }}
                          >
                            <div className="flex items-center gap-2">
                              <div style={{ width: 24, height: 24, borderRadius: 8, background: muted }} />
                              <div>
                                <p style={{ fontSize: 10, fontWeight: 600, color: cardFg }}>{tx.name}</p>
                                <p style={{ fontSize: 8, color: mutedFg }}>Today, 2:30 PM</p>
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: tx.neg ? (previewDark ? "#f87171" : "#dc2626") : (previewDark ? "#4ade80" : "#16a34a") }}>
                              {tx.amount}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Bottom nav */}
                      <div
                        className="absolute bottom-0 left-0 right-0 flex items-center justify-around py-2 px-2"
                        style={{ background: card, borderTop: `1px solid ${border}` }}
                      >
                        {["Home", "History", "Scan", "Inbox", "Account"].map((tab, i) => (
                          <div key={tab} className="flex flex-col items-center gap-0.5">
                            <div style={{
                              width: tab === "Scan" ? 28 : 16,
                              height: tab === "Scan" ? 28 : 16,
                              borderRadius: tab === "Scan" ? 10 : 6,
                              background: i === 0 ? primary : (tab === "Scan" ? primary : muted),
                              ...(tab === "Scan" ? { marginTop: -10 } : {}),
                            }} />
                            <span style={{ fontSize: 7, fontWeight: 600, color: i === 0 ? primary : mutedFg }}>{tab}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
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
