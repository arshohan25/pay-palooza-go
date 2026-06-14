import { useState, useRef, useEffect, useCallback } from "react";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, CheckCircle2, Camera, Eye,
  AlertCircle, ShieldCheck, CreditCard,
  FileCheck, Clock, ScanFace, Pencil, Check, X,
  Loader2, RefreshCw, Sparkles, UserCog,
  Briefcase, Heart, Wallet, MapPin, Users, Crop, Lock, Unlock,
  ScrollText, CircleCheck,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "intro" | "terms" | "nid_capture" | "nid_details" | "additional_info" | "selfie" | "review" | "submitted";

const STEPS: Step[] = ["intro", "terms", "nid_capture", "nid_details", "additional_info", "selfie", "review"];

// ─── Select Field Options ─────────────────────────────────────────────────────
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const OCCUPATION_OPTIONS = ["Student", "Business", "Government Job", "Private Job", "Freelancer", "Homemaker", "Retired", "Other"];
const INCOME_OPTIONS = ["Below ৳10,000", "৳10,001–৳25,000", "৳25,001–৳50,000", "৳50,001–৳1,00,000", "Above ৳1,00,000"];
const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed"];

// ─── Utility helpers ──────────────────────────────────────────────────────────
const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
};

// ─── Glassmorphic SelectField ─────────────────────────────────────────────────
interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  icon: React.ElementType;
  gradient: string;
  delay?: number;
}

const SelectField = ({ label, value, onChange, options, placeholder, icon: Icon, gradient, delay = 0 }: SelectFieldProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, type: "spring", stiffness: 300, damping: 28 }}
    className="space-y-1.5"
  >
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">{label}</p>
    <div className="flex items-center gap-3 p-1 rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-sm">
      <div className={`w-10 h-10 ${gradient} rounded-xl flex items-center justify-center text-primary-foreground shrink-0 shadow-sm`}>
        <Icon size={18} />
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 h-10 text-sm font-medium">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="z-[120]">
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </motion.div>
);

// ─── Slide variants ───────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "30%" : "-30%", opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "30%" : "-30%", opacity: 0, scale: 0.96 }),
};

// ─── Image Cropper Component ──────────────────────────────────────────────────
interface ImageCropperProps {
  image: string;
  onCrop: (croppedDataUrl: string) => void;
  onRetake: () => void;
}

