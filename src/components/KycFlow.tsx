import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, CheckCircle2, Upload, Camera, Eye,
  AlertCircle, ShieldCheck, CreditCard, User, RotateCcw,
  FileCheck, Clock
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "nid_front" | "nid_back" | "selfie" | "review" | "submitted";

const STEPS: Step[] = ["nid_front", "nid_back", "selfie", "review"];

const STEP_META: Record<Step, { label: string; heading: string; sub: string }> = {
  nid_front: {
    label: "NID Front",
    heading: "Upload NID Front",
    sub: "Take a clear photo of the front of your National ID Card",
  },
  nid_back: {
    label: "NID Back",
    heading: "Upload NID Back",
    sub: "Now capture the back side of your National ID Card",
  },
  selfie: {
    label: "Selfie",
    heading: "Take a Selfie",
    sub: "Hold your phone at eye level in good lighting and look directly at the camera",
  },
  review: {
    label: "Review",
    heading: "Review & Submit",
    sub: "Check your documents before submitting for verification",
  },
  submitted: {
    label: "Done",
    heading: "",
    sub: "",
  },
};

// ─── Slide variants ───────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Upload Box ───────────────────────────────────────────────────────────────
interface UploadBoxProps {
  label: string;
  preview: string | null;
  onFile: (dataUrl: string) => void;
  icon: React.ElementType;
  gradient: string;
  accept?: string;
}

