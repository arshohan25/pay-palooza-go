import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, Ticket, Heart, X, Briefcase, HandCoins, Shield, Gift } from "lucide-react";
import { toast } from "sonner";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  onBankTransfer: () => void;
}

const FEATURE_KEY_MAP: Record<string, string> = {
  bank: "bank_transfer",
  
  loan: "loan",
  insurance: "insurance",
  giftcards: "gift_cards",
  careers: "careers",
  coupons: "coupons",
  donations: "donations",
};

const items: { id: string; icon: any; labelKey: TranslationKey; descKey: TranslationKey; gradient: string }[] = [
  { id: "bank", icon: Landmark, labelKey: "msBankLabel", descKey: "msBankDesc", gradient: "bg-gradient-to-b from-blue-500 to-indigo-600" },
  { id: "loan", icon: HandCoins, labelKey: "msLoanLabel", descKey: "msLoanDesc", gradient: "bg-gradient-to-b from-amber-500 to-orange-600" },
  { id: "insurance", icon: Shield, labelKey: "msInsuranceLabel", descKey: "msInsuranceDesc", gradient: "bg-gradient-to-b from-violet-500 to-purple-600" },
  { id: "giftcards", icon: Gift, labelKey: "msGiftLabel", descKey: "msGiftDesc", gradient: "bg-gradient-to-b from-orange-400 to-red-500" },
  { id: "careers", icon: Briefcase, labelKey: "msCareersLabel", descKey: "msCareersDesc", gradient: "bg-gradient-to-b from-slate-500 to-slate-700" },
  { id: "coupons", icon: Ticket, labelKey: "msCouponsLabel", descKey: "msCouponsDesc", gradient: "bg-gradient-to-b from-pink-500 to-rose-600" },
  { id: "donations", icon: Heart, labelKey: "msDonationsLabel", descKey: "msDonationsDesc", gradient: "bg-gradient-to-b from-red-500 to-rose-700" },
];

const MoreSheet = ({ open, onClose, onBankTransfer }: MoreSheetProps) => {
  const navigate = useNavigate();
  const { isHidden } = useGlobalToggles();
  const { t } = useI18n();

  const visibleItems = useMemo(
    () => items.filter(item => {
      const fk = FEATURE_KEY_MAP[item.id];
      return !fk || !isHidden(fk);
    }),
    [isHidden]
  );

  const handleTap = (id: string) => {
    onClose();
    setTimeout(() => {
      if (id === "bank") onBankTransfer();
      else if (id === "careers") navigate("/careers");
      else if (id === "coupons") navigate("/coupons");
      else if (id === "donations") navigate("/donations");
      else if (id === "loan") navigate("/loan");
      else if (id === "insurance") navigate("/insurance");
      else if (id === "giftcards") navigate("/giftcards");
      else toast.info(t("msComingSoon"));
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
              <h2 className="text-lg font-extrabold text-foreground">{t("msTitle")}</h2>
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
                  onClick={() => handleTap(item.id)}
                  className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.97] transition-all text-center"
                >
                  <div className={`${item.gradient} w-14 h-14 rounded-2xl flex items-center justify-center text-white`}>
                    <item.icon size={24} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-sm font-bold text-foreground">{t(item.labelKey)}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{t(item.descKey)}</p>
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
