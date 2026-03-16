
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface FestivalTheme {
  id: string;
  name: string;
  emoji: string;
  greeting_text: string;
  banner_gradient: string | null;
  overlay_effect: string;
  accent_color: string | null;
}

const PARTICLE_STYLES: Record<string, string> = {
  stars: "festival-stars",
  lanterns: "festival-lanterns",
  confetti: "festival-confetti",
  snow: "festival-snow",
  fireworks: "festival-fireworks",
  petals: "festival-petals",
  crescents: "festival-crescents",
  hearts: "festival-hearts",
  leaves: "festival-leaves",
  sparkles: "festival-sparkles",
};

export default function FestivalOverlay() {
  const [theme, setTheme] = useState<FestivalTheme | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissed_id = sessionStorage.getItem("festival_dismissed");
    const fetchTheme = async () => {
      const { data } = await supabase
        .from("festival_themes")
        .select("id, name, emoji, greeting_text, banner_gradient, overlay_effect, accent_color")
        .eq("is_active", true)
        .limit(1)
        .single();
      if (data) {
        const t = data as FestivalTheme;
        if (dismissed_id === t.id) {
          setDismissed(true);
        }
        setTheme(t);
      }
    };
    fetchTheme();
  }, []);

  if (!theme || dismissed) return null;

  const effectClass = PARTICLE_STYLES[theme.overlay_effect] || "";

  return (
    <>
      {/* CSS for particle effects */}
      <style>{`
        @keyframes twinkle { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes float-up { 0%{opacity:0;transform:translateY(20px)} 30%{opacity:1} 100%{opacity:0;transform:translateY(-60px)} }
        @keyframes fall { 0%{opacity:1;transform:translateY(-10px) rotate(0deg)} 100%{opacity:0;transform:translateY(80px) rotate(360deg)} }
        @keyframes snowfall { 0%{opacity:0.8;transform:translateY(-5px)} 100%{opacity:0;transform:translateY(60px)} }
        @keyframes burst { 0%{opacity:1;transform:scale(0.5)} 50%{opacity:1;transform:scale(1.3)} 100%{opacity:0;transform:scale(0.3)} }

        .festival-particles { position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit }
        .festival-particles span { position:absolute;display:block }

        .festival-stars span { width:3px;height:3px;background:white;border-radius:50%;animation:twinkle 2s ease-in-out infinite }
        .festival-lanterns span { width:6px;height:8px;background:hsl(35 90% 55%);border-radius:50% 50% 50% 50% / 40% 40% 60% 60%;animation:float-up 3s ease-in-out infinite;box-shadow:0 0 6px hsl(35 90% 55% / 0.6) }
        .festival-confetti span { width:4px;height:8px;border-radius:1px;animation:fall 2.5s ease-in infinite }
        .festival-snow span { width:4px;height:4px;background:white;border-radius:50%;animation:snowfall 3s linear infinite }
        .festival-fireworks span { width:4px;height:4px;border-radius:50%;animation:burst 1.8s ease-out infinite }
      `}</style>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          className="relative rounded-xl overflow-hidden"
          style={{ background: theme.banner_gradient || "hsl(var(--primary))" }}
        >
          {/* Particle layer */}
          {effectClass && (
            <div className={`festival-particles ${effectClass}`}>
              {Array.from({ length: 12 }).map((_, i) => {
                const colors = ["#fff", "#fbbf24", "#f87171", "#34d399", "#60a5fa", "#c084fc"];
                return (
                  <span
                    key={i}
                    style={{
                      left: `${8 + Math.random() * 84}%`,
                      top: `${Math.random() * 80}%`,
                      animationDelay: `${Math.random() * 3}s`,
                      animationDuration: `${1.5 + Math.random() * 2}s`,
                      ...(theme.overlay_effect === "confetti" || theme.overlay_effect === "fireworks"
                        ? { background: colors[i % colors.length] }
                        : {}),
                    }}
                  />
                );
              })}
            </div>
          )}

          <div className="relative px-4 py-4 flex items-center gap-3">
            <span className="text-2xl shrink-0">{theme.emoji}</span>
            <p className="text-white font-semibold text-sm flex-1 drop-shadow">{theme.greeting_text}</p>
            <button
              onClick={() => {
                setDismissed(true);
                sessionStorage.setItem("festival_dismissed", theme.id);
              }}
              className="shrink-0 rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
