import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

export interface TxnToastData {
  id: string;
  type: string;        // "Send Money", "Cash Out", etc.
  amount: string;      // formatted like "৳500.00"
  gradient: string;    // Tailwind gradient class
}

let listeners: Array<(t: TxnToastData) => void> = [];

export const showTxnToast = (data: Omit<TxnToastData, "id">) => {
  const toast: TxnToastData = { ...data, id: `toast-${Date.now()}` };
  listeners.forEach((fn) => fn(toast));
};

const TxnToast = () => {
  const [toasts, setToasts] = useState<TxnToastData[]>([]);

  useEffect(() => {
    const handler = (t: TxnToastData) => {
      setToasts((prev) => [t, ...prev].slice(0, 3));
      // auto-dismiss after 4s
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4000);
    };
    listeners.push(handler);
    return () => { listeners = listeners.filter((l) => l !== handler); };
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed top-4 left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ y: -80, opacity: 0, scale: 0.88 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="pointer-events-auto w-full max-w-sm"
          >
            <div className="flex items-center gap-3 bg-card border border-border rounded-2xl shadow-float px-4 py-3 overflow-hidden relative">
              {/* Gradient accent strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.gradient} rounded-l-2xl`} />

              {/* Green check */}
              <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-primary" strokeWidth={2.5} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium leading-tight">{t.type} Successful</p>
                <p className="text-base font-extrabold text-foreground tracking-tight leading-tight">{t.amount}</p>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <X size={11} className="text-muted-foreground" />
              </button>

              {/* Progress bar */}
              <motion.div
                className={`absolute bottom-0 left-0 h-[2px] ${t.gradient}`}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4, ease: "linear" }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default TxnToast;
