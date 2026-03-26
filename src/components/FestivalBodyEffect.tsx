import { useFestivalTheme } from "@/contexts/FestivalThemeContext";
import { useEffect, useRef, useState } from "react";

const THEME_COLORS: Record<string, string[]> = {
  crescents: ["#d4af37", "#f5e6a3", "#ffffff", "#e8c547"],
  stars: ["#d4af37", "#f5e6a3", "#ffffff", "#e8c547"],
  lanterns: ["#d4af37", "#f5e6a3", "#ffffff", "#e8c547"],
  petals: ["#e53935", "#ff9800", "#ffeb3b", "#ffffff"],
  leaves: ["#e53935", "#ff9800", "#ffeb3b", "#ffffff"],
  hearts: ["#e53935", "#ff1744", "#ff80ab", "#ffffff"],
  confetti: ["#6366f1", "#f59e0b", "#10b981", "#ffffff"],
  fireworks: ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#ffffff"],
  sparkles: ["#6366f1", "#a78bfa", "#f59e0b", "#ffffff"],
  snow: ["#90caf9", "#e3f2fd", "#ffffff", "#b3e5fc"],
};

const DEFAULT_COLORS = ["#f59e0b", "#10b981", "#6366f1", "#ef4444", "#ffffff"];

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number;
  size: number;
  color: string;
  decay: number;
  drag: number;
}

interface Rocket {
  x: number; y: number;
  vy: number;
  targetY: number;
  trail: { x: number; y: number; alpha: number }[];
  exploded: boolean;
  colors: string[];
}

export default function FestivalBodyEffect() {
  const { theme, isActive } = useFestivalTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isActive || !theme || theme.overlay_effect === "none") return;

    // Only play once per session
    const sessionKey = `festival_effect_played_${theme.id}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    setShow(true);

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;z-index:50;pointer-events:none;";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const gravity = 0.06;
    const colors = THEME_COLORS[theme.overlay_effect] || DEFAULT_COLORS;

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    let flashAlpha = 0;
    let running = true;
    let startTime = performance.now();

    // Schedule 5 rockets over ~3.5s
    const launchTimes = [0, 600, 1200, 2000, 3000];
    const launched = new Set<number>();

    function launchRocket() {
      const x = W * (0.2 + Math.random() * 0.6);
      rockets.push({
        x, y: H + 10,
        vy: -(7 + Math.random() * 4),
        targetY: H * (0.15 + Math.random() * 0.25),
        trail: [],
        exploded: false,
        colors,
      });
    }

    function explode(r: Rocket) {
      r.exploded = true;
      flashAlpha = 0.35;
      const count = 35 + Math.floor(Math.random() * 25);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        sparks.push({
          x: r.x, y: r.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          size: 2 + Math.random() * 2.5,
          color: r.colors[Math.floor(Math.random() * r.colors.length)],
          decay: 0.012 + Math.random() * 0.008,
          drag: 0.97 + Math.random() * 0.02,
        });
      }
    }

    function draw() {
      if (!running) return;
      const elapsed = performance.now() - startTime;

      // Launch rockets on schedule
      launchTimes.forEach((t, i) => {
        if (elapsed >= t && !launched.has(i)) {
          launched.add(i);
          launchRocket();
        }
      });

      ctx.clearRect(0, 0, W, H);

      // Screen flash
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 215, 0, ${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        flashAlpha *= 0.88;
        if (flashAlpha < 0.01) flashAlpha = 0;
      }

      // Update & draw rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        if (r.exploded) continue;

        r.trail.push({ x: r.x, y: r.y, alpha: 1 });
        if (r.trail.length > 12) r.trail.shift();

        r.y += r.vy;
        r.vy += 0.03; // slight deceleration

        // Draw trail
        for (let j = 0; j < r.trail.length; j++) {
          const t = r.trail[j];
          t.alpha *= 0.85;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 2 * t.alpha, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 220, 120, ${t.alpha * 0.7})`;
          ctx.fill();
        }

        // Rocket head
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ffe082";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ffab00";
        ctx.fill();
        ctx.shadowBlur = 0;

        if (r.y <= r.targetY) {
          explode(r);
        }
      }

      // Update & draw sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= s.drag;
        s.vy = s.vy * s.drag + gravity;
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= s.decay;
        s.size *= 0.995;

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.shadowBlur = 4;
        ctx.shadowColor = s.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // End condition: all rockets exploded and no sparks left
      const allExploded = rockets.length > 0 && rockets.every(r => r.exploded);
      if (allExploded && sparks.length === 0 && elapsed > 4000) {
        running = false;
        canvas.remove();
        setShow(false);
        return;
      }

      requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);

    return () => {
      running = false;
      canvas.remove();
    };
  }, [isActive, theme]);

  return null;
}
