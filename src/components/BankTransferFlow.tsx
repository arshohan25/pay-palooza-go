import { validateRecipient } from "@/lib/recipientValidation";
import { useState, useMemo } from "react";
import FeatureGuard from "@/components/FeatureGuard";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence } from "framer-motion";
import { useFundRequests } from "@/hooks/use-fund-requests";
import { useSavedBanks } from "@/hooks/use-saved-banks";
import { verifyPin } from "@/lib/verifyPin";
import { useFeeConfig } from "@/hooks/use-fee-config";
import { BANGLADESH_BANKS } from "@/lib/bangladeshBanks";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import { getBalance } from "@/lib/balanceStore";
import SlideToConfirm from "@/components/SlideToConfirm";
import {
  ChevronLeft, AlertCircle, CheckCircle2, Landmark, User, Hash, Clock, Trash2, ShieldCheck, Search, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Step = "bank" | "amount" | "confirm" | "pin" | "success";
const STEPS: Step[] = ["bank", "amount", "confirm", "pin"];
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

interface BankTransferFlowProps { onClose: () => void; }

const BankTransferFlow = ({ onClose }: BankTransferFlowProps) => {
  const { t, lang } = useI18n();
  const numLocale = lang === "bn" ? "bn-BD" : "en-US";
  const fmt = (n: number) => n.toLocaleString(numLocale);
  const { requests, submitWithdraw } = useFundRequests();
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
  const [bankSearch, setBankSearch] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [resultData, setResultData] = useState<{ fee: number; total_deducted: number; new_balance: number } | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const parsedAmount = parseFloat(amount) || 0;
  const { calcBankTransferFee } = useFeeConfig();
  const fee = calcBankTransferFee(parsedAmount);
  const totalDeduction = parsedAmount + fee;

  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return BANGLADESH_BANKS;
    const q = bankSearch.toLowerCase();
    return BANGLADESH_BANKS.filter(b => b.name.toLowerCase().includes(q) || b.short.toLowerCase().includes(q));
  }, [bankSearch]);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > STEPS.indexOf(step) ? 1 : -1);
    setStep(next);
    setError("");
    setPinError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "bank") { onClose(); return; }
    if (step === "amount") { goTo("bank"); return; }
    if (step === "confirm") { goTo("amount"); return; }
    if (step === "pin") { setPin(""); setPinError(""); setPinVerified(false); goTo("confirm"); return; }
  };

  const handleBankContinue = () => {
    if (!bankName) { setError(t("btErrSelectBank")); return; }
    const acctCheck = validateRecipient("bankAccount", accountNumber);
    if (!acctCheck.isValid) { setError(acctCheck.errorMessage || t("btErrValidAccount")); return; }
    if (accountHolder.trim().length < 2) { setError(t("btErrAccountHolder")); return; }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError(t("btErrValidAmount")); return; }
    if (val < 30) { setError(t("btErrMinAmount")); return; }
    if (val > 50000) { setError(t("btErrMaxAmount")); return; }
    goTo("confirm");
  };

  const handleConfirmContinue = () => {
    goTo("pin");
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) { setPinError(t("btErrPin4")); return; }
    setSubmitting(true);
    setPinError("");
    try {
      const valid = await verifyPin(pin);
      if (!valid) { setPinError(t("btErrIncorrectPin")); setPin(""); setSubmitting(false); return; }
      setPinVerified(true);
      const result = await submitWithdraw({
        amount: parsedAmount,
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
      });
      setResultData({ fee: result.fee, total_deducted: result.total_deducted, new_balance: result.new_balance });

      const bankShort = BANGLADESH_BANKS.find(b => b.name === bankName)?.short ?? bankName.slice(0, 4).toUpperCase();
      saveBank({ bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, short_code: bankShort });
      haptics.success();
      setDirection(1);
      setStep("success");
      import("@/lib/activityTracker").then(({ activityTracker }) =>
        activityTracker.transaction("bank_transfer_success", { amount: parseFloat(amount) || 0, bank: bankName })
      );
    } catch (e: any) {
      setPinError(e.message || t("btErrSubmitFailed"));
      setPin("");
      setPinVerified(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSlideConfirm = handlePinSubmit;

  const selectedBank = BANGLADESH_BANKS.find(b => b.name === bankName);

  return (
    <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-md sm:max-w-xl mx-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bank-transfer-title">

      {step !== "success" && (
        <motion.div className="gradient-send px-4 pt-3 pb-3 text-primary-foreground"
          initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={goBack}
              aria-label={t("btGoBack")}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 id="bank-transfer-title" className="text-xl font-extrabold tracking-tight">{t("flowBankTransfer")}</h1>
              <p className="text-xs text-white/70 mt-0.5">{t("btSubtitle")}</p>
            </div>
          </div>
          <div
            className="h-1.5 rounded-full bg-white/20 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-label={t("btStepXofY").replace("{current}", String(stepIndex + 1)).replace("{total}", String(STEPS.length))}
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

                  {/* Bank dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t("selectBank")}</label>
                    <Popover open={bankDropdownOpen} onOpenChange={setBankDropdownOpen}>
                      <PopoverTrigger asChild>
                        <button className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all text-left">
                          {selectedBank ? (
                            <>
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: selectedBank.color }}>
                                {selectedBank.short.slice(0, 2)}
                              </div>
                              <span className="flex-1 text-sm font-semibold text-foreground">{selectedBank.name}</span>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                <Landmark size={16} className="text-muted-foreground" />
                              </div>
                              <span className="flex-1 text-sm text-muted-foreground">{t("btChooseBank")}</span>
                            </>
                          )}
                          <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-72 overflow-hidden" align="start">
                        <div className="p-2 border-b border-border">
                          <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="text"
                              placeholder={t("btSearchBanks")}
                              value={bankSearch}
                              onChange={e => setBankSearch(e.target.value)}
                              className="w-full pl-8 pr-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="overflow-y-auto max-h-56">
                          {filteredBanks.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">{t("btNoBanksFound")}</p>
                          ) : (
                            filteredBanks.map(b => (
                              <button
                                key={b.id}
                                onClick={() => { setBankName(b.name); setBankDropdownOpen(false); setBankSearch(""); setError(""); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${bankName === b.name ? "bg-primary/10" : ""}`}
                              >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: b.color }}>
                                  {b.short.slice(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{b.short}</p>
                                </div>
                                {bankName === b.name && <CheckCircle2 size={14} className="text-primary shrink-0" />}
                              </button>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t("accountNumber")}</label>
                    <div className="relative">
                      <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type="text" inputMode="numeric" placeholder={t("btAcctPlaceholder")} value={accountNumber} onChange={e => { const digits = e.target.value.replace(/\D/g, "").slice(0, 17); setAccountNumber(digits); setError(""); }} className="pl-9 h-12 text-base bg-card border-border" />
                    </div>
                    {(() => {
                      const v = validateRecipient("bankAccount", accountNumber);
                      return v.errorMessage ? (
                        <p className="text-xs text-destructive flex items-center gap-1 animate-fade-in"><AlertCircle size={12} /> {v.errorMessage}</p>
                      ) : null;
                    })()}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">{t("accountHolderName")}</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input type="text" placeholder={t("btHolderPlaceholder")} value={accountHolder} onChange={e => { setAccountHolder(e.target.value); setError(""); }} className="pl-9 h-12 text-base bg-card border-border" />
                    </div>
                    {(() => {
                      const v = validateRecipient("accountHolder", accountHolder);
                      return v.errorMessage ? (
                        <p className="text-xs text-destructive flex items-center gap-1 animate-fade-in"><AlertCircle size={12} /> {v.errorMessage}</p>
                      ) : null;
                    })()}
                  </div>
                  {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
                  {bankName && validateRecipient("bankAccount", accountNumber).isValid && validateRecipient("accountHolder", accountHolder).isValid && (
                    <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold animate-fade-in" onClick={handleBankContinue}>{t("continue")}</Button>
                  )}
                </div>
              )}

              {step === "amount" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className="gradient-primary w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"><Landmark size={20} /></div>
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
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all active:scale-95 ${amount === String(q) ? "gradient-primary text-white border-transparent" : "bg-card border-border text-foreground hover:border-primary/50"}`}>
                        ৳{fmt(q)}
                      </button>
                    ))}
                  </div>
                  {parsedAmount > 0 && totalDeduction > getBalance() && (
                    <p className="text-center text-sm text-destructive font-medium">{t("btInsufficientBalance")}</p>
                  )}
                  {parsedAmount > 0 && totalDeduction <= getBalance() && parsedAmount > 50000 && (
                    <p className="text-center text-sm text-destructive font-medium">{t("btExceedsDailyLimit")}</p>
                  )}
                  {parsedAmount > 0 && totalDeduction <= getBalance() && parsedAmount <= 50000 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                      <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold"
                        onClick={handleAmountContinue}>
                        {t("continue")}
                      </Button>
                    </motion.div>
                  )}
                </div>
              )}

              {/* PIN step — final confirmation after summary */}
              {step === "pin" && (
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck size={32} className="text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-foreground">{t("btEnterYourPin")}</h2>
                    <p className="text-sm text-muted-foreground">{t("btConfirmWithdrawalOf").replace("{amount}", fmt(totalDeduction))}</p>
                  </div>
                  <div className="flex gap-3">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${pin.length > i ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                        {pin.length > i ? "•" : ""}
                      </div>
                    ))}
                  </div>
                  <div className="w-full max-w-[200px]">
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder={t("btEnter4DigitPin")}
                      value={pin}
                      onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); setPinError(""); }}
                      className="text-center text-lg tracking-[0.5em] h-12 bg-card border-border"
                      autoFocus
                    />
                  </div>
                  {pinError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{pinError}</p>}
                  <Button
                    className="w-full max-w-xs h-11 gradient-primary border-0 text-white font-semibold"
                    onClick={handlePinSubmit}
                    disabled={submitting || pin.length !== 4}
                  >
                    {submitting ? t("btProcessing") : t("btConfirmWithdrawal")}
                  </Button>
                </div>
              )}

              {/* Review/Summary step — right after amount entry */}
              {step === "confirm" && (
                <div className="space-y-6">
                  <div className="text-center space-y-1">
                    <p className="text-sm text-muted-foreground">Withdrawal Summary</p>
                    <p className="text-4xl font-extrabold text-foreground">৳{parsedAmount.toLocaleString()}</p>
                  </div>

                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <span className="text-sm text-muted-foreground">Transfer Amount</span>
                      <span className="text-sm font-bold text-foreground">৳{parsedAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-border">
                      <span className="text-sm text-muted-foreground">Service Charge (1%)</span>
                      <span className="text-sm font-bold text-destructive">−৳{fee.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                      <span className="text-xs text-muted-foreground/70">Fee source</span>
                      <span className="text-xs text-primary font-medium">From your balance</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted/50">
                      <span className="text-sm font-bold text-foreground">Total Deduction</span>
                      <span className="text-base font-extrabold text-foreground">৳{totalDeduction.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                    <div className="gradient-primary w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"><Landmark size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{bankName}</p>
                      <p className="text-xs text-muted-foreground">{accountNumber} · {accountHolder}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <AlertCircle size={12} className="inline mr-1" />
                      ৳{totalDeduction.toLocaleString()} will be deducted from your balance instantly. You'll receive ৳{parsedAmount.toLocaleString()} after admin approval. If rejected, the full ৳{totalDeduction.toLocaleString()} will be refunded.
                    </p>
                  </div>

                  <Button
                    className="w-full h-12 gradient-primary border-0 text-white font-semibold text-base rounded-xl"
                    onClick={handleConfirmContinue}
                  >
                    Confirm & Enter PIN
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => goTo("amount")}>Edit Amount</Button>
                </div>
              )}

              {step === "success" && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={36} className="text-emerald-600" />
                    </div>
                  </motion.div>
                  <h2 className="text-xl font-bold text-foreground">Withdrawal Submitted</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    ৳{resultData ? resultData.total_deducted.toLocaleString() : totalDeduction.toLocaleString()} has been deducted from your balance.
                  </p>
                  <div className="w-full max-w-xs rounded-2xl border border-border bg-card overflow-hidden text-left">
                    <div className="flex justify-between p-3 border-b border-border">
                      <span className="text-xs text-muted-foreground">You'll Receive</span>
                      <span className="text-sm font-bold text-foreground">৳{parsedAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-border">
                      <span className="text-xs text-muted-foreground">Charge (1%)</span>
                      <span className="text-sm font-bold text-destructive">৳{(resultData?.fee ?? fee).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 border-b border-border">
                      <span className="text-xs text-muted-foreground">Bank</span>
                      <span className="text-sm font-bold text-foreground">{bankName}</span>
                    </div>
                    <div className="flex justify-between p-3">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-[10px] gap-1"><Clock size={10} />Pending Approval</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    If rejected, ৳{resultData ? resultData.total_deducted.toLocaleString() : totalDeduction.toLocaleString()} will be refunded to your wallet instantly.
                  </p>
                  <Button className="mt-4 w-full max-w-xs" onClick={onClose}>Done</Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
      </div>

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

const BankTransferFlowGuarded = (props: BankTransferFlowProps) => (
  <FeatureGuard featureKey="bank_transfer" onClose={props.onClose}>
    <BankTransferFlow {...props} />
  </FeatureGuard>
);

export default BankTransferFlowGuarded;
