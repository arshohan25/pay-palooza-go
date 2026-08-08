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
  XCircle, Loader2, Lock, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { verifyPin } from "@/lib/verifyPin";


type Step = "amount" | "source" | "send_to" | "proof" | "pin" | "success";
const STEPS: Step[] = ["amount", "source", "send_to", "proof", "pin"];
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000];
const CHECKOUT_POPUP_STORAGE_PREFIX = "easypay_uddoktapay_checkout_";

type SourceId = "uddoktapay" | "bank_transfer" | "bkash" | "nagad" | "rocket" | "upay" | "card";
const SOURCE_OPTIONS: { id: SourceId; labelKey: string; icon: any; color: string; online?: boolean }[] = [
  { id: "uddoktapay", labelKey: "amSourceUddoktapay", icon: CreditCard, color: "bg-gradient-to-br from-indigo-500 to-purple-600", online: true },
  { id: "bank_transfer", labelKey: "amSourceBank", icon: Landmark, color: "bg-blue-500" },
  { id: "bkash", labelKey: "amSourceBkash", icon: Wallet, color: "bg-[#E2136E]" },
  { id: "nagad", labelKey: "amSourceNagad", icon: Wallet, color: "bg-[#F6921E]" },
  { id: "rocket", labelKey: "amSourceRocket", icon: Wallet, color: "bg-[#8B2F8B]" },
  { id: "upay", labelKey: "amSourceUpay", icon: Wallet, color: "bg-[#00A859]" },
  { id: "card", labelKey: "amSourceCard", icon: CreditCard, color: "bg-slate-600" },
];


// TxnID validation patterns per provider
const TXNID_PATTERNS: Record<string, { regex: RegExp; hintKey: string }> = {
  bkash: { regex: /^[A-Za-z0-9]{10}$/, hintKey: "amHintBkash" },
  nagad: { regex: /^\d{8,15}$/, hintKey: "amHintNagad" },
  rocket: { regex: /^R?\d{8,15}$/i, hintKey: "amHintRocket" },
};

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};


interface AddMoneyFlowProps { onClose: () => void; }

