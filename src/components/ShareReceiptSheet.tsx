import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Copy, CheckCheck, X, Download } from "lucide-react";
import { haptics } from "@/lib/haptics";

export interface ReceiptData {
  title: string;       // e.g. "Money Sent", "Cash Out Successful"
  amount: string;      // e.g. "৳500"
  gradient: string;    // e.g. "gradient-send"
  rows: { label: string; value: string }[];
  txnId: string;
}

interface ShareReceiptSheetProps {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData;
}

const ShareReceiptSheet = ({ open, onClose, receipt }: ShareReceiptSheetProps) => {
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const buildText = () => {
    const lines = [
      `🧾 ${receipt.title}`,
      `💰 Amount: ${receipt.amount}`,
      ``,
      ...receipt.rows.map((r) => `${r.label}: ${r.value}`),
      ``,
      `Transaction ID: ${receipt.txnId}`,
      ``,
      `Powered by PayWave`,
    ];
    return lines.join("\n");
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(buildText());
    } catch {
      const el = document.createElement("textarea");
      el.value = buildText();
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(receipt.txnId);
    } catch {
      const el = document.createElement("textarea");
      el.value = receipt.txnId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    haptics.light();
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleNativeShare = async () => {
    haptics.medium();
    if (navigator.share) {
      try {
        await navigator.share({
          title: receipt.title,
          text: buildText(),
        });
      } catch {
        // user cancelled — no-op
      }
    } else {
      await handleCopyText();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="share-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="share-sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="fixed bottom-0 left-0 right-0 z-[91] bg-card rounded-t-3xl shadow-float
                       md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
                       md:w-[90vw] md:max-w-sm md:rounded-3xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
            </div>

            {/* Close */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </motion.button>

            <div className="px-5 pt-3 pb-8 space-y-4">
              {/* Header */}
              <div className="text-center pb-1">
                <p className="text-base font-bold text-foreground">Share Receipt</p>
                <p className="text-xs text-muted-foreground mt-0.5">Copy or share your transaction details</p>
              </div>

              {/* Receipt preview card */}
              <div className="rounded-2xl border border-border overflow-hidden shadow-card">
                {/* Gradient header */}
                <div className={`${receipt.gradient} px-4 py-4 text-white text-center`}>
                  <p className="text-xs font-semibold opacity-80 mb-0.5">{receipt.title}</p>
                  <p className="text-3xl font-extrabold">{receipt.amount}</p>
                </div>

                {/* Receipt rows */}
                <div className="divide-y divide-border/60">
                  {receipt.rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                      <span className="text-xs font-semibold text-foreground text-right break-all max-w-[60%]">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Transaction ID row with copy */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Transaction ID</p>
                    <p className="text-xs font-mono font-bold text-primary truncate mt-0.5">{receipt.txnId}</p>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handleCopyId}
                    className="ml-2 shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={copiedId ? "check" : "copy"}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        {copiedId ? <CheckCheck size={13} className="text-primary" /> : <Copy size={13} />}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCopyText}
                  className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-muted border border-border text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={copied ? "check" : "copy"}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2"
                    >
                      {copied ? (
                        <><CheckCheck size={15} className="text-primary" /> Copied!</>
                      ) : (
                        <><Copy size={15} /> Copy Text</>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleNativeShare}
                  className={`flex items-center justify-center gap-2 h-11 rounded-2xl ${receipt.gradient} text-white text-sm font-semibold shadow-card active:opacity-90 transition-opacity`}
                >
                  <Share2 size={15} />
                  Share
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ShareReceiptSheet;
