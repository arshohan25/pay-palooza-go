import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCheck, Share2, Download } from "lucide-react";
import { renderQrWithLogo } from "@/lib/qrWithLogo";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { activityTracker } from "@/lib/activityTracker";

interface WalletShareSheetProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

const WalletShareSheet = ({ open, onClose, userId, userName }: WalletShareSheetProps) => {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const walletId = userId;

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const payload = JSON.stringify({ walletId, name: userName, app: "EasyPay" });
    renderQrWithLogo(canvasRef.current, payload, 220).catch(console.error);
    activityTracker.qr("qr_opened", { kind: "wallet_share", walletId });
  }, [open, userId, userName]);

  const handleCopy = async () => {
    haptics.light();
    try { await navigator.clipboard.writeText(walletId); }
    catch {
      const el = document.createElement("textarea");
      el.value = walletId; document.body.appendChild(el);
      el.select(); document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleShare = async () => {
    haptics.medium();
    const text = `💳 My EasyPay Wallet ID: ${walletId}\n👤 ${userName}\n\nScan my QR code to send money instantly!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My EasyPay Wallet", text });
        return;
      }
    } catch { /* share failed or blocked in iframe */ }
    await handleCopy();
    toast({ title: t("copied"), description: t("walletId") + ": " + walletId });
  };

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    haptics.medium();
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const card = document.getElementById("wallet-share-card");
      if (!card) return;
      const canvas = await html2canvas(card, { backgroundColor: null, scale: 3, useCORS: true, logging: false });
      const link = document.createElement("a");
      link.download = `easypay-qr-${walletId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) { console.error(e); }
    finally { setDownloading(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ws-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            key="ws-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-0 left-0 right-0 z-[81] bg-card rounded-t-3xl shadow-float max-w-md mx-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
            </div>

            <button
              onClick={onClose}
              className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>

            <div className="px-5 pt-2 pb-8 space-y-5">
              <h3 className="text-base font-bold text-foreground text-center">{t("shareMyWallet")}</h3>

              <div
                id="wallet-share-card"
                className="rounded-2xl overflow-hidden border border-border shadow-card bg-card"
              >
                <div className="gradient-hero px-4 py-4 text-white text-center">
                  <p className="text-xs font-semibold opacity-75 mb-0.5 uppercase tracking-widest">EasyPay</p>
                  <p className="text-base font-bold">{userName}</p>
                </div>

                <div className="flex flex-col items-center gap-2 py-5 bg-background">
                  <canvas
                    ref={canvasRef}
                    className="rounded-lg"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <p className="text-[10px] text-muted-foreground font-medium tracking-widest">{t("scanToSend")}</p>
                </div>

                <div className="px-4 py-3 bg-muted/30 text-center border-t border-border/60">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-[0.18em] mb-0.5">{t("walletId")}</p>
                   <p className="text-sm font-mono font-bold text-foreground tracking-widest">{walletId}</p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCopy}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-muted border border-border hover:bg-muted/70 active:scale-[0.98] transition-all"
              >
                <div className="text-left">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t("yourWalletId")}</p>
                  <p className="text-sm font-mono font-bold text-foreground tracking-widest">{walletId}</p>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={copied ? "check" : "copy"}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    {copied
                      ? <CheckCheck size={18} className="text-primary" />
                      : <Copy size={18} className="text-muted-foreground" />
                    }
                  </motion.div>
                </AnimatePresence>
              </motion.button>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="h-14 flex-col gap-1.5 text-[11px] font-semibold rounded-2xl"
                  onClick={handleCopy}
                >
                  {copied ? <CheckCheck size={16} className="text-primary" /> : <Copy size={16} />}
                  <span>{copied ? t("copied") : t("copyId")}</span>
                </Button>

                <Button
                  variant="outline"
                  disabled={downloading}
                  className="h-14 flex-col gap-1.5 text-[11px] font-semibold rounded-2xl"
                  onClick={handleDownload}
                >
                  {downloading
                    ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><Download size={16} /></motion.div><span>{t("saving")}</span></>
                    : <><Download size={16} /><span>{t("saveQr")}</span></>
                  }
                </Button>

                <Button
                  className="h-14 flex-col gap-1.5 text-[11px] font-semibold rounded-2xl gradient-hero border-0 text-white"
                  onClick={handleShare}
                >
                  <Share2 size={16} />
                  <span>{t("share")}</span>
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WalletShareSheet;
