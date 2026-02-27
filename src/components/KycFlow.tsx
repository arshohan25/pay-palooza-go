import { useState, useRef, useEffect, useCallback } from "react";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, CheckCircle2, Camera, Eye,
  AlertCircle, ShieldCheck, CreditCard,
  FileCheck, Clock, ScanFace, Pencil, Check, X,
  Loader2, RefreshCw, Sparkles, UserCog,
  Briefcase, Heart, Wallet, MapPin, Users,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "nid_front" | "nid_back" | "nid_details" | "selfie" | "additional_info" | "review" | "submitted";

const STEPS: Step[] = ["nid_front", "nid_back", "nid_details", "selfie", "additional_info", "review"];

// ─── Select Field Options ─────────────────────────────────────────────────────
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const OCCUPATION_OPTIONS = ["Student", "Business", "Government Job", "Private Job", "Freelancer", "Homemaker", "Retired", "Other"];
const INCOME_OPTIONS = ["Below ৳10,000", "৳10,001–৳25,000", "৳25,001–৳50,000", "৳50,001–৳1,00,000", "Above ৳1,00,000"];
const MARITAL_OPTIONS = ["Single", "Married", "Divorced", "Widowed"];

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
        <SelectContent>
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
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Camera Component ─────────────────────────────────────────────────────────
interface CameraBoxProps {
  label: string;
  preview: string | null;
  onCapture: (dataUrl: string) => void;
  icon: React.ElementType;
  gradient: string;
  guideText: string;
  retakeLabel: string;
  isNidCard?: boolean;
}