const AddMoneyFlow = ({ onClose }: AddMoneyFlowProps) => {
  const { t, lang } = useI18n();
  const dateLocale = lang === "bn" ? "bn-BD" : "en-GB";
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
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [popupState, setPopupState] = useState<"idle" | "preparing" | "open" | "closed" | "blocked">("idle");
  const popupRef = useRef<Window | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const popupFeatures = () => {
    const w = 480, h = 720;
    const dualLeft = window.screenLeft ?? window.screenX ?? 0;
    const dualTop = window.screenTop ?? window.screenY ?? 0;
    const width = window.innerWidth || document.documentElement.clientWidth || screen.width;
    const height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    const left = Math.max(0, dualLeft + (width - w) / 2);
    const top = Math.max(0, dualTop + (height - h) / 2);
    return `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
  };

  const watchPopup = (popup: Window) => {
    popupRef.current = popup;
    popup.focus?.();
    if (popupTimerRef.current) clearInterval(popupTimerRef.current);
    popupTimerRef.current = setInterval(() => {
      if (popup.closed) {
        if (popupTimerRef.current) clearInterval(popupTimerRef.current);
        popupTimerRef.current = null;
        popupRef.current = null;
        setPopupState("closed");
      }
    }, 500);
  };

  const openCheckoutShell = (token: string) => {
    const popupUrl = `${window.location.origin}/payment-popup?token=${encodeURIComponent(token)}`;
    const popup = window.open(popupUrl, "easypay_uddoktapay_checkout", popupFeatures());
    if (!popup || popup.closed) {
      setPopupState("blocked");
      toast.error("Popup blocked. Please allow popups for EasyPay and try again.");
      return false;
    }
    watchPopup(popup);
    setPopupState("preparing");
    return true;
  };

  const deliverCheckoutToPopup = (token: string, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error("Checkout URL must be secure");
    } catch {
      toast.error("Invalid checkout link. Please try again.");
      return false;
    }

    const payload = {
      url: parsed.toString(),
      amount: parseFloat(amount || "0"),
      provider: "UddoktaPay",
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    localStorage.setItem(`${CHECKOUT_POPUP_STORAGE_PREFIX}${token}`, JSON.stringify(payload));
    try {
      popupRef.current?.postMessage({ type: "EASYPAY_CHECKOUT_READY", token, payload }, window.location.origin);
    } catch {
      // The storage payload above is the reliable fallback for mobile/PWA popup bridges.
    }
    setPopupState("open");
    return true;
  };

  const openCheckoutPopup = (url: string) => {
    const token = crypto.randomUUID();
    if (!openCheckoutShell(token)) return false;
    return deliverCheckoutToPopup(token, url);
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { status?: string; requestId?: string } | undefined;
      if (!detail) return;
      if (popupTimerRef.current) clearInterval(popupTimerRef.current);
      popupTimerRef.current = null;
      popupRef.current = null;
      setSubmitting(false);
      setCheckoutUrl(null);
      if (detail.requestId) setSubmittedRequestId(detail.requestId);
      if (detail.status === "success") {
        haptics.success();
      } else {
        haptics.error();
      }
    };
    window.addEventListener("easypay:addmoney-return", handler);
    return () => window.removeEventListener("easypay:addmoney-return", handler);
  }, []);

  useEffect(() => () => {
    if (popupTimerRef.current) clearInterval(popupTimerRef.current);
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
  }, []);

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
    if (!amount || isNaN(val) || val <= 0) { setError(t("amEnterValidAmount")); return; }
    if (val < 10) { setError(t("amMin")); return; }
    if (val > 100000) { setError(t("amMax")); return; }
    goTo("source");
  };

  const handleSourceContinue = async () => {
    if (!source) { setError(t("amSelectSource")); return; }
    if (source === "uddoktapay") {
      const popupToken = crypto.randomUUID();
      const popupOpened = openCheckoutShell(popupToken);
      setSubmitting(true);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("uddoktapay-addmoney-init", {
          body: { amount: parseFloat(amount), return_origin: window.location.origin },
        });
        if (fnErr) throw fnErr;
        if (!data?.payment_url) throw new Error(data?.error || "Failed to start checkout");
        if (data?.request_id) {
          setSubmittedRequestId(data.request_id as string);
          localStorage.setItem("pending_uddoktapay_addmoney_request", data.request_id as string);
        }
        setCheckoutUrl(data.payment_url as string);
        if (popupOpened) deliverCheckoutToPopup(popupToken, data.payment_url as string);
        setSubmitting(false);
      } catch (e: any) {
        if (popupOpened && popupRef.current && !popupRef.current.closed) popupRef.current.close();
        setError(e.message || "Failed to start UddoktaPay checkout");
        setSubmitting(false);
      }
      return;
    }
    goTo("send_to");
  };


  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    haptics.light();
    toast.success(t("amCopied"));
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError(t("amFileTooLarge")); return; }
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
      setTxnIdWarning(t(pattern.hintKey as any));
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
          const date = new Date(data[0].created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" });
          setDuplicateTxnWarning(t("amDuplicateInfo").replace("{date}", date).replace("{status}", data[0].status));
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
    if (!txnId.trim() && !proofFile) { setError(t("amProvideProof")); return; }
    if (duplicateTxnWarning) { setError(t("amDuplicateBlock")); return; }
    setPin("");
    setPinError("");
    goTo("pin");
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) { setPinError(t("amEnterPin")); return; }
    setSubmitting(true);
    setPinError("");
    try {
      const valid = await verifyPin(pin);
      if (!valid) { setPinError(t("amIncorrectPin")); setPin(""); setSubmitting(false); return; }
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
      setPinError(e.message || t("amSubmitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // Real-time status tracking on success screen
  useEffect(() => {
    if (step !== "success" || !submittedRequestId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      channel = supabase
        .channel(`fund-request-${user.id}-${submittedRequestId}`)
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
              toast.success(t("amApprovedToast"));
            } else if (newStatus === "rejected") {
              haptics.error();
              toast.error(t("amRejectedToast"));
            }
          }
        }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [step, submittedRequestId]);

  const trackingSteps = [
    { key: "pending", label: t("amSubmitted"), icon: Clock },
    { key: "review", label: t("amUnderReview"), icon: Loader2 },
    { key: "approved", label: t("amApproved"), icon: CheckCircle2 },
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
                aria-label={t("amGoBack")}
                className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 id="add-money-title" className="text-xl font-extrabold tracking-tight">{t("amTitle")}</h1>
                <p className="text-xs text-white/70 mt-0.5">{t("amSubtitle")}</p>
              </div>
            </div>
            <div
              className="h-1.5 rounded-full bg-white/20 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-valuenow={stepIndex + 1}
              aria-label={t("amStepOf").replace("{n}", String(stepIndex + 1)).replace("{total}", String(STEPS.length))}
            >
              <motion.div className="h-full bg-white rounded-full"
                animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
            </div>
          </motion.div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-none relative">
          {checkoutUrl && (
            <div className="absolute inset-0 z-40 bg-background flex flex-col">
              <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-8 flex flex-col items-center justify-center text-center">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="w-20 h-20 rounded-3xl gradient-addmoney flex items-center justify-center shadow-glow mb-5"
                >
                  <Lock size={32} className="text-primary-foreground" strokeWidth={2.5} />
                </motion.div>

                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  {"Secure checkout ready"}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                  {"UddoktaPay will open in a secure EasyPay popup and return you to Home with the payment status."}
                </p>

                <div className="mt-6 w-full max-w-xs rounded-2xl bg-card border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{"Amount"}</span>
                    <span className="text-lg font-extrabold text-foreground">৳{parseFloat(amount || "0").toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">{"Provider"}</span>
                    <span className="text-xs font-semibold text-foreground">UddoktaPay</span>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <ShieldCheck size={14} className="text-primary shrink-0" />
                    <span className="text-[11px] text-muted-foreground leading-snug text-left">
                      {"256-bit encrypted. EasyPay never sees your card or PIN."}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    if (popupRef.current && !popupRef.current.closed) {
                      popupRef.current.focus();
                      return;
                    }
                    openCheckoutPopup(checkoutUrl);
                  }}
                  className="mt-6 w-full max-w-xs h-12 rounded-2xl gradient-addmoney text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-glow active:scale-[0.98] transition-transform"
                >
                  {popupState === "preparing" ? (
                    <><Loader2 size={16} className="animate-spin" /> Preparing checkout…</>
                  ) : popupState === "open" ? (
                    <><Loader2 size={16} className="animate-spin" /> Waiting for payment…</>
                  ) : popupState === "closed" ? (
                    <>Reopen checkout <ExternalLink size={16} /></>
                  ) : popupState === "blocked" ? (
                    <>Try opening popup again <ExternalLink size={16} /></>
                  ) : (
                    <>Open secure checkout <ExternalLink size={16} /></>
                  )}
                </button>

                {popupState === "open" && (
                  <p className="mt-3 text-[11px] text-muted-foreground max-w-xs">
                    Complete payment in the popup window. This screen will update automatically.
                  </p>
                )}
                {popupState === "closed" && (
                  <p className="mt-3 text-[11px] text-primary max-w-xs">
                    Popup closed. If you completed payment, your balance will update shortly.
                  </p>
                )}
                {popupState === "blocked" && (
                  <p className="mt-3 text-[11px] text-destructive max-w-xs">
                    EasyPay could not open the payment popup. Allow popups for this app, then try again.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
                    if (popupTimerRef.current) clearInterval(popupTimerRef.current);
                    popupTimerRef.current = null;
                    popupRef.current = null;
                    setPopupState("idle");
                    setCheckoutUrl(null);
                    setSubmitting(false);
                  }}
                  className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground py-2"
                >
                  {popupState === "open" ? "Cancel payment" : "Close"}
                </button>

              </div>
            </div>
          )}
            <AnimatePresence custom={direction} mode="wait">
              <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit"
                transition={{ type: "spring", stiffness: 320, damping: 32 }} className="px-4 pt-6 pb-32">

                {step === "amount" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">{t("amEnterAmount")}</label>
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
                      <p className="text-center text-sm text-destructive font-medium">{t("amExceedsDaily")}</p>
                    )}
                    {parseFloat(amount) > 0 && parseFloat(amount) <= 100000 && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                        <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold" onClick={handleAmountContinue}>{t("amContinue")}</Button>
                      </motion.div>
                    )}
                  </div>
                )}

                {step === "source" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">{t("amHowSent")}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {SOURCE_OPTIONS.map(s => {
                          const Icon = s.icon;
                          return (
                            <button key={s.id} onClick={() => { setSource(s.id); setError(""); }}
                              className={`p-3 rounded-xl border text-left transition-all active:scale-95 ${source === s.id ? "border-primary bg-primary/10 shadow-card" : "border-border bg-card hover:border-primary/50"}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg ${s.color} flex items-center justify-center text-white shrink-0`}><Icon size={16} /></div>
                                <span className="text-xs font-semibold text-foreground">{t(s.labelKey as any)}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
                    </div>
                    <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold" onClick={handleSourceContinue} disabled={submitting}>
                      {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                      {source === "uddoktapay" ? t("amPayNowUddoktapay") : t("amContinue")}
                    </Button>

                  </div>
                )}

                {step === "send_to" && (
                  <div className="space-y-6">
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("amAmountLabel")}</span><span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("amSourceLabel")}</span><span className="font-medium text-foreground">{(() => { const o = SOURCE_OPTIONS.find(x => x.id === source); return o ? t(o.labelKey as any) : source; })()}</span></div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">{t("amSendToAccount")}</label>
                      {depositLoading ? (
                        <p className="text-sm text-muted-foreground">{t("amLoadingAccounts")}</p>
                      ) : depositAccounts.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card p-4 text-center">
                          <p className="text-sm text-muted-foreground">{t("amNoDepositAccount")}</p>
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
                              {acc.bank_name && <p className="text-xs text-muted-foreground">{t("amBankLabel")}: {acc.bank_name}</p>}
                              {acc.instructions && <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">{acc.instructions}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold" onClick={() => goTo("proof")}>
                      {t("amISentMoney")}
                    </Button>
                  </div>
                )}

                {step === "proof" && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
                      <ShieldAlert size={20} className="text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-destructive">{t("amWarningTitle")}</p>
                        <p className="text-xs text-destructive/90 leading-relaxed">
                          {t("amWarningBody")}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("amAmountLabel")}</span><span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("amSourceLabel")}</span><span className="font-medium text-foreground">{(() => { const o = SOURCE_OPTIONS.find(x => x.id === source); return o ? t(o.labelKey as any) : source; })()}</span></div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">{t("amTxnIdLabel")}</label>
                      <Input type="text" placeholder={t("amTxnIdPlaceholder")} value={txnId}
                        onChange={(e) => { setTxnId(e.target.value); setError(""); validateTxnId(e.target.value); checkDuplicateTxnId(e.target.value); }}
                        className="h-12 bg-card border-border" />
                      {checkingDuplicate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" />{t("amCheckingDuplicate")}
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
                          <CheckCircle2 size={12} />{t("amFormatOk")}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground">{t("amUploadReceipt")}</label>
                      <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-dashed border-border bg-card hover:border-primary/50 cursor-pointer transition-colors">
                        {proofPreview ? (
                          <img src={proofPreview} alt="Proof" className="w-full max-h-48 object-contain rounded-lg" />
                        ) : (
                          <>
                            <Upload size={24} className="text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{t("amTapToUpload")}</span>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </label>
                    </div>

                    {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

                    <Button className="w-full h-11 gradient-primary border-0 text-white font-semibold"
                      onClick={handleProofContinue}>
                      {t("amContinue")}
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
                      <h2 className="text-xl font-bold text-foreground">{t("amConfirmPin")}</h2>
                      <p className="text-sm text-muted-foreground">{t("amEnter4Pin")}</p>
                    </div>
                    <div className="relative flex justify-center gap-3 py-3 cursor-text" onClick={() => pinRef.current?.focus()}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`w-4 h-4 rounded-full transition-all ${i < pin.length ? "bg-emerald-500 scale-110" : "bg-border"}`} />
                      ))}
                      <Input
                        ref={pinRef}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        autoFocus
                        value={pin}
                        onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); setPinError(""); }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                      />
                    </div>
                    {pinError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{pinError}</p>}
                    <Button
                      className="w-full max-w-xs h-11 gradient-primary border-0 text-white font-semibold"
                      onClick={handlePinSubmit}
                      disabled={submitting || pin.length !== 4}
                    >
                      {submitting ? t("amVerifying") : t("amConfirmSubmit")}
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
                      {trackingStatus === "approved" ? t("amStatusApprovedTitle") :
                       trackingStatus === "rejected" ? t("amStatusRejectedTitle") :
                       t("amStatusSubmittedTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {trackingStatus === "approved" ? (
                        <>{t("amApprovedBody").replace("{amt}", `৳${parseFloat(amount).toLocaleString()}`)}</>
                      ) : trackingStatus === "rejected" ? (
                        <>{t("amRejectedBody").replace("{amt}", `৳${parseFloat(amount).toLocaleString()}`)}</>
                      ) : (
                        <>{t("amPendingBodyPrefix")} <span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span> {t("amPendingBodySuffix")}</>
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
                        {t("amProcessingHint")}
                      </p>
                    )}

                    <Button className="mt-4 w-full max-w-xs" onClick={onClose}>{t("amDone")}</Button>
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
