import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  CheckCircle2,
  Smartphone,
  AlertCircle,
  Delete,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "number" | "amount" | "pin" | "success";

interface Operator {
  name: string;
  short: string;
  gradient: string;
  prefixes: string[];
  color: string;
}

// ─── Operator detection ──────────────────────────────────────────────────────
const OPERATORS: Operator[] = [
  {
    name: "Grameenphone",
    short: "GP",
    gradient: "gradient-accent",
    prefixes: ["017", "013"],
    color: "text-amber-600",
  },
  {
    name: "Robi",
    short: "RB",
    gradient: "gradient-payment",
    prefixes: ["018"],
    color: "text-sky-600",
  },
  {
    name: "Banglalink",
    short: "BL",
    gradient: "gradient-cashout",
    prefixes: ["019", "014"],
    color: "text-rose-600",
  },
  {
    name: "Teletalk",
    short: "TT",
    gradient: "gradient-addmoney",
    prefixes: ["015"],
    color: "text-emerald-600",
  },
  {
    name: "Airtel",
    short: "AT",
    gradient: "gradient-send",
    prefixes: ["016"],
    color: "text-purple-600",
  },
];

const detectOperator = (phone: string): Operator | null => {
  const digits = phone.replace(/\D/g, "");
  const prefix3 = digits.slice(0, 3);
  return OPERATORS.find((op) => op.prefixes.includes(prefix3)) ?? null;
};

// ─── Preset amounts ──────────────────────────────────────────────────────────
const PRESET_AMOUNTS = [20, 50, 100, 150, 200, 300, 500, 1000];

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["number", "amount", "pin"];
const STEP_LABELS: Record<Step, string> = {
  number: "Number",
  amount: "Amount",
  pin: "PIN",
  success: "Done",
};

// ─── Slide animation ─────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── PIN Pad ─────────────────────────────────────────────────────────────────
const PIN_KEYS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

