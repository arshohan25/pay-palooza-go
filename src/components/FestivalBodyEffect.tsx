import { useFestivalTheme } from "@/contexts/FestivalThemeContext";
import { useMemo } from "react";

const PARTICLE_CHARS: Record<string, string[]> = {
  stars: ["✦", "✧", "⋆", "★"],
  crescents: ["☽", "☾", "🌙"],
  petals: ["🌸", "🌺", "💮"],
  confetti: ["●", "■", "▲", "◆"],
  snow: ["❄", "❅", "❆", "•"],
  fireworks: ["✦", "✧", "⊹", "⋆"],
  hearts: ["♥", "❤", "💕"],
  leaves: ["🍂", "🍁", "🍃"],
  sparkles: ["✨", "⭐", "💫"],
  lanterns: ["🏮", "🪔", "💡"],
};

export default function FestivalBodyEffect() {
  const { theme, isActive } = useFestivalTheme();

  const particles = useMemo(() => {
    if (!isActive || !theme || theme.overlay_effect === "none") return [];
    const chars = PARTICLE_CHARS[theme.overlay_effect] || PARTICLE_CHARS.stars;
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      char: chars[i % chars.length],
      left: `${5 + Math.random() * 90}%`,
      delay: `${Math.random() * 8}s`,
      duration: `${6 + Math.random() * 8}s`,
      size: `${10 + Math.random() * 8}px`,
      opacity: 0.15 + Math.random() * 0.2,
    }));
  }, [isActive, theme]);

  if (!isActive || particles.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes festival-float {
          0% { opacity: 0; transform: translateY(100vh) rotate(0deg); }
          10% { opacity: var(--p-opacity); }
          90% { opacity: var(--p-opacity); }
          100% { opacity: 0; transform: translateY(-10vh) rotate(360deg); }
        }
      `}</style>
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: p.left,
              fontSize: p.size,
              animationName: "festival-float",
              animationDuration: p.duration,
              animationDelay: p.delay,
              animationIterationCount: "infinite",
              animationTimingFunction: "linear",
              "--p-opacity": p.opacity,
              opacity: 0,
            } as React.CSSProperties}
          >
            {p.char}
          </span>
        ))}
      </div>
    </>
  );
}
