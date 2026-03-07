import { motion, AnimatePresence } from "framer-motion";
import { Landmark, PiggyBank, Gauge, TrendingUp, Ticket, Heart, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  onBankTransfer: () => void;
  onSavings: () => void;
  onLimits: () => void;
  onInsights: () => void;
}

const items = [
  { id: "bank", icon: Landmark, label: "Bank Transfer", desc: "Transfer to any bank account", gradient: "bg-gradient-to-b from-blue-500 to-indigo-600" },
  { id: "savings", icon: PiggyBank, label: "Savings", desc: "Set goals & grow your money", gradient: "bg-gradient-to-b from-emerald-500 to-teal-600" },
  { id: "limits", icon: Gauge, label: "Limits & Usage", desc: "View daily & monthly limits", gradient: "bg-gradient-to-b from-amber-500 to-orange-600" },
  { id: "insights", icon: TrendingUp, label: "Spending Insights", desc: "Track where your money goes", gradient: "bg-gradient-to-b from-violet-500 to-purple-600" },
  { id: "coupons", icon: Ticket, label: "Coupons & Offers", desc: "Exclusive deals & cashback", gradient: "bg-gradient-to-b from-pink-500 to-rose-600", soon: true },
  { id: "donations", icon: Heart, label: "Donations", desc: "Support causes you care about", gradient: "bg-gradient-to-b from-red-500 to-rose-700", soon: true },
];

const MoreSheet = ({ open, onClose, onBankTransfer, onSavings, onLimits, onInsights }: MoreSheetProps) => {
  const handleTap = (id: string) => {
    onClose();
    setTimeout(() => {
      if (id === "bank") onBankTransfer();
      else if (id === "savings") onSavings();
      else if (id === "limits") onLimits();
      else if (id === "insights") onInsights();
      else toast.info("Coming soon!");
    }, 200);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-50 max-w-md mx-auto bg-background rounded-t-3xl border-t border-border shadow-elevated"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-lg font-extrabold text-foreground">More Services</h2>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 pb-8 pt-2 space-y-2 max-h-[70vh] overflow-y-auto scrollbar-none">
              {items.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3 }}
                  onClick={() => handleTap(item.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left ${item.soon ? "opacity-60" : ""}`}
                >
                  <div className={`${item.gradient} w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0`}>
                    <item.icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{item.label}</p>
                      {item.soon && (
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Soon</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoreSheet;
