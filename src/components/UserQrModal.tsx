import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCheck, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderQrWithLogo } from "@/lib/qrWithLogo";
import { useI18n } from "@/lib/i18n";
import { activityTracker } from "@/lib/activityTracker";
import { generateWalletId, validateWalletId, type WalletRole } from "@/lib/walletId";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";

interface UserQrModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  /** Optional explicit phone seed. Falls back to the current user's profile phone. */
  phone?: string;
  /** Wallet role — controls the ID format: user (EZP-XXXX-XXXX), agent (EZP-AGN{RR}-XXXX), merchant (EZP-MRC{RR}-XXXX). */
  role?: WalletRole;
  /** 2-letter route code (DH/KH/NR/…). Only used for agent + merchant. Defaults to DH. */
  route?: string;
}

const UserQrModal = ({ open, onClose, userId, userName, phone, role = "user", route = "DH" }: UserQrModalProps) => {
  const { t } = useI18n();
  const profile = useProfile();
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Deterministic wallet ID derived from the phone seed + role + route.
  const walletId = useMemo(() => {
    const seed = (phone || profile.phone || userId || "").toString().trim();
    if (!seed) return "";
    const id = generateWalletId(seed, role, route);
    // Guard: if generator ever produced a malformed ID, block it.
    return validateWalletId(id, role).ok ? id : "";
  }, [phone, profile.phone, userId, role, route]);

  useEffect(() => {
    if (!open || !canvasRef.current || !walletId) return;
    const payload = JSON.stringify({ walletId, name: userName, app: "EasyPay" });
    renderQrWithLogo(canvasRef.current, payload, 200).catch(console.error);
    activityTracker.qr("qr_opened", { kind: "user_wallet", walletId });
  }, [open, walletId, userName]);


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
    activityTracker.qr("qr_shared", { channel: "copy", walletId });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "My EasyPay ID", text: `My wallet ID: ${walletId}` });
        activityTracker.qr("qr_shared", { channel: "system_share", walletId });
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
            className="w-full max-w-md bg-card rounded-t-3xl p-6 pb-8 space-y-6"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto" />

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">{t("myQrCode")}</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Identity block — name, wallet ID, tagline — centered above QR */}
            <div className="flex flex-col items-center text-center space-y-2">
              <p className="text-xl font-bold text-foreground leading-tight">{userName}</p>
              <p className="text-base font-mono font-semibold tracking-[0.2em] text-primary">
                {walletId}
              </p>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                {t(role === "agent" ? "scanToPayAgent" : role === "merchant" ? "scanToPayMerchant" : "scanToSendMoney")}
              </p>
            </div>

            {/* QR — centered, premium framed */}
            <div className="flex justify-center">
              <div className="relative p-5 bg-gradient-to-br from-background to-muted/40 rounded-3xl shadow-elevated border border-border">
                <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <canvas
                  ref={canvasRef}
                  width={200}
                  height={200}
                  className="rounded-xl block"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            </div>

            <AnimatePresence>
              {copied && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-primary text-center font-medium"
                >
                  {t("walletIdCopied")}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1 h-12 gradient-primary border-0 text-white font-semibold rounded-2xl"
                onClick={handleCopy}
              >
                {copied
                  ? <><CheckCheck size={16} /> {t("walletIdCopied")}</>
                  : <><Copy size={16} /> {t("copyId")}</>}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 font-semibold rounded-2xl"
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
