import { useState, useEffect } from "react";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { useFundRequests, FundRequest } from "@/hooks/use-fund-requests";
import { useSavedBanks } from "@/hooks/use-saved-banks";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import {
  ChevronLeft, AlertCircle, CheckCircle2, Landmark, User, Hash, Clock, XCircle, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Step = "bank" | "amount" | "success";
const STEPS: Step[] = ["bank", "amount"];
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

const BANKS = [
  { id: "dbbl", name: "Dutch-Bangla Bank", short: "DBBL" },
  { id: "brac", name: "BRAC Bank", short: "BRAC" },
  { id: "city", name: "City Bank", short: "CITY" },
  { id: "ebl", name: "Eastern Bank", short: "EBL" },
  { id: "ucb", name: "UCB Bank", short: "UCB" },
  { id: "islami", name: "Islami Bank", short: "IBBL" },
  { id: "ab", name: "AB Bank", short: "AB" },
  { id: "scb", name: "Standard Chartered", short: "SCB" },
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

interface BankTransferFlowProps { onClose: () => void; }

const BankTransferFlow = ({ onClose }: BankTransferFlowProps) => {
  const { t } = useI18n();
  const { requests, submitRequest } = useFundRequests();
  const { accounts: savedBanks, save: saveBank, remove: removeBank } = useSavedBanks();
  const [step, setStep] = useState<Step>("bank");
  const [direction, setDirection] = useState(1);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const myRequests = requests.filter(r => r.type === "withdraw");
  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > STEPS.indexOf(step) ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "bank") { onClose(); return; }
    if (step === "amount") { goTo("bank"); return; }
  };

  const handleBankContinue = () => {
    if (!bankName) { setError("Select a bank."); return; }
    if (accountNumber.trim().length < 8) { setError("Enter a valid account number."); return; }
    if (accountHolder.trim().length < 2) { setError("Enter account holder name."); return; }
    goTo("amount");
  };

  const handleSubmit = async () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError("Enter a valid amount."); return; }
    if (val < 30) { setError("Minimum withdrawal is ৳30."); return; }
    if (val > 50000) { setError("Maximum withdrawal is ৳50,000."); return; }
    setSubmitting(true);
    try {
      await submitRequest({
        type: "withdraw",
        amount: val,
        source_method: "bank_transfer",
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
      });
      const bankShort = BANKS.find(b => b.name === bankName)?.short ?? bankName.slice(0, 4).toUpperCase();
      saveBank({ bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, short_code: bankShort });
      haptics.success();
      setDirection(1);
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
        <motion.div className="bg-gradient-to-b from-blue-500 to-indigo-600 px-4 pt-3 pb-3 text-primary-foreground"
          initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="flex items-center gap-3 mb-2">
            <button onClick={goBack} className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0">
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowBankTransfer")}</h1>
              <p className="text-xs text-white/70 mt-0.5">Submit a withdrawal request</p>
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
            <h3 className="text-sm font-semibold text-foreground">Your Withdrawal Requests</h3>
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
                  <p className="text-xs text-muted-foreground">{r.bank_name} · {r.account_number?.slice(-4).padStart(r.account_number.length, "•")} · {new Date(r.created_at).toLocaleDateString()}</p>
                  {r.admin_note && <p className="text-xs text-destructive">Note: {r.admin_note}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <AnimatePresence custom={direction} mode="wait">
            <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
              transition={{ type: "spring", stiffness: 320, damping: 32 }} className="px-4 pt-6 pb-32">

              {step === "bank" && (
                <div className="space-y-6">
                  {savedBanks.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">{t("savedAccounts")}</label>
                      <div className="space-y-2">
                        {savedBanks.map(sb => (
                          <div key={sb.id} className="flex items-center gap-3">
                            <button onClick={() => { setBankName(sb.bank_name); setAccountNumber(sb.account_number); setAccountHolder(sb.account_holder); setError(""); }}
                              className={`flex-1 flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.98] text-left ${bankName === sb.bank_name && accountNumber === sb.account_number ? "border-primary bg-primary/10 shadow-card" : "border-border bg-card hover:border-primary/50"}`}>
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{sb.short_code.slice(0, 2)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{sb.account_holder}</p>
                                <p className="text-xs text-muted-foreground">{sb.bank_name} · {sb.account_number.slice(-4).padStart(sb.account_number.length, "•")}</p>
                              </div>
                            </button>
                            <button onClick={() => setDeleteConfirmId(sb.id)} className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">{t("orEnterNew")}</span><div className="flex-1 h-px bg-border" /></div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t("selectBank")}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {BANKS.map(b => (
                        <button key={b.id} onClick={() => { setBankName(b.name); setError(""); }}
                          className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${bankName === b.name ? "border-primary bg-primary/10 shadow-card" : "border-border bg-card hover:border-primary/50"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${bankName === b.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{b.short.slice(0, 2)}</div>
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
                      <Input type="text" placeholder="e.g. 1234567890123" value={accountNumber} onChange={e => { setAccountNumber(e.target.value); setError(""); }} className="pl-9 h-12 text-base bg-card border-border" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t("accountHolderName")}</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type="text" placeholder="e.g. Mohammad Ali" value={accountHolder} onChange={e => { setAccountHolder(e.target.value); setError(""); }} className="pl-9 h-12 text-base bg-card border-border" />
                    </div>
                  </div>
                  {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
                  <Button className="w-full h-11 bg-gradient-to-b from-blue-500 to-indigo-600 border-0 text-white font-semibold" onClick={handleBankContinue}>{t("continue")}</Button>
                </div>
              )}

              {step === "amount" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className="bg-gradient-to-b from-blue-500 to-indigo-600 w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"><Landmark size={20} /></div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("transferringTo")}</p>
                      <p className="text-sm font-bold text-foreground">{bankName}</p>
                      <p className="text-xs text-muted-foreground">{accountNumber} · {accountHolder}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-foreground">{t("enterAmount")}</label>
                      <AvailableBalanceBadge />
                    </div>
                    <div className="relative flex items-center">
                      <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                      <input type="text" inputMode="decimal" placeholder="0" value={amount}
                        onChange={e => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) { setAmount(v); setError(""); } }}
                        className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40" />
                    </div>
                    {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {QUICK_AMOUNTS.map(q => (
                      <button key={q} onClick={() => setAmount(String(q))}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${amount === String(q) ? "bg-gradient-to-b from-blue-500 to-indigo-600 text-white border-transparent" : "bg-card border-border text-foreground hover:border-primary/50"}`}>
                        ৳{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <Clock size={12} className="inline mr-1" />
                      Your balance will be deducted after admin approves this withdrawal request.
                    </p>
                  </div>
                  <Button className="w-full h-11 bg-gradient-to-b from-blue-500 to-indigo-600 border-0 text-white font-semibold"
                    onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit Withdrawal Request"}
                  </Button>
                </div>
              )}

              {step === "success" && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                      <Clock size={36} className="text-blue-600" />
                    </div>
                  </motion.div>
                  <h2 className="text-xl font-bold text-foreground">Withdrawal Request Submitted</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Your withdrawal of <span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span> to {bankName} is pending admin approval.
                  </p>
                  <Button className="mt-4 w-full max-w-xs" onClick={onClose}>Done</Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Delete saved bank confirm dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove saved account?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the saved bank details.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteConfirmId) removeBank(deleteConfirmId); setDeleteConfirmId(null); }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default BankTransferFlow;
