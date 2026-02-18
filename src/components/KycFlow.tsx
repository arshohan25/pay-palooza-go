import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, CheckCircle2, Upload, Camera, Eye,
  AlertCircle, ShieldCheck, CreditCard, RotateCcw,
  FileCheck, Clock, ScanFace, Pencil, Check, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "nid_front" | "nid_back" | "nid_details" | "selfie" | "review" | "submitted";
type LivenessState = "idle" | "scanning" | "passed" | "failed";

const STEPS: Step[] = ["nid_front", "nid_back", "nid_details", "selfie", "review"];

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
  nid_details: {
    label: "NID Details",
    heading: "Confirm NID Details",
    sub: "We extracted the following info — please verify and correct if needed",
  },
  selfie: {
    label: "Liveness",
    heading: "Liveness Check",
    sub: "We'll verify you're a real person — no photo upload allowed",
  },
  review: {
    label: "Review",
    heading: "Review & Submit",
    sub: "Check your documents before submitting for verification",
  },
  submitted: { label: "Done", heading: "", sub: "" },
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

// ─── Editable field ───────────────────────────────────────────────────────────
const EditableField = ({
  label, value, onChange, placeholder
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => {
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
          <span className="text-sm text-foreground flex-1 truncate">{value || <span className="text-muted-foreground italic">Not extracted</span>}</span>
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

// ─── Liveness Check ───────────────────────────────────────────────────────────
const LivenessCheck = ({ onPassed }: { onPassed: () => void }) => {
  const [state, setState] = useState<LivenessState>("idle");
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState("Press Start to begin liveness check");

  const instructions = [
    "Look straight at the camera…",
    "Slowly turn your head left…",
    "Now turn your head right…",
    "Blink twice…",
    "Smile for the camera…",
    "Hold still — almost done…",
  ];

  const startScan = () => {
    setState("scanning");
    setProgress(0);
    let step = 0;
    setInstruction(instructions[0]);

    const interval = setInterval(() => {
      step++;
      setProgress(Math.round((step / instructions.length) * 100));
      if (step < instructions.length) {
        setInstruction(instructions[step]);
      } else {
        clearInterval(interval);
        setState("passed");
        setInstruction("Liveness verified ✓");
        onPassed();
      }
    }, 900);
  };

  const scanColor = state === "passed" ? "text-primary" : state === "failed" ? "text-destructive" : "text-accent";

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Face frame */}
      <div className="relative w-56 h-56 flex items-center justify-center">
        {/* Animated ring */}
        {state === "scanning" && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-accent/50"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
        )}
        {/* Dashed oval */}
        <div className={`absolute inset-4 rounded-full border-2 border-dashed transition-colors ${
          state === "passed" ? "border-primary" : state === "scanning" ? "border-accent" : "border-border"
        }`} />
        {/* Center icon */}
        <motion.div
          animate={state === "scanning" ? { scale: [1, 1.06, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
          className={`w-20 h-20 rounded-full flex items-center justify-center ${
            state === "passed" ? "gradient-primary" : state === "scanning" ? "bg-accent/10" : "bg-muted"
          }`}
        >
          {state === "passed" ? (
            <CheckCircle2 size={40} className="text-primary-foreground" />
          ) : (
            <ScanFace size={40} className={scanColor} />
          )}
        </motion.div>

        {/* Corner markers */}
        {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-5 h-5 border-2 rounded-sm transition-colors ${
            state === "passed" ? "border-primary" : state === "scanning" ? "border-accent" : "border-muted-foreground/40"
          } ${pos.includes("right") ? "border-l-0" : "border-r-0"} ${pos.includes("bottom") ? "border-t-0" : "border-b-0"}`} />
        ))}
      </div>

      {/* Progress bar */}
      {state === "scanning" && (
        <div className="w-full space-y-2">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full gradient-accent rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground">{progress}% complete</p>
        </div>
      )}

      {/* Instruction text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={instruction}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={`text-sm font-semibold text-center ${
            state === "passed" ? "text-primary" : "text-foreground"
          }`}
        >
          {instruction}
        </motion.p>
      </AnimatePresence>

      {/* No upload notice */}
      {state === "idle" && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3 w-full">
          <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive font-medium">
            Direct photo upload is not allowed. You must complete the live face scan.
          </p>
        </div>
      )}

      {state === "idle" && (
        <button
          onClick={startScan}
          className="w-full h-12 gradient-accent text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
        >
          Start Liveness Check
        </button>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
interface KycFlowProps { onClose: () => void; }

const KycFlow = ({ onClose }: KycFlowProps) => {
  const [step, setStep]         = useState<Step>("nid_front");
  const [direction, setDir]     = useState(1);
  const [nidFront, setNidFront] = useState<string | null>(null);
  const [nidBack, setNidBack]   = useState<string | null>(null);
  const [livenessPassed, setLivenessPassed] = useState(false);

  // Editable NID details (auto-"extracted" when NID front is uploaded)
  const [nidName, setNidName]     = useState("");
  const [nidNumber, setNidNumber] = useState("");
  const [nidDob, setNidDob]       = useState("");

  // Simulate OCR extraction when nidFront is set
  const prevNidFront = useRef<string | null>(null);
  useEffect(() => {
    if (nidFront && nidFront !== prevNidFront.current) {
      prevNidFront.current = nidFront;
      // Simulate extracted data
      setNidName("Tanvir Hasan");
      setNidNumber("19901234567890");
      setNidDob("01 Jan 1990");
    }
  }, [nidFront]);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step, dir = 1) => {
    setDir(dir);
    setStep(next);
  };

  const goBack = () => {
    if (step === "nid_front")   { onClose(); return; }
    if (step === "nid_back")    { goTo("nid_front", -1); return; }
    if (step === "nid_details") { goTo("nid_back", -1); return; }
    if (step === "selfie")      { goTo("nid_details", -1); return; }
    if (step === "review")      { goTo("selfie", -1); return; }
  };

  const canAdvanceNidFront   = !!nidFront;
  const canAdvanceNidBack    = !!nidBack;
  const canAdvanceNidDetails = !!nidName.trim() && !!nidNumber.trim() && !!nidDob.trim();
  const canSubmit            = !!nidFront && !!nidBack && livenessPassed;

  const headerGradient = (() => {
    if (step === "nid_front")   return "gradient-payment";
    if (step === "nid_back")    return "gradient-send";
    if (step === "nid_details") return "gradient-cashout";
    if (step === "selfie")      return "gradient-accent";
    return "gradient-primary";
  })();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
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
              <h1 className="text-xl font-extrabold tracking-tight">KYC Verification</h1>
              <p className="text-xs text-white/70 mt-0.5">Secure Identity Check</p>
            </div>
          </div>
          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
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
                  onClick={() => canAdvanceNidBack && goTo("nid_details")}
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

            {/* ── NID Details (editable) ── */}
            {step === "nid_details" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.nid_details.heading}</h2>
                  <p className="text-sm text-muted-foreground">{STEP_META.nid_details.sub}</p>
                </div>

                {/* OCR badge */}
                <div className="flex items-center gap-2 rounded-xl bg-primary/8 border border-primary/15 px-4 py-2.5">
                  <CheckCircle2 size={14} className="text-primary shrink-0" />
                  <p className="text-xs text-primary font-medium">Details auto-extracted from your NID photo. Tap <Pencil size={10} className="inline" /> to correct any errors.</p>
                </div>

                {/* NID front thumbnail */}
                {nidFront && (
                  <img src={nidFront} alt="NID Front" className="w-full h-28 object-cover rounded-2xl border border-border" />
                )}

                {/* Editable fields */}
                <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-4">
                  <EditableField
                    label="Full Name (as on NID)"
                    value={nidName}
                    onChange={setNidName}
                    placeholder="e.g. Tanvir Hasan"
                  />
                  <EditableField
                    label="NID Number"
                    value={nidNumber}
                    onChange={setNidNumber}
                    placeholder="e.g. 19901234567890"
                  />
                  <EditableField
                    label="Date of Birth"
                    value={nidDob}
                    onChange={setNidDob}
                    placeholder="e.g. 01 Jan 1990"
                  />
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
                  {canAdvanceNidDetails ? "Confirm Details →" : "Fill in all fields to continue"}
                </button>
              </div>
            )}

            {/* ── Selfie / Liveness ── */}
            {step === "selfie" && (
              <div className="flex flex-col gap-5 px-4 pt-6 pb-8">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.selfie.heading}</h2>
                  <p className="text-sm text-muted-foreground">{STEP_META.selfie.sub}</p>
                </div>

                <LivenessCheck onPassed={() => setLivenessPassed(true)} />

                {livenessPassed && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => goTo("review")}
                    className="w-full h-12 gradient-primary text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                  >
                    Review Documents →
                  </motion.button>
                )}

                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                  <p className="text-xs font-bold text-foreground">🤳 Liveness Tips</p>
                  <TipChip text="Ensure you're in good, even lighting" />
                  <TipChip text="Remove glasses, hat, or face coverings" />
                  <TipChip text="Follow on-screen instructions carefully" />
                </div>
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
                  {/* Liveness row */}
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className="w-16 h-10 gradient-accent rounded-lg flex items-center justify-center text-primary-foreground shrink-0">
                      <ScanFace size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">Liveness Check</p>
                      <p className={`text-xs font-medium ${livenessPassed ? "text-primary" : "text-destructive"}`}>
                        {livenessPassed ? "✓ Verified" : "Not completed"}
                      </p>
                    </div>
                    {!livenessPassed && (
                      <button
                        onClick={() => goTo("selfie", -1)}
                        className="text-xs font-semibold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors"
                      >
                        Redo
                      </button>
                    )}
                  </div>
                </div>

                {/* Extracted NID details (read-only summary) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">NID Details</p>
                    <button
                      onClick={() => goTo("nid_details", -1)}
                      className="flex items-center gap-1 text-xs text-primary font-semibold"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                  </div>
                  <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3">
                    {[
                      { label: "Full Name", value: nidName },
                      { label: "NID Number", value: nidNumber },
                      { label: "Date of Birth", value: nidDob },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold text-foreground text-right">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
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
                      Please complete all steps before submitting.
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
                      <ScanFace size={15} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">Liveness Check</p>
                      <p className="text-xs text-muted-foreground">Face verified successfully</p>
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
