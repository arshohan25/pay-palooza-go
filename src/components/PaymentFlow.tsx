import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Delete,
  CreditCard,
  Hash,
  QrCode,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScannerModal from "@/components/QrScannerModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "merchant" | "amount" | "pin" | "success";

interface Merchant {
  id: string;
  name: string;
  merchantId: string;
  category: string;
  initials: string;
  gradient: string;
}

// ─── Mock merchants ───────────────────────────────────────────────────────────
const RECENT_MERCHANTS: Merchant[] = [
  { id: "1", name: "Shwapno Supershop",  merchantId: "MRC-88901", category: "Grocery",     initials: "SS", gradient: "gradient-payment" },
  { id: "2", name: "Chaldal Online",     merchantId: "MRC-22341", category: "Grocery",     initials: "CO", gradient: "gradient-addmoney" },
  { id: "3", name: "Pathao Food",        merchantId: "MRC-55612", category: "Food",         initials: "PF", gradient: "gradient-accent" },
  { id: "4", name: "Daraz BD",           merchantId: "MRC-71008", category: "Shopping",     initials: "DB", gradient: "gradient-cashout" },
  { id: "5", name: "Meena Bazar",        merchantId: "MRC-39204", category: "Retail",       initials: "MB", gradient: "gradient-send" },
];

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["merchant", "amount", "pin"];
const STEP_LABELS: Record<Step, string> = {
  merchant: "Merchant",
  amount:   "Amount",
  pin:      "PIN",
  success:  "Done",
};

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── PIN Pad ──────────────────────────────────────────────────────────────────
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
              pin.length > i ? "gradient-payment border-transparent" : "border-muted-foreground/40 bg-transparent"
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

// ─── PaymentFlow ──────────────────────────────────────────────────────────────
interface PaymentFlowProps { onClose: () => void; }

