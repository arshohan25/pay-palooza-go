import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle2, ArrowRight } from "lucide-react";
import { haptics } from "@/lib/haptics";

interface SlideToConfirmProps {
  onConfirm: () => void;
  label?: string;
  gradient?: string;
  disabled?: boolean;
  /** When true, fires an attention bounce after a 200ms delay */
  pinComplete?: boolean;
}

const THUMB = 56;
const PADDING = 4;

const SlideToConfirm = ({
  onConfirm,
  label = "Slide to Confirm",
  gradient = "gradient-primary",
  disabled = false,
  pinComplete = false,
}: SlideToConfirmProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [bounceTick, setBounceTick] = useState(0);

  const x = useMotionValue(0);

  const getMax = () =>
    trackRef.current ? trackRef.current.offsetWidth - THUMB - PADDING * 2 : 260;

  // Fill gradient expands with thumb
  const fillWidth = useTransform(x, () => {
    const max = getMax();
    const pct = Math.min(1, x.get() / max) * 100;
    return `${pct}%`;
  });

  // Label fades out in first 40% of drag
  const labelOpacity = useTransform(x, () => {
    const max = getMax();
    return Math.max(0, 1 - x.get() / (max * 0.4));
  });

  // Fire attention bounce 200ms after PIN complete
  useEffect(() => {
    if (!pinComplete || disabled || confirmed) return;
    const timer = setTimeout(() => {
      setBounceTick((t) => t + 1);
      haptics.light();
    }, 200);
    return () => clearTimeout(timer);
  }, [pinComplete, disabled, confirmed]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    const max = getMax();
    const threshold = max * 0.76;
    const current = x.get();

    if (current >= threshold) {
      animate(x, max, { type: "spring", stiffness: 400, damping: 28 });
      setConfirmed(true);
      haptics.success();
      setTimeout(onConfirm, 320);
    } else {
      animate(x, 0, { type: "spring", stiffness: 380, damping: 28 });
      haptics.light();
    }
  }, [x, onConfirm]);

  // Attention bounce animation sequence: nudge right then spring back
  const bounceSequence = async () => {
    const max = getMax();
    const nudge = max * 0.22;
    await animate(x, nudge, { type: "spring", stiffness: 500, damping: 18, velocity: 8 });
    await animate(x, 0, { type: "spring", stiffness: 420, damping: 22 });
  };

  useEffect(() => {
    if (bounceTick === 0) return;
    bounceSequence();
  }, [bounceTick]);

  return (
    <div
      ref={trackRef}
      className={`relative h-14 rounded-2xl overflow-hidden select-none ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
      style={{ background: "hsl(var(--muted))" }}
    >
      {/* Filled gradient track */}
      <motion.div
        className={`absolute inset-y-0 left-0 ${gradient} rounded-2xl`}
        style={{ width: fillWidth }}
      />

      {/* Zigzag chevron label */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none gap-2"
        style={{ opacity: labelOpacity }}
      >
        <motion.span
          className="flex items-center"
          animate={isDragging ? {} : { x: [0, 7, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        >
          <ChevronRight size={16} className="text-muted-foreground -mr-2.5 opacity-30" />
          <ChevronRight size={18} className="text-muted-foreground -mr-2.5 opacity-60" />
          <ChevronRight size={20} className="text-muted-foreground opacity-100" />
        </motion.span>
        <span className="text-sm font-semibold text-muted-foreground">
          {label}
        </span>
      </motion.div>

      {/* Draggable thumb */}
      <motion.div
        ref={thumbRef}
        drag="x"
        dragConstraints={trackRef}
        dragElastic={0.05}
        dragMomentum={false}
        style={{
          x,
          position: "absolute",
          top: PADDING,
          left: PADDING,
          width: THUMB,
          height: THUMB,
        }}
        onDragStart={() => {
          setIsDragging(true);
          haptics.light();
        }}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.93 }}
        className={`${gradient} rounded-xl flex items-center justify-center text-white shadow-[0_4px_18px_rgba(0,0,0,0.25)] cursor-grab active:cursor-grabbing z-10`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={confirmed ? "check" : "lock"}
            initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
          >
            {confirmed ? (
              <CheckCircle2 size={24} strokeWidth={2.5} />
            ) : (
              <ArrowRight size={22} strokeWidth={2.5} />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SlideToConfirm;
