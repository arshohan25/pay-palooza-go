import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, CheckCircle2, Delete, AlertCircle, Lock, ShieldCheck } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "current" | "new" | "confirm" | "success";

// Mock current PIN (in a real app this would be verified server-side)
const MOCK_CURRENT_PIN = "1234";

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── PIN dots display ─────────────────────────────────────────────────────────
const PinDots = ({ length, gradient }: { length: number; gradient: string }) => (
  <div className="flex justify-center gap-5 py-2">
    {[0, 1, 2, 3].map((i) => (
      <motion.div
        key={i}
        animate={{ scale: length > i ? 1.2 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${
          length > i
            ? `${gradient} border-transparent shadow-md`
            : "border-muted-foreground/30 bg-transparent"
        }`}
      />
    ))}
  </div>
);

// ─── Numpad ───────────────────────────────────────────────────────────────────
const PIN_KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

const Numpad = ({ pin, onChange }: { pin: string; onChange: (p: string) => void }) => {
  const handleKey = (key: string) => {
    if (key === "⌫") { onChange(pin.slice(0, -1)); return; }
    if (key === "") return;
    if (pin.length < 4) onChange(pin + key);
  };

  return (
    <div className="grid grid-cols-3 gap-3 px-6">
      {PIN_KEYS.map((key, i) => (
        <motion.button
          key={i}
          whileTap={{ scale: key === "" ? 1 : 0.92 }}
          onClick={() => handleKey(key)}
          disabled={key === ""}
          className={`h-16 rounded-2xl text-xl font-bold transition-all ${
            key === ""
              ? "invisible"
              : key === "⌫"
              ? "bg-muted text-muted-foreground active:bg-muted/70"
              : "bg-card border border-border text-foreground shadow-card hover:shadow-elevated active:bg-muted/30"
          }`}
        >
          {key === "⌫" ? <Delete size={22} className="mx-auto" /> : key}
        </motion.button>
      ))}
    </div>
  );
};

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS: Step[] = ["current", "new", "confirm"];
const STEP_META: Record<Step, { label: string; heading: string; sub: string; gradient: string }> = {
  current: {
    label: "Verify",
    heading: "Enter Current PIN",
    sub: "Confirm your existing 4-digit PIN to continue",
    gradient: "gradient-send",
  },
  new: {
    label: "New PIN",
    heading: "Set New PIN",
    sub: "Choose a strong 4-digit PIN you haven't used before",
    gradient: "gradient-primary",
  },
  confirm: {
    label: "Confirm",
    heading: "Confirm New PIN",
    sub: "Re-enter your new PIN to make sure it matches",
    gradient: "gradient-addmoney",
  },
  success: { label: "Done", heading: "", sub: "", gradient: "" },
};

// ─── Main component ───────────────────────────────────────────────────────────
interface ChangePinFlowProps { onClose: () => void; }

const ChangePinFlow = ({ onClose }: ChangePinFlowProps) => {
  const [step, setStep]       = useState<Step>("current");
  const [direction, setDir]   = useState(1);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin]   = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError]     = useState("");

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

  // Auto-advance when 4 digits entered
  const handleCurrentPin = (p: string) => {
    setCurrentPin(p);
    setError("");
    if (p.length === 4) {
      // Simulate slight delay for UX
      setTimeout(() => {
        if (p !== MOCK_CURRENT_PIN) {
          setError("Incorrect PIN. Please try again.");
          setCurrentPin("");
        } else {
          goTo("new");
        }
      }, 300);
    }
  };

  const handleNewPin = (p: string) => {
    setNewPin(p);
    setError("");
    if (p.length === 4) {
      // Basic validation: can't be sequential like 1234 / 0000
      const sequential = ["1234","2345","3456","4567","5678","6789","0123","9876","8765","7654","6543","5432","4321","3210"];
      const repeated   = ["0000","1111","2222","3333","4444","5555","6666","7777","8888","9999"];
      setTimeout(() => {
        if (sequential.includes(p) || repeated.includes(p)) {
          setError("PIN is too simple. Avoid sequential or repeated digits.");
          setNewPin("");
        } else {
          goTo("confirm");
        }
      }, 300);
    }
  };

  const handleConfirmPin = (p: string) => {
    setConfirmPin(p);
    setError("");
    if (p.length === 4) {
      setTimeout(() => {
        if (p !== newPin) {
          setError("PINs don't match. Please try again.");
          setConfirmPin("");
        } else {
          // Success!
          setDir(1);
          setStep("success");
        }
      }, 300);
    }
  };

  const activeMeta = STEP_META[step];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      {step !== "success" && (
        <div className={`${activeMeta.gradient} px-4 pt-12 pb-6 text-primary-foreground`}>
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold">Change PIN</h1>
          </div>

          {/* Step pills */}
          <div className="flex gap-2 items-center">
            {STEPS.map((s, i) => {
              const si = STEPS.indexOf(step);
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    i < si  ? "bg-white/30 text-white"
                    : i === si ? "bg-white text-foreground"
                    : "bg-white/10 text-white/50"
                  }`}>
                    {i < si ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
                    {STEP_META[s].label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-4 ${i < si ? "bg-white/50" : "bg-white/20"}`} />
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

            {/* ─── Current PIN ─── */}
            {step === "current" && (
              <div className="flex flex-col gap-8 px-4 pt-10 pb-8">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 gradient-send rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <Lock size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.current.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{STEP_META.current.sub}</p>
                </div>

                <PinDots length={currentPin.length} gradient="gradient-send" />

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive flex items-center justify-center gap-1.5"
                  >
                    <AlertCircle size={13} /> {error}
                  </motion.p>
                )}

                <Numpad pin={currentPin} onChange={handleCurrentPin} />

                <p className="text-center text-xs text-muted-foreground">
                  Demo PIN: <span className="font-mono font-bold text-foreground">1234</span>
                </p>
              </div>
            )}

            {/* ─── New PIN ─── */}
            {step === "new" && (
              <div className="flex flex-col gap-8 px-4 pt-10 pb-8">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <Lock size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.new.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{STEP_META.new.sub}</p>
                </div>

                <PinDots length={newPin.length} gradient="gradient-primary" />

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive flex items-center justify-center gap-1.5"
                  >
                    <AlertCircle size={13} /> {error}
                  </motion.p>
                )}

                <Numpad pin={newPin} onChange={handleNewPin} />

                {/* PIN strength hints */}
                <div className="mx-6 rounded-xl bg-muted/60 border border-border px-4 py-3 space-y-1">
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
              <div className="flex flex-col gap-8 px-4 pt-10 pb-8">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 gradient-addmoney rounded-2xl flex items-center justify-center text-primary-foreground mx-auto shadow-glow">
                    <ShieldCheck size={26} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{STEP_META.confirm.heading}</h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{STEP_META.confirm.sub}</p>
                </div>

                <PinDots length={confirmPin.length} gradient="gradient-addmoney" />

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive flex items-center justify-center gap-1.5"
                  >
                    <AlertCircle size={13} /> {error}
                  </motion.p>
                )}

                <Numpad pin={confirmPin} onChange={handleConfirmPin} />
              </div>
            )}

            {/* ─── Success ─── */}
            {step === "success" && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
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
                  <p className="text-sm text-muted-foreground max-w-xs">
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