const PaymentFlow = ({ onClose }: PaymentFlowProps) => {
  const [step, setStep]           = useState<Step>("merchant");
  const [direction, setDirection] = useState(1);
  const [merchant, setMerchant]   = useState<Merchant | null>(null);
  const [merchantIdInput, setMerchantIdInput] = useState("");
  const [amount, setAmount]       = useState("");
  const [note, setNote]           = useState("");
  const [pin, setPin]             = useState("");
  const [error, setError]         = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const txnTime = useRef(new Date());

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "merchant") { onClose(); return; }
    if (step === "amount")   { goTo("merchant"); return; }
    if (step === "pin")      { goTo("amount"); return; }
  };

  const handleSelectMerchant = (m: Merchant) => {
    setMerchant(m);
    setMerchantIdInput(m.merchantId);
    goTo("amount");
  };

  const handleQrScan = (result: string) => {
    setMerchantIdInput(result);
    const found = RECENT_MERCHANTS.find((m) => m.merchantId.toLowerCase() === result.toLowerCase());
    if (found) {
      setMerchant(found);
    } else {
      setMerchant({ id: "qr", name: "Merchant", merchantId: result, category: "Payment", initials: "MR", gradient: "gradient-payment" });
    }
    goTo("amount");
  };

  const handleMerchantIdContinue = () => {
    const trimmed = merchantIdInput.trim();
    if (trimmed.length < 5) { setError("Enter a valid Merchant ID."); return; }
    const found = RECENT_MERCHANTS.find((m) => m.merchantId.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      setMerchant(found);
    } else {
      setMerchant({ id: "custom", name: "Merchant", merchantId: trimmed, category: "Payment", initials: "MR", gradient: "gradient-payment" });
    }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 1)     { setError("Minimum payment is ৳1."); return; }
    if (val > 50000) { setError("Maximum payment is ৳50,000."); return; }
    goTo("pin");
  };

  const handlePinConfirm = () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    txnTime.current = new Date();
    setDirection(1);
    setStep("success");
  };

  const amtNum = parseFloat(amount) || 0;
  // Payment is free (no charge)

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      {step !== "success" && (
        <div className="gradient-payment px-4 pt-12 pb-6 text-primary-foreground">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold">Payment</h1>
          </div>
          {/* Step pills */}
          <div className="flex gap-2 items-center">
            {STEPS.map((s, i) => {
              const si = STEPS.indexOf(step);
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    i < si ? "bg-white/30 text-white" : i === si ? "bg-white text-blue-700" : "bg-white/10 text-white/50"
                  }`}>
                    {i < si ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
                    {STEP_LABELS[s]}
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

            {/* ── STEP 1: Merchant ── */}
            {step === "merchant" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Merchant ID</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. MRC-88901"
                      value={merchantIdInput}
                      onChange={(e) => { setMerchantIdInput(e.target.value); setError(""); }}
                      className="pl-9 pr-12 h-12 text-base bg-card border-border uppercase"
                    />
                    <button
                      onClick={() => setShowScanner(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <QrCode size={16} className="text-muted-foreground" />
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                  <Button
                    className="w-full h-11 gradient-payment border-0 text-white font-semibold"
                    onClick={handleMerchantIdContinue}
                  >
                    Continue
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingBag size={11} /> Recent merchants</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Merchant list */}
                <div className="space-y-2">
                  {RECENT_MERCHANTS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMerchant(m)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${m.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {m.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.merchantId} · {m.category}</p>
                      </div>
                      <ChevronLeft size={16} className="text-muted-foreground rotate-180 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: Amount ── */}
            {step === "amount" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {merchant && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${merchant.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paying to</p>
                      <p className="text-sm font-bold text-foreground">{merchant.name}</p>
                      <p className="text-xs text-muted-foreground">{merchant.merchantId} · {merchant.category}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Enter Amount</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setError(""); }}
                      className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40"
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Quick select</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmount(String(q))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                          amount === String(q)
                            ? "gradient-payment text-white border-transparent shadow-card"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        ৳{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Note (optional)</label>
                  <Input
                    placeholder="Invoice / reference…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>

                {amtNum > 0 && (
                  <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Payment Amount</span>
                      <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fee</span>
                      <span className="text-primary font-semibold">Free</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Total</span>
                      <span>৳{amtNum.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <Button className="w-full h-12 gradient-payment border-0 text-white font-semibold text-base" onClick={handleAmountContinue}>
                  Continue to PIN
                </Button>
              </div>
            )}

            {/* ── STEP 3: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">Paying</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">to <span className="font-semibold text-foreground">{merchant?.name}</span></p>
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3">
                  <div className={`${merchant?.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{merchant?.name}</p>
                    <p className="text-xs text-muted-foreground">{merchant?.merchantId} · {merchant?.category}</p>
                  </div>
                </div>

                {note && (
                  <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Note: </span>{note}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground text-center">Enter your PIN</p>
                  <PinPad pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />
                </div>

                <Button
                  className="w-full h-12 gradient-payment border-0 text-white font-bold text-base"
                  onClick={handlePinConfirm}
                  disabled={pin.length < 4}
                >
                  <CreditCard size={18} /> Confirm Payment
                </Button>
              </div>
            )}

            {/* ── STEP 4: Success ── */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 gradient-payment rounded-full flex items-center justify-center shadow-glow"
                >
                  <CheckCircle2 size={52} className="text-white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-foreground">Payment Successful!</h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{amtNum.toLocaleString()} paid to{" "}
                    <span className="font-semibold text-foreground">{merchant?.name}</span>
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>Merchant</span><span className="text-foreground font-medium">{merchant?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Merchant ID</span><span className="text-foreground font-medium">{merchant?.merchantId}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Category</span><span className="text-foreground font-medium">{merchant?.category}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span><span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee</span><span className="text-primary font-semibold">Free</span>
                  </div>
                  {note && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Note</span><span className="text-foreground font-medium">{note}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Date</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Time</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Transaction ID</span>
                    <span className="text-primary">TXN{Date.now().toString().slice(-8)}</span>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full space-y-3">
                  <Button className="w-full h-12 gradient-primary border-0 text-white font-semibold" onClick={onClose}>
                    Back to Home
                  </Button>
                  <Button variant="outline" className="w-full h-11" onClick={onClose}>Share Receipt</Button>
                </motion.div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* QR Scanner */}
      <QrScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQrScan}
        title="Scan Merchant QR"
      />
    </div>
  );
};

export default PaymentFlow;
