import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, CheckCircle2, AlertCircle, Lock, ShieldCheck } from "lucide-react";

// ─── PIN storage key ───────────────────────────────────────────────────────────
const PIN_STORAGE_KEY = "mfs_user_pin";
const getStoredPin = () => sessionStorage.getItem(PIN_STORAGE_KEY) ?? "1234";
const storePin    = (pin: string) => sessionStorage.setItem(PIN_STORAGE_KEY, pin);

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "current" | "new" | "confirm" | "success";

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS: Step[] = ["current", "new", "confirm"];
const STEP_META: Record<Step, { label: string; heading: string; sub: string; gradient: string; iconGradient: string }> = {
  current: {
    label: "Verify",
    heading: "Enter Current PIN",
    sub: "Confirm your existing 4-digit PIN to continue",
    gradient: "gradient-send",
    iconGradient: "gradient-send",
  },
  new: {
    label: "New PIN",
    heading: "Set New PIN",
    sub: "Choose a strong 4-digit PIN you haven't used before",
    gradient: "gradient-primary",
    iconGradient: "gradient-primary",
  },
  confirm: {
    label: "Confirm",
    heading: "Confirm New PIN",
    sub: "Re-enter your new PIN to make sure it matches",
    gradient: "gradient-addmoney",
    iconGradient: "gradient-addmoney",
  },
  success: { label: "Done", heading: "", sub: "", gradient: "", iconGradient: "" },
};

// ─── PIN dots + native input ──────────────────────────────────────────────────
interface PinFieldProps {
  value: string;
  onChange: (v: string) => void;
  gradient: string;
  error?: string;
  autoFocus?: boolean;
}

const PinField = ({ value, onChange, gradient, error, autoFocus }: PinFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus when step mounts
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div className="space-y-5">
      {/* Animated dots */}
      <div className="flex justify-center gap-5 py-2">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: value.length > i ? 1.2 : 1,
              backgroundColor: error
                ? "hsl(var(--destructive))"
                : value.length > i
                ? undefined // controlled by className
                : "transparent",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
              value.length > i && !error
                ? `${gradient} border-transparent shadow-md`
                : value.length > i && error
                ? "bg-destructive border-transparent"
                : "border-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-destructive flex items-center justify-center gap-1.5"
          >
            <AlertCircle size={13} /> {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Native system keyboard input */}
      <div className="px-6">
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className={`w-full h-14 text-center text-3xl font-bold tracking-[1.2rem] bg-card border-2 rounded-2xl focus:outline-none transition-colors placeholder:text-muted-foreground/30 ${
            error ? "border-destructive" : "border-border focus:border-primary"
          }`}
          placeholder="••••"
        />
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
interface ChangePinFlowProps { onClose: () => void; }

const ChangePinFlow = ({ onClose }: ChangePinFlowProps) => {
  const [step, setStep]         = useState<Step>("current");
  const [direction, setDir]     = useState(1);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError]       = useState("");

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step, dir = 1) => {
    setDir(dir);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "current") { onClose(); return; }
    if (step === "new")     { setCurrentPin(""); goTo("current", -1); return; }
    if (step === "confirm") { setNewPin(""); goTo("new", -1); return; }
  };

  // ── Auto-advance when 4 digits entered ────────────────────────────────────
  const handleCurrentPin = (p: string) => {
    setCurrentPin(p);
    setError("");
    if (p.length === 4) {
      setTimeout(() => {
        if (p !== getStoredPin()) {
          setError("Incorrect PIN. Please try again.");
          setTimeout(() => setCurrentPin(""), 600);
        } else {
          goTo("new");
          setCurrentPin("");
        }
      }, 280);
    }
  };

  const handleNewPin = (p: string) => {
    setNewPin(p);
    setError("");
    if (p.length === 4) {
      const sequential = ["1234","2345","3456","4567","5678","6789","0123","9876","8765","7654","6543","5432","4321","3210"];
      const repeated   = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999"];
      setTimeout(() => {
        if (sequential.includes(p) || repeated.includes(p)) {
          setError("PIN is too simple. Avoid sequential or repeated digits.");
          setTimeout(() => setNewPin(""), 600);
        } else {
          goTo("confirm");
          setNewPin(p); // keep value for comparison in confirm step
        }
      }, 280);
    }
  };

  const handleConfirmPin = (p: string) => {
    setConfirmPin(p);
    setError("");
    if (p.length === 4) {
      setTimeout(() => {
        if (p !== newPin) {
          setError("PINs don't match. Please try again.");
          setTimeout(() => setConfirmPin(""), 600);
        } else {
          // Persist new PIN
          storePin(newPin);
          setDir(1);
          setStep("success");
        }
      }, 280);
    }
  };

  const activeMeta = STEP_META[step];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      {step !== "success" && (
        <div className={`${activeMeta.gradient} px-4 pt-3 pb-3 text-primary-foreground`}>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">Change PIN</h1>
              <p className="text-xs text-white/70 mt-0.5">Keep Your Account Secure</p>
            </div>
          </div>
          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
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

            {/* ─── Current PIN ─── */}
            {step === "current" && (
              <div className="flex flex-col gap-7 pt-10 pb-8">
                <div className="text-center space-y-2 px-4">
                  <div className="w-14 h-14 gradient-send rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <Lock size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.current.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{STEP_META.current.sub}</p>
                </div>

                <PinField
                  value={currentPin}
                  onChange={handleCurrentPin}
                  gradient="gradient-send"
                  error={error}
                  autoFocus
                />

                <p className="text-center text-xs text-muted-foreground px-4">
                  Demo PIN: <span className="font-mono font-bold text-foreground">1234</span>
                </p>
              </div>
            )}

            {/* ─── New PIN ─── */}
            {step === "new" && (
              <div className="flex flex-col gap-7 pt-10 pb-8">
                <div className="text-center space-y-2 px-4">
                  <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <Lock size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.new.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{STEP_META.new.sub}</p>
                </div>

                <PinField
                  value={newPin}
                  onChange={handleNewPin}
                  gradient="gradient-primary"
                  error={error}
                  autoFocus
                />

                {/* PIN strength hints */}
                <div className="mx-6 rounded-2xl bg-muted/60 border border-border px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">PIN tips:</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                    <li>Avoid repeated digits (e.g. 1111)</li>
                    <li>Avoid sequential digits (e.g. 1234)</li>
                    <li>Don't share your PIN with anyone</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ─── Confirm PIN ─── */}
            {step === "confirm" && (
              <div className="flex flex-col gap-7 pt-10 pb-8">
                <div className="text-center space-y-2 px-4">
                  <div className="w-14 h-14 gradient-addmoney rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <ShieldCheck size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.confirm.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{STEP_META.confirm.sub}</p>
                </div>

                <PinField
                  value={confirmPin}
                  onChange={handleConfirmPin}
                  gradient="gradient-addmoney"
                  error={error}
                  autoFocus
                />
              </div>
            )}

            {/* ─── Success ─── */}
            {step === "success" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center py-16">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-24 h-24 gradient-addmoney rounded-3xl flex items-center justify-center text-primary-foreground shadow-glow"
                >
                  <CheckCircle2 size={48} strokeWidth={1.5} />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <h2 className="text-2xl font-bold text-foreground">PIN Changed!</h2>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Your transaction PIN has been updated successfully. Use your new PIN for all future transactions.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="w-full space-y-3"
                >
                  <button
                    onClick={onClose}
                    className="w-full h-12 gradient-addmoney text-primary-foreground font-semibold rounded-2xl shadow-glow active:scale-[0.98] transition-transform"
                  >
                    Back to Account
                  </button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ChangePinFlow;
