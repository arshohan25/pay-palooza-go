import { useState, useEffect } from "react";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { useFundRequests, FundRequest } from "@/hooks/use-fund-requests";
import { useDepositAccounts } from "@/hooks/use-deposit-accounts";
import {
  ChevronLeft, CheckCircle2, AlertCircle, Upload, Clock, XCircle,
  Landmark, CreditCard, Wallet, Image as ImageIcon, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";


type Step = "amount" | "source" | "send_to" | "proof" | "success";
const STEPS: Step[] = ["amount", "source", "send_to", "proof"];
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];

const SOURCE_OPTIONS = [
  { id: "bank_transfer", label: "Bank Transfer", icon: Landmark, color: "bg-blue-500" },
  { id: "bkash", label: "bKash", icon: Wallet, color: "bg-[#E2136E]" },
  { id: "nagad", label: "Nagad", icon: Wallet, color: "bg-[#F6921E]" },
  { id: "rocket", label: "Rocket", icon: Wallet, color: "bg-[#8B2F8B]" },
  { id: "upay", label: "Upay", icon: Wallet, color: "bg-[#00A859]" },
  { id: "card", label: "Card / Other", icon: CreditCard, color: "bg-slate-600" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

const STATUS_BADGE: Record<string, { color: string; icon: any }> = {
  pending: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  approved: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  rejected: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

interface AddMoneyFlowProps { onClose: () => void; }

const AddMoneyFlow = ({ onClose }: AddMoneyFlowProps) => {
  const { t } = useI18n();
  const { requests, submitRequest, uploadProof } = useFundRequests();
  const [step, setStep] = useState<Step>("amount");
  const [direction, setDir] = useState(1);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [txnId, setTxnId] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { accounts: depositAccounts, loading: depositLoading } = useDepositAccounts(source ?? undefined);

  const myRequests = requests.filter(r => r.type === "add_money");
  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    setDir(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "amount") { onClose(); return; }
    if (step === "source") { goTo("amount"); return; }
    if (step === "proof") { goTo("source"); return; }
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
    goTo("proof");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("File must be under 5MB."); return; }
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async () => {
    if (!txnId.trim() && !proofFile) { setError("Provide a Transaction ID or upload proof."); return; }
    setSubmitting(true);
    try {
      let proofUrl: string | undefined;
      if (proofFile) {
        proofUrl = await uploadProof(proofFile);
      }
      await submitRequest({
        type: "add_money",
        amount: parseFloat(amount),
        source_method: source ?? undefined,
        proof_url: proofUrl,
        transaction_id_proof: txnId.trim() || undefined,
      });
      haptics.success();
      setDir(1);
      setStep("success");
    } catch (e: any) {
      setError(e.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 500, damping: 40 }}
        className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

        {step !== "success" && (
          <motion.div className="bg-gradient-to-b from-emerald-500 to-green-600 px-4 pt-3 pb-3 text-primary-foreground"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={goBack} className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0">
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-extrabold tracking-tight">Add Money</h1>
                <p className="text-xs text-white/70 mt-0.5">Submit a deposit request for approval</p>
              </div>
              {myRequests.length > 0 && (
                <button onClick={() => setShowHistory(!showHistory)}
                  className="text-xs bg-white/20 px-3 py-1.5 rounded-full font-medium">
                  {showHistory ? "New Request" : `History (${myRequests.length})`}
                </button>
              )}
            </div>
            {!showHistory && (
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <motion.div className="h-full bg-white rounded-full"
                  animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
              </div>
            )}
          </motion.div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-none">
          {showHistory ? (
            <div className="px-4 pt-4 pb-32 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Your Add Money Requests</h3>
              {myRequests.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
              {myRequests.map(r => {
                const badge = STATUS_BADGE[r.status];
                const Icon = badge?.icon ?? Clock;
                return (
                  <div key={r.id} className="p-3 rounded-2xl border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-foreground">৳{r.amount.toLocaleString()}</span>
                      <Badge className={`${badge?.color} text-[10px] gap-1`}><Icon size={10} />{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Via {r.source_method ?? "—"} · {new Date(r.created_at).toLocaleDateString()}</p>
                    {r.admin_note && <p className="text-xs text-destructive">Note: {r.admin_note}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
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
                          className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${amount === String(q) ? "bg-gradient-to-b from-emerald-500 to-green-600 text-white border-transparent" : "bg-card border-border text-foreground hover:border-primary/50"}`}>
                          ৳{q.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <Button className="w-full h-11 bg-gradient-to-b from-emerald-500 to-green-600 border-0 text-white font-semibold" onClick={handleAmountContinue}>Continue</Button>
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
                    <Button className="w-full h-11 bg-gradient-to-b from-emerald-500 to-green-600 border-0 text-white font-semibold" onClick={handleSourceContinue}>Continue</Button>
                  </div>
                )}

                {step === "proof" && (
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Source</span><span className="font-medium text-foreground capitalize">{source?.replace("_", " ")}</span></div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">Transaction ID / Reference</label>
                      <Input type="text" placeholder="e.g. TXN123456789" value={txnId}
                        onChange={(e) => { setTxnId(e.target.value); setError(""); }}
                        className="h-12 bg-card border-border" />
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

                    <Button className="w-full h-11 bg-gradient-to-b from-emerald-500 to-green-600 border-0 text-white font-semibold"
                      onClick={handleSubmit} disabled={submitting}>
                      {submitting ? "Submitting…" : "Submit Request"}
                    </Button>
                  </div>
                )}

                {step === "success" && (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                      <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                        <Clock size={36} className="text-emerald-600" />
                      </div>
                    </motion.div>
                    <h2 className="text-xl font-bold text-foreground">Request Submitted</h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Your add money request of <span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span> is pending admin approval. You'll be notified once processed.
                    </p>
                    <Button className="mt-4 w-full max-w-xs" onClick={onClose}>Done</Button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
  );
};

export default AddMoneyFlow;
