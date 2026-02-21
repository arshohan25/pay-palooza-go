import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Copy, CheckCheck, X, Download } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";

export interface ReceiptData {
  title: string;
  amount: string;
  gradient: string;
  rows: { label: string; value: string }[];
  txnId: string;
}

interface ShareReceiptSheetProps {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData;
}

const ShareReceiptSheet = ({ open, onClose, receipt }: ShareReceiptSheetProps) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const buildText = () => {
    const lines = [
      `🧾 ${receipt.title}`,
      `💰 ${t("amount")}: ${receipt.amount}`,
      ``,
      ...receipt.rows.map((r) => `${r.label}: ${r.value}`),
      ``,
      `${t("transactionId")}: ${receipt.txnId}`,
      ``,
      t("poweredByEasyPay"),
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
        // user cancelled
      }
    } else {
      await handleCopyText();
    }
  };

  const handleDownload = async () => {
    if (!receiptRef.current || downloading) return;
    haptics.medium();
    setDownloading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `receipt-${receipt.txnId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download failed", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="share-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

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
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
            </div>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </motion.button>

            <div className="px-5 pt-3 pb-8 space-y-4">
              <div className="text-center pb-1">
                <p className="text-base font-bold text-foreground">{t("shareReceiptTitle")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("copyShareSave")}</p>
              </div>

              <div
                ref={receiptRef}
                className="rounded-2xl border border-border overflow-hidden shadow-card bg-card"
              >
                <div className={`${receipt.gradient} px-4 py-4 text-white text-center`}>
                  <p className="text-xs font-semibold opacity-80 mb-0.5">{receipt.title}</p>
                  <p className="text-3xl font-extrabold">{receipt.amount}</p>
                </div>

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

                <div className="flex items-center justify-between px-4 py-3 border-t border-border/60 bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{t("transactionId")}</p>
                    <p className="text-xs font-mono font-bold text-primary break-all mt-0.5 leading-snug">{receipt.txnId}</p>
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

                <div className="px-4 py-2 bg-muted/20 text-center">
                  <p className="text-[9px] text-muted-foreground font-semibold tracking-widest uppercase">{t("poweredByEasyPay")}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCopyText}
                  className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-2xl bg-muted border border-border text-[11px] font-semibold text-foreground hover:bg-muted/80 transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={copied ? "check" : "copy"}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col items-center gap-1"
                    >
                      {copied ? (
                        <><CheckCheck size={16} className="text-primary" /><span>{t("copied")}</span></>
                      ) : (
                        <><Copy size={16} /><span>{t("copy")}</span></>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-2xl bg-muted border border-border text-[11px] font-semibold text-foreground hover:bg-muted/80 transition-colors disabled:opacity-60"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={downloading ? "loading" : "idle"}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col items-center gap-1"
                    >
                      {downloading ? (
                        <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}><Download size={16} /></motion.div><span>{t("saving")}</span></>
                      ) : (
                        <><Download size={16} /><span>{t("savePng")}</span></>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleNativeShare}
                  className={`flex flex-col items-center justify-center gap-1.5 h-14 rounded-2xl ${receipt.gradient} text-white text-[11px] font-semibold shadow-card active:opacity-90 transition-opacity`}
                >
                  <Share2 size={16} />
                  <span>{t("share")}</span>
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
