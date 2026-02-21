import { motion } from "framer-motion";

const Shimmer = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`relative overflow-hidden rounded-xl bg-muted ${className}`} style={style}>
    <motion.div
      className="absolute inset-0"
      style={{
        background: "linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground)/0.08) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
      }}
      animate={{ backgroundPosition: ["200% center", "-200% center"] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
    />
  </div>
);

export const BalanceCardSkeleton = () => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
    className="rounded-[28px] gradient-hero p-5 shadow-glow-lg overflow-hidden"
  >
    <Shimmer className="h-3 w-28 mb-3 bg-white/15" />
    <Shimmer className="h-12 w-48 mb-6 bg-white/15" />
    <div className="flex gap-2 mb-5">
      <Shimmer className="h-10 w-28 rounded-2xl bg-white/15" />
      <Shimmer className="h-10 w-10 rounded-2xl bg-white/15" />
      <Shimmer className="h-10 w-10 rounded-2xl bg-white/15" />
    </div>
    <div className="h-px bg-white/10 mb-4" />
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <Shimmer className="h-2.5 w-16 bg-white/15" />
        <Shimmer className="h-4 w-36 bg-white/15" />
      </div>
      <Shimmer className="h-9 w-9 rounded-xl bg-white/15" />
    </div>
  </motion.div>
);

export const QuickActionsSkeleton = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.08, ease: [0.23, 1, 0.32, 1] }}
    className="bg-card rounded-[24px] shadow-card border border-border/60 p-4"
  >
    <div className="grid grid-cols-4 gap-y-4 gap-x-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <Shimmer className="rounded-[18px]" style={{ width: 52, height: 52 }} />
          <Shimmer className="h-2.5 w-10 rounded-lg" />
        </div>
      ))}
    </div>
  </motion.div>
);

export const TransactionListSkeleton = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.16, ease: [0.23, 1, 0.32, 1] }}
  >
    <div className="flex items-center justify-between mb-3 px-0.5">
      <Shimmer className="h-4 w-40" />
      <Shimmer className="h-3.5 w-14" />
    </div>
    <div className="bg-card rounded-[22px] border border-border/60 shadow-card overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
          <Shimmer className="w-10 h-10 rounded-[14px] shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Shimmer className="h-3.5 w-3/4" />
            <Shimmer className="h-2.5 w-1/2" />
          </div>
          <div className="text-right shrink-0 space-y-1.5">
            <Shimmer className="h-3.5 w-16 ml-auto" />
            <Shimmer className="h-2.5 w-12 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);