const CameraBox = ({ label, preview, onCapture, icon: Icon, gradient, guideText, retakeLabel, isNidCard = false }: CameraBoxProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { t } = useI18n();

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: isNidCard ? "environment" : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
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

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    if (!isNidCard) {
      // Mirror for selfie
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

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</p>
      <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-border bg-black" style={{ aspectRatio: isNidCard ? "16/10" : "3/4" }}>
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className={`w-14 h-14 ${gradient} rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow`}>
              <AlertCircle size={26} />
            </div>
            <p className="text-sm font-semibold text-white">{cameraError}</p>
            <button onClick={startCamera} className="text-xs text-primary font-semibold underline">
              {t("tryAgain")}
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
            {/* Guide overlay */}
            {isNidCard && (
              <div className="absolute inset-4 border-2 border-white/40 rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-lg" />
              </div>
            )}
            {!isNidCard && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 border-2 border-white/40 rounded-[40%] relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-2xl" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-2xl" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-2xl" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-2xl" />
                </div>
              </div>
            )}
            {/* Guide text */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-3 px-4 text-center">
              <p className="text-xs text-white/80 font-medium">{guideText}</p>
            </div>
            {/* Capture button */}
            {cameraActive && (
              <div className="absolute bottom-14 inset-x-0 flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={capture}
                  className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center border-4 border-white/50 active:bg-white/90 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center">
                    <Camera size={20} className="text-primary" />
                  </div>
                </motion.button>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
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
interface KycFlowProps { onClose: () => void; }

const KycFlow = ({ onClose }: KycFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]         = useState<Step>("nid_front");
  const [direction, setDir]     = useState(1);
  const [nidFront, setNidFront] = useState<string | null>(null);
  const [nidBack, setNidBack]   = useState<string | null>(null);
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

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDone, setOcrDone]     = useState(false);
  const [faceMatchLoading, setFaceMatchLoading] = useState(false);
  const [faceMatchResult, setFaceMatchResult] = useState<{ match: boolean; confidence: number; result: string; reason: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step, dir = 1) => {
    haptics.medium();
    setDir(dir);
    setStep(next);
  };

  const goBack = () => {
    haptics.medium();
    if (step === "nid_front")      { onClose(); return; }
    if (step === "nid_back")       { goTo("nid_front", -1); return; }
    if (step === "nid_details")    { goTo("nid_back", -1); return; }
    if (step === "selfie")         { goTo("nid_details", -1); return; }
    if (step === "additional_info"){ goTo("selfie", -1); return; }
    if (step === "review")         { goTo("additional_info", -1); return; }
  };

  // Run OCR when NID front is captured
  const runOcr = useCallback(async (imageData: string) => {
    if (!imageData) return;
    setOcrLoading(true);
    setOcrDone(false);
    try {
      const { data, error } = await supabase.functions.invoke("kyc-ocr", {
        body: { image_base64: imageData },
      });
      if (error) throw error;
      if (data?.data) {
        const d = data.data;
        if (d.full_name) setNidName(d.full_name);
        if (d.full_name_bn) setNidNameBn(d.full_name_bn);
        if (d.nid_number) setNidNumber(d.nid_number);
        if (d.date_of_birth) setNidDob(d.date_of_birth);
        if (d.father_name) setFatherName(d.father_name);
        if (d.mother_name) setMotherName(d.mother_name);
        setOcrDone(true);
        toast.success(t("ocrExtracted"));
      }
    } catch (err: any) {
      console.error("OCR error:", err);
      toast.error(t("ocrFailed"));
    } finally {
      setOcrLoading(false);
    }
  }, [t]);

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

  const handleNidFrontCapture = (dataUrl: string) => {
    if (!dataUrl) { setNidFront(null); return; }
    setNidFront(dataUrl);
    runOcr(dataUrl);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { toast.error(t("notAuthenticated")); return; }
      const userId = session.user.id;

      // Upload photos to storage
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

      // Save to kyc_verifications - use raw query since table is new
      const { error: insertError } = await supabase.from("kyc_verifications" as any).insert({
        user_id: userId,
        status: "under_review",
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

  const canAdvanceNidFront   = !!nidFront;
  const canAdvanceNidBack    = !!nidBack;
  const canAdvanceNidDetails = !!nidName.trim() && !!nidNumber.trim() && !!nidDob.trim();
  const canAdvanceSelfie     = !!selfiePhoto && !!faceMatchResult;
  const canAdvanceAdditional = !!gender && !!occupation && !!monthlyIncome && !!maritalStatus;
  const canSubmit            = !!nidFront && !!nidBack && !!selfiePhoto && !!faceMatchResult && canAdvanceNidDetails && canAdvanceAdditional;

  const headerGradient = (() => {
    if (step === "nid_front")      return "gradient-payment";
    if (step === "nid_back")       return "gradient-send";
    if (step === "nid_details")    return "gradient-cashout";
    if (step === "selfie")         return "gradient-accent";
    if (step === "additional_info") return "gradient-primary";
    return "gradient-primary";
  })();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {step !== "submitted" && (
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
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
      )}

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute inset-0 overflow-y-auto scrollbar-none flex flex-col"
          >

            {/* ── NID Front ── */}
            {step === "nid_front" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{t("captureNidFront")}</h2>
                  <p className="text-sm text-muted-foreground">{t("captureNidFrontSub")}</p>
                </div>

                <CameraBox
                  label={t("nidCardFront")}
                  preview={nidFront}
                  onCapture={handleNidFrontCapture}
                  icon={CreditCard}
                  gradient="gradient-payment"
                  guideText={t("alignNidGuide")}
                  retakeLabel={t("retake")}
                  isNidCard
                />

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

                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">📸 {t("cameraTips")}</p>
                  <TipChip text={t("tipCorners")} />
                  <TipChip text={t("tipGlare")} />
                  <TipChip text={t("tipSurface")} />
                </div>

                <button
                  onClick={() => canAdvanceNidFront && goTo("nid_back")}
                  disabled={!canAdvanceNidFront || ocrLoading}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canAdvanceNidFront && !ocrLoading
                      ? "gradient-payment text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {ocrLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> {t("processingKyc")}
                    </span>
                  ) : canAdvanceNidFront ? t("continueArrow") : t("captureNidToContinue")}
                </button>
              </div>
            )}

            {/* ── NID Back ── */}
            {step === "nid_back" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{t("captureNidBack")}</h2>
                  <p className="text-sm text-muted-foreground">{t("captureNidBackSub")}</p>
                </div>

                <CameraBox
                  label={t("nidCardBack")}
                  preview={nidBack}
                  onCapture={(d) => { if (d) setNidBack(d); else setNidBack(null); }}
                  icon={CreditCard}
                  gradient="gradient-send"
                  guideText={t("alignNidBackGuide")}
                  retakeLabel={t("retake")}
                  isNidCard
                />

                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">📸 {t("cameraTips")}</p>
                  <TipChip text={t("tipBarcode")} />
                  <TipChip text={t("tipNoDamage")} />
                  <TipChip text={t("tipLighting")} />
                </div>

                <button
                  onClick={() => canAdvanceNidBack && goTo("nid_details")}
                  disabled={!canAdvanceNidBack}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canAdvanceNidBack
                      ? "gradient-send text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {canAdvanceNidBack ? t("continueArrow") : t("captureNidBackToContinue")}
                </button>
              </div>
            )}

            {/* ── NID Details (editable) ── */}
            {step === "nid_details" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{t("confirmNidDetails")}</h2>
                  <p className="text-sm text-muted-foreground">{t("confirmNidDetailsSub")}</p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-primary/8 border border-primary/15 px-4 py-2.5">
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">{t("aiExtractedBadge")}</p>
                </div>

                {nidFront && (
                  <img src={nidFront} alt="NID Front" className="w-full h-28 object-cover rounded-2xl border border-border" />
                )}

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

                <button
                  onClick={() => canAdvanceNidDetails && goTo("selfie")}
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
            )}

            {/* ── Selfie / Face Match ── */}
            {step === "selfie" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{t("liveFaceVerification")}</h2>
                  <p className="text-sm text-muted-foreground">{t("liveFaceVerificationSub")}</p>
                </div>

                <CameraBox
                  label={t("selfieCapture")}
                  preview={selfiePhoto}
                  onCapture={handleSelfieCapture}
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
                    onClick={() => goTo("additional_info")}
                    className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                  >
                    {t("continueArrow")}
                  </motion.button>
                )}
              </div>
            )}

            {/* ── Additional Information ── */}
            {step === "additional_info" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow mx-auto"
                  >
                    <UserCog size={30} />
                  </motion.div>
                  <h2 className="text-xl font-bold text-foreground">Additional Information</h2>
                  <p className="text-sm text-muted-foreground">Help us know you better for a seamless experience</p>
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
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Address (Optional)</p>
                    <div className="flex items-center gap-3 p-1 rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-sm">
                      <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
                        <MapPin size={18} />
                      </div>
                      <input
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="Enter your address"
                        className="flex-1 h-10 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none px-1"
                      />
                    </div>
                  </motion.div>
                </div>

                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => canAdvanceAdditional && goTo("review")}
                  disabled={!canAdvanceAdditional}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canAdvanceAdditional
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {canAdvanceAdditional ? t("reviewDocuments") : "Fill all required fields"}
                </motion.button>
              </div>
            )}

            {/* ── Review ── */}
            {step === "review" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{t("reviewSubmit")}</h2>
                  <p className="text-sm text-muted-foreground">{t("reviewSubmitSub")}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">{t("documents")}</p>
                  <ReviewDoc
                    label={t("nidFrontLabel")}
                    preview={nidFront}
                    onRetake={() => goTo("nid_front", -1)}
                    gradient="gradient-payment"
                    icon={CreditCard}
                    retakeLabel={t("retake")}
                    uploadedLabel={t("captured")}
                    notUploadedLabel={t("notCaptured")}
                  />
                  <ReviewDoc
                    label={t("nidBackLabel")}
                    preview={nidBack}
                    onRetake={() => goTo("nid_back", -1)}
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
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-12 text-center">
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
                  className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                >
                  {t("backToAccount")}
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
