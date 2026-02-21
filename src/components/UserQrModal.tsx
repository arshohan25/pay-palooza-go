import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCheck, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

interface UserQrModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

const UserQrModal = ({ open, onClose, userId, userName }: UserQrModalProps) => {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate alphabetic wallet ID (MFS-ABCD-EFGH)
  const walletId = (() => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const block = (seed: string) => {
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
      return Array.from({ length: 4 }, (_, i) => chars[Math.abs((h >> (i * 5)) % 26)]).join("");
    };
    return `MFS-${block(userId)}-${block(userId + "salt")}`;
  })();

  // Generate real QR code when modal opens
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const payload = JSON.stringify({ walletId, name: userName, app: "PayWave" });
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(console.error);
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
    if (navigator.share) {
      await navigator.share({ title: "My PayWave ID", text: `My wallet ID: ${walletId}` });
    } else {
      handleCopy();
    }
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
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-border mx-auto" />

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">My QR Code</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* QR + info */}
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
                <p className="text-xs text-muted-foreground">Scan this code to send money to me</p>
              </div>
            </div>

            {/* User ID chip */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-muted border border-border hover:bg-muted/80 active:scale-[0.98] transition-all"
            >
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Your Wallet ID</p>
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
                ✓ Wallet ID copied to clipboard!
              </motion.p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                className="flex-1 h-11 gradient-primary border-0 text-white font-semibold"
                onClick={handleCopy}
              >
                <Copy size={16} /> Copy ID
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-11 font-semibold"
                onClick={handleShare}
              >
                <Share2 size={16} /> Share
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserQrModal;
