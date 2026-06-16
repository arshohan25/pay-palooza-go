import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ImageUp, Flashlight, FlashlightOff, Info, CheckCircle2, ScanText, Loader2 } from "lucide-react";
import jsQR from "jsqr";
import { requestCamera } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { activityTracker } from "@/lib/activityTracker";

const trackScan = (source: "camera" | "upload" | "ocr" | "multi", decoded: string) => {
  const preview = decoded.length > 60 ? decoded.slice(0, 60) + "…" : decoded;
  activityTracker.qr("qr_scanned", { source, preview });
};

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  title?: string;
}

const QrScannerModal = ({ open, onClose, onScan, title = "Scan any QR" }: QrScannerModalProps) => {
  const [detected, setDetected] = useState(false);
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResults, setOcrResults] = useState<string[]>([]);
  const [ocrError, setOcrError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanningRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // ─── QR scan frame loop ──────────────────────────────────────────────────
  const scanFrame = useCallback(() => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(scanFrame); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
    if (code && code.data) {
      scanningRef.current = false;
      setDetected(true);
      trackScan("camera", code.data);
      setTimeout(() => { onScan(code.data); onClose(); }, 600);
      return;
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, onClose]);

  // ─── Camera lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setDetected(false);
      setUploadProcessing(false);
      setCameraError(false);
      setTorchOn(false);
      setTorchSupported(false);
      setOcrScanning(false);
      setOcrResults([]);
      setOcrError("");
      scanningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); setCameraStream(null); }
      return;
    }
    let cancelled = false;
    const startCamera = async () => {
      const result = await requestCamera();
      if (cancelled) { if (result.data) (result.data as MediaStream).getTracks().forEach(t => t.stop()); return; }
      if (result.status === "granted" && result.data) {
        const stream = result.data as MediaStream;
        setCameraStream(stream);
        const track = stream.getVideoTracks()[0];
        const caps = (track as any).getCapabilities?.();
        if (caps?.torch) setTorchSupported(true);
      } else {
        setCameraError(true);
      }
    };
    startCamera();
    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
      scanningRef.current = true;
      rafRef.current = requestAnimationFrame(scanFrame);
      return () => { scanningRef.current = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }
  }, [cameraStream, scanFrame]);

  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
    };
  }, [cameraStream]);

  // ─── Torch ───────────────────────────────────────────────────────────────
  const toggleTorch = async () => {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch {}
  };

  // ─── Gallery upload ──────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProcessing(true);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setUploadProcessing(false); return; }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
      if (code && code.data) {
        setDetected(true);
        trackScan("upload", code.data);
        setTimeout(() => { onScan(code.data); onClose(); setUploadProcessing(false); }, 600);
      } else {
        // No QR found — try OCR on the uploaded image
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        performOcr(dataUrl);
        setUploadProcessing(false);
      }
    };
    img.onerror = () => setUploadProcessing(false);
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  // ─── OCR: capture frame & send to edge function ──────────────────────────
  const captureFrameForOcr = () => {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_ENOUGH_DATA) return;

    const canvas = document.createElement("canvas");
    // Use a smaller resolution for faster upload
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    performOcr(dataUrl);
  };

  const performOcr = async (imageDataUrl: string) => {
    setOcrScanning(true);
    setOcrResults([]);
    setOcrError("");

    try {
      const { data, error } = await supabase.functions.invoke("ocr-scan-number", {
        body: { image: imageDataUrl },
      });

      if (error) throw error;

      const allResults: string[] = [
        ...(data?.numbers || []),
        ...(data?.merchant_codes || []),
      ];

      if (allResults.length === 0) {
        setOcrError("No numbers found. Try again with clearer text.");
      } else if (allResults.length === 1) {
        // Single result — auto-select
        setDetected(true);
        trackScan("ocr", allResults[0]);
        setTimeout(() => { onScan(allResults[0]); onClose(); }, 600);
      } else {
        // Multiple results — let user pick
        setOcrResults(allResults);
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      setOcrError("Could not read the number. Try again.");
    } finally {
      setOcrScanning(false);
    }
  };

  const handleSelectOcrResult = (result: string) => {
    setDetected(true);
    setTimeout(() => { onScan(result); onClose(); }, 600);
  };

  const cornerClass = "absolute w-10 h-10 z-20";
  const borderColor = detected ? "border-emerald-400" : "border-white";
  const borderW = "border-[3.5px]";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black flex flex-col"
        >
          {/* Camera feed background */}
          {cameraStream && (
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay is handled by viewfinder box-shadow below */}

          {/* Top bar */}
          <div className="relative z-30 flex items-center justify-between px-5 pt-[env(safe-area-inset-top,12px)] mt-3">
            <div className="w-10" />
            <div className="flex items-center gap-1.5">
              <h2 className="text-white text-base font-bold tracking-tight">{title}</h2>
              <Info size={14} className="text-white/50" />
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Viewfinder area */}
          <div className="relative z-20 flex-1 min-h-0 flex flex-col items-center justify-center">
            <div className="relative w-[240px] h-[240px] m-4 bg-transparent rounded-lg" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}>
              {/* Corner brackets */}
              <div className={`${cornerClass} -top-2 -left-2 ${borderW} ${borderColor} border-r-0 border-b-0 rounded-tl-2xl transition-colors duration-300`} />
              <div className={`${cornerClass} -top-2 -right-2 ${borderW} ${borderColor} border-l-0 border-b-0 rounded-tr-2xl transition-colors duration-300`} />
              <div className={`${cornerClass} -bottom-2 -left-2 ${borderW} ${borderColor} border-r-0 border-t-0 rounded-bl-2xl transition-colors duration-300`} />
              <div className={`${cornerClass} -bottom-2 -right-2 ${borderW} ${borderColor} border-l-0 border-t-0 rounded-br-2xl transition-colors duration-300`} />

              {/* Scan line */}
              {!detected && cameraStream && !uploadProcessing && !ocrScanning && ocrResults.length === 0 && (
                <motion.div
                  animate={{ top: ["5%", "92%", "5%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-3 right-3 h-0.5 rounded-full z-30"
                  style={{
                    background: "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)",
                    boxShadow: "0 0 12px 3px hsl(var(--primary) / 0.5)",
                  }}
                />
              )}

              {/* Camera starting state */}
              {!cameraStream && !cameraError && !detected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* Camera error */}
              {cameraError && !detected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60 text-xs text-center px-4">
                  <p>Camera not available</p>
                  <p className="text-[10px] text-white/40">Use gallery upload below</p>
                </div>
              )}

              {/* Upload processing */}
              {uploadProcessing && !detected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* OCR scanning state */}
              {ocrScanning && !detected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 size={32} className="text-primary animate-spin" />
                  <p className="text-white text-xs font-medium">Reading number...</p>
                </div>
              )}

              {/* OCR results — multiple numbers found */}
              {ocrResults.length > 1 && !detected && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3">
                  <p className="text-white/70 text-[10px] uppercase tracking-wider mb-1">Numbers found</p>
                  {ocrResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectOcrResult(r)}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/15 backdrop-blur-sm text-white text-sm font-mono font-semibold text-center active:scale-95 transition-transform"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              {/* OCR error */}
              {ocrError && !detected && !ocrScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <p className="text-amber-400 text-xs">{ocrError}</p>
                  <button
                    onClick={captureFrameForOcr}
                    className="text-white/70 text-[10px] underline"
                  >
                    Tap to retry
                  </button>
                </div>
              )}

              {/* Detected state */}
              {detected && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={36} className="text-emerald-400" />
                  </div>
                  <p className="text-white text-sm font-semibold">Detected!</p>
                </motion.div>
              )}
            </div>

            {/* Help text */}
            <p className="text-white/50 text-[11px] text-center mt-4 px-8 leading-relaxed">
              Scan QR code or tap "Read Number" to scan a phone number.
            </p>
          </div>

          {/* Bottom controls */}
          <div className="relative z-30 shrink-0 px-5 pb-[max(env(safe-area-inset-bottom,12px),12px)]">
            {/* Action buttons */}
            <div className="flex items-center justify-center gap-5 mb-4">
              <button
                onClick={toggleTorch}
                disabled={!torchSupported || detected}
                className="flex flex-col items-center gap-1.5 disabled:opacity-30"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${torchOn ? "bg-primary/20 ring-2 ring-primary/40" : "bg-white/10 backdrop-blur-sm"}`}>
                  {torchOn
                    ? <Flashlight size={20} className="text-primary" />
                    : <FlashlightOff size={20} className="text-white/80" />
                  }
                </div>
                <span className="text-white/60 text-[10px] font-medium">Torch</span>
              </button>

              {/* OCR Scan Number button */}
              <button
                onClick={captureFrameForOcr}
                disabled={detected || ocrScanning || (!cameraStream && !cameraError)}
                className="flex flex-col items-center gap-1.5 disabled:opacity-30"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${ocrScanning ? "bg-primary/20 ring-2 ring-primary/40" : "bg-white/15 backdrop-blur-sm border border-white/20"}`}>
                  {ocrScanning
                    ? <Loader2 size={22} className="text-primary animate-spin" />
                    : <ScanText size={22} className="text-white" />
                  }
                </div>
                <span className="text-white/60 text-[10px] font-medium">Read Number</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={detected || uploadProcessing}
                className="flex flex-col items-center gap-1.5 disabled:opacity-30"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <ImageUp size={20} className="text-white/80" />
                </div>
                <span className="text-white/60 text-[10px] font-medium">Gallery</span>
              </button>
            </div>

            {/* Branding footer */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-white/30 text-[9px] uppercase tracking-widest">Supports</span>
              <img
                src="/icons/easypay-logo.webp"
                alt="EasyPay"
                className="h-5 opacity-60"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QrScannerModal;
