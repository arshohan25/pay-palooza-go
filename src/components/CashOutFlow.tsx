import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeeConfig } from "@/hooks/use-fee-config";
import { requestLocation } from "@/lib/permissions";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { transferMoney, getBalance, recordTransaction } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { checkDailyLimit } from "@/lib/dailyLimits";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";

import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import {
  ChevronLeft,
  Search,
  MapPin,
  Hash,
  AlertCircle,
  Store,
  QrCode,
  CheckCircle2,
  Building2,
  Landmark,
  User,
  Users,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import QrScannerModal from "@/components/QrScannerModal";
import { useSavedBanks } from "@/hooks/use-saved-banks";
import { useI18n } from "@/lib/i18n";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import FeatureGuard from "@/components/FeatureGuard";
import FeatureLockedOverlay from "@/components/FeatureLockedOverlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "method" | "agent" | "bank" | "amount" | "pin" | "success";
type CashOutMethod = "agent" | "bank";

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

// Recent agents loaded from real transaction history

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["method", "agent", "amount", "pin"];
const BANK_STEPS: Step[] = ["method", "bank", "amount", "pin"];
const STEP_LABELS: Record<Step, string> = {
  method: "Method",
  agent: "Agent",
  bank: "Bank",
  amount: "Amount",
  pin: "PIN",
  success: "Done",
};

// ─── Mock banks ──────────────────────────────────────────────────────────────
const BANKS = [
  { id: "dbbl", name: "Dutch-Bangla Bank", short: "DBBL" },
  { id: "brac", name: "BRAC Bank", short: "BRAC" },
  { id: "city", name: "City Bank", short: "CITY" },
  { id: "ebl",  name: "Eastern Bank", short: "EBL" },
  { id: "ucb",  name: "UCB Bank", short: "UCB" },
  { id: "islami", name: "Islami Bank", short: "IBBL" },
  { id: "ab",   name: "AB Bank", short: "AB" },
  { id: "scb",  name: "Standard Chartered", short: "SCB" },
];

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
  const { t } = useI18n();
  const { isLocked } = useFeatureLocks();
  const { calcCashOutFee, calcBankTransferFee, getFeeLabel, getAgentCommission, loading: feeLoading } = useFeeConfig();
  const cashOutLock = isLocked("cash_out");
  const [step, setStep] = useState<Step>("method");
  const [direction, setDirection] = useState(1);
  const [cashOutMethod, setCashOutMethod] = useState<CashOutMethod>("agent");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentIdInput, setAgentIdInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [recentAgents, setRecentAgents] = useState<Agent[]>([]);
  
  // Bank transfer state
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const { accounts: savedBanks, save: saveBank, remove: removeBank } = useSavedBanks();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const txnTime = useRef(new Date());
  const genId = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };
  const txnId   = useRef(genId());

  useEffect(() => {
    if (step === "success") {
      fireSuccessConfetti();
      addTxnNotif();
      txnId.current = genId();
    }
  }, [step]);

  // Fetch recent cashout agents from real transactions
  const AGENT_GRADIENTS = ["gradient-cashout", "gradient-payment", "gradient-addmoney", "gradient-send", "gradient-accent"];
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data: trans } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("type", "cashout")
        .order("created_at", { ascending: false });
      if (!trans) return;
      const seen = new Set<string>();
      const agents: Agent[] = [];
      for (const tx of trans) {
        const aid = tx.recipient_phone;
        if (!aid || seen.has(aid)) continue;
        seen.add(aid);
        const name = tx.recipient_name || "Agent";
        agents.push({
          id: tx.id,
          name,
          agentId: aid,
          address: "",
          distance: "",
          initials: name.slice(0, 2).toUpperCase(),
          gradient: AGENT_GRADIENTS[agents.length % AGENT_GRADIENTS.length],
          rating: 0,
        });
        if (agents.length >= 5) break;
      }
      setRecentAgents(agents);
    })();
  }, []);

  const activeSteps = cashOutMethod === "bank" ? BANK_STEPS : STEPS;
  const stepIndex = activeSteps.indexOf(step);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(activeSteps.indexOf(next) > activeSteps.indexOf(step) ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "method") { onClose(); return; }
    if (step === "agent" || step === "bank") { goTo("method"); return; }
    if (step === "amount") { goTo(cashOutMethod === "bank" ? "bank" : "agent"); return; }
    if (step === "pin") { goTo("amount"); return; }
  };

  const filteredAgents = recentAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.agentId.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelectAgent = (a: Agent) => {
    setAgent(a);
    setAgentIdInput(a.agentId);
    goTo("amount");
  };

  const handleQrScan = (result: string) => {
    setAgentIdInput(result);
    const found = recentAgents.find((a) => a.agentId.toLowerCase() === result.toLowerCase());
    if (found) {
      setAgent(found);
      goTo("amount");
    } else {
      setAgent({ id: "qr", name: "Agent", agentId: result, address: "", distance: "", initials: "AG", gradient: "gradient-cashout", rating: 0 });
      goTo("amount");
    }
  };

  const handleAgentIdContinue = () => {
    const trimmed = agentIdInput.trim();
    if (trimmed.length < 5) { setError("Enter a valid Agent ID."); return; }
    const found = recentAgents.find((a) => a.agentId.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      setAgent(found);
    } else {
      setAgent({ id: "custom", name: "Agent", agentId: trimmed, address: "", distance: "", initials: "AG", gradient: "gradient-primary", rating: 0 });
    }
    goTo("amount");
  };

  const handleBankContinue = () => {
    if (!bankName) { setError("Select a bank."); return; }
    if (accountNumber.trim().length < 8) { setError("Enter a valid account number."); return; }
    if (accountHolder.trim().length < 2) { setError("Enter account holder name."); return; }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 30) { setError("Minimum cash out amount is ৳30."); return; }
    if (val > 50000) { setError("Maximum cash out per day is ৳50,000."); return; }
    goTo("pin");
  };

  const isBank = cashOutMethod === "bank";
  const recipientLabel = isBank ? bankName : agent?.name;

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    if (processing) return;
    setProcessing(true);

    // Verify PIN
    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError("Incorrect PIN. Please try again."); setPin(""); setProcessing(false); return; }

    // Check daily limit
    const amtVal = parseFloat(amount) || 0;
    const txnType = isBank ? "banktransfer" : "cashout";
    const limitCheck = await checkDailyLimit(txnType, amtVal);
    if (!limitCheck.allowed) {
      setError(`Daily limit exceeded. Used ৳${limitCheck.used.toLocaleString()} of ৳${limitCheck.limit.toLocaleString()} today.`);
      setProcessing(false);
      return;
    }

    // Silently capture location for fraud detection
    requestLocation().catch(() => {});
    haptics.success();
    txnTime.current = new Date();
    const feeVal = isBank ? calcBankTransferFee(amtVal) : calcCashOutFee(amtVal);
    const commissionVal = isBank ? 0 : getAgentCommission("cashout", amtVal);
    try {
      if (isBank) {
        await recordTransaction({
          type: "banktransfer",
          amount: amtVal,
          fee: feeVal,
          recipientName: `${bankName} - ${accountHolder}`,
          description: `Bank Transfer to ${bankName} (${accountNumber})`,
          reference: txnId.current,
        });
      } else {
        await transferMoney({
          recipientPhone: agent?.agentId ?? "",
          amount: amtVal,
          fee: feeVal,
          type: "cashout",
          recipientName: agent?.name,
          description: `Cash Out at ${agent?.name}`,
          reference: txnId.current,
          recipientType: "cashin",
          commission: commissionVal,
        });
      }
    } catch (e: any) {
      setError(e.message || "Cash out failed");
      setProcessing(false);
      return;
    }
    showTxnToast({ type: isBank ? "Bank Transfer" : "Cash Out", amount: `৳${amtVal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-cashout" });
    if (isBank) {
      const bankShort = BANKS.find((b) => b.name === bankName)?.short ?? bankName.slice(0, 4).toUpperCase();
      saveBank({ bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, short_code: bankShort });
    }
    setDirection(1);
    setStep("success");
  };

  // Fee from DB
  const FEE_LABEL = isBank ? getFeeLabel("banktransfer") : getFeeLabel("cashout");
  const BALANCE = getBalance();
  const calcFeeForMethod = (amt: number) => isBank ? calcBankTransferFee(amt) : calcCashOutFee(amt);
  const feeNum = parseFloat(amount) > 0 ? calcFeeForMethod(parseFloat(amount)) : 0;
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

  if (cashOutLock.locked) {
    return (
      <FeatureLockedOverlay
        featureName="Cash Out"
        reason={cashOutLock.reason}
        expiresAt={cashOutLock.expiresAt}
        onClose={onClose}
      />
    );
  }

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
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowCashOut")}</h1>
              <p className="text-xs text-white/70 mt-0.5">
                {isBank ? t("flowTransferBank") : t("flowWithdrawAgent")}
              </p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.55)]"
              animate={{ width: `${((stepIndex + 1) / activeSteps.length) * 100}%` }}
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

            {/* ── STEP 0: Method ── */}
            {step === "method" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-bold text-foreground">{t("howCashOut")}</h2>
                  <p className="text-sm text-muted-foreground">{t("chooseMethod")}</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => { setCashOutMethod("agent"); goTo("agent"); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                  >
                    <div className="gradient-cashout w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <Store size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-foreground">{t("agentCashOut")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("withdrawFromAgentDesc")}</p>
                      <p className="text-xs text-primary font-semibold mt-1">{t("fee")}: 1.19%</p>
                    </div>
                    <ChevronLeft size={18} className="text-muted-foreground rotate-180 shrink-0" />
                  </button>

                  <button
                    onClick={() => { setCashOutMethod("bank"); goTo("bank"); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated active:scale-[0.98] transition-all text-left"
                  >
                    <div className="bg-gradient-to-b from-blue-500 to-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <Landmark size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-foreground">{t("flowBankTransfer")}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("transferToBankDesc")}</p>
                      <p className="text-xs text-primary font-semibold mt-1">{t("fee")}: 1%</p>
                    </div>
                    <ChevronLeft size={18} className="text-muted-foreground rotate-180 shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 1a: Agent ── */}
            {step === "agent" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Agent ID input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("agentIdLabel")}</label>
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
                    {t("continue")}
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={11} /> {t("nearbyAgents")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {recentAgents.length > 0 && (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search agent name or ID…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-card border-border"
                      />
                    </div>
                  </>
                )}

                {/* Agent list */}
                <div className="space-y-2">
                  {recentAgents.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3"
                  >
                    <Users className="w-7 h-7 text-muted-foreground" />
                  </motion.div>
                  <p className="text-sm font-semibold text-foreground">No recent agents</p>
                  <p className="text-xs text-muted-foreground mt-1">Your cash out history will appear here</p>
                </motion.div>
                  ) : filteredAgents.map((a) => (
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
                        </div>
                        <p className="text-xs text-muted-foreground">{a.agentId}</p>
                      </div>
                      <ChevronLeft size={16} className="text-muted-foreground rotate-180 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 1b: Bank ── */}
            {step === "bank" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Saved bank accounts */}
                {savedBanks.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t("savedAccounts")}</label>
                    <div className="space-y-2">
                      {savedBanks.map((sb) => (
                        <div key={sb.id} className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setBankName(sb.bank_name);
                              setAccountNumber(sb.account_number);
                              setAccountHolder(sb.account_holder);
                              setError("");
                            }}
                            className={`flex-1 flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98] text-left ${
                              bankName === sb.bank_name && accountNumber === sb.account_number
                                ? "border-primary bg-primary/10 shadow-card"
                                : "border-border bg-card hover:border-primary/50"
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                              {sb.short_code.slice(0, 2)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{sb.account_holder}</p>
                              <p className="text-xs text-muted-foreground">{sb.bank_name} · {sb.account_number.slice(-4).padStart(sb.account_number.length, "•")}</p>
                            </div>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(sb.id)}
                            className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">{t("orEnterNew")}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("selectBank")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BANKS.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => { setBankName(b.name); setError(""); }}
                        className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${
                          bankName === b.name
                            ? "border-primary bg-primary/10 shadow-card"
                            : "border-border bg-card hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            bankName === b.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}>
                            {b.short.slice(0, 2)}
                          </div>
                          <p className="text-xs font-semibold text-foreground truncate">{b.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("accountNumber")}</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. 1234567890123"
                      value={accountNumber}
                      onChange={(e) => { setAccountNumber(e.target.value); setError(""); }}
                      className="pl-9 h-12 text-base bg-card border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("accountHolderName")}</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="e.g. Mohammad Ali"
                      value={accountHolder}
                      onChange={(e) => { setAccountHolder(e.target.value); setError(""); }}
                      className="pl-9 h-12 text-base bg-card border-border"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}

                <Button
                  className="w-full h-11 gradient-cashout border-0 text-white font-semibold"
                  onClick={handleBankContinue}
                >
                  {t("continue")}
                </Button>
              </div>
            )}

            {/* ── STEP 2: Amount ── */}
            {step === "amount" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Recipient pill */}
                {!isBank && agent && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${agent.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      <Store size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("cashingOutAt")}</p>
                      <p className="text-sm font-bold text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.agentId} · {agent.address}</p>
                    </div>
                  </div>
                )}
                {isBank && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className="bg-gradient-to-b from-blue-500 to-indigo-600 w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0">
                      <Landmark size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("transferringTo")}</p>
                      <p className="text-sm font-bold text-foreground">{bankName}</p>
                      <p className="text-xs text-muted-foreground">{accountNumber} · {accountHolder}</p>
                    </div>
                  </div>
                )}


                {/* Big amount input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">{t("enterAmount")}</label>
                    <div className="flex flex-col items-end gap-0.5">
                      <AvailableBalanceBadge />
                      <DailyLimitBadge txnType={cashOutMethod === "bank" ? "banktransfer" : "cashout"} />
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) { setAmount(v); setError(""); } }}
                      className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  <p className="text-xs text-muted-foreground font-medium">{t("quickSelect")}</p>
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
                      <span>{t("cashOutAmount")}</span>
                      <span className="text-foreground font-medium">৳{parseFloat(amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Fee ({FEE_LABEL})</span>
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
                      <span>{t("youReceive")}</span>
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
                  {t("continueToPIN")}
                </Button>
              </div>
            )}

            {/* ── STEP 3: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                {/* Summary banner */}
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{isBank ? t("transferringToBank") : t("cashingOut")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{parseFloat(amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {isBank
                      ? <>to <span className="font-semibold text-foreground">{bankName}</span></>
                      : <>at <span className="font-semibold text-foreground">{agent?.name}</span></>
                    }
                  </p>
                </div>

                {/* Recipient card */}
                <div className="rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3">
                  {isBank ? (
                    <>
                      <div className="bg-gradient-to-b from-blue-500 to-indigo-600 w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0">
                        <Landmark size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">{bankName}</p>
                        <p className="text-xs text-muted-foreground">{accountNumber} · {accountHolder}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`${agent?.gradient} w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0`}>
                        <Store size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">{agent?.name}</p>
                        <p className="text-xs text-muted-foreground">{agent?.agentId} · {agent?.address}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Fee row */}
                <div className="rounded-2xl bg-muted/40 border border-border p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("youReceive")}</span>
                    <span className="font-bold text-primary">৳{parseFloat(receive).toLocaleString()}</span>
                  </div>
                  {feeNum > 0 && (
                    <p className="text-[11px] text-muted-foreground text-right">
                      ৳{parseFloat(amount).toLocaleString()} + ৳{fee} fee ({feeFromBalance >= feeNum ? "from balance" : feeFromBalance > 0 ? "balance + amount" : "from amount"})
                    </p>
                  )}
                </div>

                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label={isBank ? t("slideToTransfer") : t("slideToCashOut")}
                  gradient="gradient-cashout"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                  icon={Landmark}
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
                  <h2 className="text-2xl font-extrabold text-foreground">
                    {isBank ? t("bankTransferSuccessful") : t("cashOutSuccessful")}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{parseFloat(amount).toLocaleString()} {isBank ? "transferred to" : "cashed out at"}{" "}
                    <span className="font-semibold text-foreground">{isBank ? bankName : agent?.name}</span>
                  </p>
                </motion.div>

                {/* Receipt card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  {isBank ? (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Bank</span>
                        <span className="text-foreground font-medium">{bankName}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Account</span>
                        <span className="text-foreground font-medium">{accountNumber}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Account Holder</span>
                        <span className="text-foreground font-medium">{accountHolder}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Agent</span>
                        <span className="text-foreground font-medium">{agent?.name}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Agent ID</span>
                        <span className="text-foreground font-medium">{agent?.agentId}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Amount</span>
                    <span className="text-foreground font-medium">৳{parseFloat(amount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fee ({FEE_LABEL})</span>
                    <span className="text-foreground font-medium">৳{fee}</span>
                  </div>
                  {feeNum > 0 && (
                    <p className="text-[11px] text-muted-foreground text-right">
                      ৳{parseFloat(amount).toLocaleString()} + ৳{fee} fee ({feeFromBalance >= feeNum ? "from balance" : feeFromBalance > 0 ? "balance + amount" : "from amount"})
                    </p>
                  )}
                  {feeFromAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>You Received</span>
                      <span className="font-semibold text-primary">৳{parseFloat(receive).toLocaleString()}</span>
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
                    {t("backToHome")}
                  </Button>
                  <Button variant="outline" className="w-full h-11" onClick={() => setShowShare(true)}>
                    {t("shareReceipt")}
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
        title={t("scanAgentQr")}
      />

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: isBank ? "Bank Transfer Successful" : "Cash Out Successful",
          amount: `৳${parseFloat(amount || "0").toLocaleString()}`,
          gradient: "gradient-cashout",
          txnId: txnId.current,
          rows: [
            ...(isBank
              ? [
                  { label: "Bank", value: bankName },
                  { label: "Account", value: accountNumber },
                  { label: "Account Holder", value: accountHolder },
                ]
              : [
                  { label: "Agent", value: agent?.name ?? "" },
                  { label: "Agent ID", value: agent?.agentId ?? "" },
                ]
            ),
            { label: "Amount", value: `৳${parseFloat(amount || "0").toLocaleString()}` },
            { label: `Fee (${FEE_LABEL})`, value: `৳${feeNum.toFixed(2)}` },
            { label: "You Received", value: `৳${parseFloat(receive).toLocaleString()}` },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="rounded-2xl max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeSavedAccount")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeSavedAccountDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId) removeBank(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const CashOutFlowGuarded = (props: CashOutFlowProps) => (
  <FeatureGuard featureKey="cash_out" onClose={props.onClose}>
    <CashOutFlow {...props} />
  </FeatureGuard>
);

export default CashOutFlowGuarded;


