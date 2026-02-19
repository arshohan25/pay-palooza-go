import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  title?: string;
}

const MOCK_RESULTS: Record<string, string> = {
  recipient: "01711-223344",
  agent: "AGT-10234",
  merchant: "MRC-88901",
};

const QrScannerModal = ({ open, onClose, onScan, title = "Scan QR Code" }: QrScannerModalProps) => {
  const [detected, setDetected] = useState(false);
  const [scanType, setScanType] = useState<keyof typeof MOCK_RESULTS>("merchant");
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine mock result based on title
  useEffect(() => {
    if (title.toLowerCase().includes("agent")) setScanType("agent");
    else if (title.toLowerCase().includes("recipient") || title.toLowerCase().includes("send")) setScanType("recipient");
    else setScanType("merchant");
  }, [title]);

  // Auto-start scan immediately when opened
  useEffect(() => {
    if (!open) { setDetected(false); setUploadProcessing(false); return; }

    const detectTimer = setTimeout(() => {
      setDetected(true);
      setTimeout(() => {
        onScan(MOCK_RESULTS[scanType]);
        onClose();
      }, 600);
    }, 2000);

    return () => clearTimeout(detectTimer);
  }, [open, scanType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Simulate QR processing from uploaded image
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProcessing(true);
    setTimeout(() => {
      setDetected(true);
      setTimeout(() => {
        onScan(MOCK_RESULTS[scanType]);
        onClose();
        setUploadProcessing(false);
      }, 600);
    }, 1200);
    e.target.value = "";
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center"
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
            {/* Handle + Header */}
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Viewfinder */}
            <div className="relative aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {/* Corner brackets */}
              {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
                <div
                  key={i}
                  className={`absolute ${pos} w-8 h-8 border-[3px] border-white/80 ${
                    i < 2 ? (i === 0 ? "rounded-tl-xl border-r-0 border-b-0" : "rounded-tr-xl border-l-0 border-b-0")
                    : (i === 2 ? "rounded-bl-xl border-r-0 border-t-0" : "rounded-br-xl border-l-0 border-t-0")
                  }`}
                />
              ))}

              {!detected && !uploadProcessing && (
                <>
                  <motion.div
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-4 right-4 h-0.5 bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)]"
                    style={{ position: "absolute" }}
                  />
                  <p className="text-white/70 text-xs z-10">Scanning…</p>
                </>
              )}

              {uploadProcessing && !detected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 text-white"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full"
                  />
                  <p className="text-xs text-white/80">Reading QR…</p>
                </motion.div>
              )}

              {detected && (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2 text-white"
                >
                  <Zap size={48} className="text-primary" />
                  <p className="text-sm font-semibold">QR Detected!</p>
                </motion.div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 gap-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => fileInputRef.current?.click()}
                disabled={detected || uploadProcessing}
              >
                <ImageUp size={16} />
                Upload QR from Gallery
              </Button>
              <Button variant="outline" className="h-12 px-5" onClick={onClose}>
                Cancel
              </Button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QrScannerModal;
