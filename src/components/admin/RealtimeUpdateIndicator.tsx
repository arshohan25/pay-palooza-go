import { AnimatePresence, motion } from "framer-motion";

interface Props {
  visible: boolean;
}

export default function RealtimeUpdateIndicator({ visible }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 w-fit"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Data synced just now
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
