import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, ImageUp, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestCamera, getCachedStatus } from "@/lib/permissions";

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
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine mock result based on title
  useEffect(() => {
    if (title.toLowerCase().includes("agent")) setScanType("agent");
    else if (title.toLowerCase().includes("recipient") || title.toLowerCase().includes("send")) setScanType("recipient");
    else setScanType("merchant");
  }, [title]);

  // Request camera when modal opens
  useEffect(() => {
    if (!open) {
      setDetected(false);
      setUploadProcessing(false);
      setCameraError(false);
      // Stop camera stream on close
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        setCameraStream(null);
      }
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      const result = await requestCamera();
      if (cancelled) {
        // Modal closed before camera resolved
        if (result.data) (result.data as MediaStream).getTracks().forEach(t => t.stop());
        return;
      }
      if (result.status === "granted" && result.data) {
        setCameraStream(result.data as MediaStream);
      } else {
        setCameraError(true);
        // Fall back to mock scanning
        startMockScan();
      }
    };

    startCamera();

    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});

      // Mock: detect after 3 seconds (real QR detection would use a library)
      const timer = setTimeout(() => {
        setDetected(true);
        setTimeout(() => {
          onScan(MOCK_RESULTS[scanType]);
          onClose();
        }, 600);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [cameraStream, scanType]); // eslint-disable-line react-hooks/exhaustive-deps

  const startMockScan = () => {
    const timer = setTimeout(() => {
      setDetected(true);
      setTimeout(() => {
        onScan(MOCK_RESULTS[scanType]);
        onClose();
      }, 600);
    }, 2000);
    return () => clearTimeout(timer);
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [cameraStream]);

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
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-1" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Viewfinder */}
            <div className="relative aspect-square w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              {/* Real camera feed */}
              {cameraStream && !detected && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              {/* Corner brackets */}
              {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
                <div
                  key={i}
                  className={`absolute ${pos} w-8 h-8 border-[3px] border-white/80 z-10 ${
                    i < 2 ? (i === 0 ? "rounded-tl-xl border-r-0 border-b-0" : "rounded-tr-xl border-l-0 border-b-0")
                    : (i === 2 ? "rounded-bl-xl border-r-0 border-t-0" : "rounded-br-xl border-l-0 border-t-0")
                  }`}
                />
              ))}

              {!detected && !uploadProcessing && !cameraStream && !cameraError && (
                <div className="flex flex-col items-center gap-2 text-white z-10">
                  <Camera size={32} className="text-white/60 animate-pulse" />
                  <p className="text-white/70 text-xs">Starting camera…</p>
                </div>
              )}

              {!detected && !uploadProcessing && cameraError && (
                <>
                  <motion.div
                    animate={{ top: ["10%", "90%", "10%"] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-4 right-4 h-0.5 bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)] z-10"
                    style={{ position: "absolute" }}
                  />
                  <p className="text-white/70 text-xs z-10">Scanning…</p>
                </>
              )}

              {!detected && !uploadProcessing && cameraStream && (
                <motion.div
                  animate={{ top: ["10%", "90%", "10%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-4 right-4 h-0.5 bg-primary shadow-[0_0_8px_2px_hsl(var(--primary)/0.6)] z-10"
                  style={{ position: "absolute" }}
                />
              )}

              {uploadProcessing && !detected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 text-white z-10"
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
                  className="flex flex-col items-center gap-2 text-white z-10"
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
