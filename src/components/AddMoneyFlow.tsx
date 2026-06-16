import { useState, useRef, useEffect } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { useFundRequests } from "@/hooks/use-fund-requests";
import { useDepositAccounts } from "@/hooks/use-deposit-accounts";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft, CheckCircle2, AlertCircle, Upload, Clock,
  Landmark, CreditCard, Wallet, Copy, Check, ShieldAlert, ShieldCheck,
  XCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { verifyPin } from "@/lib/verifyPin";


type Step = "amount" | "source" | "send_to" | "proof" | "pin" | "success";
const STEPS: Step[] = ["amount", "source", "send_to", "proof", "pin"];
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

const SOURCE_OPTIONS = [
  { id: "bank_transfer", label: "Bank Transfer", icon: Landmark, color: "bg-blue-500" },
  { id: "bkash", label: "bKash", icon: Wallet, color: "bg-[#E2136E]" },
  { id: "nagad", label: "Nagad", icon: Wallet, color: "bg-[#F6921E]" },
  { id: "rocket", label: "Rocket", icon: Wallet, color: "bg-[#8B2F8B]" },
  { id: "upay", label: "Upay", icon: Wallet, color: "bg-[#00A859]" },
  { id: "card", label: "Card / Other", icon: CreditCard, color: "bg-slate-600" },
];

// TxnID validation patterns per provider
const TXNID_PATTERNS: Record<string, { regex: RegExp; hint: string }> = {
  bkash: {
    regex: /^[A-Za-z0-9]{10}$/,
    hint: "bKash TxnID is 10 alphanumeric characters (e.g., ABC1234XYZ)",
  },
  nagad: {
    regex: /^\d{8,15}$/,
    hint: "Nagad TxnID is 8-15 digits (e.g., 12345678901)",
  },
  rocket: {
    regex: /^R?\d{8,15}$/i,
    hint: "Rocket TxnID starts with 'R' followed by digits (e.g., R12345678)",
  },
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};


interface AddMoneyFlowProps { onClose: () => void; }

