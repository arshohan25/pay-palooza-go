import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, ChevronRight } from "lucide-react";

const ONBOARDING_KEY = "mfs_onboarding_done";

export const hasSeenOnboarding = () =>
  localStorage.getItem(ONBOARDING_KEY) === "1";

export const markOnboardingDone = () =>
  localStorage.setItem(ONBOARDING_KEY, "1");

// ── Slide definitions ──────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: "send",
    gradient: "linear-gradient(145deg, hsl(330 80% 55%), hsl(340 75% 38%) 60%, hsl(350 70% 30%))",
    accentLight: "hsl(330 80% 70%)",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        {/* Phone body */}
        <rect x="16" y="8" width="48" height="64" rx="10" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.5" strokeWidth="2"/>
        {/* Screen */}
        <rect x="22" y="18" width="36" height="44" rx="5" fill="white" fillOpacity="0.12"/>
        {/* Arrow send icon in center */}
        <circle cx="40" cy="40" r="14" fill="white" fillOpacity="0.25"/>
        <path d="M34 40h12M43 36l4 4-4 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Floating coin top-right */}
        <circle cx="62" cy="22" r="10" fill="white" fillOpacity="0.22" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
        <text x="62" y="26.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">৳</text>
        {/* Floating sparkle bottom-left */}
        <circle cx="18" cy="62" r="6" fill="white" fillOpacity="0.18"/>
        <path d="M18 57v10M13 62h10" stroke="white" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    title: "Send Money Instantly",
    subtitle: "Transfer to any mobile number in Bangladesh in seconds — day or night, zero delays.",
    pills: ["01700…", "৳500", "✓ Sent"],
    pillColors: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.28)"],
    badgeLabel: "⚡ Instant Transfer",
  },
  {
    id: "bills",
    gradient: "linear-gradient(145deg, hsl(217 80% 52%), hsl(226 75% 38%) 60%, hsl(240 65% 28%))",
    accentLight: "hsl(217 80% 72%)",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        {/* Bill document */}
        <rect x="14" y="10" width="42" height="56" rx="8" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.5" strokeWidth="2"/>
        {/* Lines */}
        <rect x="22" y="22" width="26" height="3" rx="1.5" fill="white" fillOpacity="0.5"/>
        <rect x="22" y="30" width="20" height="3" rx="1.5" fill="white" fillOpacity="0.35"/>
        <rect x="22" y="38" width="24" height="3" rx="1.5" fill="white" fillOpacity="0.35"/>
        {/* Check circle bottom right */}
        <circle cx="58" cy="58" r="16" fill="white" fillOpacity="0.22" stroke="white" strokeOpacity="0.4" strokeWidth="2"/>
        <path d="M50 58l5 5 9-9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Small bolt top right */}
        <circle cx="62" cy="20" r="8" fill="white" fillOpacity="0.18"/>
        <path d="M63 14l-4 7h4l-4 7" stroke="white" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Pay Bills with Ease",
    subtitle: "Electricity, gas, water, internet — pay any utility bill from your wallet in one tap.",
    pills: ["Electric", "Internet", "Gas"],
    pillColors: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.15)"],
    badgeLabel: "🏦 50+ Billers",
  },
  {
    id: "cashback",
    gradient: "linear-gradient(145deg, hsl(36 95% 52%), hsl(28 90% 42%) 60%, hsl(20 80% 32%))",
    accentLight: "hsl(36 95% 72%)",
    icon: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        {/* Coin stack */}
        <ellipse cx="40" cy="56" rx="22" ry="7" fill="white" fillOpacity="0.18" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
        <ellipse cx="40" cy="50" rx="22" ry="7" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.45" strokeWidth="1.5"/>
        <ellipse cx="40" cy="44" rx="22" ry="7" fill="white" fillOpacity="0.25" stroke="white" strokeOpacity="0.55" strokeWidth="2"/>
        <text x="40" y="48.5" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">৳</text>
        {/* Arrow up (cashback) */}
        <path d="M40 36V16M32 24l8-8 8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Stars */}
        <circle cx="16" cy="20" r="4" fill="white" fillOpacity="0.22"/>
        <circle cx="64" cy="18" r="5" fill="white" fillOpacity="0.22"/>
        <circle cx="70" cy="36" r="3" fill="white" fillOpacity="0.18"/>
      </svg>
    ),
    title: "Earn Cashback & Rewards",
    subtitle: "Get Drive commission on mobile recharges, cashback on payments, and exclusive loyalty rewards.",
    pills: ["Drive ৳", "Cashback", "Rewards"],
    pillColors: ["rgba(255,255,255,0.2)", "rgba(255,255,255,0.15)", "rgba(255,255,255,0.22)"],
    badgeLabel: "🎁 Drive Rewards",
  },
] as const;

// ── Component ──────────────────────────────────────────────────────────────────
interface OnboardingSlidesProps {
  onDone: () => void;
}

export default function OnboardingSlides({ onDone }: OnboardingSlidesProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const dragX = useMotionValue(0);
  const dragProgress = useTransform(dragX, [-200, 200], [1, -1]);
  const containerRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
  }, [current]);

  const next = useCallback(() => {
    if (current < SLIDES.length - 1) {
      goTo(current + 1);
    } else {
      markOnboardingDone();
      onDone();
    }
  }, [current, goTo, onDone]);

  const skip = useCallback(() => {
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

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[190] overflow-hidden flex flex-col"
      style={{ background: slide.gradient }}
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

      {/* Background orbs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-16 w-80 h-80 rounded-full bg-white/8 blur-3xl pointer-events-none" />

      {/* Skip button */}
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
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            style={{ x: dragX }}
            ref={containerRef}
            className="flex flex-col items-center text-center w-full max-w-xs select-none cursor-grab active:cursor-grabbing"
          >
            {/* Illustration */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 220, damping: 18 }}
              className="relative mb-8"
            >
              {/* Glow ring */}
              <div
                className="absolute inset-0 rounded-full blur-2xl scale-150 opacity-30"
                style={{ background: slide.accentLight }}
              />
              {/* Icon bg circle */}
              <div
                className="relative w-36 h-36 rounded-[36px] flex items-center justify-center shadow-2xl"
                style={{ background: "rgba(255,255,255,0.16)", border: "2px solid rgba(255,255,255,0.28)" }}
              >
                {slide.icon}
              </div>
            </motion.div>

            {/* Pills row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="flex gap-2 mb-6"
            >
              {slide.pills.map((pill, i) => (
                <motion.span
                  key={pill}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
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
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="h-2 rounded-full bg-white"
            />
          ))}
        </div>

        {/* CTA Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
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
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
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

        {/* Step counter */}
        <p className="text-center text-white/50 text-xs font-semibold tracking-wider">
          {current + 1} / {SLIDES.length}
        </p>
      </div>
    </motion.div>
  );
}
