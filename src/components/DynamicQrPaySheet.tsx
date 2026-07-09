import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Store, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { playPaymentSuccess, playPaymentError } from "@/lib/sounds";
import { useI18n } from "@/lib/i18n";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

interface DynamicQrPaySheetProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  merchantId?: string;
  amount?: number;
  ref_?: string | null;
}

type Step = "loading" | "confirm" | "pin" | "processing" | "success" | "error";

const DynamicQrPaySheet = ({ open, onClose, sessionId, merchantId, amount: qrAmount, ref_ }: DynamicQrPaySheetProps) => {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("loading");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState(qrAmount || 0);
  const [reference, setReference] = useState(ref_ || "");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Load session details
  useEffect(() => {
    if (!open || !sessionId) return;
    setStep("loading");
    setPin("");
    setErrorMsg("");

    // Also reset pin whenever step changes away from pin
    return () => { setPin(""); };

    (async () => {
      const { data: session, error } = await supabase
        .from("merchant_payment_sessions")
        .select("id, amount, reference, description, status, expires_at, merchant_id")
        .eq("id", sessionId)
        .single();

      if (error || !session) { setErrorMsg(t("dqSessionNotFound")); setStep("error"); return; }
      if (session.status !== "pending") { setErrorMsg(`${t("dqSessionAlready")} ${session.status}`); setStep("error"); return; }
      if (new Date(session.expires_at) < new Date()) { setErrorMsg(t("dqSessionExpired")); setStep("error"); return; }

      setAmount(session.amount);
      setReference(session.reference || "");

      const { data: merchRows } = await supabase.rpc("get_merchant_display_name", { p_merchant_id: session.merchant_id });
      const merch = Array.isArray(merchRows) ? merchRows[0] : null;
      if (merch?.business_name) setMerchantName(merch.business_name);

      setStep("confirm");
    })();
  }, [open, sessionId]);

  // Pay with PIN
  const handlePay = useCallback(async () => {
    if (pin.length < 4) return;
    setStep("processing");
    haptics.medium();

    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.access_token) throw new Error(t("dqNotAuthenticated"));

      const { data, error } = await supabase.functions.invoke("checkout-pay", {
        body: { session_id: sessionId, pin, source: "qr" },
      });

      if (error) throw new Error(error.message || t("dqPaymentFailed"));
      if (data?.error) throw new Error(data.error);

      setStep("success");
      fireSuccessConfetti();
      haptics.success();
      playPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || t("dqPaymentFailed"));
      setStep("error");
      haptics.error();
      playPaymentError();
    }
  }, [pin, sessionId]);

  // Auto-submit PIN
  useEffect(() => {
    if (pin.length === 4 && step === "pin") handlePay();
  }, [pin, step, handlePay]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-card rounded-t-3xl overflow-hidden"
        >
          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto mt-3 mb-2" />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <h3 className="text-base font-bold text-foreground">{t("dqPayWithEasyPay")}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="px-5 pb-6">
            <AnimatePresence mode="wait">
              {/* Loading */}
              {step === "loading" && (
                <motion.div key="loading" className="py-12 flex justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full" />
                </motion.div>
              )}

              {/* Confirm */}
              {step === "confirm" && (
                <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/50">
                    <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                      <Store className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">{merchantName || t("dqMerchant")}</p>
                      {reference && <p className="text-xs text-muted-foreground">{t("dqRef")} {reference}</p>}
                    </div>
                  </div>

                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">{t("dqAmountToPay")}</p>
                    <p className="text-4xl font-extrabold text-foreground">৳{fmt(amount)}</p>
                  </div>

                  <Button
                    className="w-full h-13 rounded-2xl font-bold text-base gradient-primary text-primary-foreground"
                    onClick={() => { setStep("pin"); setTimeout(() => inputRef.current?.focus(), 100); }}
                  >
                    {t("dqConfirmPay")}
                  </Button>
                </motion.div>
              )}

              {/* PIN */}
              {step === "pin" && (
                <motion.div key="pin" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-5 py-4">
                  <div className="text-center space-y-1">
                    <Lock className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">Enter your PIN</p>
                    <p className="text-xs text-muted-foreground">to pay ৳{fmt(amount)} to {merchantName}</p>
                  </div>

                  {/* PIN dots */}
                  <div className="flex gap-4 justify-center cursor-text" onClick={() => inputRef.current?.focus()}>
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                          i < pin.length
                            ? "bg-primary/15 border-2 border-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.4)]"
                            : i === pin.length
                              ? "bg-muted/80 border-2 border-primary/50"
                              : "bg-muted/50 border-2 border-border/60"
                        }`}
                        animate={i < pin.length ? { scale: [0.8, 1.1, 1] } : {}}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      >
                        {i < pin.length ? (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3.5 h-3.5 rounded-full bg-primary" />
                        ) : i === pin.length ? (
                          <motion.div className="w-0.5 h-6 bg-primary/60 rounded-full" animate={{ opacity: [1, 0.2] }} transition={{ duration: 0.7, repeat: Infinity }} />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-border/40" />
                        )}
                      </motion.div>
                    ))}
                  </div>

                  <input
                    ref={inputRef}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length > pin.length) haptics.light();
                      setPin(v);
                    }}
                    className="sr-only"
                    autoFocus
                  />

                  {errorMsg && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/20">
                      <AlertCircle size={14} className="text-destructive shrink-0" />
                      <p className="text-xs text-destructive">{errorMsg}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Processing */}
              {step === "processing" && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} className="absolute inset-0 rounded-full border-2 border-primary/30" animate={{ scale: [1, 2], opacity: [0.5, 0] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4 }} />
                    ))}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center">
                        <Lock size={18} className="text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Processing payment…</p>
                </motion.div>
              )}

              {/* Success */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center space-y-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                    <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-foreground">Payment Successful!</h3>
                  <p className="text-sm text-muted-foreground">৳{fmt(amount)} paid to {merchantName}</p>
                  <Button variant="outline" className="mt-4 rounded-2xl" onClick={onClose}>Done</Button>
                </motion.div>
              )}

              {/* Error */}
              {step === "error" && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 text-center space-y-4">
                  <AlertCircle className="w-14 h-14 text-destructive/60 mx-auto" />
                  <h3 className="text-lg font-bold text-foreground">Payment Failed</h3>
                  <p className="text-sm text-muted-foreground">{errorMsg}</p>
                  <Button variant="outline" className="rounded-2xl" onClick={onClose}>Close</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DynamicQrPaySheet;
