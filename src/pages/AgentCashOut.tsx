import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowDownToLine, CheckCircle2, Home, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";
import { supabase } from "@/integrations/supabase/client";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import QrScannerModal from "@/components/QrScannerModal";
import { parseQrData } from "@/lib/qrParser";
import { verifyPin } from "@/lib/verifyPin";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

/**
 * Agent-initiated Cash Out.
 * Agent enters customer phone + amount → customer receives 6-digit OTP →
 * agent enters OTP + own PIN → RPC debits customer, credits agent + commission.
 */
const AgentCashOut = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "otp" | "confirm" | "done">("form");
  const [processing, setProcessing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [resolvedName, setResolvedName] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [result, setResult] = useState<{ reference: string; fee: number; commission: number } | null>(null);
  const phoneValidation = usePhoneValidation(phone);

  useEffect(() => {
    if (phone.length === 11 && phone.startsWith("01")) {
      (async () => {
        try {
          const { data } = await supabase.rpc("resolve_transfer_recipient", { p_identifier: phone, p_flow: "send" });
          const res = data as any;
          setResolvedName(res?.found ? res.recipient_name : "");
        } catch { setResolvedName(""); }
      })();
    }
  }, [phone]);

  useEffect(() => {
    if (expiresIn <= 0) return;
    const t = setInterval(() => setExpiresIn(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [expiresIn]);

  const requestOtp = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("agent_cashout_initiate", {
        p_customer_phone: phone,
        p_amount: Number(amount),
      });
      if (error) throw error;
      const res = data as any;
      setExpiresIn(res?.expires_in_seconds || 180);
      setDevCode(res?.debug_code || null);
      setStep("otp");
      toast({ title: "OTP sent", description: `A 6-digit code was sent to ${phone}.` });
    } catch (err: any) {
      toast({ title: "Failed to initiate", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        toast({ title: "Incorrect PIN", description: "Please try again.", variant: "destructive" });
        setPin("");
        setProcessing(false);
        return;
      }
      const { data, error } = await supabase.rpc("agent_cashout_confirm", {
        p_customer_phone: phone,
        p_amount: Number(amount),
        p_otp: otp,
      });
      if (error) throw error;
      const res = data as any;
      setResult({ reference: res.reference, fee: Number(res.fee) || 0, commission: Number(res.commission) || 0 });
      window.dispatchEvent(new Event("txn:refresh"));
      setStep("done");
      toast({ title: "Cash Out Successful", description: `৳${amount} withdrawn by ${phone}` });
    } catch (err: any) {
      const msg = err.message?.includes("invalid_or_expired_otp") ? "OTP invalid or expired." :
        err.message?.includes("insufficient_balance") ? "Customer has insufficient balance." :
        err.message || "Failed";
      toast({ title: "Cash Out Failed", description: msg, variant: "destructive" });
      setPin("");
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setPhone(""); setAmount(""); setOtp(""); setPin("");
    setResolvedName(""); setDevCode(null); setResult(null);
    setStep("form");
  };

  const progress = step === "form" ? "25%" : step === "otp" ? "55%" : step === "confirm" ? "80%" : "100%";
  const total = Number(amount) + (result?.fee || 0);

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-send px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/agent")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <ArrowUpFromLine size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Cash Out</h1>
              <p className="text-[9px] text-primary-foreground/60">Customer withdrawal (OTP verified)</p>
            </div>
          </div>
        </div>
        <div className="max-w-xl mx-auto mt-3">
          <div className="h-1.5 bg-primary-foreground/10 rounded-full overflow-hidden">
            <motion.div animate={{ width: progress }} className="h-full bg-primary-foreground/40 rounded-full" transition={{ duration: 0.4 }} />
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        {step === "done" ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-primary" />
              </motion.div>
              <div>
                <p className="text-lg font-extrabold text-foreground">Hand ৳{fmt(Number(amount))} in cash</p>
                <p className="text-sm text-muted-foreground mt-1">to {resolvedName || phone}</p>
              </div>
              <div className="space-y-2 bg-muted/50 rounded-xl p-4 text-sm text-left">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee (customer paid)</span><span className="font-bold text-foreground">৳{fmt(result?.fee || 0)}</span></div>
                <div className="flex justify-between border-t border-border/40 pt-2"><span className="text-muted-foreground">Commission earned</span><span className="font-bold text-primary">+৳{fmt(result?.commission || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono text-xs text-foreground">{result?.reference}</span></div>
              </div>
              <Button onClick={reset} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">New Cash Out</Button>
              <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2"><Home size={16} /> Back to Dashboard</Button>
            </Card>
          </motion.div>
        ) : step === "confirm" ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <h3 className="text-base font-extrabold text-foreground text-center">Confirm Cash Out</h3>
              <div className="space-y-2.5 bg-muted/50 rounded-xl p-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer</span><span className="font-bold text-foreground">{resolvedName || phone}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">OTP</span><span className="font-mono font-bold text-foreground">{otp}</span></div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Your PIN</Label>
                <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1" />
              </div>
              <SlideToConfirm onConfirm={handleConfirm} disabled={pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Withdraw"} />
              <Button variant="ghost" onClick={() => setStep("otp")} className="w-full text-muted-foreground">Back</Button>
            </Card>
          </motion.div>
        ) : step === "otp" ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck size={16} className="text-primary" />
                <p className="font-semibold text-foreground">Ask customer for the 6-digit code</p>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Sent to {phone}. Expires in {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, "0")}</p>
              {devCode && <p className="text-[10px] text-amber-500 font-mono">DEV code: {devCode}</p>}
              <div>
                <Label className="text-xs font-semibold">OTP Code</Label>
                <Input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="text-center text-xl tracking-[0.4em] rounded-xl h-14 mt-1 font-mono" />
              </div>
              {otp.length === 6 && expiresIn > 0 && (
                <Button onClick={() => setStep("confirm")} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 animate-fade-in">Continue</Button>
              )}
              <Button variant="ghost" onClick={requestOtp} disabled={processing || expiresIn > 150} className="w-full text-xs text-muted-foreground">
                {expiresIn > 150 ? `Resend in ${expiresIn - 150}s` : "Resend OTP"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("form")} className="w-full text-muted-foreground">Cancel</Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div>
                <Label className="text-xs font-semibold">Customer Phone</Label>
                <div className="relative mt-1">
                  <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, "")); setResolvedName(""); }} onBlur={() => phoneValidation.setTouched(true)} maxLength={11} className={`rounded-xl h-11 pr-11 ${phoneValidation.inputClassName}`} />
                  <button type="button" onClick={() => setShowQr(true)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                    <ScanLine size={16} />
                  </button>
                </div>
                {resolvedName && <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> {resolvedName}</p>}
                {phoneValidation.showError && <p className="text-[10px] text-destructive font-medium mt-1 animate-fade-in">{phoneValidation.errorMessage}</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold">Amount (৳)</Label>
                <Input type="text" inputMode="numeric" placeholder="Enter amount (min 50, max 25,000)" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[500, 1000, 2000, 5000, 10000].map(a => (
                  <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground press-effect hover:bg-primary/10 hover:text-primary transition-colors">৳{fmt(a)}</button>
                ))}
              </div>
              {phoneValidation.isValid && amount && Number(amount) >= 50 && Number(amount) <= 25000 && (
                <Button onClick={() => { if (phoneValidation.triggerShake()) return; requestOtp(); }} disabled={processing} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold animate-fade-in">
                  {processing ? "Sending OTP…" : "Send OTP to Customer"}
                </Button>
              )}
            </Card>
          </motion.div>
        )}
      </div>
      <QrScannerModal
        open={showQr}
        onClose={() => setShowQr(false)}
        title="Scan Customer QR"
        onScan={(result) => {
          setShowQr(false);
          const parsed = parseQrData(result);
          const extracted = parsed.identifier?.replace(/\D/g, "").slice(0, 11) || result.replace(/\D/g, "").slice(0, 11);
          setPhone(extracted);
        }}
      />
    </div>
  );
};

export default AgentCashOut;
