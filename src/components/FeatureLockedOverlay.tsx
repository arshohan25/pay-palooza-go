import { motion } from "framer-motion";
import { Lock, Clock, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface FeatureLockedOverlayProps {
  featureName: string;
  reason?: string | null;
  expiresAt?: string | null;
  onClose: () => void;
}

const FeatureLockedOverlay = ({ featureName, reason, expiresAt, onClose }: FeatureLockedOverlayProps) => {
  const { t, lang } = useI18n();
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      <motion.div
        className="bg-destructive px-4 pt-3 pb-3 text-destructive-foreground"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight">{t("floTitle")}</h1>
            <p className="text-xs text-white/70 mt-0.5">{t("floCurrentlyLocked").replace("{name}", featureName)}</p>
          </div>
        </div>
      </motion.div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.15 }}
          className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center"
        >
          <Lock className="w-12 h-12 text-destructive" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center space-y-3 max-w-xs"
        >
          <h2 className="text-xl font-bold text-foreground">
            {t("floIsLocked").replace("{name}", featureName)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("floDesc")}
          </p>

          {reason && (
            <div className="bg-muted rounded-xl p-3 text-left">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{t("floReason")}</p>
              <p className="text-sm text-foreground">{reason}</p>
            </div>
          )}

          {expiresAt && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {t("floExpires")}: {new Date(expiresAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {!expiresAt && (
            <p className="text-xs text-muted-foreground">
              {t("floContactSupport")}
            </p>
          )}
        </motion.div>

        <Button
          onClick={onClose}
          variant="outline"
          className="mt-4 min-w-[160px]"
        >
          {t("floGoBack")}
        </Button>
      </div>
    </div>
  );
};

export default FeatureLockedOverlay;
