import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";
import { haptics } from "@/lib/haptics";

const ONBOARDING_KEY = "mfs_onboarding_done";

export const hasSeenOnboarding = () =>
  localStorage.getItem(ONBOARDING_KEY) === "1";

export const markOnboardingDone = () =>
  localStorage.setItem(ONBOARDING_KEY, "1");

// Slides are now empty — onboarding content should be managed from the backend.
// When no slides exist, the component auto-skips.
const SLIDES: { id: string; gradient: string; accentLight: string; icon: React.ReactNode; title: string; subtitle: string; pills: string[]; pillColors: string[]; badgeLabel: string }[] = [];

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
  // If no slides, auto-skip onboarding
  useEffect(() => {
    if (SLIDES.length === 0) {
      markOnboardingDone();
      onDone();
    }
  }, [onDone]);

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

  if (SLIDES.length === 0) return null;

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4 }}
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
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 18 }}
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="text-[28px] font-black text-white leading-tight tracking-tight mb-3"
            >
              {slide.title}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
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
