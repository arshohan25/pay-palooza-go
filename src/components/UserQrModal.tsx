import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCheck, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderQrWithLogo } from "@/lib/qrWithLogo";
import { useI18n } from "@/lib/i18n";
import { activityTracker } from "@/lib/activityTracker";

interface UserQrModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

const UserQrModal = ({ open, onClose, userId, userName }: UserQrModalProps) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const walletId = userId;

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const payload = JSON.stringify({ walletId, name: userName, app: "EasyPay" });
    renderQrWithLogo(canvasRef.current, payload, 200).catch(console.error);
  }, [open, userId, userName]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(walletId);
    } catch {
      const el = document.createElement("textarea");
      el.value = walletId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "My EasyPay ID", text: `My wallet ID: ${walletId}` });
        return;
      }
    } catch { /* blocked in iframe */ }
    handleCopy();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/70 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card rounded-t-3xl p-6 space-y-5"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto" />

            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">{t("myQrCode")}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 py-2">
              <div className="p-4 bg-background rounded-2xl shadow-elevated border border-border">
                <canvas
                  ref={canvasRef}
                  width={200}
                  height={200}
                  className="rounded-xl"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-bold text-foreground">{userName}</p>
                <p className="text-xs text-muted-foreground">{t("scanToSendMoney")}</p>
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-muted border border-border hover:bg-muted/80 active:scale-[0.98] transition-all"
            >
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("yourWalletId")}</p>
                <p className="text-sm font-bold text-foreground font-mono tracking-widest">{walletId}</p>
              </div>
              <motion.div
                animate={{ scale: copied ? [1, 1.25, 1] : 1 }}
                transition={{ duration: 0.3 }}
              >
                {copied
                  ? <CheckCheck size={20} className="text-primary" />
                  : <Copy size={20} className="text-muted-foreground" />
                }
              </motion.div>
            </button>

            {copied && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-primary text-center font-medium"
              >
                {t("walletIdCopied")}
              </motion.p>
            )}

            <div className="flex gap-3">
              <Button
                className="flex-1 h-11 gradient-primary border-0 text-white font-semibold"
                onClick={handleCopy}
              >
                <Copy size={16} /> {t("copyId")}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11 font-semibold"
                onClick={handleShare}
              >
                <Share2 size={16} /> {t("share")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserQrModal;
