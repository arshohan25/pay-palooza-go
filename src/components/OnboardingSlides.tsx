import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";

import { hasSeenOnboarding, markOnboardingDone } from "@/lib/onboardingUtils";
export { hasSeenOnboarding, markOnboardingDone };

// ── Slide definitions ──────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: "send",
    gradient: "linear-gradient(145deg, hsl(330 80% 55%), hsl(340 75% 38%) 60%, hsl(350 70% 30%))",
    accentLight: "hsl(330 80% 70%)",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="16" y="8" width="48" height="64" rx="10" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.5" strokeWidth="2"/>
        <rect x="22" y="18" width="36" height="44" rx="5" fill="white" fillOpacity="0.12"/>
        <circle cx="40" cy="40" r="14" fill="white" fillOpacity="0.25"/>
        <path d="M34 40h12M43 36l4 4-4 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="62" cy="22" r="10" fill="white" fillOpacity="0.22" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
        <text x="62" y="26.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">৳</text>
        <circle cx="18" cy="62" r="6" fill="white" fillOpacity="0.18"/>
        <path d="M18 57v10M13 62h10" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    titleKey: "obSendTitle",
    subtitleKey: "obSendSubtitle",
    pillKeys: ["obSendPill1", "obSendPill2", "obSendPill3"] as const,
    pillColors: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.28)"],
    badgeLabelKey: "obSendBadge",
  },
  {
    id: "bills",
    gradient: "linear-gradient(145deg, hsl(217 80% 52%), hsl(226 75% 38%) 60%, hsl(240 65% 28%))",
    accentLight: "hsl(217 80% 72%)",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="14" y="10" width="42" height="56" rx="8" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.5" strokeWidth="2"/>
        <rect x="22" y="22" width="26" height="3" rx="1.5" fill="white" fillOpacity="0.5"/>
        <rect x="22" y="30" width="20" height="3" rx="1.5" fill="white" fillOpacity="0.35"/>
        <rect x="22" y="38" width="24" height="3" rx="1.5" fill="white" fillOpacity="0.35"/>
        <circle cx="58" cy="58" r="16" fill="white" fillOpacity="0.22" stroke="white" strokeOpacity="0.4" strokeWidth="2"/>
        <path d="M50 58l5 5 9-9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="62" cy="20" r="8" fill="white" fillOpacity="0.18"/>
        <path d="M63 14l-4 7h4l-4 7" stroke="white" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    titleKey: "obBillsTitle",
    subtitleKey: "obBillsSubtitle",
    pillKeys: ["obBillsPill1", "obBillsPill2", "obBillsPill3"] as const,
    pillColors: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.15)"],
    badgeLabelKey: "obBillsBadge",
  },
  {
    id: "cashback",
    gradient: "linear-gradient(145deg, hsl(36 95% 52%), hsl(28 90% 42%) 60%, hsl(20 80% 32%))",
    accentLight: "hsl(36 95% 72%)",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <ellipse cx="40" cy="56" rx="22" ry="7" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
        <ellipse cx="40" cy="50" rx="22" ry="7" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.45" strokeWidth="1.5"/>
        <ellipse cx="40" cy="44" rx="22" ry="7" fill="white" fillOpacity="0.25" stroke="white" strokeOpacity="0.55" strokeWidth="2"/>
        <text x="40" y="48.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">৳</text>
        <path d="M40 36V16M32 24l8-8 8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="20" r="4" fill="white" fillOpacity="0.22"/>
        <circle cx="64" cy="18" r="5" fill="white" fillOpacity="0.22"/>
        <circle cx="70" cy="36" r="3" fill="white" fillOpacity="0.18"/>
      </svg>
    ),
    titleKey: "obCashbackTitle",
    subtitleKey: "obCashbackSubtitle",
    pillKeys: ["obCashbackPill1", "obCashbackPill2", "obCashbackPill3"] as const,
    pillColors: ["rgba(255,255,255,0.2)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.22)"],
    badgeLabelKey: "obCashbackBadge",
  },
] as const;

// ── Floating orb component for zigzag parallax ─────────────────────────────────
const FloatingOrb = ({ mouseX, mouseY, depth, size, top, left, opacity }: {
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
  depth: number; size: number; top: string; left: string; opacity: number;
}) => {
  const x = useTransform(mouseX, [-300, 300], [-depth * 30, depth * 30]);
  const y = useTransform(mouseY, [-300, 300], [-depth * 20, depth * 20]);
  const sx = useSpring(x, { stiffness: 80 - depth * 20, damping: 18 });
  const sy = useSpring(y, { stiffness: 80 - depth * 20, damping: 18 });
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none blur-2xl"
      style={{ width: size, height: size, top, left, x: sx, y: sy, opacity, background: "rgba(255,255,255,0.18)" }}
    />
  );
};

