import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** Increments only on genuine realtime (or smoke-test) refetches. */
  liveUpdateKey: number;
  /** Optional short context label ("Bank list", "Banks", …). */
  label?: string;
  /** Emit a sonner toast in addition to the inline pill. */
  toastOnUpdate?: boolean;
  className?: string;
}

/**
 * Small inline confirmation shown inside every bank picker after the list
 * syncs live from an admin change (add / reorder / toggle / logo / default).
 * Auto-dismisses after ~2.5s so it never blocks the picker UI.
 */
export function BankListLiveBadge({
  liveUpdateKey,
  label = "Bank list",
  toastOnUpdate = true,
  className = "",
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (liveUpdateKey <= 0) return;
    setVisible(true);
    if (toastOnUpdate) {
      toast.success(`${label} updated`, {
        description: "Synced live from admin changes",
        duration: 2500,
      });
    }
    const t = window.setTimeout(() => setVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [liveUpdateKey, label, toastOnUpdate]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          data-testid="bank-live-badge"
          data-live-key={liveUpdateKey}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 ${className}`}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <RefreshCw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
            {label} updated live
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
