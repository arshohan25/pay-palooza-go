import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Phone, Shield, Lock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { isWeakPin } from "@/lib/pinValidation";

interface GuestCheckoutFlowProps {
  merchantCode: string;
  amount: string;
  note: string;
  reference: string;
  onClose: () => void;
}

type Step = "phone" | "otp" | "pin" | "processing" | "success" | "error";

const GuestCheckoutFlow = ({ merchantCode, amount, note, reference, onClose }: GuestCheckoutFlowProps) => {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [result, setResult] = useState<{ merchant_name?: string; amount?: number; payer_name?: string }>({});
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // Auto-focus PIN input
  useEffect(() => {
    if (step === "pin") pinInputRef.current?.focus();
  }, [step]);

  const cleanPhone = phone.replace(/\D/g, "").replace(/^88/, "");

  const handleSendOtp = async () => {
    setError("");
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setError("Enter a valid 11-digit phone number");
      return;
    }
    setSending(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanPhone, purpose: "payment" },
      });
      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        setSending(false);
        return;
      }
      if (data?.dev_otp) setDevOtp(data.dev_otp);
      setResendTimer(60);
      setStep("otp");
    } catch {
      setError("Failed to send OTP. Try again.");
    }
    setSending(false);
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP");
      return;
    }
    setError("");
    setStep("pin");
  };

  const handleResendOtp = async () => {
    setOtp("");
    setDevOtp("");
    setError("");
    setSending(true);
    try {
      const { data } = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanPhone, purpose: "payment" },
      });
      if (data?.dev_otp) setDevOtp(data.dev_otp);
      setResendTimer(60);
    } catch {
      setError("Failed to resend OTP");
    }
    setSending(false);
  };

  const handlePay = async () => {
    if (pin.length !== 4) { setError("Enter your 4-digit PIN"); return; }
    if (isWeakPin(pin)) { setError("PIN is too weak"); return; }
    setError("");
    setStep("processing");

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("checkout-guest", {
        body: {
          merchant_code: merchantCode,
          amount: parseFloat(amount),
          phone: cleanPhone,
          otp_code: otp,
          pin,
          note,
          ref: reference,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        setStep("error");
        return;
      }
      setResult(data);
      setStep("success");
    } catch {
      setError("Payment failed. Please try again.");
      setStep("error");
    }
  };

  // ── Summary card (reused across steps) ────────────────────
  const SummaryCard = () => (
    <div className="bg-card rounded-2xl p-4 border border-border space-y-1 text-center">
      {amount && <p className="text-2xl font-bold text-primary tabular-nums">৳{parseFloat(amount).toLocaleString()}</p>}
      <p className="text-sm text-muted-foreground">To: <span className="font-semibold text-foreground">{merchantCode}</span></p>
      {note && <p className="text-xs text-muted-foreground italic">"{note}"</p>}
      {reference && <p className="text-xs text-muted-foreground">Ref: <span className="font-mono font-semibold text-foreground">{reference}</span></p>}
    </div>
  );

  // ── Phone step ────────────────────────────────────────────
  if (step === "phone") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)] mt-3 mb-2">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Pay via Link</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <SummaryCard />
          <div className="w-full max-w-sm space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" /> Your Phone Number
              </label>
              <Input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={11}
                className="h-12 rounded-xl text-center text-lg tracking-widest font-mono"
                inputMode="numeric"
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button
              onClick={handleSendOtp}
              disabled={sending || cleanPhone.length < 11}
              className="w-full h-12 rounded-xl font-bold"
            >
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Send OTP
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── OTP step ──────────────────────────────────────────────
  if (step === "otp") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)] mt-3 mb-2">
          <button onClick={() => { setStep("phone"); setOtp(""); setError(""); }} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Verify OTP</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <SummaryCard />
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">OTP sent to <span className="font-semibold text-foreground">{cleanPhone}</span></p>
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          {devOtp && (
            <p className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg font-mono">
              DEV OTP: {devOtp}
            </p>
          )}
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button
            onClick={handleVerifyOtp}
            disabled={otp.length !== 6}
            className="w-full max-w-sm h-12 rounded-xl font-bold"
          >
            Verify & Continue
          </Button>
          <button
            onClick={handleResendOtp}
            disabled={resendTimer > 0 || sending}
            className="text-sm text-primary font-medium disabled:text-muted-foreground"
          >
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
          </button>
        </div>
      </div>
    );
  }

  // ── PIN step ──────────────────────────────────────────────
  if (step === "pin") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)] mt-3 mb-2">
          <button onClick={() => { setStep("otp"); setPin(""); setError(""); }} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Enter PIN</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <SummaryCard />
          <div className="text-center space-y-1">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Enter your 4-digit EasyPay PIN</p>
          </div>
          <div className="flex justify-center">
            <InputOTP maxLength={4} value={pin} onChange={setPin}>
              <InputOTPGroup>
                {[0, 1, 2, 3].map(i => (
                  <InputOTPSlot key={i} index={i} className="w-12 h-14 text-xl" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <input
            ref={pinInputRef}
            type="tel"
            inputMode="numeric"
            className="sr-only"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <Button
            onClick={handlePay}
            disabled={pin.length !== 4}
            className="w-full max-w-sm h-12 rounded-xl font-bold"
          >
            Confirm Payment
          </Button>
        </div>
      </div>
    );
  }

  // ── Processing ────────────────────────────────────────────
  if (step === "processing") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-lg font-semibold text-foreground">Processing Payment…</p>
        <p className="text-sm text-muted-foreground">Please wait, do not close this page</p>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-6">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">Payment Successful!</h2>
          {result.amount && (
            <p className="text-3xl font-bold text-primary tabular-nums">৳{result.amount.toLocaleString()}</p>
          )}
          {result.merchant_name && (
            <p className="text-sm text-muted-foreground">Paid to <span className="font-semibold text-foreground">{result.merchant_name}</span></p>
          )}
          {reference && <p className="text-xs text-muted-foreground">Ref: <span className="font-mono font-semibold text-foreground">{reference}</span></p>}
        </div>
        <Button onClick={onClose} variant="outline" className="rounded-xl">
          Done
        </Button>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-6">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-foreground">Payment Failed</h2>
        <p className="text-sm text-muted-foreground">{error || "Something went wrong"}</p>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => { setPin(""); setStep("pin"); setError(""); }} variant="outline" className="rounded-xl">
          Try Again
        </Button>
        <Button onClick={onClose} variant="outline" className="rounded-xl">
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default GuestCheckoutFlow;
