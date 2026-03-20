import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Store, CheckCircle2, XCircle, QrCode, Wallet, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { playPaymentSuccess, playPaymentError } from "@/lib/sounds";
import { verifyPin } from "@/lib/verifyPin";
import QRCode from "qrcode";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

type Step = "loading" | "ready" | "phone" | "otp" | "pin" | "processing" | "success" | "error" | "not_found";

interface MerchantInfo {
  id: string;
  business_name: string;
  category: string;
  phone: string;
  user_id: string;
}

/* ─── PIN Input ──────────────────────────────────────────────── */
const PinInput = ({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4 cursor-text" onClick={() => inputRef.current?.focus()}>
        {Array.from({ length }).map((_, i) => {
          const isFilled = i < value.length;
          const isActive = i === value.length;
          return (
            <motion.div
              key={i}
              className={`w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm transition-all duration-300
                ${isFilled ? "bg-primary/15 border-2 border-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]"
                  : isActive ? "bg-muted/80 border-2 border-primary/50" : "bg-muted/50 border-2 border-border/60"}`}
              animate={isFilled ? { scale: [0.75, 1.1, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 18 }}
            >
              {isFilled ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="w-3.5 h-3.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
              ) : isActive ? (
                <motion.div className="w-0.5 h-6 bg-primary/60 rounded-full" animate={{ opacity: [1, 0.2] }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut" }} />
              ) : <div className="w-3 h-3 rounded-full bg-border/40" />}
            </motion.div>
          );
        })}
      </div>
      <input ref={inputRef} type="password" inputMode="numeric" maxLength={length} value={value}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, length); if (v.length > value.length) haptics.light(); onChange(v); }}
        className="sr-only" autoFocus />
    </div>
  );
};

/* ─── OTP Input ──────────────────────────────────────────────── */
const OtpInput = ({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2 cursor-text" onClick={() => inputRef.current?.focus()}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i];
          const isActive = i === value.length;
          const isFilled = !!char;
          return (
            <motion.div key={i}
              className={`w-12 h-14 rounded-2xl flex items-center justify-center text-xl font-black backdrop-blur-sm transition-all duration-300
                ${isFilled ? "bg-primary/15 border-2 border-primary text-foreground" : isActive ? "bg-muted/80 border-2 border-primary/60" : "bg-muted/50 border-2 border-border/60"}`}
              animate={isFilled ? { scale: [0.8, 1.08, 1] } : {}}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              {char ? <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}>{char}</motion.span>
                : isActive ? <motion.div className="w-0.5 h-6 bg-primary rounded-full" animate={{ opacity: [1, 0.2] }} transition={{ duration: 0.7, repeat: Infinity }} />
                : null}
            </motion.div>
          );
        })}
      </div>
      <input ref={inputRef} type="text" inputMode="numeric" maxLength={length} value={value}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, length); if (v.length > value.length) haptics.light(); onChange(v); }}
        className="sr-only" autoComplete="one-time-code" autoFocus />
    </div>
  );
};

const PayPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const merchantCode = params.get("merchant") || "";
  const refParam = params.get("ref") || "";
  const noteParam = params.get("note") || "";
  const amountParam = parseFloat(params.get("amount") || "0");
  const description = [refParam, noteParam].filter(Boolean).join(" — ");

  const [step, setStep] = useState<Step>("loading");
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Resolve merchant
  useEffect(() => {
    if (!merchantCode) { setStep("not_found"); return; }
    (async () => {
      const { data } = await supabase.rpc("resolve_transfer_recipient", {
        p_identifier: merchantCode,
        p_flow: "payment",
      });
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.recipient_phone) { setStep("not_found"); return; }

      // Get merchant details
      const { data: merch } = await supabase
        .from("merchants")
        .select("id, business_name, category, phone, user_id")
        .eq("merchant_code", merchantCode)
        .eq("status", "active")
        .maybeSingle();

      if (merch) {
        setMerchant(merch);
      } else {
        // Fallback: use resolved info
        setMerchant({
          id: "",
          business_name: result.recipient_name || merchantCode,
          category: "",
          phone: result.recipient_phone,
          user_id: "",
        });
      }
      setStep("ready");
    })();
  }, [merchantCode]);

  // Generate QR for authenticated users
  useEffect(() => {
    if (!merchant || !showQr) return;
    const payload = JSON.stringify({
      type: "easypay_pay",
      merchant: merchantCode,
      amount: amountParam,
      ref: refParam || null,
      note: noteParam || null,
    });
    QRCode.toDataURL(payload, { width: 280, margin: 2, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQrDataUrl);
  }, [merchant, showQr, merchantCode, amountParam, refParam, noteParam]);

  // Guest Pay: Send OTP
  const handleSendOtp = useCallback(async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg("Enter a valid 11-digit number");
      haptics.error();
      return;
    }
    setErrorMsg("");
    setStep("processing");
    haptics.medium();
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, purpose: "payment" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send OTP");
      if (result.dev_otp) setDevOtp(result.dev_otp);
      setStep("otp");
      haptics.success();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send OTP");
      setStep("phone");
      haptics.error();
    }
  }, [phone]);

  // Auto-advance OTP → PIN
  useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      haptics.medium();
      setErrorMsg("");
      setPin("");
      setStep("pin");
    }
  }, [otp, step]);

  // Auto-submit PIN
  useEffect(() => {
    if (pin.length === 4 && step === "pin") handleGuestPay();
  }, [pin, step]);

  // Guest Pay: Verify OTP + PIN
  const handleGuestPay = useCallback(async () => {
    if (otp.length < 6 || pin.length < 4 || !merchant) return;
    setErrorMsg("");
    setStep("processing");
    haptics.medium();
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/checkout-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: cleanPhone,
          otp_code: otp,
          pin,
          recipient_phone: merchant.phone,
          amount: amountParam,
          description: description || `Payment to ${merchant.business_name}`,
          reference: refParam || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Payment failed");
      setStep("success");
      fireSuccessConfetti();
      haptics.success();
      playPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Payment failed");
      setPin("");
      if (err.message?.toLowerCase().includes("pin")) setStep("pin");
      else { setStep("error"); }
      haptics.error();
      playPaymentError();
    }
  }, [otp, pin, phone, merchant, amountParam, description, refParam]);

  // Authenticated wallet pay
  const handleWalletPay = useCallback(async () => {
    if (pin.length < 4 || !merchant || !user) return;
    setErrorMsg("");
    setStep("processing");
    haptics.medium();
    try {
      const verified = await verifyPin(pin, user.email || "");
      if (!verified) throw new Error("Incorrect PIN");

      const { data, error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: merchant.phone,
        p_amount: amountParam,
        p_fee: 0,
        p_type: "payment" as any,
        p_description: description || `Payment to ${merchant.business_name}`,
        p_reference: refParam || null,
        p_recipient_name: merchant.business_name,
        p_recipient_type: "receive" as any,
      });
      if (error) throw new Error(error.message);
      setStep("success");
      fireSuccessConfetti();
      haptics.success();
      playPaymentSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Payment failed");
      setPin("");
      if (err.message?.toLowerCase().includes("pin")) setStep("pin");
      else setStep("error");
      haptics.error();
      playPaymentError();
    }
  }, [pin, merchant, user, amountParam, description, refParam]);

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full" />
      </div>
    );
  }

  if (step === "not_found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Merchant Not Found</h2>
          <p className="text-sm text-muted-foreground">The merchant code "{merchantCode}" could not be resolved.</p>
          <Button variant="outline" onClick={() => navigate("/")} className="mt-4">Go Home</Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-card rounded-3xl shadow-xl border border-border overflow-hidden">

        {/* Merchant Header */}
        <div className="bg-gradient-to-br from-primary/8 via-card to-accent/5 px-6 pt-6 pb-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/12 flex items-center justify-center mx-auto mb-3">
            <Store className="w-7 h-7 text-primary" />
          </div>
          {merchant && <h1 className="text-lg font-bold text-foreground">{merchant.business_name}</h1>}
          {merchant?.category && <p className="text-xs text-muted-foreground capitalize mt-0.5">{merchant.category.replace(/_/g, " ")}</p>}
          {amountParam > 0 && (
            <p className="text-3xl font-extrabold text-foreground mt-2">
              ৳{fmt(amountParam)} <span className="text-sm font-medium text-muted-foreground">BDT</span>
            </p>
          )}
          {refParam && <p className="text-xs text-muted-foreground mt-1">Ref: {refParam}</p>}
          {noteParam && <p className="text-xs text-muted-foreground">Note: {noteParam}</p>}
        </div>

        <AnimatePresence mode="wait">
          {/* ─── Ready: Choose payment method ─── */}
          {step === "ready" && (
            <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-3">
              <button onClick={() => { setStep("phone"); setPhone(""); setOtp(""); setPin(""); setErrorMsg(""); }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border/60 hover:bg-muted transition-colors active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Pay with Phone & PIN</p>
                  <p className="text-[11px] text-muted-foreground">No login required</p>
                </div>
              </button>

              {isAuthenticated && (
                <button onClick={() => setShowQr(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border/60 hover:bg-muted transition-colors active:scale-[0.98]">
                  <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Show Dynamic QR</p>
                    <p className="text-[11px] text-muted-foreground">Scan with EasyPay app</p>
                  </div>
                </button>
              )}

              {isAuthenticated && (
                <button onClick={() => { setStep("pin"); setPin(""); setErrorMsg(""); }}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-primary/8 border border-primary/20 hover:bg-primary/12 transition-colors active:scale-[0.98]">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Pay from Wallet</p>
                    <p className="text-[11px] text-muted-foreground">Quick pay with PIN</p>
                  </div>
                </button>
              )}
            </motion.div>
          )}

          {/* ─── Phone step ─── */}
          {step === "phone" && (
            <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Enter your phone number</p>
                <p className="text-xs text-muted-foreground mt-1">We'll send a verification code</p>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">+880</span>
                <input type="tel" inputMode="numeric" maxLength={11} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="01XXXXXXXXX"
                  className="w-full pl-16 pr-4 py-3.5 rounded-2xl bg-muted/50 border border-border/60 text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  autoFocus />
              </div>
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <Button onClick={handleSendOtp} disabled={phone.length < 11} className="w-full rounded-2xl h-12 font-semibold">
                Send OTP
              </Button>
              <button onClick={() => { setStep("ready"); setErrorMsg(""); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">← Back</button>
            </motion.div>
          )}

          {/* ─── OTP step ─── */}
          {step === "otp" && (
            <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 space-y-5">
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Enter verification code</p>
                <p className="text-xs text-muted-foreground mt-1">Sent to +880{phone}</p>
              </div>
              <OtpInput value={otp} onChange={setOtp} />
              {devOtp && <p className="text-xs text-center text-muted-foreground/60">Dev OTP: {devOtp}</p>}
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <button onClick={() => { setStep("phone"); setOtp(""); setErrorMsg(""); }} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">← Change number</button>
            </motion.div>
          )}

          {/* ─── PIN step ─── */}
          {step === "pin" && (
            <motion.div key="pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 space-y-5">
              <div className="text-center">
                <Lock className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Enter your PIN</p>
                <p className="text-xs text-muted-foreground mt-1">4-digit security PIN</p>
              </div>
              <PinInput value={pin} onChange={(v) => { setPin(v); if (v.length === 4) { isAuthenticated ? handleWalletPay() : handleGuestPay(); } }} />
              {errorMsg && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
              <button onClick={() => { setStep(isAuthenticated && !otp ? "ready" : "otp"); setPin(""); setErrorMsg(""); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1">← Back</button>
            </motion.div>
          )}

          {/* ─── Processing ─── */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 flex flex-col items-center gap-4">
              <div className="relative w-16 h-16">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="absolute inset-0 rounded-full border-2 border-primary/30"
                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }} />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                    animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <Lock size={14} className="text-primary-foreground" />
                  </motion.div>
                </div>
              </div>
              <p className="text-sm font-medium text-muted-foreground">Processing payment…</p>
            </motion.div>
          )}

          {/* ─── Success ─── */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-8 text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}>
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
              </motion.div>
              <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
              <p className="text-sm text-muted-foreground">৳{fmt(amountParam)} paid to {merchant?.business_name}</p>
              <Button variant="outline" onClick={() => navigate("/")} className="mt-2 rounded-2xl">Go Home</Button>
            </motion.div>
          )}

          {/* ─── Error ─── */}
          {step === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 text-center space-y-4">
              <XCircle className="w-14 h-14 text-destructive/60 mx-auto" />
              <h2 className="text-lg font-bold text-foreground">Payment Failed</h2>
              <p className="text-sm text-muted-foreground">{errorMsg || "Something went wrong"}</p>
              <Button variant="outline" onClick={() => { setStep("ready"); setPin(""); setOtp(""); setErrorMsg(""); }} className="rounded-2xl">Try Again</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Overlay */}
        {showQr && qrDataUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-6 border-t border-border/50 space-y-4">
            <div className="bg-white rounded-2xl p-4 mx-auto w-fit shadow-sm">
              <img src={qrDataUrl} alt="Payment QR" className="w-56 h-56" />
            </div>
            <p className="text-center text-xs text-muted-foreground">Scan with <span className="font-semibold text-foreground">EasyPay</span> app</p>
            <Button variant="ghost" size="sm" onClick={() => setShowQr(false)} className="w-full text-xs">Close QR</Button>
          </motion.div>
        )}

        <div className="px-6 pb-5 pt-2 text-center">
          <p className="text-[10px] text-muted-foreground/60">Powered by EasyPay</p>
        </div>
      </motion.div>
    </div>
  );
};

export default PayPage;