// ─── Pinch-to-Zoom Image Viewer ───────────────────────────────────────────────
const ZoomableImage = ({ src, alt }: { src: string; alt: string }) => {
  const [zoomed, setZoomed] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [previewAspect, setPreviewAspect] = useState<number | null>(null);
  const lastDist = useRef(0);
  const lastCenter = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const lastTouch = useRef({ x: 0, y: 0 });

  const resetView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      lastDist.current = Math.hypot(dx, dy);
      lastCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging.current = true;
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy);
      if (lastDist.current > 0) {
        const newScale = Math.min(5, Math.max(1, scale * (dist / lastDist.current)));
        setScale(newScale);
        if (newScale <= 1) resetView();
      }
      lastDist.current = dist;
    } else if (e.touches.length === 1 && isDragging.current && scale > 1) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;
      setTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchEnd = () => {
    lastDist.current = 0;
    isDragging.current = false;
    if (scale <= 1.05) resetView();
  };

  return (
    <>
      {/* Inline preview - tap to open fullscreen */}
      <div
        className="relative rounded-2xl overflow-hidden border-2 border-primary/30 shadow-glow bg-muted/30 cursor-zoom-in"
        style={{ aspectRatio: previewAspect ? `${previewAspect}` : "16/10" }}
        onClick={() => { setZoomed(true); resetView(); }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) {
              setPreviewAspect(naturalWidth / naturalHeight);
            }
          }}
        />
        <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm flex items-center gap-1">
          <Eye size={12} className="text-white" />
          <span className="text-[9px] text-white font-bold">TAP TO ZOOM</span>
        </div>
      </div>

      {/* Fullscreen zoom modal */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col"
          >
            {/* Close bar */}
            <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2">
              <button
                onClick={() => { setZoomed(false); resetView(); }}
                className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={20} className="text-white" />
              </button>
              <p className="text-white/70 text-xs font-medium">{alt}</p>
              <button
                onClick={resetView}
                className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-bold active:scale-95 transition-transform"
              >
                Reset
              </button>
            </div>

            {/* Zoomable area */}
            <div
              className="flex-1 flex items-center justify-center overflow-hidden touch-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={src}
                alt={alt}
                className="max-w-full max-h-full object-contain transition-transform duration-75"
                style={{
                  transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                }}
                draggable={false}
              />
            </div>

            {/* Zoom indicator */}
            {scale > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md">
                <p className="text-white text-xs font-bold">{scale.toFixed(1)}×</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const ImageCropper = ({ image, onCrop, onRetake }: ImageCropperProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [locked, setLocked] = useState(true); // 16:10 aspect lock ON by default
  const [dragging, setDragging] = useState<null | "move" | "tl" | "tr" | "bl" | "br">(null);
  const dragStart = useRef({ mx: 0, my: 0, box: { x: 0, y: 0, w: 0, h: 0 } });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const ASPECT = 16 / 10;

  useEffect(() => {
    if (imgLoaded && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;
      setContainerSize({ w: cw, h: ch });
      // Initialize with 16:10 locked crop centered
      const pad = 16;
      let bw = cw - pad * 2;
      let bh = bw / ASPECT;
      if (bh > ch - pad * 2) {
        bh = ch - pad * 2;
        bw = bh * ASPECT;
      }
      setCropBox({ x: (cw - bw) / 2, y: (ch - bh) / 2, w: bw, h: bh });
    }
  }, [imgLoaded]);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  const MIN_SIZE = 60;

  const handlePointerDown = (e: React.PointerEvent, type: "move" | "tl" | "tr" | "bl" | "br") => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(type);
    dragStart.current = { mx: e.clientX, my: e.clientY, box: { ...cropBox } };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    const { x, y, w, h } = dragStart.current.box;
    const { w: cw, h: ch } = containerSize;

    if (dragging === "move") {
      setCropBox({
        x: clamp(x + dx, 0, cw - w),
        y: clamp(y + dy, 0, ch - h),
        w, h,
      });
    } else if (locked) {
      // Aspect-locked resize: use the dominant axis
      let newW: number, newH: number, newX: number, newY: number;
      if (dragging === "br") {
        newW = clamp(w + dx, MIN_SIZE, cw - x);
        newH = newW / ASPECT;
        if (y + newH > ch) { newH = ch - y; newW = newH * ASPECT; }
        setCropBox({ x, y, w: newW, h: newH });
      } else if (dragging === "bl") {
        newW = clamp(w - dx, MIN_SIZE, x + w);
        newH = newW / ASPECT;
        newX = x + w - newW;
        if (y + newH > ch) { newH = ch - y; newW = newH * ASPECT; newX = x + w - newW; }
        setCropBox({ x: newX, y, w: newW, h: newH });
      } else if (dragging === "tr") {
        newW = clamp(w + dx, MIN_SIZE, cw - x);
        newH = newW / ASPECT;
        newY = y + h - newH;
        if (newY < 0) { newY = 0; newH = h + y - newY; newW = newH * ASPECT; }
        setCropBox({ x, y: newY, w: newW, h: newH });
      } else if (dragging === "tl") {
        newW = clamp(w - dx, MIN_SIZE, x + w);
        newH = newW / ASPECT;
        newX = x + w - newW;
        newY = y + h - newH;
        if (newY < 0) { newY = 0; newH = h + y; newW = newH * ASPECT; newX = x + w - newW; }
        setCropBox({ x: newX, y: newY, w: newW, h: newH });
      }
    } else {
      // Free resize (unlocked)
      if (dragging === "br") {
        setCropBox({ x, y, w: clamp(w + dx, MIN_SIZE, cw - x), h: clamp(h + dy, MIN_SIZE, ch - y) });
      } else if (dragging === "bl") {
        const newW = clamp(w - dx, MIN_SIZE, x + w);
        setCropBox({ x: x + w - newW, y, w: newW, h: clamp(h + dy, MIN_SIZE, ch - y) });
      } else if (dragging === "tr") {
        const newH = clamp(h - dy, MIN_SIZE, y + h);
        setCropBox({ x, y: y + h - newH, w: clamp(w + dx, MIN_SIZE, cw - x), h: newH });
      } else if (dragging === "tl") {
        const newW = clamp(w - dx, MIN_SIZE, x + w);
        const newH = clamp(h - dy, MIN_SIZE, y + h);
        setCropBox({ x: x + w - newW, y: y + h - newH, w: newW, h: newH });
      }
    }
  };

  const handlePointerUp = () => setDragging(null);

  const performCrop = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;
    const { w: cw, h: ch } = containerSize;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    // Calculate object-cover mapping: the image is scaled to fill the container
    const containerAspect = cw / ch;
    const imageAspect = nw / nh;
    let sx: number, sy: number, sw: number, sh: number;

    if (imageAspect > containerAspect) {
      // Image is wider — height fills, width is cropped
      const visibleW = nh * containerAspect;
      sx = (nw - visibleW) / 2;
      sy = 0;
      sw = visibleW;
      sh = nh;
    } else {
      // Image is taller — width fills, height is cropped
      const visibleH = nw / containerAspect;
      sx = 0;
      sy = (nh - visibleH) / 2;
      sw = nw;
      sh = visibleH;
    }

    // Map crop box from container coords to the visible portion of the image
    const scaleX = sw / cw;
    const scaleY = sh / ch;
    const srcX = sx + cropBox.x * scaleX;
    const srcY = sy + cropBox.y * scaleY;
    const srcW = cropBox.w * scaleX;
    const srcH = cropBox.h * scaleY;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(srcW);
    canvas.height = Math.round(srcH);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    const croppedUrl = canvas.toDataURL("image/jpeg", 0.9);
    haptics.medium();
    onCrop(croppedUrl);
  };

  const handleStyle = "w-6 h-6 bg-white border-2 border-primary rounded-full absolute shadow-lg z-10 touch-none";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-3"
    >
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden border-2 border-primary/30 shadow-glow bg-black"
        style={{ aspectRatio: "16/10" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <img
          ref={imgRef}
          src={image}
          alt="Crop preview"
          className="w-full h-full object-cover"
          onLoad={() => setImgLoaded(true)}
          draggable={false}
        />
        {imgLoaded && (
          <>
            {/* Dark overlay outside crop */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `linear-gradient(to right, rgba(0,0,0,0.6) ${cropBox.x}px, transparent ${cropBox.x}px, transparent ${cropBox.x + cropBox.w}px, rgba(0,0,0,0.6) ${cropBox.x + cropBox.w}px)`,
            }} />
            <div className="absolute pointer-events-none" style={{
              left: cropBox.x, top: 0, width: cropBox.w, height: cropBox.y,
              background: "rgba(0,0,0,0.6)",
            }} />
            <div className="absolute pointer-events-none" style={{
              left: cropBox.x, top: cropBox.y + cropBox.h, width: cropBox.w, bottom: 0,
              background: "rgba(0,0,0,0.6)",
            }} />

            {/* Crop border */}
            <div
              className="absolute border-2 border-white/90 rounded-lg cursor-move touch-none"
              style={{ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h }}
              onPointerDown={(e) => handlePointerDown(e, "move")}
            >
              {/* Corner lines */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-md" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-md" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-md" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-md" />

              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
              </div>
            </div>

            {/* Drag handles */}
            <div className={handleStyle} style={{ left: cropBox.x - 12, top: cropBox.y - 12 }} onPointerDown={(e) => handlePointerDown(e, "tl")} />
            <div className={handleStyle} style={{ left: cropBox.x + cropBox.w - 12, top: cropBox.y - 12 }} onPointerDown={(e) => handlePointerDown(e, "tr")} />
            <div className={handleStyle} style={{ left: cropBox.x - 12, top: cropBox.y + cropBox.h - 12 }} onPointerDown={(e) => handlePointerDown(e, "bl")} />
            <div className={handleStyle} style={{ left: cropBox.x + cropBox.w - 12, top: cropBox.y + cropBox.h - 12 }} onPointerDown={(e) => handlePointerDown(e, "br")} />
          </>
        )}
      </div>

      {/* Lock toggle + action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLocked(!locked)}
          className={`h-11 px-3 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all ${
            locked
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground"
          }`}
          title={locked ? "Unlock aspect ratio" : "Lock to 16:10"}
        >
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
          <span className="text-[11px]">{locked ? "16:10" : "Free"}</span>
        </button>
        <button
          onClick={onRetake}
          className="flex-1 h-11 rounded-2xl border border-border bg-card text-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        >
          <RefreshCw size={14} /> Retake
        </button>
        <button
          onClick={performCrop}
          className="flex-1 h-11 rounded-2xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[0.97] transition-transform"
        >
          <Crop size={14} /> Crop
        </button>
      </div>
    </motion.div>
  );
};

// ─── Camera Component ─────────────────────────────────────────────────────────
interface CameraBoxProps {
  label: string;
  preview: string | null;
  onCapture: (dataUrl: string) => void;
  onClose?: () => void;
  icon: React.ElementType;
  gradient: string;
  guideText: string;
  retakeLabel: string;
  isNidCard?: boolean;
}

const CameraBox = ({ label, preview, onCapture, onClose, icon: Icon, gradient, guideText, retakeLabel, isNidCard = false }: CameraBoxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashEffect, setFlashEffect] = useState(false);
  const { t } = useI18n();

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isNidCard ? "environment" : "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(err.name === "NotAllowedError"
        ? t("cameraPermissionDenied")
        : t("cameraNotAvailable"));
    }
  }, [isNidCard, t]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!preview) startCamera();
    return () => stopCamera();
  }, [preview, startCamera, stopCamera]);

  useEffect(() => {
    if (preview) return;
    const navEls = Array.from(document.querySelectorAll<HTMLElement>('[data-global-nav="true"]'));
    navEls.forEach((el) => {
      el.dataset.prevDisplay = el.style.display;
      el.style.display = "none";
    });

    return () => {
      navEls.forEach((el) => {
        el.style.display = el.dataset.prevDisplay ?? "";
        delete el.dataset.prevDisplay;
      });
    };
  }, [preview]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 300);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    if (!isNidCard) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    onCapture(dataUrl);
    haptics.medium();
  };

  const retake = () => {
    onCapture("");
    startCamera();
  };

  if (preview) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</p>
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 shadow-glow">
          <img src={preview} alt={label} className="w-full object-cover" />
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 flex justify-center">
            <button
              onClick={retake}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm font-semibold hover:bg-white/30 transition-colors"
            >
              <RefreshCw size={14} /> {retakeLabel}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-primary font-medium px-1">
          <CheckCircle2 size={13} /> {t("photoCaptured")}
        </div>
      </div>
    );
  }

  // ── FULLSCREEN IMMERSIVE CAMERA ──
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Camera feed — fills entire screen */}
      <div className="relative flex-1 overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center bg-gradient-to-b from-black via-[hsl(260,30%,8%)] to-black">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[hsl(340,80%,55%)] to-[hsl(280,70%,50%)] flex items-center justify-center shadow-[0_0_40px_rgba(220,50,100,0.4)]"
            >
              <AlertCircle size={36} className="text-white" />
            </motion.div>
            <p className="text-base font-bold text-white">{cameraError}</p>
            <p className="text-xs text-white/50">ক্যামেরা পারমিশন দিন বা আবার চেষ্টা করুন</p>
            <button
              onClick={startCamera}
              className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[hsl(340,80%,55%)] to-[hsl(280,70%,50%)] text-white font-bold text-sm shadow-lg active:scale-95 transition-transform"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${!isNidCard ? "scale-x-[-1]" : ""}`}
            />

            {/* Flash effect */}
            <AnimatePresence>
              {flashEffect && (
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-white z-50"
                />
              )}
            </AnimatePresence>

            {/* Dark vignette overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)"
            }} />

            {/* Top floating bar */}
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-3"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)" }}
            >
              <button
                onClick={() => { stopCamera(); onClose ? onClose() : onCapture(""); }}
                className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/20 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={20} className="text-white" />
              </button>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/10">
                  <p className="text-[11px] font-bold text-white tracking-wide">{label}</p>
                </div>
              </div>
              <div className="w-10" /> {/* spacer */}
            </motion.div>

            {/* NID card frame overlay */}
            {isNidCard && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="relative"
                  style={{ width: "88%", aspectRatio: "86/54" }}
                >
                  {/* Animated scanning border */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-white/50" />
                  
                  {/* Bright corner brackets */}
                  <div className="absolute -top-[1px] -left-[1px] w-8 h-8 border-t-[3px] border-l-[3px] border-white rounded-tl-2xl" />
                  <div className="absolute -top-[1px] -right-[1px] w-8 h-8 border-t-[3px] border-r-[3px] border-white rounded-tr-2xl" />
                  <div className="absolute -bottom-[1px] -left-[1px] w-8 h-8 border-b-[3px] border-l-[3px] border-white rounded-bl-2xl" />
                  <div className="absolute -bottom-[1px] -right-[1px] w-8 h-8 border-b-[3px] border-r-[3px] border-white rounded-br-2xl" />
                  
                  {/* Scanning line */}
                  <motion.div
                    animate={{ top: ["5%", "95%", "5%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-2 right-2 h-[2px] rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent, hsl(340,80%,55%), hsl(280,70%,60%), transparent)",
                      boxShadow: "0 0 12px 3px hsla(340,80%,55%,0.5)"
                    }}
                  />
                </motion.div>
              </div>
            )}

            {/* Selfie face frame */}
            {!isNidCard && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="w-52 h-64 border-2 border-white/50 rounded-[40%] relative"
                >
                  <div className="absolute -top-1 -left-1 w-7 h-7 border-t-[3px] border-l-[3px] border-white rounded-tl-3xl" />
                  <div className="absolute -top-1 -right-1 w-7 h-7 border-t-[3px] border-r-[3px] border-white rounded-tr-3xl" />
                  <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-[3px] border-l-[3px] border-white rounded-bl-3xl" />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-[3px] border-r-[3px] border-white rounded-br-3xl" />
                </motion.div>
              </div>
            )}

            {/* Bottom controls area */}
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
              className="absolute bottom-0 inset-x-0 z-20 pb-[env(safe-area-inset-bottom,16px)]"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)" }}
            >
              <div className="flex flex-col items-center gap-4 pt-10 pb-6">
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-xs font-medium text-white/80 tracking-wide"
                >
                  {guideText}
                </motion.p>

                {cameraActive && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={capture}
                    className="relative w-[76px] h-[76px] rounded-full flex items-center justify-center"
                  >
                    <div className="absolute inset-0 rounded-full border-[3px] border-white/80" />
                    <motion.div
                      animate={{ boxShadow: ["0 0 0 0 rgba(255,255,255,0.3)", "0 0 0 8px rgba(255,255,255,0)", "0 0 0 0 rgba(255,255,255,0.3)"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-[62px] h-[62px] rounded-full bg-white"
                    />
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

// ─── Tip chip ─────────────────────────────────────────────────────────────────
const TipChip = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2 text-xs text-muted-foreground">
    <CheckCircle2 size={13} className="text-primary mt-0.5 shrink-0" />
    {text}
  </div>
);

// ─── Editable field ───────────────────────────────────────────────────────────
const EditableField = ({
  label, value, onChange, placeholder, notExtractedLabel = "Not extracted"
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; notExtractedLabel?: string }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    onChange(draft.trim() || value);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            placeholder={placeholder}
            className="flex-1 h-9 rounded-xl border border-primary/50 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button onClick={commit} className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            <Check size={14} />
          </button>
          <button onClick={cancel} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 h-9 px-3 rounded-xl border border-border bg-muted/30">
          <span className="text-sm text-foreground flex-1 truncate">{value || <span className="text-muted-foreground italic">{notExtractedLabel}</span>}</span>
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil size={13} />
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Review row ───────────────────────────────────────────────────────────────
const ReviewDoc = ({
  label, preview, onRetake, gradient, icon: Icon, retakeLabel, uploadedLabel, notUploadedLabel
}: {
  label: string; preview: string | null; onRetake: () => void; gradient: string; icon: React.ElementType;
  retakeLabel: string; uploadedLabel: string; notUploadedLabel: string;
}) => (
  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
    {preview ? (
      <img src={preview} alt={label} className="w-16 h-10 rounded-lg object-cover shrink-0 border border-border" />
    ) : (
      <div className={`w-16 h-10 ${gradient} rounded-lg flex items-center justify-center text-primary-foreground shrink-0`}>
        <Icon size={18} />
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-foreground truncate">{label}</p>
      <p className={`text-xs font-medium ${preview ? "text-primary" : "text-destructive"}`}>
        {preview ? uploadedLabel : notUploadedLabel}
      </p>
    </div>
    <button
      onClick={onRetake}
      className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
    >
      {retakeLabel}
    </button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
interface KycFlowProps {
  onClose: () => void;
  agentMode?: boolean;
  targetUserId?: string;
}

const KycFlow = ({ onClose, agentMode = false, targetUserId }: KycFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]         = useState<Step>(agentMode ? "nid_capture" : "intro");
  const [direction, setDir]     = useState(1);
  
  // KYC existing status check
  const [kycStatus, setKycStatus] = useState<null | "pending" | "verified" | "rejected">(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(agentMode ? false : true);

  useEffect(() => {
    if (agentMode) return; // Skip status check in agent mode
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatusLoading(false); return; }
      const { data } = await supabase
        .from("kyc_verifications")
        .select("status, reviewer_notes")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.status === "verified" || data?.status === "pending" || data?.status === "rejected") {
        setKycStatus(data.status as "verified" | "pending" | "rejected");
        if (data.status === "rejected") {
          setRejectionReason(data.reviewer_notes || null);
        }
      }
      setStatusLoading(false);
    })();
  }, [agentMode]);

  // NID capture states: raw = just captured (pre-crop), final = cropped
  const [nidFrontRaw, setNidFrontRaw] = useState<string | null>(null);
  const [nidFront, setNidFront] = useState<string | null>(null);
  const [croppingFront, setCroppingFront] = useState(false);
  
  const [nidBackRaw, setNidBackRaw] = useState<string | null>(null);
  const [nidBack, setNidBack]   = useState<string | null>(null);
  const [croppingBack, setCroppingBack] = useState(false);
  
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);

  const [nidName, setNidName]     = useState("");
  const [nidNameBn, setNidNameBn] = useState("");
  const [nidNumber, setNidNumber] = useState("");
  const [nidDob, setNidDob]       = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");

  // Additional info state
  const [occupation, setOccupation] = useState("");
  const [gender, setGender] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [address, setAddress] = useState("");
   const [addressFromBack, setAddressFromBack] = useState(false);
   const [backOcrLoading, setBackOcrLoading] = useState(false);

   const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone]     = useState(false);
  const [faceMatchLoading, setFaceMatchLoading] = useState(false);
  const [faceMatchResult, setFaceMatchResult] = useState<{ match: boolean; confidence: number; result: string; reason: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step, dir = 1) => {
    // Subtle double-tap haptic for step transitions
    haptics.light();
    setTimeout(() => haptics.light(), 80);
    setDir(dir);
    setStep(next);
  };

  const goBack = () => {
    haptics.medium();
    if (step === "intro")           { onClose(); return; }
    if (step === "terms")           { goTo("intro", -1); return; }
    if (step === "nid_capture")     { agentMode ? onClose() : goTo("terms", -1); return; }
    if (step === "nid_details")     { goTo("nid_capture", -1); return; }
    if (step === "additional_info") { goTo("nid_details", -1); return; }
    if (step === "selfie")          { goTo("additional_info", -1); return; }
    if (step === "review")          { goTo("selfie", -1); return; }
  };

  // Run OCR when NID front is captured
  const runOcr = useCallback(async (imageData: string) => {
    if (!imageData) return;
    setOcrLoading(true);
    setOcrDone(false);
    try {
      const base64 = imageData.replace(/^data:image\/[a-z]+;base64,/, "");
      const { data, error } = await supabase.functions.invoke("kyc-ocr", {
        body: { image_base64: base64, side: "front" },
      });
      if (error) throw error;

      const extracted = data?.data ?? {};
      const fullName = pickFirstString(extracted.full_name, extracted.full_name_en, extracted.name, extracted.fullName, extracted.english_name);
      const fullNameBn = pickFirstString(extracted.full_name_bn, extracted.name_bn, extracted.bangla_name);
      const nidNumberValue = pickFirstString(extracted.nid_number, extracted.nid_no, extracted.nid, extracted.id_number, extracted.national_id).replace(/\D/g, "");
      const dateOfBirth = pickFirstString(extracted.date_of_birth, extracted.dob, extracted.birth_date, extracted.birthDate);
      const fatherNameValue = pickFirstString(extracted.father_name, extracted.father, extracted.fatherName);
      const motherNameValue = pickFirstString(extracted.mother_name, extracted.mother, extracted.motherName);

      if (fullName) setNidName(fullName);
      if (fullNameBn) setNidNameBn(fullNameBn);
      if (nidNumberValue) setNidNumber(nidNumberValue);
      if (dateOfBirth) setNidDob(dateOfBirth);
      if (fatherNameValue) setFatherName(fatherNameValue);
      if (motherNameValue) setMotherName(motherNameValue);

      const hasFrontData = [fullName, nidNumberValue, dateOfBirth, fatherNameValue, motherNameValue].some(Boolean);
      if (hasFrontData) {
        setOcrDone(true);
      } else {
        toast.error("NID তথ্য পড়া যায়নি, আবার পরিষ্কার ছবি তুলুন");
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      toast.error(t("ocrFailed"));
    } finally {
      setOcrLoading(false);
    }
  }, [t]);

  // Run OCR on NID back and extract address only
  const runBackOcr = useCallback(async (imageData: string) => {
    if (!imageData) return;
    setBackOcrLoading(true);
    try {
      const base64 = imageData.replace(/^data:image\/[a-z]+;base64,/, "");
      const { data, error } = await supabase.functions.invoke("kyc-ocr", {
        body: { image_base64: base64, side: "back" },
      });
      if (error) throw error;

      console.log("Back OCR response:", data);
      const extracted = data?.data || {};
      const extractedAddress = pickFirstString(
        extracted.address,
        extracted.permanent_address,
        extracted.present_address,
        extracted.current_address,
        extracted.full_address,
        extracted.address_bn,
        extracted.permanent_address_bn,
        extracted.present_address_bn,
      );

      if (extractedAddress) {
        setAddress(extractedAddress);
        setAddressFromBack(true);
        toast.success("ঠিকানা NID থেকে নেওয়া হয়েছে");
      } else {
        console.warn("No address found in back OCR:", extracted);
        toast.error("ঠিকানা খুঁজে পাওয়া যায়নি, ম্যানুয়ালি লিখুন");
      }
    } catch (err) {
      console.error("Back OCR error:", err);
      toast.error("Back OCR ব্যর্থ হয়েছে");
    } finally {
      setBackOcrLoading(false);
    }
  }, []);

  // Run face match when selfie is captured
  const runFaceMatch = useCallback(async (selfieData: string) => {
    if (!selfieData || !nidFront) return;
    setFaceMatchLoading(true);
    setFaceMatchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("kyc-face-match", {
        body: { nid_image_base64: nidFront, selfie_base64: selfieData },
      });
      if (error) throw error;
      if (data?.data) {
        setFaceMatchResult(data.data);
        if (data.data.result === "match") {
          haptics.success();
          toast.success(t("faceMatchSuccess"));
        } else if (data.data.result === "no_match") {
          toast.error(t("faceMatchFailed"));
        } else {
          toast(t("faceMatchInconclusive"));
        }
      }
    } catch (err: any) {
      console.error("Face match error:", err);
      toast.error(t("faceMatchError"));
    } finally {
      setFaceMatchLoading(false);
    }
  }, [nidFront, t]);

  // NID front capture → show cropper
  const handleNidFrontCapture = (dataUrl: string) => {
    if (!dataUrl) { setNidFrontRaw(null); setNidFront(null); setCroppingFront(false); return; }
    setNidFrontRaw(dataUrl);
    setCroppingFront(true);
  };

  // NID front crop confirmed
  const handleFrontCropped = (croppedUrl: string) => {
    setNidFront(croppedUrl);
    setCroppingFront(false);
    runOcr(croppedUrl);
  };

  // NID back capture → show cropper
  const handleNidBackCapture = (dataUrl: string) => {
    if (!dataUrl) { setNidBackRaw(null); setNidBack(null); setCroppingBack(false); return; }
    setNidBackRaw(dataUrl);
    setCroppingBack(true);
  };

  // NID back crop confirmed
  const handleBackCropped = (croppedUrl: string) => {
    setNidBack(croppedUrl);
    setCroppingBack(false);
    runBackOcr(croppedUrl);
  };

  const handleSelfieCapture = (dataUrl: string) => {
    if (!dataUrl) { setSelfiePhoto(null); setFaceMatchResult(null); return; }
    setSelfiePhoto(dataUrl);
    runFaceMatch(dataUrl);
  };

  // Upload to storage and save to DB
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let userId: string;
      if (agentMode && targetUserId) {
        userId = targetUserId;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { toast.error(t("notAuthenticated")); setSubmitting(false); return; }
        userId = session.user.id;
      }

      // Check if this NID is already verified by another account
      if (nidNumber.trim()) {
        const { data: existingKyc } = await supabase
          .from("kyc_verifications")
          .select("id, user_id, status")
          .eq("nid_number", nidNumber.trim())
          .eq("status", "verified")
          .neq("user_id", userId)
          .limit(1);

        if (existingKyc && existingKyc.length > 0) {
          // Auto-reject: another account already verified with this NID
          toast.error("এই NID দিয়ে অন্য একটি অ্যাকাউন্ট ইতোমধ্যে যাচাই করা হয়েছে। একটি NID দিয়ে শুধুমাত্র একটি অ্যাকাউন্ট যাচাই করা যায়।");
          setSubmitting(false);
          return;
        }
      }

      const uploadPhoto = async (base64: string, filename: string) => {
        const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, "");
        const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "image/jpeg" });
        const path = `${userId}/${filename}`;
        const { error } = await supabase.storage.from("kyc-documents").upload(path, blob, { upsert: true });
        if (error) throw error;
        return path;
      };

      const [frontPath, backPath, selfiePath] = await Promise.all([
        nidFront ? uploadPhoto(nidFront, `nid-front-${Date.now()}.jpg`) : Promise.resolve(null),
        nidBack ? uploadPhoto(nidBack, `nid-back-${Date.now()}.jpg`) : Promise.resolve(null),
        selfiePhoto ? uploadPhoto(selfiePhoto, `selfie-${Date.now()}.jpg`) : Promise.resolve(null),
      ]);

      const { error: insertError } = await supabase.from("kyc_verifications" as any).insert({
        user_id: userId,
        status: "pending",
        nid_number: nidNumber,
        full_name: nidName,
        date_of_birth: nidDob,
        nid_front_url: frontPath,
        nid_back_url: backPath,
        selfie_url: selfiePath,
        face_match_score: faceMatchResult?.confidence ?? null,
        face_match_result: faceMatchResult?.result ?? null,
        ocr_raw_data: {
          full_name: nidName,
          full_name_bn: nidNameBn,
          nid_number: nidNumber,
          date_of_birth: nidDob,
          father_name: fatherName,
          mother_name: motherName,
          occupation,
          gender,
          monthly_income: monthlyIncome,
          marital_status: maritalStatus,
          address,
        },
      } as any);

      if (insertError) throw insertError;

      haptics.success();
      goTo("submitted");
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error(err.message || t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const canAdvanceCapture    = !!nidFront && !!nidBack && !croppingFront && !croppingBack;
  const canAdvanceNidDetails = !!nidName.trim() && !!nidNumber.trim() && !!nidDob.trim();
  const canAdvanceAdditional = !!gender && !!occupation && !!monthlyIncome && !!maritalStatus;
  const canAdvanceSelfie     = !!selfiePhoto && !!faceMatchResult;
  const canSubmit            = !!nidFront && !!nidBack && !!selfiePhoto && !!faceMatchResult && canAdvanceNidDetails && canAdvanceAdditional;

  // Show status screen if already verified or pending (after all hooks)
  if (statusLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (kycStatus === "verified") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 mx-auto">
            <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
        </motion.div>
        <h2 className="text-xl font-bold text-foreground mb-1.5">KYC Verified ✓</h2>
        <p className="text-muted-foreground text-sm mb-6">Your identity has been successfully verified. You have full access to all features.</p>
        <button
          onClick={onClose}
          className="h-11 px-8 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow active:scale-[0.97] transition-transform"
        >
          Done
        </button>
      </div>
    );
  }

  if (kycStatus === "pending") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
          <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 mx-auto">
            <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
        </motion.div>
        <h2 className="text-xl font-bold text-foreground mb-1.5">Under Review</h2>
        <p className="text-muted-foreground text-sm mb-6">Your KYC submission is being reviewed. We'll notify you once it's approved.</p>
        <button
          onClick={onClose}
          className="h-11 px-8 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow active:scale-[0.97] transition-transform"
        >
          Close
        </button>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4 mx-auto">
            <X className="w-10 h-10 text-destructive" />
          </div>
        </motion.div>
        <h2 className="text-xl font-bold text-foreground mb-1.5">Verification Rejected</h2>
        {rejectionReason && (
          <div className="w-full max-w-sm rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 mb-4">
            <p className="text-sm text-destructive font-medium">Reason</p>
            <p className="text-sm text-muted-foreground mt-1">{rejectionReason}</p>
          </div>
        )}
        {!rejectionReason && (
          <p className="text-muted-foreground text-sm mb-4">Your KYC submission was rejected. Please resubmit with correct documents.</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="h-11 px-6 rounded-2xl border border-border text-foreground font-semibold text-sm active:scale-[0.97] transition-transform"
          >
            Close
          </button>
          <button
            onClick={() => {
              setKycStatus(null);
              setRejectionReason(null);
              setStep("intro");
            }}
            className="h-11 px-6 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm shadow-glow active:scale-[0.97] transition-transform"
          >
            Resubmit KYC
          </button>
        </div>
      </div>
    );
  }

  const headerGradient = (() => {
    if (step === "intro" || step === "terms") return "gradient-hero";
    if (step === "nid_capture")     return "gradient-payment";
    if (step === "nid_details")     return "gradient-cashout";
    if (step === "additional_info") return "gradient-primary";
    if (step === "selfie")          return "gradient-accent";
    return "gradient-primary";
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col max-w-md mx-auto">

      {step !== "submitted" && step !== "intro" && step !== "terms" && (
        <motion.div
          className={`${headerGradient} px-4 pt-3 pb-3 text-primary-foreground`}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">{t("kycTitle")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("secureIdCheck")}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.55)]"
              animate={{ width: `${(Math.max(0, stepIndex) / (STEPS.length - 1)) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="absolute inset-0 overflow-y-auto scrollbar-none flex flex-col will-change-transform"
          >

            {/* ── Intro / Welcome Screen ── */}
            {step === "intro" && (
              <div className="flex flex-col min-h-full">
                {/* Gradient Header */}
                <div className="relative overflow-clip bg-gradient-to-br from-[hsl(330,80%,55%)] via-[hsl(340,85%,50%)] to-[hsl(350,80%,45%)] px-5 pt-4 pb-8 text-white">
                  <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/8 pointer-events-none translate-x-12 -translate-y-12" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 pointer-events-none -translate-x-8 translate-y-16" />
                  
                  <div className="relative flex items-center gap-3 mb-6">
                    <button
                      onClick={onClose}
                      className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-lg font-extrabold tracking-tight">{t("kycTitle")}</h1>
                  </div>

                  {/* Centered icon */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
                    className="flex justify-center mb-6"
                  >
                    <div className="relative">
                      {/* Main icon box — soft teal/green rounded square */}
                      <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-[hsl(170,55%,92%)] to-[hsl(160,45%,84%)] flex items-center justify-center shadow-[0_6px_24px_rgba(0,0,0,0.12)]">
                        <ShieldCheck size={38} strokeWidth={2} className="text-[hsl(152,73%,39%)]" />
                      </div>
                      {/* Pink badge */}
                      <motion.div
                        className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(340,80%,58%)] to-[hsl(330,75%,48%)] flex items-center justify-center shadow-[0_3px_12px_rgba(220,40,80,0.35)] ring-2 ring-white"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                      >
                        <Sparkles size={16} className="text-white" />
                      </motion.div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center"
                  >
                    <h2 className="text-lg font-bold leading-snug">
                      অনুগ্রহ করে আপনার তথ্য<br />হালনাগাদ করুন
                    </h2>
                    <p className="text-xs text-white/70 mt-2 leading-relaxed max-w-[260px] mx-auto">
                      আপনার অ্যাকাউন্টের নিরাপত্তা ও সম্পূর্ণ সেবা পেতে KYC যাচাই সম্পন্ন করুন
                    </p>
                  </motion.div>
                </div>

                {/* Floating gradient banner */}
                <div className="relative z-10 flex justify-center -mt-6 mb-[-14px]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25, type: "spring", stiffness: 300 }}
                    className="bg-gradient-to-r from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)] text-white font-bold text-[13px] px-7 py-3 rounded-full shadow-[0_4px_20px_rgba(220,40,80,0.4)] tracking-wide"
                  >
                    ৩টি সহজ ধাপে আপনার তথ্য সাবমিট করুন
                  </motion.div>
                </div>

                {/* Steps overview */}
                <div className="flex-1 px-5">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    className="bg-card rounded-3xl border border-border shadow-lg p-5 pt-7"
                  >

                    <div className="space-y-0">
                      {/* Step 1 */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        className="flex items-start gap-4"
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)] flex items-center justify-center text-white shadow-md">
                            <CreditCard size={22} />
                          </div>
                          <div className="w-0.5 h-8 bg-gradient-to-b from-[hsl(330,80%,55%)/40] to-transparent mt-1" />
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm font-bold text-foreground">আপনার NID এর ছবি তুলুন</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            জাতীয় পরিচয়পত্রের সামনে ও পিছনের ছবি ক্যামেরা দিয়ে তুলুন
                          </p>
                        </div>
                        <span className="text-4xl font-black text-muted/10 select-none leading-none mt-1">1</span>
                      </motion.div>

                      {/* Step 2 */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55 }}
                        className="flex items-start gap-4"
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(217,80%,50%)] to-[hsl(230,75%,45%)] flex items-center justify-center text-white shadow-md">
                            <FileCheck size={22} />
                          </div>
                          <div className="w-0.5 h-8 bg-gradient-to-b from-[hsl(217,80%,50%)/40] to-transparent mt-1" />
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm font-bold text-foreground">প্রয়োজনীয় তথ্য প্রদান করুন</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            নাম, জন্মতারিখ, পেশা ও অন্যান্য তথ্য যাচাই করুন
                          </p>
                        </div>
                        <span className="text-4xl font-black text-muted/10 select-none leading-none mt-1">2</span>
                      </motion.div>

                      {/* Step 3 */}
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 }}
                        className="flex items-start gap-4"
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(160,60%,45%)] to-[hsl(170,55%,40%)] flex items-center justify-center text-white shadow-md">
                            <ScanFace size={22} />
                          </div>
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm font-bold text-foreground">নিজের চেহারার ছবি তুলুন</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            NID ফটোর সাথে মিলিয়ে দেখতে একটি সেলফি তুলুন
                          </p>
                        </div>
                        <span className="text-4xl font-black text-muted/10 select-none leading-none mt-1">3</span>
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Info note */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="flex items-start gap-3 mt-4 px-1"
                  >
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck size={15} className="text-primary" />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      আপনার সকল তথ্য সম্পূর্ণ নিরাপদ ও এনক্রিপ্টেড। শুধুমাত্র যাচাইয়ের উদ্দেশ্যে ব্যবহৃত হবে।
                    </p>
                  </motion.div>
                </div>

                {/* Bottom sticky button */}
                <div className="sticky bottom-0 p-5 pt-3 pb-5 bg-gradient-to-t from-background via-background to-transparent">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => goTo("terms")}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)] text-white font-bold text-base shadow-lg shadow-[hsl(340,85%,50%)/25] flex items-center justify-center gap-2 active:shadow-md transition-shadow"
                  >
                    শুরু করুন
                    <ChevronLeft size={18} className="rotate-180" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── Terms & Conditions ── */}
            {step === "terms" && (
              <div className="flex flex-col min-h-full">
                {/* Gradient Header — compact with no icon clipping */}
                <div className="relative overflow-clip bg-gradient-to-br from-[hsl(330,80%,55%)] via-[hsl(340,85%,50%)] to-[hsl(350,80%,45%)] px-5 pt-4 pb-6 text-white">
                  <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/8 pointer-events-none translate-x-12 -translate-y-12" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 pointer-events-none -translate-x-8 translate-y-16" />
                  
                  <div className="relative flex items-center gap-3">
                    <button
                      onClick={goBack}
                      className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-lg font-extrabold tracking-tight">শর্তসমূহ</h1>
                  </div>
                </div>

                {/* Floating subtitle banner */}
                <div className="relative z-10 flex justify-center -mt-4 mb-2">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 300 }}
                    className="bg-gradient-to-r from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)] text-white font-bold text-[13px] px-6 py-2.5 rounded-full shadow-[0_4px_20px_rgba(220,40,80,0.35)] tracking-wide"
                  >
                    KYC যাচাইয়ের শর্তাবলী
                  </motion.div>
                </div>

                {/* Terms Content */}
                <div className="flex-1 px-4 pb-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="bg-card rounded-2xl border border-border shadow-lg p-4 space-y-3"
                  >
                    <div className="space-y-3 text-[13px] text-foreground leading-relaxed max-h-[380px] overflow-y-auto pr-1 scrollbar-none">
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                        <div className="w-9 h-9 min-w-[36px] rounded-full bg-gradient-to-br from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)] flex items-center justify-center text-white shrink-0 shadow-sm">
                          <span className="text-xs font-bold">১</span>
                        </div>
                        <p className="pt-1.5">আমি নিশ্চিত করছি যে, আমার প্রদানকৃত সকল তথ্য সঠিক এবং সত্য। ভুল বা মিথ্যা তথ্য প্রদান করলে আমার অ্যাকাউন্ট স্থগিত বা বন্ধ করা হতে পারে।</p>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                        <div className="w-9 h-9 min-w-[36px] rounded-full bg-gradient-to-br from-[hsl(217,80%,50%)] to-[hsl(230,75%,45%)] flex items-center justify-center text-white shrink-0 shadow-sm">
                          <span className="text-xs font-bold">২</span>
                        </div>
                        <p className="pt-1.5">আমি সম্মত যে, আমার জাতীয় পরিচয়পত্র (NID), সেলফি এবং ব্যক্তিগত তথ্য শুধুমাত্র পরিচয় যাচাইয়ের জন্য ব্যবহৃত হবে এবং নিরাপদে সংরক্ষণ করা হবে।</p>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                        <div className="w-9 h-9 min-w-[36px] rounded-full bg-gradient-to-br from-[hsl(160,60%,45%)] to-[hsl(170,55%,40%)] flex items-center justify-center text-white shrink-0 shadow-sm">
                          <span className="text-xs font-bold">৩</span>
                        </div>
                        <p className="pt-1.5">আমি বুঝতে পারছি যে, KYC যাচাই সম্পন্ন না হলে কিছু সেবা সীমিত থাকতে পারে, যেমন: উচ্চ লেনদেনের সীমা এবং নির্দিষ্ট ফিচার অ্যাক্সেস।</p>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                        <div className="w-9 h-9 min-w-[36px] rounded-full bg-gradient-to-br from-[hsl(40,90%,55%)] to-[hsl(30,85%,50%)] flex items-center justify-center text-white shrink-0 shadow-sm">
                          <span className="text-xs font-bold">৪</span>
                        </div>
                        <p className="pt-1.5">আমি সম্মতি দিচ্ছি যে, প্রযোজ্য আইন অনুযায়ী আমার তথ্য সরকারি বা নিয়ন্ত্রক সংস্থার সাথে শেয়ার করা হতে পারে।</p>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                        <div className="w-9 h-9 min-w-[36px] rounded-full bg-gradient-to-br from-[hsl(270,60%,55%)] to-[hsl(280,55%,50%)] flex items-center justify-center text-white shrink-0 shadow-sm">
                          <span className="text-xs font-bold">৫</span>
                        </div>
                        <p className="pt-1.5">আমি জানি যে, KYC যাচাই প্রক্রিয়া সম্পন্ন হতে কিছু সময় লাগতে পারে এবং আমাকে ধৈর্য ধরতে হবে।</p>
                      </motion.div>
                    </div>

                    {/* Read More link */}
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      onClick={() => setTermsSheetOpen(true)}
                      className="text-xs font-bold text-primary underline underline-offset-2 mx-auto block mt-2"
                    >
                      📖 বিস্তারিত পড়ুন (Read More)
                    </motion.button>
                  </motion.div>

                  {/* Accept checkbox */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4"
                  >
                    <button
                      onClick={() => { setTermsAccepted(!termsAccepted); haptics.light(); }}
                      className="flex items-start gap-3 w-full text-left px-1"
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        termsAccepted 
                          ? "bg-gradient-to-br from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)] border-transparent shadow-md" 
                          : "border-border bg-card"
                      }`}>
                        {termsAccepted && <Check size={14} className="text-white" />}
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        আমি উপরের সকল <span className="font-bold text-primary">শর্তাবলী</span> পড়েছি এবং সম্মত আছি
                      </p>
                    </button>
                  </motion.div>
                </div>

                {/* Full Terms Sheet */}
                <Sheet open={termsSheetOpen} onOpenChange={setTermsSheetOpen}>
                  <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
                    <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
                      <SheetTitle className="text-base font-extrabold text-foreground">📜 সম্পূর্ণ শর্তাবলী</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(85vh-80px)] px-5 py-4">
                      <div className="space-y-5 text-[13px] text-foreground leading-relaxed pb-8">
                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">১. তথ্যের সঠিকতা</h3>
                          <p>আমি নিশ্চিত করছি যে, আমার প্রদানকৃত সকল তথ্য সঠিক এবং সত্য। ভুল বা মিথ্যা তথ্য প্রদান করলে আমার অ্যাকাউন্ট স্থগিত বা বন্ধ করা হতে পারে। EasyPay যেকোনো সময় প্রদানকৃত তথ্য যাচাই করার অধিকার রাখে এবং অসঙ্গতি পাওয়া গেলে যথাযথ ব্যবস্থা নিতে পারে।</p>
                        </section>

                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">২. গোপনীয়তা ও তথ্য সুরক্ষা</h3>
                          <p>আমি সম্মত যে, আমার জাতীয় পরিচয়পত্র (NID), সেলফি এবং ব্যক্তিগত তথ্য শুধুমাত্র পরিচয় যাচাইয়ের জন্য ব্যবহৃত হবে এবং নিরাপদে সংরক্ষণ করা হবে। EasyPay আপনার ব্যক্তিগত তথ্য এনক্রিপ্ট করে সংরক্ষণ করে এবং তৃতীয় পক্ষের কাছে বিক্রি বা অননুমোদিতভাবে শেয়ার করে না। আপনার তথ্য শুধুমাত্র আইনি বাধ্যবাধকতা বা আপনার সম্মতি অনুযায়ী শেয়ার করা হতে পারে।</p>
                        </section>

                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">৩. সেবার সীমাবদ্ধতা</h3>
                          <p>আমি বুঝতে পারছি যে, KYC যাচাই সম্পন্ন না হলে কিছু সেবা সীমিত থাকতে পারে। এর মধ্যে রয়েছে:</p>
                          <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                            <li>দৈনিক লেনদেনের সর্বোচ্চ সীমা কম থাকবে</li>
                            <li>মাসিক লেনদেনের সীমা সীমিত থাকবে</li>
                            <li>ব্যাংক ট্রান্সফার এবং বড় অঙ্কের লেনদেন অক্ষম থাকতে পারে</li>
                            <li>কিছু প্রিমিয়াম ফিচার অ্যাক্সেস করা যাবে না</li>
                          </ul>
                        </section>

                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">৪. আইনি সম্মতি ও নিয়ন্ত্রক সংস্থা</h3>
                          <p>আমি সম্মতি দিচ্ছি যে, প্রযোজ্য আইন অনুযায়ী আমার তথ্য সরকারি বা নিয়ন্ত্রক সংস্থার সাথে শেয়ার করা হতে পারে। বাংলাদেশ ব্যাংক, BTRC এবং অন্যান্য নিয়ন্ত্রক সংস্থার নির্দেশনা অনুযায়ী EasyPay KYC প্রক্রিয়া পরিচালনা করে। মানি লন্ডারিং প্রতিরোধ আইন (AMLA) এবং সন্ত্রাস অর্থায়ন প্রতিরোধ আইন অনুযায়ী তথ্য সংরক্ষণ ও যাচাই করা হয়।</p>
                        </section>

                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">৫. প্রক্রিয়াকরণ সময়</h3>
                          <p>আমি জানি যে, KYC যাচাই প্রক্রিয়া সম্পন্ন হতে কিছু সময় লাগতে পারে এবং আমাকে ধৈর্য ধরতে হবে। সাধারণত যাচাই প্রক্রিয়া ২৪-৭২ ঘণ্টার মধ্যে সম্পন্ন হয়। তবে অতিরিক্ত যাচাইয়ের প্রয়োজন হলে আরও সময় লাগতে পারে। যাচাই সম্পন্ন হলে আপনাকে নোটিফিকেশনের মাধ্যমে জানানো হবে।</p>
                        </section>

                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">৬. অ্যাকাউন্ট স্থগিত ও বন্ধকরণ</h3>
                          <p>EasyPay নিম্নলিখিত ক্ষেত্রে আপনার অ্যাকাউন্ট স্থগিত বা বন্ধ করার অধিকার রাখে:</p>
                          <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                            <li>ভুল বা জাল পরিচয়পত্র প্রদান করলে</li>
                            <li>অন্য কারো পরিচয়পত্র ব্যবহার করলে</li>
                            <li>সন্দেহজনক কার্যকলাপ শনাক্ত হলে</li>
                            <li>নিয়ন্ত্রক সংস্থার নির্দেশনা অনুযায়ী</li>
                          </ul>
                        </section>

                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">৭. তথ্য আপডেট</h3>
                          <p>আপনার ব্যক্তিগত তথ্যে কোনো পরিবর্তন হলে (যেমন: ঠিকানা, ফোন নম্বর, বা NID তথ্য) আপনাকে যত দ্রুত সম্ভব EasyPay-তে তথ্য আপডেট করতে হবে। পুরানো বা ভুল তথ্যের কারণে সেবা ব্যাহত হলে EasyPay দায়ী থাকবে না।</p>
                        </section>

                        <section>
                          <h3 className="text-sm font-bold text-foreground mb-2">৮. যোগাযোগ</h3>
                          <p>KYC সংক্রান্ত যেকোনো প্রশ্ন বা সমস্যার জন্য EasyPay সাপোর্ট টিমের সাথে যোগাযোগ করুন। আমরা আপনাকে সাহায্য করতে সর্বদা প্রস্তুত।</p>
                        </section>
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>

                {/* Bottom button */}
                <div className="sticky bottom-0 p-5 pt-3 pb-6 bg-gradient-to-t from-background via-background to-transparent">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                    whileTap={{ scale: termsAccepted ? 0.97 : 1 }}
                    onClick={() => termsAccepted && goTo("nid_capture")}
                    disabled={!termsAccepted}
                    className={`w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
                      termsAccepted
                        ? "bg-gradient-to-r from-[hsl(330,80%,55%)] to-[hsl(350,80%,45%)] text-white shadow-lg shadow-[hsl(340,85%,50%)/25] active:shadow-md"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {termsAccepted ? (
                      <>
                        <CircleCheck size={18} />
                        সম্মত হয়ে এগিয়ে যান
                      </>
                    ) : (
                      "শর্তাবলীতে সম্মতি দিন"
                    )}
                  </motion.button>
                </div>
              </div>
            )}

            {step === "nid_capture" && (
               <div className="flex flex-col gap-4 px-4 pt-4 pb-5">
                <div className="text-center space-y-0.5">
                  <h2 className="text-lg font-bold text-foreground">{t("captureNidFront")}</h2>
                  <p className="text-xs text-muted-foreground">Capture both sides of your NID card</p>
                </div>

                {/* NID Front */}
                {croppingFront && nidFrontRaw ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Crop NID Front</p>
                    <ImageCropper
                      image={nidFrontRaw}
                      onCrop={handleFrontCropped}
                      onRetake={() => { setNidFrontRaw(null); setCroppingFront(false); }}
                    />
                  </div>
                ) : nidFront ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{t("nidCardFront")}</p>
                    <ZoomableImage src={nidFront} alt="NID Front" />
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 text-xs text-primary font-medium">
                        <CheckCircle2 size={13} /> Cropped & Saved
                      </div>
                      <button
                        onClick={() => { setNidFront(null); setNidFrontRaw(null); setOcrDone(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors"
                      >
                        <RefreshCw size={12} /> {t("retake")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <CameraBox
                    label={t("nidCardFront")}
                    preview={null}
                    onCapture={handleNidFrontCapture}
                    onClose={() => goTo("terms", -1)}
                    icon={CreditCard}
                    gradient="gradient-payment"
                    guideText={t("alignNidGuide")}
                    retakeLabel={t("retake")}
                    isNidCard
                  />
                )}

                {ocrLoading && (
                  <div className="flex items-center gap-2 rounded-xl bg-accent/10 border border-accent/20 px-4 py-3">
                    <Loader2 size={14} className="text-accent animate-spin" />
                    <p className="text-xs text-accent font-medium">{t("extractingNidData")}</p>
                  </div>
                )}

                {ocrDone && (
                  <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                    <Sparkles size={14} className="text-primary" />
                    <p className="text-xs text-primary font-medium">{t("nidDataExtracted")}</p>
                  </div>
                )}

                {/* NID Back — only show after front is done */}
                {nidFront && !croppingFront && (
                  <>
                    <div className="h-px bg-border" />
                    {croppingBack && nidBackRaw ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Crop NID Back</p>
                        <ImageCropper
                          image={nidBackRaw}
                          onCrop={handleBackCropped}
                          onRetake={() => { setNidBackRaw(null); setCroppingBack(false); }}
                        />
                      </div>
                    ) : nidBack ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{t("nidCardBack")}</p>
                        <ZoomableImage src={nidBack} alt="NID Back" />
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2 text-xs text-primary font-medium">
                            <CheckCircle2 size={13} /> Cropped & Saved
                          </div>
                          <button
                            onClick={() => { setNidBack(null); setNidBackRaw(null); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted text-foreground text-xs font-semibold hover:bg-muted/80 transition-colors"
                          >
                            <RefreshCw size={12} /> {t("retake")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <CameraBox
                        label={t("nidCardBack")}
                        preview={null}
                        onCapture={handleNidBackCapture}
                        onClose={() => {}}
                        icon={CreditCard}
                        gradient="gradient-send"
                        guideText={t("alignNidBackGuide")}
                        retakeLabel={t("retake")}
                        isNidCard
                      />
                    )}
                  </>
                )}

                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">📸 {t("cameraTips")}</p>
                  <TipChip text={t("tipCorners")} />
                  <TipChip text={t("tipGlare")} />
                  <TipChip text={t("tipSurface")} />
                </div>

                <button
                  onClick={() => canAdvanceCapture && goTo("nid_details")}
                  disabled={!canAdvanceCapture || ocrLoading}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canAdvanceCapture && !ocrLoading
                      ? "gradient-payment text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {ocrLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> {t("processingKyc")}
                    </span>
                  ) : canAdvanceCapture ? t("continueArrow") : "Capture both sides to continue"}
                </button>
              </div>
            )}

            {/* ── NID Details (editable) ── */}
            {step === "nid_details" && (
              <div className="flex flex-col min-h-full">
                <div className="flex-1 px-4 pt-4 pb-4 space-y-4">
                  <div className="text-center space-y-0.5">
                    <h2 className="text-lg font-bold text-foreground">{t("confirmNidDetails")}</h2>
                    <p className="text-xs text-muted-foreground">{t("confirmNidDetailsSub")}</p>
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-primary/8 border border-primary/15 px-4 py-2.5">
                    <Sparkles size={14} className="text-primary shrink-0" />
                    <p className="text-xs text-primary font-medium">{t("aiExtractedBadge")}</p>
                  </div>

                  <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-4">
                    <EditableField label={t("fullNameNid")} value={nidName} onChange={setNidName} placeholder="e.g. Tanvir Hasan" />
                    {nidNameBn && (
                      <EditableField label={t("fullNameBn")} value={nidNameBn} onChange={setNidNameBn} placeholder="বাংলা নাম" />
                    )}
                    <EditableField label={t("nidNumber")} value={nidNumber} onChange={setNidNumber} placeholder="e.g. 19901234567890" />
                    <EditableField label={t("dateOfBirth")} value={nidDob} onChange={setNidDob} placeholder="e.g. 01/01/1990" />
                    {fatherName && (
                      <EditableField label={t("fatherName")} value={fatherName} onChange={setFatherName} />
                    )}
                    {motherName && (
                      <EditableField label={t("motherName")} value={motherName} onChange={setMotherName} />
                    )}
                  </div>
                </div>

                <div className="sticky bottom-0 px-4 pb-5 pt-3 bg-gradient-to-t from-background via-background to-transparent">
                  <button
                    onClick={() => canAdvanceNidDetails && goTo("additional_info")}
                    disabled={!canAdvanceNidDetails}
                    className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                      canAdvanceNidDetails
                        ? "gradient-cashout text-primary-foreground shadow-glow"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {canAdvanceNidDetails ? t("confirmDetailsArrow") : t("fillAllFields")}
                  </button>
                </div>
              </div>
            )}

            {/* ── Additional Information ── */}
            {step === "additional_info" && (
              <div className="flex flex-col min-h-full">
                <div className="flex-1 px-4 pt-4 pb-4 space-y-4">
                  <div className="text-center space-y-1.5">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                      className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-glow mx-auto"
                    >
                      <UserCog size={22} />
                    </motion.div>
                    <h2 className="text-lg font-bold text-foreground">Additional Information</h2>
                    <p className="text-xs text-muted-foreground">Help us know you better for a seamless experience</p>
                  </div>

                  <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border shadow-card p-4 space-y-4">
                    <SelectField
                      label="Gender"
                      value={gender}
                      onChange={setGender}
                      options={GENDER_OPTIONS}
                      placeholder="Select gender"
                      icon={Users}
                      gradient="gradient-accent"
                      delay={0.05}
                    />
                    <SelectField
                      label="Occupation"
                      value={occupation}
                      onChange={setOccupation}
                      options={OCCUPATION_OPTIONS}
                      placeholder="Select occupation"
                      icon={Briefcase}
                      gradient="gradient-payment"
                      delay={0.1}
                    />
                    <SelectField
                      label="Monthly Income"
                      value={monthlyIncome}
                      onChange={setMonthlyIncome}
                      options={INCOME_OPTIONS}
                      placeholder="Select income range"
                      icon={Wallet}
                      gradient="gradient-send"
                      delay={0.15}
                    />
                    <SelectField
                      label="Marital Status"
                      value={maritalStatus}
                      onChange={setMaritalStatus}
                      options={MARITAL_OPTIONS}
                      placeholder="Select status"
                      icon={Heart}
                      gradient="gradient-cashout"
                      delay={0.2}
                    />

                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 28 }}
                      className="space-y-1.5"
                    >
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Address (Optional)</p>
                        {addressFromBack && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary">
                            <Sparkles size={9} /> NID Back থেকে
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 p-1 rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-sm">
                        <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
                          {backOcrLoading ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                              <Loader2 size={18} className="text-primary-foreground" />
                            </motion.div>
                          ) : (
                            <MapPin size={18} />
                          )}
                        </div>
                        {backOcrLoading ? (
                          <div className="flex-1 flex flex-col gap-1.5 py-2 px-1">
                            <motion.div
                              className="h-3 w-3/4 rounded-md bg-muted"
                              animate={{ opacity: [0.4, 0.8, 0.4] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <motion.div
                              className="h-2.5 w-1/2 rounded-md bg-muted"
                              animate={{ opacity: [0.3, 0.7, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                            />
                          </div>
                        ) : (
                          <input
                            value={address}
                            onChange={e => { setAddress(e.target.value); if (addressFromBack) setAddressFromBack(false); }}
                            placeholder="Enter your address"
                            className="flex-1 h-10 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none px-1"
                          />
                        )}
                      </div>
                    </motion.div>
                  </div>
                </div>

                <div className="sticky bottom-0 px-4 pb-5 pt-3 bg-gradient-to-t from-background via-background to-transparent">
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => canAdvanceAdditional && goTo("selfie")}
                    disabled={!canAdvanceAdditional}
                    className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                      canAdvanceAdditional
                        ? "gradient-primary text-primary-foreground shadow-glow"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    }`}
                  >
                    {canAdvanceAdditional ? t("continueArrow") : "Fill all required fields"}
                  </motion.button>
                </div>
              </div>
            )}

            {/* ── Selfie / Face Match ── */}
            {step === "selfie" && (
              <div className="flex flex-col gap-4 px-4 pt-4 pb-5">
                <div className="text-center space-y-0.5">
                  <h2 className="text-lg font-bold text-foreground">{t("liveFaceVerification")}</h2>
                  <p className="text-xs text-muted-foreground">{t("liveFaceVerificationSub")}</p>
                </div>

                <CameraBox
                  label={t("selfieCapture")}
                  preview={selfiePhoto}
                  onCapture={handleSelfieCapture}
                  onClose={() => goTo("additional_info", -1)}
                  icon={ScanFace}
                  gradient="gradient-accent"
                  guideText={t("alignFaceGuide")}
                  retakeLabel={t("retake")}
                  isNidCard={false}
                />

                {faceMatchLoading && (
                  <div className="flex items-center gap-3 rounded-xl bg-accent/10 border border-accent/20 px-4 py-3">
                    <Loader2 size={16} className="text-accent animate-spin" />
                    <div>
                      <p className="text-xs text-accent font-semibold">{t("comparingFaces")}</p>
                      <p className="text-[10px] text-accent/70">{t("aiAnalyzing")}</p>
                    </div>
                  </div>
                )}

                {faceMatchResult && (
                  <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                    faceMatchResult.result === "match"
                      ? "bg-primary/10 border-primary/20"
                      : faceMatchResult.result === "no_match"
                      ? "bg-destructive/10 border-destructive/20"
                      : "bg-accent/10 border-accent/20"
                  }`}>
                    {faceMatchResult.result === "match" ? (
                      <CheckCircle2 size={16} className="text-primary shrink-0" />
                    ) : (
                      <AlertCircle size={16} className={faceMatchResult.result === "no_match" ? "text-destructive" : "text-accent"} />
                    )}
                    <div className="flex-1">
                      <p className={`text-xs font-semibold ${
                        faceMatchResult.result === "match" ? "text-primary" : faceMatchResult.result === "no_match" ? "text-destructive" : "text-accent"
                      }`}>
                        {faceMatchResult.result === "match" ? t("faceMatchedNid") : faceMatchResult.result === "no_match" ? t("faceNotMatched") : t("faceInconclusive")}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t("confidence")}: {faceMatchResult.confidence}% — {faceMatchResult.reason}
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">🤳 {t("selfieTips")}</p>
                  <TipChip text={t("tipEvenLighting")} />
                  <TipChip text={t("tipRemoveGlasses")} />
                  <TipChip text={t("tipLookStraight")} />
                </div>

                {faceMatchResult?.result === "no_match" && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3">
                    <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive font-medium">{t("faceNotMatchedRetry")}</p>
                  </div>
                )}

                {canAdvanceSelfie && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => goTo("review")}
                    className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                  >
                    {t("reviewDocuments")}
                  </motion.button>
                )}
              </div>
            )}

            {/* ── Review ── */}
            {step === "review" && (
              <div className="flex flex-col gap-4 px-4 pt-4 pb-5">
                <div className="text-center space-y-0.5">
                  <h2 className="text-lg font-bold text-foreground">{t("reviewSubmit")}</h2>
                  <p className="text-xs text-muted-foreground">{t("reviewSubmitSub")}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">{t("documents")}</p>
                  <ReviewDoc
                    label={t("nidFrontLabel")}
                    preview={nidFront}
                    onRetake={() => goTo("nid_capture", -1)}
                    gradient="gradient-payment"
                    icon={CreditCard}
                    retakeLabel={t("retake")}
                    uploadedLabel={t("captured")}
                    notUploadedLabel={t("notCaptured")}
                  />
                  <ReviewDoc
                    label={t("nidBackLabel")}
                    preview={nidBack}
                    onRetake={() => goTo("nid_capture", -1)}
                    gradient="gradient-send"
                    icon={CreditCard}
                    retakeLabel={t("retake")}
                    uploadedLabel={t("captured")}
                    notUploadedLabel={t("notCaptured")}
                  />
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    {selfiePhoto ? (
                      <img src={selfiePhoto} alt="Selfie" className="w-16 h-10 rounded-lg object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="w-16 h-10 gradient-accent rounded-lg flex items-center justify-center text-primary-foreground shrink-0">
                        <ScanFace size={18} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{t("faceVerification")}</p>
                      <p className={`text-xs font-medium ${
                        faceMatchResult?.result === "match" ? "text-primary" : "text-destructive"
                      }`}>
                        {faceMatchResult?.result === "match"
                          ? `${t("matched")} (${faceMatchResult.confidence}%)`
                          : t("notCompleted")}
                      </p>
                    </div>
                    <button
                      onClick={() => goTo("selfie", -1)}
                      className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                    >
                      {t("redo")}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("nidDetails")}</p>
                    <button
                      onClick={() => goTo("nid_details", -1)}
                      className="flex items-center gap-1 text-xs text-primary font-semibold"
                    >
                      <Pencil size={11} /> {t("edit")}
                    </button>
                  </div>
                  <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3">
                    {[
                      { label: t("fullNameLabel"), value: nidName },
                      { label: t("nidNumber"), value: nidNumber },
                      { label: t("dateOfBirth"), value: nidDob },
                      ...(fatherName ? [{ label: t("fatherName"), value: fatherName }] : []),
                      ...(motherName ? [{ label: t("motherName"), value: motherName }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold text-foreground text-right">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Additional Info</p>
                    <button
                      onClick={() => goTo("additional_info", -1)}
                      className="flex items-center gap-1 text-xs text-primary font-semibold"
                    >
                      <Pencil size={11} /> {t("edit")}
                    </button>
                  </div>
                  <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3">
                    {[
                      { label: "Gender", value: gender },
                      { label: "Occupation", value: occupation },
                      { label: "Monthly Income", value: monthlyIncome },
                      { label: "Marital Status", value: maritalStatus },
                      ...(address ? [{ label: "Address", value: address }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold text-foreground text-right">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {canSubmit && (
                  <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                    {t("termsNote")}
                  </div>
                )}

                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={13} className="text-primary" />
                    <span>{t("encrypted256")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye size={13} className="text-primary" />
                    <span>{t("privateSecure")}</span>
                  </div>
                </div>

                <button
                  onClick={() => canSubmit && handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canSubmit && !submitting
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> {t("submittingKyc")}
                    </span>
                  ) : canSubmit ? t("submitForVerification") : t("completeAllFirst")}
                </button>
              </div>
            )}

            {/* ── Submitted ── */}
            {step === "submitted" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-8 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-28 h-28 gradient-primary rounded-3xl flex items-center justify-center text-primary-foreground shadow-glow"
                >
                  <FileCheck size={54} strokeWidth={1.5} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <h2 className="text-2xl font-bold text-foreground">{t("submittedTitle")}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    {t("kycSubmittedSub")}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-card p-4 space-y-3"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("verificationStatus")}</p>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl gradient-payment flex items-center justify-center text-primary-foreground shrink-0">
                      <CreditCard size={15} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">{t("nidDocuments")}</p>
                      <p className="text-xs text-muted-foreground">{t("frontBackCaptured")}</p>
                    </div>
                    <CheckCircle2 size={16} className="text-primary" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl gradient-accent flex items-center justify-center text-primary-foreground shrink-0">
                      <ScanFace size={15} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">{t("faceVerification")}</p>
                      <p className="text-xs text-muted-foreground">
                        {faceMatchResult?.result === "match"
                          ? `${t("matched")} (${faceMatchResult.confidence}%)`
                          : t("submitted")}
                      </p>
                    </div>
                    <CheckCircle2 size={16} className="text-primary" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Clock size={15} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">{t("reviewText")}</p>
                      <p className="text-xs text-muted-foreground">{t("underReview")}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                      {t("pendingUpper")}
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="flex items-center gap-4 text-xs text-muted-foreground"
                >
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={13} className="text-primary" />
                    <span>{t("encrypted256")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye size={13} className="text-primary" />
                    <span>{t("dataProtected")}</span>
                  </div>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  onClick={onClose}
                  className="w-full h-12 gradient-primary text-primary-foreground font-bold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                >
                  {t("backToHome")}
                </motion.button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default KycFlow;
