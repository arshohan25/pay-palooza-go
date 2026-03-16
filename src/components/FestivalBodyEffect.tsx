import { useFestivalTheme } from "@/contexts/FestivalThemeContext";
import { useState, useEffect, useMemo, useCallback } from "react";

/**
 * One-time celebration burst effect.
 * Shows a burst of themed particles that rain down once then fade out.
 * Plays only once per session per theme.
 */

const BURST_CHARS: Record<string, string[]> = {
  stars: ["✦", "✧", "⭐", "⋆", "★"],
  crescents: ["☪", "☽", "🌙", "✦", "⋆"],
  petals: ["🌸", "🌺", "💮", "🌷", "✿"],
  confetti: ["🎊", "🎉", "✦", "●", "■"],
  snow: ["❄", "❅", "❆", "✧", "•"],
  fireworks: ["🎆", "🎇", "✦", "✧", "⊹"],
  hearts: ["♥", "❤", "💖", "💕", "✦"],
  leaves: ["🍂", "🍁", "🍃", "✦", "🌿"],
  sparkles: ["✨", "💫", "⭐", "✦", "⋆"],
  lanterns: ["🏮", "🪔", "💡", "✦", "⋆"],
};

interface Particle {
  id: number;
  char: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  opacity: number;
}

export default function FestivalBodyEffect() {
  const { theme, isActive } = useFestivalTheme();
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  const sessionKey = theme ? `festival_burst_${theme.id}` : "";

  useEffect(() => {
    if (!isActive || !theme || theme.overlay_effect === "none") return;
    // Only burst once per session
    if (sessionStorage.getItem(sessionKey)) return;

    sessionStorage.setItem(sessionKey, "1");
    setShow(true);
    setFading(false);

    // Start fading out after burst completes
    const fadeTimer = setTimeout(() => setFading(true), 4000);
    // Remove entirely after fade
    const removeTimer = setTimeout(() => setShow(false), 6000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isActive, theme, sessionKey]);

  const particles: Particle[] = useMemo(() => {
    if (!isActive || !theme || theme.overlay_effect === "none") return [];
    const chars = BURST_CHARS[theme.overlay_effect] || BURST_CHARS.stars;

    // Create 30 particles that burst from center-top and rain down
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      char: chars[i % chars.length],
      x: 10 + Math.random() * 80, // spread across 10-90% width
      y: -10 - Math.random() * 20, // start above viewport
      size: 12 + Math.random() * 16,
      delay: Math.random() * 0.8, // stagger burst
      duration: 2.5 + Math.random() * 2, // fall duration
      rotation: Math.random() * 360,
      opacity: 0.4 + Math.random() * 0.5,
    }));
  }, [isActive, theme]);

  if (!show || particles.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes festival-burst-fall {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.3);
            opacity: 0;
          }
          15% {
            opacity: var(--p-opacity);
            transform: translateY(10vh) rotate(90deg) scale(1.2);
          }
          40% {
            opacity: var(--p-opacity);
            transform: translateY(40vh) rotate(180deg) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(110vh) rotate(360deg) scale(0.6);
          }
        }
        @keyframes festival-burst-sparkle {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.6); }
        }
      `}</style>
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{
          zIndex: 50,
          opacity: fading ? 0 : 1,
          transition: "opacity 2s ease-out",
        }}
        aria-hidden="true"
      >
        {particles.map(p => (
          <span
            key={p.id}
            className="absolute block"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size}px`,
              "--p-opacity": p.opacity,
              animationName: "festival-burst-fall, festival-burst-sparkle",
              animationDuration: `${p.duration}s, 0.6s`,
              animationDelay: `${p.delay}s, ${p.delay}s`,
              animationIterationCount: "1, 3",
              animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94), ease-in-out",
              animationFillMode: "forwards, none",
              opacity: 0,
              transform: `rotate(${p.rotation}deg)`,
            } as React.CSSProperties}
          >
            {p.char}
          </span>
        ))}
      </div>
    </>
  );
}
