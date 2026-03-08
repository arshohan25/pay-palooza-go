import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signIn } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Store, Shield, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const isValidUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type SessionData = {
  id: string;
  amount: number;
  currency: string;
  reference: string | null;
  description: string | null;
  status: string;
  success_url: string | null;
  cancel_url: string | null;
  expires_at: string;
  merchant_id: string;
};

type Step = "loading" | "expired" | "error" | "login" | "confirm" | "processing" | "success" | "failed";

const CheckoutPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [merchantPhone, setMerchantPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Load session
  useEffect(() => {
    if (!sessionId || !isValidUUID(sessionId)) { setStep("error"); return; }

    (async () => {
      const { data, error } = await supabase
        .from("merchant_payment_sessions")
        .select("id, amount, currency, reference, description, status, success_url, cancel_url, expires_at, merchant_id")
        .eq("id", sessionId)
        .single();

      if (error || !data) { setStep("error"); return; }

      if (data.status === "completed") { setStep("success"); setSession(data as SessionData); return; }
      if (data.status === "failed" || data.status === "expired") { setStep("expired"); setSession(data as SessionData); return; }
      if (new Date(data.expires_at) < new Date()) { setStep("expired"); setSession(data as SessionData); return; }

      // Get merchant info
      const { data: merch } = await supabase
        .from("merchants")
        .select("business_name, user_id")
        .eq("id", data.merchant_id)
        .single();

      if (merch) {
        setMerchantName(merch.business_name);
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", merch.user_id)
          .single();
        if (profile) setMerchantPhone(profile.phone);
      }

      setSession(data as SessionData);
      setStep("login");
    })();
  }, [sessionId]);

  // Countdown timer
  useEffect(() => {
    if (!session?.expires_at || (step !== "login" && step !== "confirm")) return;
    const expires = new Date(session.expires_at).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setStep("expired");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.expires_at, step]);

  const handleLogin = useCallback(async () => {
    if (phone.length < 11 || pin.length < 4) {
      setErrorMsg("Enter valid phone and 4-digit PIN");
      return;
    }
    setErrorMsg("");
    setStep("processing");

    try {
      const cleanPhone = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
      await signIn(cleanPhone, pin);
      setStep("confirm");
    } catch {
      setErrorMsg("Invalid phone or PIN");
      setStep("login");
    }
  }, [phone, pin]);

  const handlePay = useCallback(async () => {
    if (!session || !merchantPhone) return;
    setStep("processing");

    try {
      const { data, error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: merchantPhone,
        p_amount: session.amount,
        p_fee: 0,
        p_type: "payment" as any,
        p_description: session.description || `Payment to ${merchantName}`,
        p_reference: session.reference || session.id,
        p_recipient_name: merchantName,
        p_recipient_type: "payment" as any,
      });

      if (error) throw error;

      // Update session status
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      await fetch(`https://${projectId}.supabase.co/functions/v1/merchant-payment-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      }).catch(() => {});

      // Update session directly too
      await supabase
        .from("merchant_payment_sessions")
        .update({
          status: "completed",
          payer_user_id: (await supabase.auth.getUser()).data.user?.id,
          customer_phone: phone.replace(/\D/g, "").replace(/^(\+?88)/, ""),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      setStep("success");

      // Redirect after delay
      if (session.success_url) {
        setTimeout(() => { window.location.href = session.success_url!; }, 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Payment failed");
      setStep("failed");

      await supabase
        .from("merchant_payment_sessions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", session?.id || "");
    }
  }, [session, merchantPhone, merchantName, phone]);

  const handleCancel = () => {
    if (session?.cancel_url) {
      window.location.href = session.cancel_url;
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 to-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Shield size={24} className="text-primary" />
          </div>
          <h1 className="text-lg font-extrabold text-foreground">EasyPay Checkout</h1>
          <p className="text-xs text-muted-foreground">Secure payment gateway</p>
        </div>

        <AnimatePresence mode="wait">
          {/* LOADING */}
          {step === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 text-center">
                <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading payment details...</p>
              </Card>
            </motion.div>
          )}

          {/* EXPIRED */}
          {step === "expired" && (
            <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 text-center">
                <Clock size={40} className="text-amber-500 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground mb-1">Session Expired</h2>
                <p className="text-sm text-muted-foreground mb-4">This payment link has expired. Please request a new one from the merchant.</p>
                <Button variant="outline" onClick={handleCancel}>Go Back</Button>
              </Card>
            </motion.div>
          )}

          {/* ERROR */}
          {step === "error" && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 text-center">
                <AlertTriangle size={40} className="text-destructive mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground mb-1">Invalid Session</h2>
                <p className="text-sm text-muted-foreground mb-4">This payment link is invalid or no longer available.</p>
                <Button variant="outline" onClick={() => navigate("/")}>Go Home</Button>
              </Card>
            </motion.div>
          )}

          {/* LOGIN */}
          {step === "login" && session && (
            <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Payment details */}
              <Card className="p-4 mb-4 border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Store size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{merchantName || "Merchant"}</p>
                    {session.description && <p className="text-[11px] text-muted-foreground">{session.description}</p>}
                  </div>
                </div>
                <div className="text-center py-3 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount to Pay</p>
                  <p className="text-3xl font-black text-foreground">৳{fmt(session.amount)}</p>
                  {session.reference && <p className="text-[10px] text-muted-foreground mt-1">Ref: {session.reference}</p>}
                </div>
              </Card>

              {/* Auth form */}
              <Card className="p-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">Phone Number</label>
                  <Input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    maxLength={11}
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">PIN</label>
                  <InputOTP maxLength={4} value={pin} onChange={setPin}>
                    <InputOTPGroup className="gap-2 justify-center w-full">
                      {[0, 1, 2, 3].map(i => (
                        <InputOTPSlot key={i} index={i} className="w-12 h-12 text-lg font-bold rounded-xl border-2" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {errorMsg && (
                  <p className="text-xs text-destructive text-center">{errorMsg}</p>
                )}

                <Button onClick={handleLogin} className="w-full" size="lg">
                  <Lock size={14} className="mr-2" />
                  Continue to Pay
                </Button>
                <Button variant="ghost" onClick={handleCancel} className="w-full text-xs">Cancel</Button>
              </Card>

              {/* Countdown timer */}
              {secondsLeft !== null && (
                <div className={`text-center mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold ${
                  secondsLeft > 60 ? "text-muted-foreground" : secondsLeft > 30 ? "text-amber-500" : "text-destructive"
                }`}>
                  <Clock size={12} />
                  <span>{fmtTime(secondsLeft)}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* CONFIRM */}
          {step === "confirm" && session && (
            <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-5 space-y-4">
                <div className="text-center">
                  <Store size={32} className="text-primary mx-auto mb-2" />
                  <h2 className="text-lg font-bold">Confirm Payment</h2>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">To</span><span className="font-semibold">{merchantName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-black text-lg">৳{fmt(session.amount)}</span></div>
                  {session.reference && <div className="flex justify-between"><span className="text-muted-foreground">Ref</span><span className="font-medium">{session.reference}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-medium text-emerald-600">Free</span></div>
                </div>
                <Button onClick={handlePay} className="w-full" size="lg">
                  Pay ৳{fmt(session.amount)}
                </Button>
                <Button variant="ghost" onClick={() => setStep("login")} className="w-full text-xs">
                  <ArrowLeft size={12} className="mr-1" />Back
                </Button>
              </Card>
              {/* Countdown timer on confirm */}
              {secondsLeft !== null && (
                <div className={`text-center mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold ${
                  secondsLeft > 60 ? "text-muted-foreground" : secondsLeft > 30 ? "text-amber-500" : "text-destructive"
                }`}>
                  <Clock size={12} />
                  <span>{fmtTime(secondsLeft)}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* PROCESSING */}
          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 text-center">
                <Loader2 size={40} className="animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">Processing payment...</p>
                <p className="text-xs text-muted-foreground mt-1">Please don't close this page</p>
              </Card>
            </motion.div>
          )}

          {/* SUCCESS */}
          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                  <CheckCircle2 size={56} className="text-emerald-500 mx-auto mb-3" />
                </motion.div>
                <h2 className="text-xl font-black text-foreground mb-1">Payment Successful!</h2>
                <p className="text-sm text-muted-foreground mb-1">৳{session ? fmt(session.amount) : "—"} paid to {merchantName || "Merchant"}</p>
                {session?.reference && <p className="text-[10px] text-muted-foreground">Ref: {session.reference}</p>}
                {session?.success_url && (
                  <p className="text-xs text-primary mt-3">Redirecting back to merchant...</p>
                )}
                {!session?.success_url && (
                  <Button variant="outline" onClick={() => navigate("/")} className="mt-4">Go to EasyPay</Button>
                )}
              </Card>
            </motion.div>
          )}

          {/* FAILED */}
          {step === "failed" && (
            <motion.div key="failed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="p-8 text-center">
                <XCircle size={48} className="text-destructive mx-auto mb-3" />
                <h2 className="text-lg font-bold text-foreground mb-1">Payment Failed</h2>
                <p className="text-sm text-muted-foreground mb-4">{errorMsg || "Something went wrong"}</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancel} className="flex-1">Cancel</Button>
                  <Button onClick={() => setStep("login")} className="flex-1">Try Again</Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-[9px] text-muted-foreground text-center mt-6">
          Secured by EasyPay · End-to-end encrypted
        </p>
      </motion.div>
    </div>
  );
};

export default CheckoutPage;