// ── Component ──────────────────────────────────────────────────────────────────
interface OnboardingSlidesProps {
  onDone: () => void;
}

export default function OnboardingSlides({ onDone }: OnboardingSlidesProps) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isHeld, setIsHeld] = useState(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse/touch parallax
  const mouseX = useMotionValue<number>(0);
  const mouseY = useMotionValue<number>(0);

  // Drag swipe
  const dragX = useMotionValue(0);

  // Shake detection
  const shakeRef = useRef({ lastX: 0, lastShake: 0, count: 0 });

  useEffect(() => {
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc?.x) return;
      const now = Date.now();
      const delta = Math.abs(acc.x - shakeRef.current.lastX);
      shakeRef.current.lastX = acc.x;
      if (delta > 12) {
        shakeRef.current.count++;
        if (shakeRef.current.count >= 3 && now - shakeRef.current.lastShake > 1500) {
          shakeRef.current.count = 0;
          shakeRef.current.lastShake = now;
          haptics.medium();
          markOnboardingDone();
          onDone();
        }
      } else {
        if (now - shakeRef.current.lastShake > 800) shakeRef.current.count = 0;
      }
    };
    window.addEventListener("devicemotion", handleMotion, true);
    return () => window.removeEventListener("devicemotion", handleMotion, true);
  }, [onDone]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0]?.clientX ?? 0;
      clientY = e.touches[0]?.clientY ?? 0;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    mouseX.set(clientX - rect.left - rect.width / 2);
    mouseY.set(clientY - rect.top - rect.height / 2);
  }, [mouseX, mouseY]);

  const goTo = useCallback((idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
    haptics.light();
  }, [current]);

  const next = useCallback(() => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      haptics.success();
      markOnboardingDone();
      onDone();
    }
  }, [current, goTo, onDone]);

  const skip = useCallback(() => {
    haptics.medium();
    markOnboardingDone();
    onDone();
  }, [onDone]);

  const handleDragEnd = useCallback((_: never, info: { offset: { x: number } }) => {
    if (info.offset.x < -60 && current < SLIDES.length - 1) {
      goTo(current + 1);
    } else if (info.offset.x > 60 && current > 0) {
      goTo(current - 1);
    }
    dragX.set(0);
  }, [current, goTo, dragX]);

  // Tap-and-hold: after 600ms hold, bounce the icon
  const handlePointerDown = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setIsHeld(false);
    holdTimerRef.current = setTimeout(() => {
      setIsHeld(true);
      haptics.light();
    }, 600);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setIsHeld(false);
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (shakeTimerRef.current) clearInterval(shakeTimerRef.current);
    };
  }, []);

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
      rotateY: dir > 0 ? 15 : -15,
    }),
    center: { x: 0, opacity: 1, rotateY: 0 },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
      rotateY: dir > 0 ? -15 : 15,
    }),
  };

  // Icon zigzag: alternating left-right on each slide
  const iconX = useTransform(mouseX, [-300, 300], [-18, 18]);
  const iconY = useTransform(mouseY, [-300, 300], [-10, 10]);
  const iconXSpring = useSpring(iconX, { stiffness: 60, damping: 14 });
  const iconYSpring = useSpring(iconY, { stiffness: 60, damping: 14 });

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[190] overflow-hidden flex flex-col select-none"
      style={{ background: slide.gradient }}
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
    >
      {/* Animated gradient transition overlay */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${current}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{ background: slide.gradient }}
        />
      </AnimatePresence>

      {/* Zigzag parallax orbs */}
      <FloatingOrb mouseX={mouseX} mouseY={mouseY} depth={1}   size={220} top="-10%" left="-8%"  opacity={0.18} />
      <FloatingOrb mouseX={mouseX} mouseY={mouseY} depth={0.6} size={280} top="50%"  left="60%"  opacity={0.12} />
      <FloatingOrb mouseX={mouseX} mouseY={mouseY} depth={1.4} size={160} top="70%"  left="-5%"  opacity={0.14} />
      <FloatingOrb mouseX={mouseX} mouseY={mouseY} depth={0.4} size={120} top="10%"  left="70%"  opacity={0.10} />

      {/* Skip / badge row */}
      <div className="relative z-10 flex justify-between items-center px-6 pt-14 pb-2">
        <motion.div
          key={`badge-${current}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="px-3 py-1.5 rounded-full text-white text-xs font-bold backdrop-blur-sm border border-white/25"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          {slide.badgeLabel}
        </motion.div>

        {!isLast && (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={skip}
            className="px-4 py-2 rounded-full text-white/80 text-sm font-semibold backdrop-blur-sm border border-white/20"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            Skip
          </motion.button>
        )}
      </div>

      {/* Shake hint — subtle text at top */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute top-28 left-0 right-0 text-center text-white text-[10px] font-semibold z-10 pointer-events-none"
      >
        📳 Shake to skip
      </motion.p>

      {/* Slide content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center overflow-hidden px-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            style={{ x: dragX, perspective: 800 }}
            className="flex flex-col items-center text-center w-full max-w-xs cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Illustration with tap-hold bounce + parallax */}
            <motion.div
              initial={{ scale: current === 0 ? 1 : 0.6, opacity: current === 0 ? 1 : 0, y: current === 0 ? 0 : 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: current === 0 ? 0 : 0.05, type: "spring", stiffness: 220, damping: 18 }}
              className="relative mb-8"
              style={{ x: iconXSpring, y: iconYSpring }}
            >
              {/* Glow ring */}
              <motion.div
                className="absolute inset-0 rounded-full blur-2xl scale-150"
                style={{ background: slide.accentLight }}
                animate={{ opacity: isHeld ? [0.4, 0.7, 0.4] : 0.3 }}
                transition={{ duration: 0.8, repeat: isHeld ? Infinity : 0 }}
              />
              {/* Icon bg circle — tap-and-hold bounces */}
              <motion.div
                className="relative w-36 h-36 rounded-[36px] flex items-center justify-center shadow-2xl"
                style={{ background: "rgba(255,255,255,0.16)", border: "2px solid rgba(255,255,255,0.28)" }}
                animate={isHeld
                  ? { scale: [1, 1.12, 0.93, 1.08, 0.97, 1], rotate: [0, -4, 4, -2, 2, 0] }
                  : { scale: 1, rotate: 0 }
                }
                transition={{ duration: 0.7, ease: "easeInOut" }}
              >
                {slide.icon}
              </motion.div>
            </motion.div>

            {/* Pills row — zigzag stagger */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="flex gap-2 mb-6"
            >
              {slide.pills.map((pill, i) => (
                <motion.span
                  key={pill}
                  initial={{ opacity: 0, y: i % 2 === 0 ? -12 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.09, type: "spring", stiffness: 320, damping: 22 }}
                  className="px-3 py-1 rounded-full text-white text-xs font-bold border border-white/20"
                  style={{ background: slide.pillColors[i] }}
                >
                  {pill}
                </motion.span>
              ))}
            </motion.div>

            {/* Text */}
            <motion.h2
              initial={{ opacity: current === 0 ? 1 : 0, y: current === 0 ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: current === 0 ? 0 : 0.1, duration: 0.3 }}
              className="text-[28px] font-black text-white leading-tight tracking-tight mb-3"
            >
              {slide.title}
            </motion.h2>
            <motion.p
              initial={{ opacity: current === 0 ? 1 : 0, y: current === 0 ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: current === 0 ? 0 : 0.12, duration: 0.3 }}
              className="text-white/75 text-sm font-medium leading-relaxed"
            >
              {slide.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="relative z-10 px-6 pb-12 flex flex-col gap-6">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => goTo(i)}
              animate={{
                width: i === current ? 28 : 8,
                opacity: i === current ? 1 : 0.45,
                scale: i === current ? 1 : 0.85,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="h-2 rounded-full bg-white"
            />
          ))}
        </div>

        {/* CTA Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          onClick={next}
          className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-base shadow-2xl"
          style={{
            background: "rgba(255,255,255,0.22)",
            border: "2px solid rgba(255,255,255,0.35)",
            backdropFilter: "blur(12px)",
            color: "white",
          }}
        >
          {isLast ? (
            <>
              Get Started
              <motion.div
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
              >
                <ArrowRight size={20} />
              </motion.div>
            </>
          ) : (
            <>
              Next
              <ChevronRight size={18} />
            </>
          )}
        </motion.button>

        {/* Tap-and-hold hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="text-center text-white text-[10px] font-semibold tracking-wider"
        >
          {current + 1} / {SLIDES.length} · Hold to feel the bounce
        </motion.p>
      </div>
    </motion.div>
  );
}
