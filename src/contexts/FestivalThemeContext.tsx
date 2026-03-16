import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FestivalTheme {
  id: string;
  name: string;
  emoji: string;
  greeting_text: string;
  banner_gradient: string | null;
  overlay_effect: string;
  accent_color: string | null;
  theme_palette: Record<string, string>;
  body_pattern: string;
}

interface FestivalThemeContextValue {
  theme: FestivalTheme | null;
  isActive: boolean;
}

const FestivalThemeContext = createContext<FestivalThemeContextValue>({ theme: null, isActive: false });

// CSS variables that map to HSL values (set via hsl(var(--key)))
const HSL_VARS = [
  "primary", "primary-foreground", "background", "foreground",
  "card", "card-foreground", "popover", "popover-foreground",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "border", "input", "ring",
];

// CSS variables that are raw values (gradients, shadows)
const RAW_VARS = [
  "gradient-primary", "gradient-hero", "gradient-accent",
  "gradient-send", "gradient-cashout", "gradient-payment", "gradient-addmoney",
  "shadow-glow", "shadow-glow-lg", "shadow-card", "shadow-elevated",
];

export function FestivalThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<FestivalTheme | null>(null);

  const applyPalette = useCallback((palette: Record<string, string>) => {
    const root = document.documentElement;
    Object.entries(palette).forEach(([key, value]) => {
      if (!value) return;
      // Convert underscores to hyphens for CSS var names
      const cssKey = key.replace(/_/g, "-");
      root.style.setProperty(`--${cssKey}`, value);
    });
  }, []);

  const clearPalette = useCallback((palette: Record<string, string>) => {
    const root = document.documentElement;
    Object.keys(palette).forEach(key => {
      const cssKey = key.replace(/_/g, "-");
      root.style.removeProperty(`--${cssKey}`);
    });
    // Also clear body pattern class
    document.body.className = document.body.className
      .split(" ")
      .filter(c => !c.startsWith("festival-body-"))
      .join(" ");
  }, []);

  useEffect(() => {
    const fetchTheme = async () => {
      const { data } = await supabase
        .from("festival_themes")
        .select("id, name, emoji, greeting_text, banner_gradient, overlay_effect, accent_color, theme_palette, body_pattern")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (data) {
        const t: FestivalTheme = {
          id: data.id,
          name: data.name,
          emoji: data.emoji,
          greeting_text: data.greeting_text,
          banner_gradient: data.banner_gradient,
          overlay_effect: data.overlay_effect,
          accent_color: data.accent_color,
          theme_palette: (data.theme_palette as Record<string, string>) || {},
          body_pattern: (data.body_pattern as string) || "none",
        };
        setTheme(t);

        // Apply CSS variable overrides
        if (Object.keys(t.theme_palette).length > 0) {
          applyPalette(t.theme_palette);
        }

        // Apply body pattern
        if (t.body_pattern && t.body_pattern !== "none") {
          document.body.classList.add(`festival-body-${t.body_pattern}`);
        }
      }
    };

    fetchTheme();

    return () => {
      if (theme?.theme_palette) {
        clearPalette(theme.theme_palette);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FestivalThemeContext.Provider value={{ theme, isActive: !!theme }}>
      {children}
    </FestivalThemeContext.Provider>
  );
}

export function useFestivalTheme() {
  return useContext(FestivalThemeContext);
}
