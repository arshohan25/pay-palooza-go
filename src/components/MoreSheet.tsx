import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, Wallet, Ticket, Heart, X, Briefcase } from "lucide-react";
import { toast } from "sonner";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  onBankTransfer: () => void;
  onSavings: () => void;
}

const items = [
  { id: "bank", icon: Landmark, label: "Bank Transfer", desc: "Transfer to any bank account", gradient: "bg-gradient-to-b from-blue-500 to-indigo-600" },
  { id: "savings", icon: Wallet, label: "Savings", desc: "Set goals & grow your money", gradient: "bg-gradient-to-b from-emerald-500 to-teal-600" },
  
  { id: "careers", icon: Briefcase, label: "Careers", desc: "Join our team & grow", gradient: "bg-gradient-to-b from-violet-500 to-purple-600" },
  { id: "coupons", icon: Ticket, label: "Coupons & Offers", desc: "Exclusive deals & cashback", gradient: "bg-gradient-to-b from-pink-500 to-rose-600" },
  { id: "donations", icon: Heart, label: "Donations", desc: "Support causes you care about", gradient: "bg-gradient-to-b from-red-500 to-rose-700", soon: true },
];

const MoreSheet = ({ open, onClose, onBankTransfer, onSavings }: MoreSheetProps) => {
  const navigate = useNavigate();
  const visibleItems = items;

  const handleTap = (id: string, soon?: boolean) => {
    if (soon) { toast.info("Coming soon!"); return; }
    onClose();
    setTimeout(() => {
      if (id === "bank") onBankTransfer();
      else if (id === "savings") onSavings();
      else if (id === "careers") navigate("/careers");
      else if (id === "coupons") navigate("/coupons");
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

            <div className="px-4 pb-8 pt-2 grid grid-cols-2 gap-3">
              {visibleItems.map((item, i) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                  onClick={() => handleTap(item.id, item.soon)}
                  className={`flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.97] transition-all text-center ${item.soon ? "opacity-60" : ""}`}
                >
                  <div className={`${item.gradient} w-14 h-14 rounded-2xl flex items-center justify-center text-white`}>
                    <item.icon size={24} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-sm font-bold text-foreground">{item.label}</p>
                      {item.soon && (
                        <span className="text-[9px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Soon</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{item.desc}</p>
                  </div>
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
