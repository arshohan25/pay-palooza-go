import { useState, useRef, useEffect } from "react";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { transferMoney, getBalance } from "@/lib/balanceStore";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";
import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import {
  ChevronLeft,
  Search,
  MapPin,
  Hash,
  AlertCircle,
  Store,
  QrCode,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScannerModal from "@/components/QrScannerModal";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "agent" | "amount" | "pin" | "success";

interface Agent {
  id: string;
  name: string;
  agentId: string;
  address: string;
  distance: string;
  initials: string;
  gradient: string;
  rating: number;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const NEARBY_AGENTS: Agent[] = [
  { id: "1", name: "Karim Store", agentId: "AGT-10234", address: "Mirpur-10, Dhaka", distance: "0.2 km", initials: "KS", gradient: "gradient-cashout", rating: 4.8 },
  { id: "2", name: "Rina Telecom", agentId: "AGT-20871", address: "Dhanmondi, Dhaka", distance: "0.5 km", initials: "RT", gradient: "gradient-payment", rating: 4.6 },
  { id: "3", name: "Hasan Mobile", agentId: "AGT-33512", address: "Gulshan-1, Dhaka", distance: "1.1 km", initials: "HM", gradient: "gradient-addmoney", rating: 4.9 },
  { id: "4", name: "City Point", agentId: "AGT-44780", address: "Banani, Dhaka", distance: "1.8 km", initials: "CP", gradient: "gradient-send", rating: 4.5 },
  { id: "5", name: "Quick Cash", agentId: "AGT-55239", address: "Motijheel, Dhaka", distance: "2.3 km", initials: "QC", gradient: "gradient-accent", rating: 4.7 },
];

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["agent", "amount", "pin"];
const STEP_LABELS: Record<Step, string> = {
  agent: "Agent",
  amount: "Amount",
  pin: "PIN",
  success: "Done",
};

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Native PIN input ────────────────────────────────────────────────────────
interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; }
const PinInput = ({ pin, onChange, error }: PinInputProps) => (
  <div className="space-y-5">
    <div className="flex justify-center gap-4">
      {[0,1,2,3].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: pin.length > i ? 1.15 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-5 h-5 rounded-full border-2 transition-colors ${
            pin.length > i ? "gradient-cashout border-transparent shadow-md" : "border-muted-foreground/40 bg-transparent"
          }`}
        />
      ))}
    </div>
    {error && (
      <p className="text-xs text-destructive flex items-center justify-center gap-1">
        <AlertCircle size={12} /> {error}
      </p>
    )}
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      value={pin}
      onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > pin.length) haptics.light(); onChange(v); }}
      autoFocus
      className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
      placeholder="••••"
    />
  </div>
);

// ─── CashOutFlow ──────────────────────────────────────────────────────────────
interface CashOutFlowProps {
  onClose: () => void;
}

const CashOutFlow = ({ onClose }: CashOutFlowProps) => {
  const [step, setStep] = useState<Step>("agent");
  const [direction, setDirection] = useState(1);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const txnTime = useRef(new Date());
  const txnId   = useRef(`TXN${Date.now().toString().slice(-8)}`);

  useEffect(() => {
    if (step === "success") {
      fireSuccessConfetti();
      addTxnNotif();
      txnId.current = `TXN${Date.now().toString().slice(-8)}`;
    }
  }, [step]);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "agent") { onClose(); return; }
    if (step === "amount") { goTo("agent"); return; }
    if (step === "pin") { goTo("amount"); return; }
  };

  const filteredAgents = NEARBY_AGENTS.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.agentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.address.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectAgent = (a: Agent) => {
    setAgent(a);
    setAgentIdInput(a.agentId);
    goTo("amount");
  };

  const handleQrScan = (result: string) => {
    setAgentIdInput(result);
    const found = NEARBY_AGENTS.find((a) => a.agentId.toLowerCase() === result.toLowerCase());
    if (found) {
      setAgent(found);
      goTo("amount");
    } else {
      setAgent({ id: "qr", name: "Agent", agentId: result, address: "Unknown location", distance: "—", initials: "AG", gradient: "gradient-cashout", rating: 0 });
      goTo("amount");
    }
  };

  const handleAgentIdContinue = () => {
    const trimmed = agentIdInput.trim();
    if (trimmed.length < 5) { setError("Enter a valid Agent ID."); return; }
    const found = NEARBY_AGENTS.find((a) => a.agentId.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      setAgent(found);
    } else {
      setAgent({ id: "custom", name: "Agent", agentId: trimmed, address: "Unknown location", distance: "—", initials: "AG", gradient: "gradient-primary", rating: 0 });
    }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 30) { setError("Minimum cash out amount is ৳30."); return; }
    if (val > 50000) { setError("Maximum cash out per day is ৳50,000."); return; }
    goTo("pin");
  };

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    if (processing) return;
    setProcessing(true);
    haptics.success();
    txnTime.current = new Date();
    const amtVal = parseFloat(amount) || 0;
    const feeVal = amtVal * 0.0119;
    try {
      await transferMoney({
        recipientPhone: agent?.agentId ?? "",
        amount: amtVal,
        fee: feeVal,
        type: "cashout",
        recipientName: agent?.name,
        description: `Cash Out at ${agent?.name}`,
        reference: txnId.current,
        recipientType: "cashout",
      });
    } catch (e: any) {
      setError(e.message || "Cash out failed");
      setProcessing(false);
      return;
    }
    showTxnToast({ type: "Cash Out", amount: `৳${amtVal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-cashout" });
    setDirection(1);
    setStep("success");
  };

  // Fee: 1.19% of amount
  const BALANCE = getBalance();
  const calcCashOutFee = (amt: number) => amt * 0.0119;
  const feeNum = parseFloat(amount) > 0 ? calcCashOutFee(parseFloat(amount)) : 0;
  const fee = feeNum.toFixed(2);
  // Fee source logic
  const feeFromBalance = Math.min(feeNum, BALANCE);
  const feeFromAmount  = parseFloat((feeNum - feeFromBalance).toFixed(2));
  // What user physically receives in hand
  const receive = parseFloat(amount) > 0
    ? (parseFloat(amount) - feeFromAmount).toFixed(2)
    : "0.00";
  // Total deducted from wallet balance
  const totalFromBalance = parseFloat(amount) > 0
    ? parseFloat((parseFloat(amount) + feeFromBalance).toFixed(2))
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      {step !== "success" && (
        <motion.div
          className="gradient-cashout px-4 pt-3 pb-3 text-primary-foreground"
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
              <h1 className="text-xl font-extrabold tracking-tight">Cash Out</h1>
              <p className="text-xs text-white/70 mt-0.5">Withdraw from Nearby Agent</p>
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
            className="absolute inset-0 overflow-y-auto scrollbar-none"
          >

            {/* ── STEP 1: Agent ── */}
            {step === "agent" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Agent ID input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Agent ID</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. AGT-10234"
                      value={agentIdInput}
                      onChange={(e) => { setAgentIdInput(e.target.value); setError(""); }}
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
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  <Button
                    className="w-full h-11 gradient-cashout border-0 text-white font-semibold"
                    onClick={handleAgentIdContinue}
                  >
                    Continue
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> Nearby agents</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search agent name, ID or area…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-card border-border"
                  />
                </div>

                {/* Agent list */}
                <div className="space-y-2">
                  {filteredAgents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAgent(a)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                    >
                      <div className={`${a.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {a.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                          {a.rating > 0 && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground shrink-0">⭐ {a.rating}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{a.agentId}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin size={10} /> {a.address} · {a.distance}
                        </p>
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
                {/* Agent pill */}
                {agent && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${agent.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      <Store size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cashing out at</p>
                      <p className="text-sm font-bold text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.agentId} · {agent.address}</p>
                    </div>
                  </div>
                )}

                {/* Big amount input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">Enter Amount</label>
                    <AvailableBalanceBadge />
                  </div>
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
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                </div>

                {/* Quick amounts */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Quick select</p>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmount(String(q))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${
                          amount === String(q)
                            ? "gradient-cashout text-white border-transparent shadow-card"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        ৳{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fee preview */}
                {parseFloat(amount) > 0 && (
                  <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Cash Out Amount</span>
                      <span className="text-foreground font-medium">৳{parseFloat(amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fee (1.19%)</span>
                      <span className="text-destructive font-medium">− ৳{fee}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Fee source</span>
                      <span className="text-primary font-medium">
                        {feeFromBalance >= feeNum
                          ? "From your balance"
                          : feeFromBalance > 0
                          ? `৳${feeFromBalance.toFixed(2)} balance + ৳${feeFromAmount} from amount`
                          : "Deducted from amount"}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>You Receive</span>
                      <span className="text-primary">৳{parseFloat(receive).toLocaleString()}</span>
                    </div>
                    {feeFromBalance > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground/70">
                        <span>Total from balance</span>
                        <span>৳{totalFromBalance.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="w-full h-12 gradient-cashout border-0 text-white font-semibold text-base"
                  onClick={handleAmountContinue}
                >
                  Continue to PIN
                </Button>
              </div>
            )}

            {/* ── STEP 3: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Summary banner */}
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">Cashing out</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{parseFloat(amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">at <span className="font-semibold text-foreground">{agent?.name}</span></p>
                </div>

                {/* Agent card */}
                <div className="rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3">
                  <div className={`${agent?.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                    <Store size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{agent?.name}</p>
                    <p className="text-xs text-muted-foreground">{agent?.agentId} · {agent?.address}</p>
                  </div>
                </div>

                {/* Fee row */}
                <div className="rounded-2xl bg-muted/40 border border-border p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You receive</span>
                    <span className="font-bold text-primary">৳{parseFloat(receive).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground/70">
                    <span>Fee (1.19%) source</span>
                    <span className="text-primary font-medium">
                      {feeFromBalance >= feeNum
                        ? "From your balance"
                        : feeFromBalance > 0
                        ? `৳${feeFromBalance.toFixed(2)} balance + ৳${feeFromAmount} from amount`
                        : "Deducted from amount"}
                    </span>
                  </div>
                </div>

                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label="Slide to Cash Out"
                  gradient="gradient-cashout"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                />
              </div>
            )}

            {/* ── STEP 4: Success ── */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 gradient-cashout rounded-full flex items-center justify-center shadow-glow"
                >
                  <CheckCircle2 size={52} className="text-white" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <h2 className="text-2xl font-extrabold text-foreground">Cash Out Successful!</h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{parseFloat(amount).toLocaleString()} cashed out at{" "}
                    <span className="font-semibold text-foreground">{agent?.name}</span>
                  </p>
                </motion.div>

                {/* Receipt card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>Agent</span>
                    <span className="text-foreground font-medium">{agent?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Agent ID</span>
                    <span className="text-foreground font-medium">{agent?.agentId}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span>
                    <span className="text-foreground font-medium">৳{parseFloat(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee (1.19%)</span>
                    <span className="text-foreground font-medium">৳{fee}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground/70">
                    <span>Fee deducted from</span>
                    <span className="font-medium">
                      {feeFromBalance >= feeNum
                        ? "Balance"
                        : feeFromBalance > 0
                        ? `Balance (৳${feeFromBalance.toFixed(2)}) + Amount (৳${feeFromAmount})`
                        : "Cash out amount"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>You Received</span>
                    <span className="font-semibold text-primary">৳{parseFloat(receive).toLocaleString()}</span>
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
                    <span className="text-primary">{txnId.current}</span>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="w-full space-y-3"
                >
                  <Button
                    className="w-full h-12 gradient-cashout border-0 text-white font-semibold"
                    onClick={onClose}
                  >
                    Back to Home
                  </Button>
                  <Button variant="outline" className="w-full h-11" onClick={() => setShowShare(true)}>
                    Share Receipt
                  </Button>
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
        title="Scan Agent QR"
      />

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Cash Out Successful",
          amount: `৳${parseFloat(amount || "0").toLocaleString()}`,
          gradient: "gradient-cashout",
          txnId: txnId.current,
          rows: [
            { label: "Agent", value: agent?.name ?? "" },
            { label: "Agent ID", value: agent?.agentId ?? "" },
            { label: "Amount", value: `৳${parseFloat(amount || "0").toLocaleString()}` },
            { label: "Fee (1.19%)", value: `৳${feeNum.toFixed(2)}` },
            { label: "You Received", value: `৳${parseFloat(receive).toLocaleString()}` },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </div>
  );
};

export default CashOutFlow;


