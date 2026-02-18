import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Search,
  CheckCircle2,
  Send,
  User,
  Phone,
  AlertCircle,
  QrCode,
  Delete,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScannerModal from "@/components/QrScannerModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "recipient" | "amount" | "confirm" | "pin" | "success";

interface Contact {
  id: string;
  name: string;
  phone: string;
  initials: string;
  gradient: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const RECENT_CONTACTS: Contact[] = [
  { id: "1", name: "Rahim Uddin",   phone: "01711-223344", initials: "RU", gradient: "gradient-send" },
  { id: "2", name: "Fatema Begum",  phone: "01812-334455", initials: "FB", gradient: "gradient-cashout" },
  { id: "3", name: "Karim Sheikh",  phone: "01900-445566", initials: "KS", gradient: "gradient-payment" },
  { id: "4", name: "Nusrat Jahan",  phone: "01655-556677", initials: "NJ", gradient: "gradient-addmoney" },
  { id: "5", name: "Shakil Ahmed",  phone: "01523-667788", initials: "SA", gradient: "gradient-accent" },
];

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// ─── Fee logic ────────────────────────────────────────────────────────────────
// ৳3 flat charge for amounts > ৳100; free for ৳100 or below
const calcSendFee = (amt: number) => (amt > 100 ? 3 : 0);

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["recipient", "amount", "confirm", "pin"];
const STEP_LABELS: Record<Step, string> = {
  recipient: "Recipient",
  amount: "Amount",
  confirm: "Confirm",
  pin: "PIN",
  success: "Done",
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
              pin.length > i ? "gradient-send border-transparent" : "border-muted-foreground/40 bg-transparent"
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

// ─── SendMoneyFlow ────────────────────────────────────────────────────────────
interface SendMoneyFlowProps { onClose: () => void; }

const SendMoneyFlow = ({ onClose }: SendMoneyFlowProps) => {
  const [step, setStep]           = useState<Step>("recipient");
  const [direction, setDirection] = useState(1);
  const [recipient, setRecipient] = useState<Contact | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [amount, setAmount]       = useState("");
  const [note, setNote]           = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError]         = useState("");
  const [pin, setPin]             = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const txnTime = useRef(new Date());

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "recipient") { onClose(); return; }
    if (step === "amount")    { goTo("recipient"); return; }
    if (step === "confirm")   { goTo("amount"); return; }
    if (step === "pin")       { goTo("confirm"); return; }
  };

  const filteredContacts = RECENT_CONTACTS.filter(
    (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery),
  );

  const handleSelectContact = (c: Contact) => {
    setRecipient(c);
    setPhoneInput(c.phone);
    goTo("amount");
  };

  const handlePhoneContinue = () => {
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 10) { setError("Please enter a valid phone number."); return; }
    if (!recipient) {
      setRecipient({ id: "custom", name: phoneInput, phone: phoneInput, initials: phoneInput.slice(-2), gradient: "gradient-primary" });
    }
    goTo("amount");
  };

  const handleQrScan = (result: string) => {
    setPhoneInput(result);
    const found = RECENT_CONTACTS.find((c) => c.phone === result);
    if (found) {
      setRecipient(found);
    } else {
      setRecipient({ id: "qr", name: result, phone: result, initials: result.slice(-2), gradient: "gradient-send" });
    }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 0.01)  { setError("Minimum send amount is ৳0.01."); return; }
    if (val > 50000) { setError("Maximum send per day is ৳50,000."); return; }
    goTo("confirm");
  };

  const handleConfirm = () => goTo("pin");

  const handlePinConfirm = () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    txnTime.current = new Date();
    setDirection(1);
    setStep("success");
  };

  const amtNum = parseFloat(amount) || 0;
  const fee    = calcSendFee(amtNum);
  const total  = amtNum + fee;

  // Visible steps in progress bar (exclude success)
  const PROGRESS_STEPS: Step[] = ["recipient", "amount", "confirm", "pin"];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      {step !== "success" && (
        <div className="gradient-send px-4 pt-12 pb-6 text-primary-foreground">
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold">Send Money</h1>
          </div>
          {/* Step pills */}
          <div className="flex gap-2 items-center flex-wrap">
            {PROGRESS_STEPS.map((s, i) => {
              const si = PROGRESS_STEPS.indexOf(step);
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    i < si ? "bg-white/30 text-white" : i === si ? "bg-white text-purple-700" : "bg-white/10 text-white/50"
                  }`}>
                    {i < si ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
                    {STEP_LABELS[s]}
                  </div>
                  {i < PROGRESS_STEPS.length - 1 && (
                    <div className={`h-px w-3 ${i < si ? "bg-white/50" : "bg-white/20"}`} />
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

            {/* ── STEP 1: Recipient ── */}
            {step === "recipient" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Mobile Number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="01X-XXXX-XXXX"
                      value={phoneInput}
                      onChange={(e) => { setPhoneInput(e.target.value); setError(""); }}
                      className="pl-9 pr-12 h-12 text-base bg-card border-border"
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
                  <Button className="w-full h-11 gradient-send border-0 text-white font-semibold" onClick={handlePhoneContinue}>
                    Continue
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">Recent contacts</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name or number…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-card border-border"
                  />
                </div>

                <div className="space-y-2">
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectContact(c)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${c.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {c.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
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
                {recipient && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${recipient.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {recipient.initials}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sending to</p>
                      <p className="text-sm font-bold text-foreground">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground">{recipient.phone}</p>
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
                            ? "gradient-send text-white border-transparent shadow-card"
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
                    placeholder="What's it for?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-card border-border"
                  />
                </div>

                {amtNum > 0 && (
                  <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Amount</span>
                      <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fee</span>
                      <span className="text-foreground font-medium">
                        {fee === 0 ? <span className="text-primary font-semibold">Free</span> : `৳${fee}`}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Total</span>
                      <span>৳{total.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                <Button className="w-full h-12 gradient-send border-0 text-white font-semibold text-base" onClick={handleAmountContinue}>
                  Review Transfer
                </Button>
              </div>
            )}

            {/* ── STEP 3: Confirm ── */}
            {step === "confirm" && (
              <div className="px-4 pt-6 pb-32 space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">You're sending</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`${recipient?.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0`}>
                      {recipient?.initials}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{recipient?.name}</p>
                      <p className="text-sm text-muted-foreground">{recipient?.phone}</p>
                    </div>
                  </div>
                  {note && (
                    <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Note: </span>{note}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3 text-sm">
                  <p className="font-semibold text-foreground">Transfer Summary</p>
                  <div className="space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Send Amount</span>
                      <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Fee</span>
                      <span className="text-foreground font-medium">
                        {fee === 0 ? <span className="text-primary font-semibold">Free</span> : `৳${fee}`}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground text-base">
                      <span>Total Deducted</span>
                      <span>৳{total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
                  <User size={14} />
                  <span>Your balance: <strong className="text-foreground">৳12,450.75</strong></span>
                </div>

                <Button className="w-full h-12 gradient-send border-0 text-white font-bold text-base" onClick={handleConfirm}>
                  <Send size={18} /> Confirm & Enter PIN
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => goTo("amount")}>Edit</Button>
              </div>
            )}

            {/* ── STEP 4: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">Sending</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">to <span className="font-semibold text-foreground">{recipient?.name}</span></p>
                </div>

                <div className="rounded-2xl bg-muted/40 border border-border p-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Total deducted</span>
                  <span className="font-bold text-foreground">৳{total.toLocaleString()}</span>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground text-center">Enter your PIN</p>
                  <PinPad pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />
                </div>

                <Button
                  className="w-full h-12 gradient-send border-0 text-white font-bold text-base"
                  onClick={handlePinConfirm}
                  disabled={pin.length < 4}
                >
                  <Send size={18} /> Send Money
                </Button>
              </div>
            )}

            {/* ── STEP 5: Success ── */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 gradient-addmoney rounded-full flex items-center justify-center shadow-glow"
                >
                  <CheckCircle2 size={52} className="text-white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-foreground">Money Sent!</h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{amtNum.toLocaleString()} sent to{" "}
                    <span className="font-semibold text-foreground">{recipient?.name}</span>
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>Recipient</span><span className="text-foreground font-medium">{recipient?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Mobile</span><span className="text-foreground font-medium">{recipient?.phone}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span><span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee</span>
                    <span className="text-foreground font-medium">{fee === 0 ? "Free" : `৳${fee}`}</span>
                  </div>
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
        title="Scan Recipient QR"
      />
    </div>
  );
};

export default SendMoneyFlow;
