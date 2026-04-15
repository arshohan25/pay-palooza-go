import { useState, useRef, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Copy, CheckCheck, X, Download, Shield } from "lucide-react";
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

const AnimatedIcon = forwardRef<HTMLSpanElement, { children: React.ReactNode; className?: string }>(
  ({ children, className }, ref) => (
    <span ref={ref} className={className}>{children}</span>
  )
);
AnimatedIcon.displayName = "AnimatedIcon";

const MotionIcon = motion.create(AnimatedIcon);

const ShareReceiptSheet = forwardRef<HTMLDivElement, ShareReceiptSheetProps>(
  ({ open, onClose, receipt }, ref) => {
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
        ...receipt.rows.map((row) => `${row.label}: ${row.value}`),
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
        const element = document.createElement("textarea");
        element.value = buildText();
        document.body.appendChild(element);
        element.select();
        document.execCommand("copy");
        document.body.removeChild(element);
      }
      haptics.light();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyId = async () => {
      try {
        await navigator.clipboard.writeText(receipt.txnId);
      } catch {
        const element = document.createElement("textarea");
        element.value = receipt.txnId;
        document.body.appendChild(element);
        element.select();
        document.execCommand("copy");
        document.body.removeChild(element);
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
      } catch (error) {
        console.error("Download failed", error);
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
              ref={ref}
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

                {/* Premium receipt card */}
                <div
                  ref={receiptRef}
                  className="rounded-2xl overflow-hidden shadow-lg border border-border/40 bg-card"
                >
                  {/* Gradient header with pattern */}
                  <div className={`${receipt.gradient} relative px-4 py-5 text-white text-center`}>
                    <div className="absolute inset-0 opacity-10" style={{
                      backgroundImage: "radial-gradient(circle at 25% 60%, white 1px, transparent 1px), radial-gradient(circle at 75% 30%, white 1px, transparent 1px)",
                      backgroundSize: "24px 24px, 32px 32px",
                    }} />
                    <div className="relative z-10">
                      <p className="text-[11px] font-semibold opacity-80 mb-1 tracking-wide uppercase">{receipt.title}</p>
                      <p className="text-[36px] font-extrabold leading-none tracking-tight">{receipt.amount}</p>
                    </div>
                  </div>

                  {/* Rows with subtle separators */}
                  <div className="divide-y divide-border/40">
                    {receipt.rows.map((row, idx) => (
                      <motion.div
                        key={row.label}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.03 * idx }}
                        className="flex items-center justify-between px-4 py-2.5 gap-2"
                      >
                        <span className="text-[11px] text-muted-foreground shrink-0 font-medium">{row.label}</span>
                        <span className="text-[12px] font-semibold text-foreground text-right break-all max-w-[60%]">
                          {row.value}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Transaction ID section — premium mono styling */}
                  <div className="flex items-center justify-between px-4 py-3.5 border-t border-border/40 bg-muted/20">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Shield size={10} className="text-primary/60" />
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{t("transactionId")}</p>
                      </div>
                      <p className="text-[13px] font-mono font-bold text-primary break-all leading-snug">{receipt.txnId}</p>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={handleCopyId}
                      className="ml-2 shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <MotionIcon
                          key={copiedId ? "check" : "copy"}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          {copiedId ? <CheckCheck size={14} className="text-primary" /> : <Copy size={14} />}
                        </MotionIcon>
                      </AnimatePresence>
                    </motion.button>
                  </div>

                  {/* Branding footer */}
                  <div className="px-4 py-2 bg-muted/10 text-center border-t border-border/30">
                    <p className="text-[9px] text-muted-foreground/60 font-semibold tracking-widest uppercase">{t("poweredByEasyPay")}</p>
                  </div>
                </div>

                {/* Action buttons — pill style with shadows */}
                <div className="grid grid-cols-3 gap-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleCopyText}
                    className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-2xl bg-muted/80 border border-border/50 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <MotionIcon
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
                      </MotionIcon>
                    </AnimatePresence>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex flex-col items-center justify-center gap-1.5 h-14 rounded-2xl bg-muted/80 border border-border/50 text-[11px] font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60 shadow-sm"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <MotionIcon
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
                      </MotionIcon>
                    </AnimatePresence>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={handleNativeShare}
                    className={`flex flex-col items-center justify-center gap-1.5 h-14 rounded-2xl ${receipt.gradient} text-white text-[11px] font-semibold shadow-md active:opacity-90 transition-opacity`}
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
  }
);

ShareReceiptSheet.displayName = "ShareReceiptSheet";

export default ShareReceiptSheet;