const UploadBox = ({ label, preview, onFile, icon: Icon, gradient, accept = "image/*" }: UploadBoxProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onFile(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{label}</p>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors overflow-hidden group"
        style={{ aspectRatio: preview ? "auto" : "16/9" }}
      >
        {preview ? (
          <div className="relative">
            <img src={preview} alt={label} className="w-full object-cover rounded-2xl" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2 text-white text-sm font-semibold">
              <RotateCcw size={16} /> Retake
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-4">
            <div className={`w-14 h-14 ${gradient} rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow`}>
              <Icon size={26} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground">Tap to upload</p>
              <p className="text-xs text-muted-foreground">JPG, PNG · Max 5MB</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border shadow-card">
              <Upload size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Choose File</span>
            </div>
          </div>
        )}
      </button>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
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

// ─── Review row ───────────────────────────────────────────────────────────────
const ReviewDoc = ({
  label, preview, onRetake, gradient, icon: Icon
}: {
  label: string; preview: string | null; onRetake: () => void; gradient: string; icon: React.ElementType;
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
        {preview ? "✓ Uploaded" : "Not uploaded"}
      </p>
    </div>
    <button
      onClick={onRetake}
      className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
    >
      Retake
    </button>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
interface KycFlowProps { onClose: () => void; }

const KycFlow = ({ onClose }: KycFlowProps) => {
  const [step, setStep]       = useState<Step>("nid_front");
  const [direction, setDir]   = useState(1);
  const [nidFront, setNidFront] = useState<string | null>(null);
  const [nidBack, setNidBack]   = useState<string | null>(null);
  const [selfie, setSelfie]     = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step, dir = 1) => {
    setDir(dir);
    setStep(next);
  };

  const goBack = () => {
    if (step === "nid_front") { onClose(); return; }
    if (step === "nid_back")  { goTo("nid_front", -1); return; }
    if (step === "selfie")    { goTo("nid_back", -1); return; }
    if (step === "review")    { goTo("selfie", -1); return; }
  };

  const canAdvanceNidFront = !!nidFront;
  const canAdvanceNidBack  = !!nidBack;
  const canAdvanceSelfie   = !!selfie;
  const canSubmit          = !!nidFront && !!nidBack && !!selfie;

  const headerGradient = (() => {
    if (step === "nid_front") return "gradient-payment";
    if (step === "nid_back")  return "gradient-send";
    if (step === "selfie")    return "gradient-accent";
    return "gradient-primary";
  })();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      {step !== "submitted" && (
        <div className={`${headerGradient} px-4 pt-12 pb-6 text-primary-foreground`}>
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold">KYC Verification</h1>
          </div>

          {/* Step pills */}
          <div className="flex gap-1.5 items-center flex-wrap">
            {STEPS.map((s, i) => {
              const si = STEPS.indexOf(step);
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                    i < si  ? "bg-white/30 text-white"
                    : i === si ? "bg-white text-foreground"
                    : "bg-white/10 text-white/50"
                  }`}>
                    {i < si ? <CheckCircle2 size={11} /> : <span>{i + 1}</span>}
                    <span>{STEP_META[s].label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-3 ${i < si ? "bg-white/50" : "bg-white/20"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Animated content ── */}
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
            className="absolute inset-0 overflow-y-auto flex flex-col"
          >

            {/* ── NID Front ── */}
            {step === "nid_front" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.nid_front.heading}</h2>
                  <p className="text-sm text-muted-foreground">{STEP_META.nid_front.sub}</p>
                </div>

                <UploadBox
                  label="NID Card — Front Side"
                  preview={nidFront}
                  onFile={setNidFront}
                  icon={CreditCard}
                  gradient="gradient-payment"
                />

                {/* Tips */}
                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">📋 Photo Tips</p>
                  <TipChip text="Ensure all 4 corners of the card are visible" />
                  <TipChip text="Avoid glare, shadows, or blurry images" />
                  <TipChip text="Place card on a dark, flat surface" />
                </div>

                <button
                  onClick={() => canAdvanceNidFront && goTo("nid_back")}
                  disabled={!canAdvanceNidFront}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canAdvanceNidFront
                      ? "gradient-payment text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {canAdvanceNidFront ? "Continue →" : "Upload NID Front to Continue"}
                </button>
              </div>
            )}

            {/* ── NID Back ── */}
            {step === "nid_back" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.nid_back.heading}</h2>
                  <p className="text-sm text-muted-foreground">{STEP_META.nid_back.sub}</p>
                </div>

                <UploadBox
                  label="NID Card — Back Side"
                  preview={nidBack}
                  onFile={setNidBack}
                  icon={CreditCard}
                  gradient="gradient-send"
                />

                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">📋 Photo Tips</p>
                  <TipChip text="Capture the barcode and signature area clearly" />
                  <TipChip text="Make sure the card is not damaged or folded" />
                  <TipChip text="Use natural lighting for best results" />
                </div>

                <button
                  onClick={() => canAdvanceNidBack && goTo("selfie")}
                  disabled={!canAdvanceNidBack}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canAdvanceNidBack
                      ? "gradient-send text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {canAdvanceNidBack ? "Continue →" : "Upload NID Back to Continue"}
                </button>
              </div>
            )}

            {/* ── Selfie ── */}
            {step === "selfie" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.selfie.heading}</h2>
                  <p className="text-sm text-muted-foreground">{STEP_META.selfie.sub}</p>
                </div>

                {/* Selfie frame guide */}
                <div className="relative flex items-center justify-center">
                  <UploadBox
                    label="Your Selfie Photo"
                    preview={selfie}
                    onFile={setSelfie}
                    icon={Camera}
                    gradient="gradient-accent"
                    accept="image/*"
                  />
                </div>

                {/* Face guide overlay hint */}
                {!selfie && (
                  <div className="flex items-center justify-center">
                    <div className="rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 p-4 text-center space-y-1 max-w-xs">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-accent/50 mx-auto flex items-center justify-center">
                        <User size={28} className="text-accent/60" />
                      </div>
                      <p className="text-xs text-muted-foreground">Position your face within the circle</p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">🤳 Selfie Tips</p>
                  <TipChip text="Look directly at the camera with a neutral expression" />
                  <TipChip text="Remove glasses, hat, or face coverings" />
                  <TipChip text="Ensure your face is fully visible and well-lit" />
                </div>

                <button
                  onClick={() => canAdvanceSelfie && goTo("review")}
                  disabled={!canAdvanceSelfie}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canAdvanceSelfie
                      ? "gradient-accent text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {canAdvanceSelfie ? "Review Documents →" : "Upload Selfie to Continue"}
                </button>
              </div>
            )}

            {/* ── Review ── */}
            {step === "review" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.review.heading}</h2>
                  <p className="text-sm text-muted-foreground">{STEP_META.review.sub}</p>
                </div>

                {/* Documents summary */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">Documents</p>
                  <ReviewDoc
                    label="NID Front"
                    preview={nidFront}
                    onRetake={() => goTo("nid_front", -1)}
                    gradient="gradient-payment"
                    icon={CreditCard}
                  />
                  <ReviewDoc
                    label="NID Back"
                    preview={nidBack}
                    onRetake={() => goTo("nid_back", -1)}
                    gradient="gradient-send"
                    icon={CreditCard}
                  />
                  <ReviewDoc
                    label="Selfie"
                    preview={selfie}
                    onRetake={() => goTo("selfie", -1)}
                    gradient="gradient-accent"
                    icon={Camera}
                  />
                </div>

                {/* Missing warning */}
                {!canSubmit && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3"
                  >
                    <AlertCircle size={15} className="text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive font-medium">
                      Please upload all required documents before submitting.
                    </p>
                  </motion.div>
                )}

                {/* Terms note */}
                {canSubmit && (
                  <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                    By submitting, you confirm that the documents belong to you and the information is accurate. Your data is encrypted and processed securely.
                  </div>
                )}

                {/* Privacy badges */}
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={13} className="text-primary" />
                    <span>256-bit Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye size={13} className="text-primary" />
                    <span>Private & Secure</span>
                  </div>
                </div>

                <button
                  onClick={() => canSubmit && goTo("submitted")}
                  disabled={!canSubmit}
                  className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                    canSubmit
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {canSubmit ? "Submit for Verification" : "Complete All Steps First"}
                </button>
              </div>
            )}

            {/* ── Submitted ── */}
            {step === "submitted" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-12 text-center">
                {/* Success icon */}
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
                  <h2 className="text-2xl font-bold text-foreground">Submitted!</h2>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Your KYC documents have been submitted successfully. We'll review them within 24–48 hours.
                  </p>
                </motion.div>

                {/* Status card */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-card p-4 space-y-3"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Verification Status</p>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl gradient-payment flex items-center justify-center text-primary-foreground shrink-0">
                      <CreditCard size={15} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">NID Documents</p>
                      <p className="text-xs text-muted-foreground">Front & back uploaded</p>
                    </div>
                    <CheckCircle2 size={16} className="text-primary" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl gradient-accent flex items-center justify-center text-primary-foreground shrink-0">
                      <Camera size={15} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">Selfie</p>
                      <p className="text-xs text-muted-foreground">Identity photo captured</p>
                    </div>
                    <CheckCircle2 size={16} className="text-primary" />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Clock size={15} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">Review</p>
                      <p className="text-xs text-muted-foreground">Under review · 24–48 hrs</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                      PENDING
                    </span>
                  </div>
                </motion.div>

                {/* Privacy badges */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="flex items-center gap-4 text-xs text-muted-foreground"
                >
                  <div className="flex items-center gap-1">
                    <ShieldCheck size={13} className="text-primary" />
                    <span>256-bit Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye size={13} className="text-primary" />
                    <span>Data Protected</span>
                  </div>
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  onClick={onClose}
                  className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                >
                  Back to Account
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