interface PinPadProps { pin: string; onChange: (p: string) => void; error: string; }
const PinPad = ({ pin, onChange, error }: PinPadProps) => {
  const handleKey = (key: string) => {
    if (key === "⌫") { onChange(pin.slice(0, -1)); return; }
    if (key === "") return;
    if (pin.length < 4) onChange(pin + key);
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-center gap-4">
        {[0,1,2,3].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: pin.length > i ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              pin.length > i ? "gradient-accent border-transparent" : "border-muted-foreground/40 bg-transparent"
            }`}
          />
        ))}
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center justify-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3 px-4">
        {PIN_KEYS.map((key, i) => (
          <button
            key={i}
            onClick={() => handleKey(key)}
            disabled={key === ""}
            className={`h-14 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
              key === ""
                ? "invisible"
                : key === "⌫"
                ? "bg-muted text-muted-foreground"
                : "bg-card border border-border text-foreground shadow-card hover:shadow-elevated"
            }`}
          >
            {key === "⌫" ? <Delete size={20} className="mx-auto" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── TxnID generator ─────────────────────────────────────────────────────────
const generateTxnId = () =>
  "RCH" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).toUpperCase().slice(2, 5);

// ─── MobileRechargeFlow ──────────────────────────────────────────────────────
interface MobileRechargeFlowProps { onClose: () => void; }

const MobileRechargeFlow = ({ onClose }: MobileRechargeFlowProps) => {
  const [step, setStep]           = useState<Step>("number");
  const [direction, setDirection] = useState(1);
  const [phone, setPhone]         = useState("");
  const [amount, setAmount]       = useState("");
  const [pin, setPin]             = useState("");
  const [error, setError]         = useState("");
  const txnTime = useRef(new Date());
  const txnId   = useRef(generateTxnId());

  const stepIndex = STEPS.indexOf(step);
  const operator  = detectOperator(phone);

  const goTo = (next: Step) => {
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "number") { onClose(); return; }
    if (step === "amount") { goTo("number"); return; }
    if (step === "pin")    { goTo("amount"); return; }
  };

  const handleNumberContinue = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) { setError("Enter an 11-digit mobile number."); return; }
    if (!operator) { setError("Unable to detect operator. Please check the number."); return; }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Select or enter a recharge amount."); return; }
    if (val < 20)   { setError("Minimum recharge amount is ৳20."); return; }
    if (val > 1000) { setError("Maximum recharge amount is ৳1,000."); return; }
    goTo("pin");
  };

  const handlePinConfirm = () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    txnTime.current = new Date();
    txnId.current   = generateTxnId();
    setDirection(1);
    setStep("success");
  };

  const amtNum = parseFloat(amount) || 0;

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
    return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      {step !== "success" && (
        <div className="gradient-accent px-4 pt-12 pb-6 text-primary-foreground">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold">Mobile Recharge</h1>
          </div>
          {/* Step pills */}
          <div className="flex gap-2 items-center">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    i < stepIndex
                      ? "bg-white/30 text-white"
                      : i === stepIndex
                      ? "bg-white text-amber-600"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {i < stepIndex ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
                  {STEP_LABELS[s]}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-4 ${i < stepIndex ? "bg-white/50" : "bg-white/20"}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Animated step content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-0 overflow-y-auto"
          >

            {/* ── STEP 1: Number ── */}
            {step === "number" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Mobile Number</label>
                  <div className="relative">
                    <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="017X-XXXX-XXXX"
                      value={formatPhone(phone)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
                        setPhone(raw);
                        setError("");
                      }}
                      className="pl-9 h-12 text-base bg-card border-border tracking-wide"
                    />
                  </div>

                  {/* Operator badge — appears as user types */}
                  <AnimatePresence>
                    {phone.length >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card"
                      >
                        {operator ? (
                          <>
                            <div className={`${operator.gradient} w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                              {operator.short}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Detected operator</p>
                              <p className="text-sm font-bold text-foreground">{operator.name}</p>
                            </div>
                            <CheckCircle2 size={18} className="ml-auto text-primary shrink-0" />
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Smartphone size={18} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">Unknown operator</p>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}

                  <Button
                    className="w-full h-11 gradient-accent border-0 text-white font-semibold"
                    onClick={handleNumberContinue}
                  >
                    Continue
                  </Button>
                </div>

                {/* Operator guide */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Operator prefixes</p>
                  <div className="grid grid-cols-1 gap-2">
                    {OPERATORS.map((op) => (
                      <div
                        key={op.name}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-border"
                      >
                        <div className={`${op.gradient} w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                          {op.short}
                        </div>
                        <span className="text-sm font-semibold text-foreground flex-1">{op.name}</span>
                        <span className="text-xs text-muted-foreground">{op.prefixes.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Amount ── */}
            {step === "amount" && operator && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Operator + number pill */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                  <div className={`${operator.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {operator.short}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recharging</p>
                    <p className="text-sm font-bold text-foreground">{formatPhone(phone)}</p>
                    <p className="text-xs text-muted-foreground">{operator.name}</p>
                  </div>
                </div>

                {/* Preset amount grid */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Select Amount</p>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => { setAmount(String(q)); setError(""); }}
                        className={`py-3 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                          amount === String(q)
                            ? "gradient-accent text-white border-transparent shadow-card"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        ৳{q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom amount */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Or enter custom amount</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={PRESET_AMOUNTS.includes(parseInt(amount)) ? "" : amount}
                      onChange={(e) => { setAmount(e.target.value); setError(""); }}
                      className="w-full pl-10 pr-4 h-14 text-2xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">৳20 minimum · ৳1,000 maximum</p>
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                {/* Summary */}
                {amtNum > 0 && (
                  <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Recharge amount</span>
                      <span className="text-foreground font-semibold">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Service fee</span>
                      <span className="text-primary font-semibold">Free</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Total</span>
                      <span>৳{amtNum.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full h-11 gradient-accent border-0 text-white font-semibold"
                  onClick={handleAmountContinue}
                >
                  Continue
                </Button>
              </div>
            )}

            {/* ── STEP 3: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-8 pb-32 space-y-8">
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">Confirm with PIN</p>
                  <p className="text-xs text-muted-foreground">
                    Recharging <span className="font-bold text-foreground">{formatPhone(phone)}</span> with{" "}
                    <span className="font-bold text-foreground">৳{amtNum.toLocaleString()}</span>
                  </p>
                </div>

                {/* Confirm card */}
                <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Number</span>
                    <span className="font-semibold text-foreground">{formatPhone(phone)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Operator</span>
                    <span className="font-semibold text-foreground">{operator?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span>
                    <span className="font-semibold text-foreground">৳{amtNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service fee</span>
                    <span className="font-semibold text-primary">Free</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Total from balance</span>
                    <span>৳{amtNum.toLocaleString()}</span>
                  </div>
                </div>

                <PinPad pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <div className="px-4">
                  <Button
                    className="w-full h-11 gradient-accent border-0 text-white font-semibold"
                    onClick={handlePinConfirm}
                    disabled={pin.length < 4}
                  >
                    Confirm Recharge
                  </Button>
                </div>
              </div>
            )}

            {/* ── SUCCESS ── */}
            {step === "success" && (
              <div className="min-h-screen flex flex-col">
                {/* Success hero */}
                <div className="gradient-accent px-4 pt-16 pb-10 text-white text-center">
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4"
                  >
                    <Zap size={36} className="text-white" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <p className="text-lg font-bold">Recharge Successful!</p>
                    <p className="text-4xl font-extrabold mt-1">৳{amtNum.toLocaleString()}</p>
                    <p className="text-white/80 text-sm mt-1">{operator?.name} · {formatPhone(phone)}</p>
                  </motion.div>
                </div>

                {/* Receipt */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex-1 px-4 py-6 space-y-4"
                >
                  <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt</p>

                    <div className="flex justify-between text-muted-foreground">
                      <span>Transaction ID</span>
                      <span className="font-mono font-bold text-foreground text-xs">{txnId.current}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Date & Time</span>
                      <span className="font-semibold text-foreground text-xs">
                        {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                        {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between text-muted-foreground">
                      <span>Mobile Number</span>
                      <span className="font-semibold text-foreground">{formatPhone(phone)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Operator</span>
                      <span className="font-semibold text-foreground">{operator?.name}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Recharge Amount</span>
                      <span className="font-semibold text-foreground">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Service Fee</span>
                      <span className="font-semibold text-primary">Free</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Deducted from balance</span>
                      <span>৳{amtNum.toLocaleString()}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full h-11 gradient-accent border-0 text-white font-semibold"
                    onClick={onClose}
                  >
                    Done
                  </Button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MobileRechargeFlow;
