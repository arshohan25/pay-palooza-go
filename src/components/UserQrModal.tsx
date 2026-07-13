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
            className="relative w-full max-w-md rounded-t-[36px] px-6 pt-3 pb-8 overflow-hidden bg-card border-t border-x border-border/60"
          >
            {/* Ambient gradient wash */}
            <div className="pointer-events-none absolute inset-0 opacity-70">
              <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -top-10 -right-16 w-64 h-64 rounded-full bg-accent/20 blur-3xl" />
            </div>

            <div className="relative">
              {/* Drag handle */}
              <div className="flex justify-center pb-2">
                <div className="w-10 h-1 bg-foreground/15 rounded-full" />
              </div>

              {/* Close */}
              <div className="flex justify-end -mt-1">
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full bg-background/60 backdrop-blur border border-border/60 flex items-center justify-center hover:bg-background/90 transition"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Identity — monogram with gradient ring */}
              <div className="flex flex-col items-center text-center pt-1">
                <div className="relative mb-3">
                  <div className="absolute inset-0 rounded-full gradient-primary blur-md opacity-60" />
                  <div className="relative w-16 h-16 rounded-full gradient-primary p-[2px]">
                    <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                      <span className="text-xl font-extrabold bg-clip-text text-transparent gradient-primary">
                        {(userName || "?").trim().charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  {userName}
                </h2>

                <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/80 font-semibold mt-1">
                  {t(role === "agent" ? "scanToPayAgent" : role === "merchant" ? "scanToPayMerchant" : "scanToSendMoney")}
                </p>

                {/* Agent ID chip */}
                <button
                  onClick={handleCopy}
                  className="mt-4 group inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-primary/10 border border-primary/25 backdrop-blur active:scale-[0.98] transition"
                >
                  <span className="text-[9px] uppercase tracking-[0.22em] text-primary/70 font-bold">
                    ID
                  </span>
                  <span className="h-4 w-px bg-primary/25" />
                  <span className="text-lg font-mono font-extrabold tracking-[0.14em] text-primary">
                    {walletId}
                  </span>
                  {copied
                    ? <CheckCheck size={16} className="text-primary" />
                    : <Copy size={14} className="text-primary/60 group-hover:text-primary transition" />}
                </button>
              </div>

              {/* QR — glass frame with corner accents */}
              <div className="flex justify-center mt-6">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-primary/20 via-transparent to-accent/20 blur-xl" />
                  <div className="relative bg-background/95 backdrop-blur p-5 rounded-[28px] border border-border/70 shadow-elevated">
                    {/* Corner accents */}
                    <span className="absolute -top-px -left-px w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-[20px]" />
                    <span className="absolute -top-px -right-px w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-[20px]" />
                    <span className="absolute -bottom-px -left-px w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-[20px]" />
                    <span className="absolute -bottom-px -right-px w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-[20px]" />
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

              {/* Agent Number — below the QR */}
              {(phone || profile.phone) && (
                <div className="mt-6 flex flex-col items-center">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground font-semibold">
                    {role === "agent" ? "Agent Number" : role === "merchant" ? "Merchant Number" : "Number"}
                  </p>
                  <p className="text-2xl font-extrabold tracking-[0.05em] text-foreground mt-1 tabular-nums">
                    {phone || profile.phone}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 mt-7">
                <Button
                  className="h-12 gradient-primary border-0 text-white font-semibold rounded-2xl shadow-lg shadow-primary/25"
                  onClick={handleCopy}
                >
                  {copied
                    ? <><CheckCheck size={16} /> {t("walletIdCopied")}</>
                    : <><Copy size={16} /> {t("copyId")}</>}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 font-semibold rounded-2xl bg-background/60 backdrop-blur border-border/70"
                  onClick={handleShare}
                >
                  <Share2 size={16} /> {t("share")}
                </Button>
              </div>
            </div>
          </motion.div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserQrModal;
