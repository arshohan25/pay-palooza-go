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

export function FestivalThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<FestivalTheme | null>(null);

  const applyPalette = useCallback((palette: Record<string, string>) => {
    const lightVars: string[] = [];
    const darkVars: string[] = [];

    Object.entries(palette).forEach(([key, value]) => {
      if (!value) return;
      const cssKey = key.replace(/_/g, "-");
      if (cssKey.startsWith("dark-")) {
        darkVars.push(`--${cssKey.replace(/^dark-/, "")}: ${value};`);
      } else {
        lightVars.push(`--${cssKey}: ${value};`);
      }
    });

    let css = "";
    if (lightVars.length > 0) css += `:root {\n  ${lightVars.join("\n  ")}\n}\n`;
    if (darkVars.length > 0) css += `.dark {\n  ${darkVars.join("\n  ")}\n}`;

    let el = document.getElementById("festival-theme-vars") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "festival-theme-vars";
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, []);

  const clearPalette = useCallback(() => {
    const el = document.getElementById("festival-theme-vars");
    if (el) el.remove();
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

        if (Object.keys(t.theme_palette).length > 0) {
          applyPalette(t.theme_palette);
        }

        if (t.body_pattern && t.body_pattern !== "none") {
          // Lazy-load festival pattern CSS only when needed
          import("@/styles/festival-patterns.css").then(() => {
            document.body.classList.add(`festival-body-${t.body_pattern}`);
          });
        }
      }
    };

    // Defer festival theme fetch to not block TTI
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(fetchTheme);
    } else {
      setTimeout(fetchTheme, 200);
    }

    return () => {
      clearPalette();
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