const AddMoneyFlow = ({ onClose }: AddMoneyFlowProps) => {
  const { t } = useI18n();
  const { requests, submitAddMoney, uploadProof } = useFundRequests();
  const [step, setStep] = useState<Step>("amount");
  const [direction, setDir] = useState(1);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [txnId, setTxnId] = useState("");
  const [txnIdWarning, setTxnIdWarning] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const pinRef = useRef<HTMLInputElement>(null);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<string>("pending");
  const [duplicateTxnWarning, setDuplicateTxnWarning] = useState("");
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const duplicateCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { accounts: depositAccounts, loading: depositLoading } = useDepositAccounts(source ?? undefined);

  
  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    setDir(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "amount") { onClose(); return; }
    if (step === "source") { goTo("amount"); return; }
    if (step === "send_to") { goTo("source"); return; }
    if (step === "proof") { goTo("send_to"); return; }
    if (step === "pin") { setPin(""); setPinError(""); goTo("proof"); return; }
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 10) { setError("Minimum is ৳10."); return; }
    if (val > 100000) { setError("Maximum is ৳1,00,000."); return; }
    goTo("source");
  };

  const handleSourceContinue = () => {
    if (!source) { setError("Select a source."); return; }
    goTo("send_to");
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    haptics.light();
    toast.success("Copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5MB."); return; }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setError("");
  };

  // Validate TxnID format based on source
  const validateTxnId = (value: string) => {
    if (!value.trim()) { setTxnIdWarning(""); return; }
    if (!source || !TXNID_PATTERNS[source]) { setTxnIdWarning(""); return; }
    const pattern = TXNID_PATTERNS[source];
    if (!pattern.regex.test(value.trim())) {
      setTxnIdWarning(pattern.hint);
    } else {
      setTxnIdWarning("");
    }
  };

  // Debounced duplicate TxnID check
  const checkDuplicateTxnId = (value: string) => {
    if (duplicateCheckTimer.current) clearTimeout(duplicateCheckTimer.current);
    if (!value.trim()) { setDuplicateTxnWarning(""); setCheckingDuplicate(false); return; }
    setCheckingDuplicate(true);
    duplicateCheckTimer.current = setTimeout(async () => {
      try {
        const trimmed = value.trim();
        const { data } = await supabase
          .from("fund_requests")
          .select("id,created_at,status")
          .eq("transaction_id_proof", trimmed)
          .neq("status", "rejected")
          .limit(1);
        if (data && data.length > 0) {
          const date = new Date(data[0].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          setDuplicateTxnWarning(`This Transaction ID was already submitted on ${date} (${data[0].status}). Duplicate IDs may delay processing.`);
        } else {
          setDuplicateTxnWarning("");
        }
      } catch {
        setDuplicateTxnWarning("");
      } finally {
        setCheckingDuplicate(false);
      }
    }, 500);
  };

  const handleProofContinue = () => {
    if (!txnId.trim() && !proofFile) { setError("Provide a Transaction ID or upload proof."); return; }
    if (duplicateTxnWarning) { setError("Please use a different Transaction ID — this one was already submitted."); return; }
    setPin("");
    setPinError("");
    goTo("pin");
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) { setPinError("Enter your 4-digit PIN."); return; }
    setSubmitting(true);
    setPinError("");
    try {
      const valid = await verifyPin(pin);
      if (!valid) { setPinError("Incorrect PIN. Try again."); setPin(""); setSubmitting(false); return; }
      let proofUrl: string | undefined;
      if (proofFile) {
        proofUrl = await uploadProof(proofFile);
      }
      const result = await submitAddMoney({
        amount: parseFloat(amount),
        source_method: source ?? undefined,
        proof_url: proofUrl,
        transaction_id_proof: txnId.trim() || undefined,
      });
      if (result?.request_id) {
        setSubmittedRequestId(result.request_id);
      }
      haptics.success();
      setDir(1);
      setStep("success");
      import("@/lib/activityTracker").then(({ activityTracker }) =>
        activityTracker.transaction("add_money_request", { amount: parseFloat(amount) || 0 })
      );
    } catch (e: any) {
      setPinError(e.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  // Real-time status tracking on success screen
  useEffect(() => {
    if (step !== "success" || !submittedRequestId) return;
    
    const channel = supabase
      .channel(`fund-request-${submittedRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "fund_requests",
          filter: `id=eq.${submittedRequestId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          if (newStatus) {
            setTrackingStatus(newStatus);
            if (newStatus === "approved") {
              haptics.success();
              toast.success("Your add money request has been approved! ✅");
            } else if (newStatus === "rejected") {
              haptics.error();
              toast.error("Your add money request was rejected.");
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [step, submittedRequestId]);

  const trackingSteps = [
    { key: "pending", label: "Submitted", icon: Clock },
    { key: "review", label: "Under Review", icon: Loader2 },
    { key: "approved", label: "Approved", icon: CheckCircle2 },
  ];

  const getTrackingIndex = () => {
    if (trackingStatus === "approved") return 2;
    if (trackingStatus === "rejected") return -1;
    return 0; // pending
  };

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}
        className="fixed inset-0 z-50 bg-background flex flex-col max-w-md sm:max-w-xl mx-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-money-title">

        {step !== "success" && (
          <motion.div className="gradient-send px-4 pt-3 pb-3 text-primary-foreground"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={goBack}
                aria-label="Go back"
                className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 id="add-money-title" className="text-xl font-extrabold tracking-tight">Add Money</h1>
                <p className="text-xs text-white/70 mt-0.5">Submit a deposit request for approval</p>
              </div>
            </div>
            <div
              className="h-1.5 rounded-full bg-white/20 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-valuenow={stepIndex + 1}
              aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
            >
              <motion.div className="h-full bg-white rounded-full"
                animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
            </div>
          </motion.div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-none">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ type: "spring", stiffness: 320, damping: 32 }} className="px-4 pt-6 pb-32">

                {step === "amount" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Enter Amount</label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                        <input type="text" inputMode="decimal" placeholder="0" value={amount}
                          onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) { setAmount(v); setError(""); } }}
                          className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40" />
                      </div>
                      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {QUICK_AMOUNTS.map(q => (
                        <button key={q} onClick={() => setAmount(String(q))}
                          className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${amount === String(q) ? "gradient-primary text-white border-transparent" : "bg-card border-border text-foreground hover:border-primary/50"}`}>
                          ৳{q.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    {parseFloat(amount) > 0 && parseFloat(amount) > 100000 && (
                      <p className="text-center text-sm text-destructive font-medium">Exceeds daily limit (৳100,000)</p>
                    )}
                    {parseFloat(amount) > 0 && parseFloat(amount) <= 100000 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                        <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold" onClick={handleAmountContinue}>Continue</Button>
                      </motion.div>
                    )}
                  </div>
                )}

                {step === "source" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">How did you send the money?</label>
                      <div className="grid grid-cols-2 gap-2">
                        {SOURCE_OPTIONS.map(s => {
                          const Icon = s.icon;
                          return (
                            <button key={s.id} onClick={() => { setSource(s.id); setError(""); }}
                              className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${source === s.id ? "border-primary bg-primary/10 shadow-card" : "border-border bg-card hover:border-primary/50"}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center text-white shrink-0`}><Icon size={16} /></div>
                                <span className="text-xs font-semibold text-foreground">{s.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
                    </div>
                    <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold" onClick={handleSourceContinue}>Continue</Button>
                  </div>
                )}

                {step === "send_to" && (
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Source</span><span className="font-medium text-foreground capitalize">{source?.replace("_", " ")}</span></div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Send money to this account</label>
                      {depositLoading ? (
                        <p className="text-sm text-muted-foreground">Loading accounts…</p>
                      ) : depositAccounts.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card p-4 text-center">
                          <p className="text-sm text-muted-foreground">No deposit account configured for this method yet. Please contact support.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {depositAccounts.map(acc => (
                            <div key={acc.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">{acc.label}</span>
                                {acc.account_name && <span className="text-xs text-muted-foreground">{acc.account_name}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold font-mono text-foreground flex-1">{acc.account_number}</span>
                                <button
                                  onClick={() => copyToClipboard(acc.account_number, acc.id)}
                                  className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary active:scale-95 transition-transform"
                                >
                                  {copiedId === acc.id ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                              </div>
                              {acc.bank_name && <p className="text-xs text-muted-foreground">Bank: {acc.bank_name}</p>}
                              {acc.instructions && <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">{acc.instructions}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold" onClick={() => goTo("proof")}>
                      I've Sent the Money
                    </Button>
                  </div>
                )}

                {step === "proof" && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
                      <ShieldAlert size={20} className="text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-destructive">⚠️ Warning</p>
                        <p className="text-xs text-destructive/90 leading-relaxed">
                          Submitting fake transaction details, forged screenshots, or fraudulent proof will result in <span className="font-bold">immediate and permanent account termination</span>. Legal action may be pursued. All submissions are verified.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Source</span><span className="font-medium text-foreground capitalize">{source?.replace("_", " ")}</span></div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Transaction ID / Reference</label>
                      <Input type="text" placeholder="e.g. TXN123456789" value={txnId}
                        onChange={(e) => { setTxnId(e.target.value); setError(""); validateTxnId(e.target.value); checkDuplicateTxnId(e.target.value); }}
                        className="h-12 bg-card border-border" />
                      {checkingDuplicate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" />Checking for duplicates…
                        </p>
                      )}
                      {duplicateTxnWarning && (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 flex gap-2">
                          <XCircle size={16} className="text-destructive shrink-0 mt-0.5" />
                          <p className="text-xs text-destructive leading-relaxed">{duplicateTxnWarning}</p>
                        </div>
                      )}
                      {txnIdWarning && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle size={12} />{txnIdWarning}
                        </p>
                      )}
                      {source && TXNID_PATTERNS[source] && !txnIdWarning && txnId.trim() && !duplicateTxnWarning && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} />Format looks correct
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Upload Receipt / Screenshot</label>
                      <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/50 cursor-pointer transition-colors">
                        {proofPreview ? (
                          <img src={proofPreview} alt="Proof" className="w-full max-h-48 object-contain rounded-lg" />
                        ) : (
                          <>
                            <Upload size={24} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Tap to upload (max 5MB)</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </label>
                    </div>

                    {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

                    <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold"
                      onClick={handleProofContinue}>
                      Continue
                    </Button>
                  </div>
                )}

                {step === "pin" && (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 px-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                      <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <ShieldCheck size={36} className="text-emerald-600" />
                      </div>
                    </motion.div>
                    <div className="text-center space-y-1">
                      <h2 className="text-xl font-bold text-foreground">Confirm with PIN</h2>
                      <p className="text-sm text-muted-foreground">Enter your 4-digit PIN to submit</p>
                    </div>
                    <div className="flex justify-center gap-3">
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? "bg-emerald-500 scale-110" : "bg-border"}`} />
                      ))}
                    </div>
                    <Input
                      ref={pinRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      autoFocus
                      value={pin}
                      onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); setPinError(""); }}
                      className="w-48 h-14 text-center text-2xl tracking-[0.5em] font-bold bg-card border-border"
                      placeholder="····"
                    />
                    {pinError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{pinError}</p>}
                    <Button
                      className="w-full max-w-xs h-11 gradient-primary border-0 text-white font-semibold"
                      onClick={handlePinSubmit}
                      disabled={submitting || pin.length !== 4}
                    >
                      {submitting ? "Verifying…" : "Confirm & Submit"}
                    </Button>
                  </div>
                )}

                {step === "success" && (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                      <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                        {trackingStatus === "approved" ? (
                          <CheckCircle2 size={36} className="text-emerald-600" />
                        ) : trackingStatus === "rejected" ? (
                          <XCircle size={36} className="text-destructive" />
                        ) : (
                          <Clock size={36} className="text-emerald-600" />
                        )}
                      </div>
                    </motion.div>
                    <h2 className="text-xl font-bold text-foreground">
                      {trackingStatus === "approved" ? "Request Approved! ✅" :
                       trackingStatus === "rejected" ? "Request Rejected" :
                       "Request Submitted"}
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {trackingStatus === "approved" ? (
                        <>৳{parseFloat(amount).toLocaleString()} has been added to your wallet.</>
                      ) : trackingStatus === "rejected" ? (
                        <>Your add money request of ৳{parseFloat(amount).toLocaleString()} was rejected. Check notifications for details.</>
                      ) : (
                        <>Your add money request of <span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span> is pending approval.</>
                      )}
                    </p>

                    {/* Status Tracker */}
                    {trackingStatus !== "rejected" && (
                      <div className="w-full max-w-xs mt-2">
                        <div className="flex items-center justify-between relative">
                          <div className="absolute top-4 left-8 right-8 h-0.5 bg-border" />
                          <div
                            className="absolute top-4 left-8 h-0.5 bg-emerald-500 transition-all duration-500"
                            style={{ width: `${getTrackingIndex() * 50}%` }}
                          />
                          {trackingSteps.map((ts, i) => {
                            const Icon = ts.icon;
                            const isActive = i <= getTrackingIndex();
                            const isCurrent = i === getTrackingIndex();
                            return (
                              <div key={ts.key} className="flex flex-col items-center gap-1 relative z-10">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                  isActive ? "bg-emerald-500 text-white" : "bg-muted border border-border text-muted-foreground"
                                } ${isCurrent ? "ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-background" : ""}`}>
                                  <Icon size={14} className={isCurrent && trackingStatus === "pending" ? "animate-pulse" : ""} />
                                </div>
                                <span className={`text-[10px] font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                  {ts.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {trackingStatus === "pending" && (
                      <p className="text-xs text-muted-foreground mt-2">
                        ⏱ Usually processed within 15 minutes. You'll be notified when done.
                      </p>
                    )}

                    <Button className="mt-4 w-full max-w-xs" onClick={onClose}>Done</Button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
        </div>
      </motion.div>
  );
};

const AddMoneyFlowGuarded = (props: AddMoneyFlowProps) => (
  <FeatureGuard featureKey="add_money" onClose={props.onClose}>
    <AddMoneyFlow {...props} />
  </FeatureGuard>
);

export default AddMoneyFlowGuarded;
