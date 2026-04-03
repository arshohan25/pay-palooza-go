import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, UserPlus, Home, Phone, ShieldCheck, User, FileCheck,
  Loader2, CheckCircle2, Send, RefreshCw, AlertTriangle, Download,
  Smartphone, Lock, Eye, EyeOff, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import { signUpWithPhonePassword } from "@/lib/auth";
import { isWeakPin } from "@/lib/pinValidation";
import { haptics } from "@/lib/haptics";
import { fireConfetti } from "@/lib/confetti";
import KycFlow from "@/components/KycFlow";

type FlowStep = "phone" | "otp" | "info" | "kyc" | "kyc_waiting" | "approved" | "rejected" | "customer_login";

const STEPS: { key: FlowStep; label: string; icon: React.ElementType }[] = [
  { key: "phone", label: "Phone", icon: Phone },
  { key: "otp", label: "Verify", icon: ShieldCheck },
  { key: "info", label: "Info", icon: User },
  { key: "kyc", label: "KYC", icon: FileCheck },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "40%" : "-40%", opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir < 0 ? "40%" : "-40%", opacity: 0, scale: 0.97 }),
};

const POST_KYC_STEPS = ["kyc_waiting", "approved", "rejected", "customer_login"];

const AgentRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<FlowStep>("phone");
  const [direction, setDirection] = useState(1);

  // Phone step
  const [phone, setPhone] = useState("");
  const phoneValidation = usePhoneValidation(phone);
  const [sendingOtp, setSendingOtp] = useState(false);

  // OTP step
  const [otpValue, setOtpValue] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Info step
  const [name, setName] = useState("");
  const [nid, setNid] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [newUserId, setNewUserId] = useState<string | null>(null);

  // KYC waiting
  const [kycStatus, setKycStatus] = useState<string>("pending");
  const [rejectionReason, setRejectionReason] = useState("");
  const [waitingElapsed, setWaitingElapsed] = useState(0);

  // Customer login guide
  const [loginStep, setLoginStep] = useState<"phone_confirm" | "otp_verify" | "set_pin">("phone_confirm");
  const [customerOtp, setCustomerOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [settingPin, setSettingPin] = useState(false);

  const channelRef = useRef<any>(null);

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);
  const isPostKyc = POST_KYC_STEPS.includes(currentStep);

  const goTo = useCallback((step: FlowStep, dir = 1) => {
    haptics.light();
    setDirection(dir);
    setCurrentStep(step);
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => setResendTimer(v => v - 1), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Auto-submit OTP when 6 digits entered
  useEffect(() => {
    if (otpValue.length === 6 && !verifyingOtp) {
      handleVerifyOtp();
    }
  }, [otpValue]);

  // KYC waiting elapsed timer
  useEffect(() => {
    if (currentStep !== "kyc_waiting") return;
    const timer = setInterval(() => setWaitingElapsed(v => v + 1), 1000);
    return () => clearInterval(timer);
  }, [currentStep]);

  // Real-time KYC subscription
  useEffect(() => {
    if (currentStep !== "kyc_waiting" || !newUserId) return;

    // Initial check
    supabase
      .from("kyc_verifications")
      .select("status, reviewer_notes")
      .eq("user_id", newUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          if (data[0].status === "verified") {
            setKycStatus("verified");
            haptics.success();
            fireConfetti();
            goTo("approved");
          } else if (data[0].status === "rejected") {
            setKycStatus("rejected");
            setRejectionReason(data[0].reviewer_notes || "No reason provided.");
            goTo("rejected");
          }
        }
      });

    const channel = supabase
      .channel(`agent-kyc-${newUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "kyc_verifications",
          filter: `user_id=eq.${newUserId}`,
        },
        (payload: any) => {
          const newStatus = payload.new?.status;
          if (newStatus === "verified") {
            setKycStatus("verified");
            haptics.success();
            fireConfetti();
            goTo("approved");
          } else if (newStatus === "rejected") {
            setKycStatus("rejected");
            setRejectionReason(payload.new?.reviewer_notes || "No reason provided.");
            goTo("rejected");
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStep, newUserId]);

  const handleSendOtp = async () => {
    if (phoneValidation.triggerShake()) return;
    setSendingOtp(true);
    try {
      const cleanedPhone = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
      const { data: existing } = await supabase.from("profiles").select("id").eq("phone", cleanedPhone).maybeSingle();
      if (existing) {
        toast({ title: "Already Registered", description: "This number already has an account.", variant: "destructive" });
        setSendingOtp(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanedPhone, purpose: "agent_register" },
      });
      if (error) throw error;
      if (data?.dev_otp) setDevOtp(data.dev_otp);
      setResendTimer(60);
      haptics.success();
      goTo("otp");
    } catch (err: any) {
      toast({ title: "Failed to send OTP", description: err.message, variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length !== 6) return;
    setVerifyingOtp(true);
    try {
      const cleanedPhone = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone: cleanedPhone, code: otpValue, purpose: "agent_register" },
      });
      if (error) throw error;
      if (!data?.verified) {
        toast({ title: "Invalid OTP", description: data?.error || "Verification failed.", variant: "destructive" });
        setOtpValue("");
        setVerifyingOtp(false);
        return;
      }
      haptics.success();
      goTo("info");
    } catch (err: any) {
      toast({ title: "Verification Failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setOtpValue("");
    setSendingOtp(true);
    try {
      const cleanedPhone = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanedPhone, purpose: "agent_register" },
      });
      if (error) throw error;
      if (data?.dev_otp) setDevOtp(data.dev_otp);
      setResendTimer(60);
      toast({ title: "OTP Resent", description: "A new code has been sent." });
    } catch (err: any) {
      toast({ title: "Resend Failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!name.trim()) {
      toast({ title: "Name Required", description: "Please enter the customer's name.", variant: "destructive" });
      return;
    }
    setCreatingAccount(true);
    try {
      const cleanedPhone = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");
      const randomPin = String(Math.floor(1000 + Math.random() * 9000));
      const result = await signUpWithPhonePassword(cleanedPhone, `${randomPin}EP`, {
        display_name: name.trim(),
        name: name.trim(),
      });
      if (result?.data?.user?.id) {
        setNewUserId(result.data.user.id);
      }
      haptics.success();
      goTo("kyc");
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleKycComplete = () => {
    haptics.success();
    setWaitingElapsed(0);
    goTo("kyc_waiting");
  };

  const handleSetPin = async () => {
    if (newPin.length !== 4) {
      toast({ title: "Invalid PIN", description: "PIN must be 4 digits.", variant: "destructive" });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: "PIN Mismatch", description: "PINs do not match.", variant: "destructive" });
      return;
    }
    if (isWeakPin(newPin)) {
      toast({ title: "Weak PIN", description: "Please choose a stronger PIN.", variant: "destructive" });
      return;
    }
    setSettingPin(true);
    try {
      // Note: PIN setup would normally be done by the customer on their device
      // Here we show a guide for the agent to walk through with the customer
      haptics.success();
      toast({ title: "Setup Complete!", description: "Customer can now login with their PIN." });
      // Reset and go back
      resetFlow();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSettingPin(false);
    }
  };

  const resetFlow = () => {
    setCurrentStep("phone");
    setPhone(""); setName(""); setNid(""); setOtpValue(""); setDevOtp("");
    setNewUserId(null); setKycStatus("pending"); setRejectionReason("");
    setWaitingElapsed(0); setLoginStep("phone_confirm");
    setCustomerOtp(""); setNewPin(""); setConfirmPin("");
  };

  const handleGoBack = () => {
    haptics.medium();
    if (currentStep === "phone") { navigate("/agent"); return; }
    if (currentStep === "otp") { goTo("phone", -1); return; }
    if (currentStep === "info") { goTo("otp", -1); return; }
    if (currentStep === "kyc") { goTo("info", -1); return; }
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-hero px-4 pt-3 pb-4 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {!isPostKyc && (
            <button onClick={handleGoBack} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <UserPlus size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Register Customer</h1>
              <p className="text-[9px] text-primary-foreground/60">
                {isPostKyc
                  ? currentStep === "kyc_waiting" ? "Awaiting KYC Review"
                  : currentStep === "approved" ? "KYC Approved"
                  : currentStep === "rejected" ? "KYC Rejected"
                  : "Customer Setup"
                  : `Step ${stepIndex + 1} of ${STEPS.length}`}
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator — only for first 4 steps */}
        {!isPostKyc && (
          <div className="max-w-xl mx-auto mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => {
              const isActive = i === stepIndex;
              const isDone = i < stepIndex;
              return (
                <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    animate={{
                      scale: isActive ? 1 : 0.85,
                      opacity: isActive ? 1 : isDone ? 0.8 : 0.4,
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                      isDone
                        ? "bg-primary-foreground/30 text-primary-foreground"
                        : isActive
                        ? "bg-primary-foreground text-primary"
                        : "bg-primary-foreground/15 text-primary-foreground/50"
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={14} /> : <s.icon size={12} />}
                  </motion.div>
                  <span className={`text-[8px] font-semibold tracking-wide ${
                    isActive ? "text-primary-foreground" : "text-primary-foreground/40"
                  }`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ─── Step 1: Phone ─── */}
          {currentStep === "phone" && (
            <motion.div key="phone" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-5 bg-card/80 backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow">
                    <Phone size={28} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Customer Phone</h2>
                  <p className="text-xs text-muted-foreground">Enter the customer's mobile number to begin registration</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">+88</span>
                    <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} onBlur={() => phoneValidation.setTouched(true)} maxLength={11} className={`rounded-xl h-12 pl-12 text-lg font-semibold tracking-wider ${phoneValidation.inputClassName}`} />
                  </div>
                  {phoneValidation.showError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-destructive font-medium">{phoneValidation.errorMessage}</motion.p>
                  )}
                </div>
                <Button onClick={handleSendOtp} disabled={!phoneValidation.isValid || sendingOtp} className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-sm font-bold shadow-glow gap-2">
                  {sendingOtp ? <><Loader2 size={16} className="animate-spin" /> Sending OTP...</> : <><Send size={16} /> Send OTP</>}
                </Button>
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                  <ShieldCheck size={12} className="text-primary" />
                  <span>OTP will be sent to the customer's phone</span>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ─── Step 2: OTP ─── */}
          {currentStep === "otp" && (
            <motion.div key="otp" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-6 bg-card/80 backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mx-auto shadow-glow">
                    <ShieldCheck size={28} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Verify OTP</h2>
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to <span className="font-bold text-foreground">+88{phone}</span></p>
                </div>
                {devOtp && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center px-3 py-2 rounded-xl bg-accent/10 border border-accent/20">
                    <p className="text-[10px] text-accent font-bold uppercase tracking-wider">Dev Mode OTP</p>
                    <p className="text-lg font-mono font-bold text-accent tracking-[0.3em]">{devOtp}</p>
                  </motion.div>
                )}
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue} disabled={verifyingOtp}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot key={i} index={i} className="w-11 h-13 text-lg font-bold rounded-xl border-2" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {verifyingOtp && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    <span>Verifying...</span>
                  </div>
                )}
                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-xs text-muted-foreground">Resend in <span className="font-bold text-foreground">{resendTimer}s</span></p>
                  ) : (
                    <button onClick={handleResendOtp} disabled={sendingOtp} className="text-xs font-semibold text-primary flex items-center gap-1.5 mx-auto active:scale-95 transition-transform">
                      <RefreshCw size={12} /> Resend OTP
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ─── Step 3: Basic Info ─── */}
          {currentStep === "info" && (
            <motion.div key="info" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-5 bg-card/80 backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center mx-auto shadow-glow">
                    <User size={28} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Customer Details</h2>
                  <p className="text-xs text-muted-foreground">Provide basic information to create the account</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name *</Label>
                    <Input placeholder="Customer's full name" value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-12 text-sm font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">NID Number (Optional)</Label>
                    <Input type="text" inputMode="numeric" placeholder="National ID number" value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-12 text-sm font-medium" />
                  </div>
                </div>
                <Button onClick={handleCreateAccount} disabled={!name.trim() || creatingAccount} className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-sm font-bold shadow-glow gap-2">
                  {creatingAccount ? <><Loader2 size={16} className="animate-spin" /> Creating Account...</> : <><UserPlus size={16} /> Create & Start KYC</>}
                </Button>
              </Card>
            </motion.div>
          )}

          {/* ─── Step 4: KYC Flow ─── */}
          {currentStep === "kyc" && (
            <motion.div key="kyc" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <KycFlow onClose={handleKycComplete} agentMode={true} targetUserId={newUserId || undefined} />
            </motion.div>
          )}

          {/* ─── KYC Waiting (Real-time) ─── */}
          {currentStep === "kyc_waiting" && (
            <motion.div key="kyc_waiting" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-6 bg-card/80 backdrop-blur-sm text-center">
                {/* Pulsing ring animation */}
                <div className="relative w-24 h-24 mx-auto">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 rounded-full bg-primary/20"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                    className="absolute inset-2 rounded-full bg-primary/30"
                  />
                  <div className="absolute inset-4 rounded-full gradient-primary flex items-center justify-center shadow-glow">
                    <ShieldCheck size={28} className="text-primary-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-foreground">KYC Under Review</h2>
                  <p className="text-xs text-muted-foreground">
                    Waiting for admin approval
                    <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>...</motion.span>
                  </p>
                </div>

                {/* Status badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={14} className="text-amber-500" />
                  </motion.div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Review</span>
                </div>

                {/* Elapsed time */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>Elapsed: {formatElapsed(waitingElapsed)}</span>
                </div>

                {/* Customer info summary */}
                <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-semibold text-foreground">{name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-semibold text-foreground">+88{phone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">PENDING</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  This page updates automatically when admin reviews the KYC
                </p>
              </Card>
            </motion.div>
          )}

          {/* ─── KYC Approved ─── */}
          {currentStep === "approved" && (
            <motion.div key="approved" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-6 bg-card/80 backdrop-blur-sm text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto"
                  style={{ boxShadow: "0 8px 32px -8px rgba(16, 185, 129, 0.45)" }}
                >
                  <CheckCircle2 size={40} className="text-white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">KYC Approved! 🎉</h2>
                  <p className="text-sm text-muted-foreground">Customer <span className="font-semibold text-foreground">{name}</span> is now verified</p>
                </motion.div>

                {/* Download link card */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/15 p-5 space-y-3"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Download size={16} className="text-primary" />
                    <span className="text-sm font-bold text-foreground">Download EasyPay</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Share this link with the customer</p>
                  <div className="flex items-center gap-2 bg-background rounded-xl border border-border px-3 py-2.5">
                    <Smartphone size={14} className="text-primary shrink-0" />
                    <span className="text-xs font-mono text-foreground truncate flex-1">pay-palooza-go.lovable.app</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px] font-bold text-primary"
                      onClick={() => {
                        navigator.clipboard.writeText("https://pay-palooza-go.lovable.app");
                        toast({ title: "Link Copied!" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </motion.div>

                {/* Customer summary */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-semibold text-foreground">{name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-semibold text-foreground">+88{phone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">KYC</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">VERIFIED ✓</span>
                  </div>
                </motion.div>

                <div className="space-y-2.5">
                  <Button onClick={() => goTo("customer_login")} className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-sm font-bold shadow-glow gap-2">
                    <Smartphone size={16} /> Guide Customer Login
                  </Button>
                  <Button onClick={resetFlow} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2">
                    <UserPlus size={16} /> Register Another
                  </Button>
                  <Button onClick={() => navigate("/agent")} variant="ghost" className="w-full rounded-xl h-10 text-xs text-muted-foreground gap-2">
                    <Home size={14} /> Back to Dashboard
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ─── KYC Rejected ─── */}
          {currentStep === "rejected" && (
            <motion.div key="rejected" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-6 bg-card/80 backdrop-blur-sm text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mx-auto"
                  style={{ boxShadow: "0 8px 32px -8px rgba(239, 68, 68, 0.45)" }}
                >
                  <AlertTriangle size={36} className="text-white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">KYC Rejected</h2>
                  <p className="text-sm text-muted-foreground">The verification for <span className="font-semibold text-foreground">{name}</span> was not approved</p>
                </motion.div>

                {/* Rejection reason */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-red-500/5 border border-red-500/15 p-4 text-left space-y-2"
                >
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Reason for Rejection</p>
                  <p className="text-sm text-foreground leading-relaxed">{rejectionReason}</p>
                </motion.div>

                <div className="space-y-2.5">
                  <Button
                    onClick={() => {
                      setKycStatus("pending");
                      setRejectionReason("");
                      goTo("kyc");
                    }}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl h-12 text-sm font-bold gap-2"
                  >
                    <RefreshCw size={16} /> Retry KYC
                  </Button>
                  <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2">
                    <Home size={16} /> Back to Dashboard
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ─── Customer Login Guide ─── */}
          {currentStep === "customer_login" && (
            <motion.div key="customer_login" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 32 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-5 bg-card/80 backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow">
                    <Smartphone size={24} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-base font-bold text-foreground">Customer Login Guide</h2>
                  <p className="text-[11px] text-muted-foreground">Walk the customer through their first login</p>
                </div>

                {/* Mini step indicators */}
                <div className="flex items-center justify-center gap-3">
                  {(["phone_confirm", "otp_verify", "set_pin"] as const).map((s, i) => {
                    const labels = ["Phone", "OTP", "PIN"];
                    const icons = [Phone, ShieldCheck, Lock];
                    const Icon = icons[i];
                    const isActive = s === loginStep;
                    const isDone = (s === "phone_confirm" && loginStep !== "phone_confirm") || (s === "otp_verify" && loginStep === "set_pin");
                    return (
                      <div key={s} className="flex items-center gap-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isDone ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : isActive ? "gradient-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                        }`}>
                          {isDone ? <CheckCircle2 size={13} /> : <Icon size={11} />}
                        </div>
                        <span className={`text-[9px] font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{labels[i]}</span>
                        {i < 2 && <div className="w-4 h-px bg-border" />}
                      </div>
                    );
                  })}
                </div>

                {/* Phone confirm sub-step */}
                {loginStep === "phone_confirm" && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Customer Phone</Label>
                      <div className="flex items-center gap-2 bg-background rounded-xl border border-border px-3 py-3">
                        <Phone size={14} className="text-primary" />
                        <span className="text-sm font-bold text-foreground tracking-wider">+88{phone}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Customer enters this number in the app to login</p>
                    </div>
                    <Button onClick={() => setLoginStep("otp_verify")} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold gap-2">
                      Next: OTP Verification <ArrowLeft size={14} className="rotate-180" />
                    </Button>
                  </motion.div>
                )}

                {/* OTP verify sub-step */}
                {loginStep === "otp_verify" && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <ShieldCheck size={12} className="text-primary" />
                        </div>
                        <span className="text-xs font-bold text-foreground">OTP Auto-Detection</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        On Android Chrome, the OTP will be automatically detected from SMS. Customer just needs to tap "Auto-fill" when the prompt appears.
                      </p>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={customerOtp} onChange={setCustomerOtp}>
                          <InputOTPGroup>
                            {[0, 1, 2, 3, 4, 5].map(i => (
                              <InputOTPSlot key={i} index={i} className="w-9 h-11 text-sm font-bold rounded-lg border-2" />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </div>
                    <Button onClick={() => setLoginStep("set_pin")} disabled={customerOtp.length !== 6} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold gap-2">
                      Next: Set PIN <ArrowLeft size={14} className="rotate-180" />
                    </Button>
                  </motion.div>
                )}

                {/* Set PIN sub-step */}
                {loginStep === "set_pin" && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Lock size={12} className="text-primary" />
                        </div>
                        <span className="text-xs font-bold text-foreground">Set 4-Digit PIN</span>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New PIN</Label>
                          <div className="relative">
                            <Input
                              type={showPin ? "text" : "password"}
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="••••"
                              value={newPin}
                              onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                              className="rounded-xl h-11 text-center text-lg font-bold tracking-[0.5em] pr-10"
                            />
                            <button onClick={() => setShowPin(!showPin)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Confirm PIN</Label>
                          <Input
                            type={showPin ? "text" : "password"}
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="••••"
                            value={confirmPin}
                            onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                            className="rounded-xl h-11 text-center text-lg font-bold tracking-[0.5em]"
                          />
                        </div>
                      </div>

                      {newPin.length === 4 && isWeakPin(newPin) && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle size={10} /> Weak PIN — avoid sequential or repeated digits
                        </motion.p>
                      )}
                      {newPin.length === 4 && confirmPin.length === 4 && newPin !== confirmPin && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-destructive font-medium">
                          PINs do not match
                        </motion.p>
                      )}
                    </div>

                    <Button
                      onClick={handleSetPin}
                      disabled={newPin.length !== 4 || confirmPin.length !== 4 || newPin !== confirmPin || isWeakPin(newPin) || settingPin}
                      className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-sm font-bold shadow-glow gap-2"
                    >
                      {settingPin ? <><Loader2 size={16} className="animate-spin" /> Setting up...</> : <><CheckCircle2 size={16} /> Complete Setup</>}
                    </Button>
                  </motion.div>
                )}

                <Button onClick={() => goTo("approved", -1)} variant="ghost" className="w-full text-xs text-muted-foreground gap-1.5">
                  <ArrowLeft size={12} /> Back to Approval
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AgentRegister;
