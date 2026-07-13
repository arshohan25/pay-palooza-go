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
            className="w-full max-w-md bg-card rounded-t-[32px] px-8 pt-3 pb-8"
          >
            {/* Drag handle */}
            <div className="flex justify-center pb-2">
              <div className="w-12 h-1.5 bg-border rounded-full" />
            </div>

            {/* Close */}
            <div className="flex justify-end -mt-1">
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Identity block — avatar, name, wallet ID pill, tagline */}
            <div className="flex flex-col items-center text-center pt-1">
              <div className="w-16 h-16 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-3">
                <span className="text-primary font-bold text-lg">
                  {(userName || "?").trim().charAt(0).toUpperCase()}
                </span>
              </div>

              <h2 className="text-xl font-bold text-foreground tracking-tight">
                {userName}
              </h2>

              {/* Agent ID + Agent number — both bold, big, highlighted */}
              <div className="w-full mt-4 space-y-2">
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center justify-between gap-3 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 active:scale-[0.98] transition text-left"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold">Agent ID</p>
                    <p className="text-lg font-mono font-bold tracking-[0.12em] text-primary truncate">
                      {walletId}
                    </p>
                  </div>
                  {copied
                    ? <CheckCheck size={18} className="text-primary shrink-0" />
                    : <Copy size={18} className="text-primary/70 shrink-0" />}
                </button>

                {(phone || profile.phone) && (
                  <div className="w-full flex items-center justify-between gap-3 bg-muted border border-border rounded-2xl px-4 py-3">
                    <div className="min-w-0 text-left">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Agent Number</p>
                      <p className="text-lg font-bold tracking-wide text-foreground truncate">
                        {phone || profile.phone}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mt-4">
                {t(role === "agent" ? "scanToPayAgent" : role === "merchant" ? "scanToPayMerchant" : "scanToSendMoney")}
              </p>
            </div>

            {/* QR — centered, framed like a certified stamp */}
            <div className="flex justify-center mt-6">
              <div className="relative">
                <div className="absolute -inset-3 bg-primary/5 rounded-[36px]" />
                <div className="relative bg-background p-5 rounded-3xl shadow-elevated border border-border">
                  <canvas
                    ref={canvasRef}
                    width={200}
                    height={200}
                    className="rounded-xl block"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 mt-8">
              <Button
                className="h-12 gradient-primary border-0 text-white font-semibold rounded-2xl shadow-lg shadow-primary/20"
                onClick={handleCopy}
              >
                {copied
                  ? <><CheckCheck size={16} /> {t("walletIdCopied")}</>
                  : <><Copy size={16} /> {t("copyId")}</>}
              </Button>
              <Button
                variant="outline"
                className="h-12 font-semibold rounded-2xl"
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
