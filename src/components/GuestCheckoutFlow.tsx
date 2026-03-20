import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Phone, Shield, Lock, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
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

const STEPS: { key: Step; label: string }[] = [
  { key: "phone", label: "Phone" },
  { key: "otp", label: "OTP" },
  { key: "pin", label: "PIN" },
];

const StepIndicator = ({ current }: { current: Step }) => {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i <= idx
                  ? "bg-primary scale-110"
                  : "bg-muted-foreground/20"
              }`}
            />
            <span
              className={`text-[10px] font-medium transition-colors duration-300 ${
                i <= idx ? "text-primary" : "text-muted-foreground/40"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 h-px mb-4 transition-colors duration-300 ${
                i < idx ? "bg-primary" : "bg-muted-foreground/15"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

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

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

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

  // ── Compact summary (inline in glass card) ────────────────
  const InlineSummary = () => (
    <div className="text-center space-y-1 pb-2">
      {amount && (
        <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">
          ৳{parseFloat(amount).toLocaleString()}
        </p>
      )}
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>To</span>
        <span className="font-semibold text-foreground font-mono">{merchantCode}</span>
      </div>
    </div>
  );

  const showStepIndicator = ["phone", "otp", "pin"].includes(step);

  // ── Wrapper ───────────────────────────────────────────────
  const PageWrapper = ({ children, showBack = true, title = "", onBack }: { children: React.ReactNode; showBack?: boolean; title?: string; onBack?: () => void }) => (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
      {showBack && (
        <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)] mt-3 mb-1">
          <button
            onClick={onBack || onClose}
            className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          {title && <h1 className="text-lg font-semibold text-foreground tracking-tight">{title}</h1>}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        {children}
      </div>
      {showStepIndicator && (
        <p className="text-center text-[11px] text-muted-foreground/60 pb-6 tracking-wide">
          Secured by <span className="font-semibold text-muted-foreground/80">EasyPay</span>
        </p>
      )}
    </div>
  );

  // ── Phone step ────────────────────────────────────────────
  if (step === "phone") {
    return (
      <PageWrapper title="Pay via Link">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="backdrop-blur-xl bg-card/60 rounded-3xl border border-border/30 shadow-xl overflow-hidden">
            <StepIndicator current="phone" />
            <div className="px-6 pb-6 space-y-5">
              <InlineSummary />
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 tracking-wide uppercase">
                  <Phone className="w-3.5 h-3.5" /> Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={11}
                  className="h-12 rounded-xl text-center text-lg tracking-widest font-mono bg-background/50 border-border/40 focus:border-primary/50"
                  inputMode="numeric"
                />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button
                onClick={handleSendOtp}
                disabled={sending || cleanPhone.length < 11}
                className="w-full h-12 rounded-xl font-semibold tracking-wide"
              >
                {sending ? (
                  <div className="w-5 h-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                ) : (
                  <>
                    Send OTP
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ── OTP step ──────────────────────────────────────────────
  if (step === "otp") {
    return (
      <PageWrapper title="Verify OTP" onBack={() => { setStep("phone"); setOtp(""); setError(""); }}>
        <div className="w-full max-w-sm animate-scale-in">
          <div className="backdrop-blur-xl bg-card/60 rounded-3xl border border-border/30 shadow-xl overflow-hidden">
            <StepIndicator current="otp" />
            <div className="px-6 pb-6 space-y-5">
              <InlineSummary />
              <p className="text-xs text-muted-foreground text-center">
                OTP sent to <span className="font-semibold text-foreground">{cleanPhone}</span>
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="w-10 h-12 text-lg bg-background/50 border-border/40" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {devOtp && (
                <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg font-mono text-center">
                  DEV OTP: {devOtp}
                </p>
              )}
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6}
                className="w-full h-12 rounded-xl font-semibold tracking-wide"
              >
                Verify & Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
              <button
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || sending}
                className="w-full text-center text-xs text-primary font-medium disabled:text-muted-foreground/40 transition-colors"
              >
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
              </button>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ── PIN step ──────────────────────────────────────────────
  if (step === "pin") {
    return (
      <PageWrapper title="Enter PIN" onBack={() => { setStep("otp"); setPin(""); setError(""); }}>
        <div className="w-full max-w-sm animate-scale-in">
          <div className="backdrop-blur-xl bg-card/60 rounded-3xl border border-border/30 shadow-xl overflow-hidden">
            <StepIndicator current="pin" />
            <div className="px-6 pb-6 space-y-5">
              <InlineSummary />
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">Enter your 4-digit EasyPay PIN</p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={pin} onChange={setPin}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3].map((i) => (
                      <InputOTPSlot key={i} index={i} className="w-13 h-14 text-xl bg-background/50 border-border/40" />
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
                className="w-full h-12 rounded-xl font-semibold tracking-wide"
              >
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ── Processing ────────────────────────────────────────────
  if (step === "processing") {
    return (
      <PageWrapper showBack={false}>
        <div className="flex flex-col items-center gap-6 animate-scale-in">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-primary/10 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-primary/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-lg font-semibold text-foreground tracking-tight">Processing Payment</p>
            <p className="text-xs text-muted-foreground">Please wait, do not close this page</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ── Success ───────────────────────────────────────────────
  if (step === "success") {
    return (
      <PageWrapper showBack={false}>
        <div className="w-full max-w-sm animate-scale-in">
          <div className="backdrop-blur-xl bg-card/60 rounded-3xl border border-border/30 shadow-xl overflow-hidden">
            <div className="px-6 py-10 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-primary" />
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-lg font-bold text-foreground tracking-tight">Payment Successful</h2>
                {result.amount && (
                  <p className="text-3xl font-bold text-primary tabular-nums tracking-tight">
                    ৳{result.amount.toLocaleString()}
                  </p>
                )}
                {result.merchant_name && (
                  <p className="text-sm text-muted-foreground">
                    Paid to <span className="font-semibold text-foreground">{result.merchant_name}</span>
                  </p>
                )}
                {reference && (
                  <p className="text-xs text-muted-foreground">
                    Ref: <span className="font-mono font-semibold text-foreground">{reference}</span>
                  </p>
                )}
              </div>
              <Button onClick={onClose} variant="outline" className="rounded-xl px-8 mt-2">
                Done
              </Button>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  return (
    <PageWrapper showBack={false}>
      <div className="w-full max-w-sm animate-scale-in">
        <div className="backdrop-blur-xl bg-card/60 rounded-3xl border border-destructive/20 shadow-xl overflow-hidden">
          <div className="px-6 py-10 flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-9 h-9 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-foreground tracking-tight">Payment Failed</h2>
              <p className="text-sm text-muted-foreground">{error || "Something went wrong"}</p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button
                onClick={() => { setPin(""); setStep("pin"); setError(""); }}
                variant="outline"
                className="rounded-xl"
              >
                Try Again
              </Button>
              <Button onClick={onClose} variant="outline" className="rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default GuestCheckoutFlow;
