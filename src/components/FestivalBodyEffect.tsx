import { useFestivalTheme } from "@/contexts/FestivalThemeContext";
import { useState, useEffect, useMemo } from "react";

/**
 * Fireworks celebration burst effect.
 * Shows a dramatic burst of themed particles + fireworks every time the app loads
 * while a festival theme is active. Multi-wave for realism.
 */

const FIREWORK_CHARS = ["🎆", "🎇", "✦", "✧", "⊹", "💥", "✨"];

const BURST_CHARS: Record<string, string[]> = {
  stars: ["✦", "✧", "⭐", "⋆", "★", ...FIREWORK_CHARS],
  crescents: ["☪", "☽", "🌙", "✦", "⋆", ...FIREWORK_CHARS],
  petals: ["🌸", "🌺", "💮", "🌷", "✿", ...FIREWORK_CHARS],
  confetti: ["🎊", "🎉", "✦", "●", "■", ...FIREWORK_CHARS],
  snow: ["❄", "❅", "❆", "✧", "•", ...FIREWORK_CHARS],
  fireworks: ["🎆", "🎇", "✦", "✧", "⊹", "💥", "✨", "🌟", "⭐"],
  hearts: ["♥", "❤", "💖", "💕", "✦", ...FIREWORK_CHARS],
  leaves: ["🍂", "🍁", "🍃", "✦", "🌿", ...FIREWORK_CHARS],
  sparkles: ["✨", "💫", "⭐", "✦", "⋆", ...FIREWORK_CHARS],
  lanterns: ["🏮", "🪔", "💡", "✦", "⋆", ...FIREWORK_CHARS],
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
  wave: number;
}

export default function FestivalBodyEffect() {
  const { theme, isActive } = useFestivalTheme();
  const [show, setShow] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!isActive || !theme || theme.overlay_effect === "none") return;

    // Play every time the component mounts (every login / page load)
    setShow(true);
    setFading(false);

    const fadeTimer = setTimeout(() => setFading(true), 5000);
    const removeTimer = setTimeout(() => setShow(false), 7500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isActive, theme]);

  const particles: Particle[] = useMemo(() => {
    if (!isActive || !theme || theme.overlay_effect === "none") return [];
    const chars = BURST_CHARS[theme.overlay_effect] || BURST_CHARS.fireworks;

    // Wave 1: 30 particles burst immediately
    const wave1: Particle[] = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      char: chars[i % chars.length],
      x: 5 + Math.random() * 90,
      y: -10 - Math.random() * 20,
      size: 14 + Math.random() * 18,
      delay: Math.random() * 0.6,
      duration: 2.5 + Math.random() * 2,
      rotation: Math.random() * 360,
      opacity: 0.5 + Math.random() * 0.4,
      wave: 1,
    }));

    // Wave 2: 20 particles burst after 0.8s delay — more fireworks-heavy
    const wave2: Particle[] = Array.from({ length: 20 }, (_, i) => ({
      id: 30 + i,
      char: FIREWORK_CHARS[i % FIREWORK_CHARS.length],
      x: 10 + Math.random() * 80,
      y: -5 - Math.random() * 15,
      size: 16 + Math.random() * 20,
      delay: 0.8 + Math.random() * 0.5,
      duration: 2.2 + Math.random() * 1.8,
      rotation: Math.random() * 360,
      opacity: 0.6 + Math.random() * 0.35,
      wave: 2,
    }));

    return [...wave1, ...wave2];
  }, [isActive, theme]);

  if (!show || particles.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes festival-burst-fall {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.2);
            opacity: 0;
          }
          10% {
            opacity: var(--p-opacity);
            transform: translateY(5vh) rotate(60deg) scale(1.4);
          }
          25% {
            opacity: var(--p-opacity);
            transform: translateY(20vh) rotate(120deg) scale(1.1);
          }
          50% {
            opacity: calc(var(--p-opacity) * 0.7);
            transform: translateY(55vh) rotate(220deg) scale(0.9);
          }
          100% {
            opacity: 0;
            transform: translateY(115vh) rotate(400deg) scale(0.4);
          }
        }
        @keyframes festival-burst-sparkle {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 2px rgba(255,215,0,0.3)); }
          50% { filter: brightness(1.8) drop-shadow(0 0 8px rgba(255,215,0,0.6)); }
        }
        @keyframes festival-burst-flash {
          0% { opacity: 0.6; }
          50% { opacity: 0; }
          100% { opacity: 0; }
        }
      `}</style>
      {/* Screen flash for fireworks feel */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 51,
          background: "radial-gradient(circle at 50% 30%, rgba(255,215,0,0.15), transparent 70%)",
          animation: "festival-burst-flash 1.2s ease-out forwards",
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{
          zIndex: 50,
          opacity: fading ? 0 : 1,
          transition: "opacity 2.5s ease-out",
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
              animationDuration: `${p.duration}s, 0.5s`,
              animationDelay: `${p.delay}s, ${p.delay}s`,
              animationIterationCount: "1, 5",
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
