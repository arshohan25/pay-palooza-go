import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, CheckCheck, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserQrModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

// Simple QR-like visual using a canvas drawn grid (deterministic from userId)
const QrCanvas = ({ value }: { value: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 21; // 21x21 module grid (QR v1 style)

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Seed a deterministic bit grid from the user ID string
    const hash = value.split("").reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
    const rand = (i: number) => {
      const x = Math.sin(hash + i) * 10000;
      return x - Math.floor(x);
    };

    const CELL = canvas.width / SIZE;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fixed finder patterns (top-left, top-right, bottom-left)
    const drawFinder = (ox: number, oy: number) => {
      ctx.fillStyle = "#000";
      ctx.fillRect(ox * CELL, oy * CELL, 7 * CELL, 7 * CELL);
      ctx.fillStyle = "#fff";
      ctx.fillRect((ox + 1) * CELL, (oy + 1) * CELL, 5 * CELL, 5 * CELL);
      ctx.fillStyle = "#000";
      ctx.fillRect((ox + 2) * CELL, (oy + 2) * CELL, 3 * CELL, 3 * CELL);
    };
    drawFinder(0, 0);
    drawFinder(SIZE - 7, 0);
    drawFinder(0, SIZE - 7);

    // Fill data modules pseudo-randomly
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        // Skip finder pattern zones
        if ((r < 8 && c < 8) || (r < 8 && c >= SIZE - 8) || (r >= SIZE - 8 && c < 8)) continue;
        const dark = rand(r * SIZE + c) > 0.45;
        ctx.fillStyle = dark ? "#000" : "#fff";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="rounded-xl border border-border"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

const UserQrModal = ({ open, onClose, userId, userName }: UserQrModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = userId;
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
      await navigator.share({ title: "My MFS ID", text: `My wallet ID: ${userId}` });
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
              <div className="p-4 bg-white rounded-2xl shadow-elevated">
                <QrCanvas value={userId} />
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
                <p className="text-sm font-bold text-foreground font-mono tracking-widest">{userId}</p>
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
