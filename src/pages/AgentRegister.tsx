import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, UserPlus, Home, Phone, ShieldCheck, User, FileCheck, Loader2, CheckCircle2, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import { signUpWithPhonePassword } from "@/lib/auth";
import { haptics } from "@/lib/haptics";
import KycFlow from "@/components/KycFlow";

type FlowStep = "phone" | "otp" | "info" | "kyc" | "success";

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

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

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

  const handleSendOtp = async () => {
    if (phoneValidation.triggerShake()) return;
    setSendingOtp(true);
    try {
      const cleanedPhone = phone.replace(/\D/g, "").replace(/^(\+?88)/, "");

      // Check if already registered
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

      // Get the new user's ID from the auth response
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
    goTo("success");
  };

  const handleGoBack = () => {
    haptics.medium();
    if (currentStep === "phone") { navigate("/agent"); return; }
    if (currentStep === "otp") { goTo("phone", -1); return; }
    if (currentStep === "info") { goTo("otp", -1); return; }
    if (currentStep === "kyc") { goTo("info", -1); return; }
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
          {currentStep !== "success" && (
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
                {currentStep === "success" ? "Registration Complete" : `Step ${stepIndex + 1} of ${STEPS.length}`}
              </p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        {currentStep !== "success" && (
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
            <motion.div
              key="phone"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-5 bg-card/80 backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-glow"
                  >
                    <Phone size={28} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Customer Phone</h2>
                  <p className="text-xs text-muted-foreground">Enter the customer's mobile number to begin registration</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">+88</span>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      placeholder="01XXXXXXXXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                      onBlur={() => phoneValidation.setTouched(true)}
                      maxLength={11}
                      className={`rounded-xl h-12 pl-12 text-lg font-semibold tracking-wider ${phoneValidation.inputClassName}`}
                    />
                  </div>
                  {phoneValidation.showError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-destructive font-medium">
                      {phoneValidation.errorMessage}
                    </motion.p>
                  )}
                </div>

                <Button
                  onClick={handleSendOtp}
                  disabled={!phoneValidation.isValid || sendingOtp}
                  className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-sm font-bold shadow-glow gap-2"
                >
                  {sendingOtp ? (
                    <><Loader2 size={16} className="animate-spin" /> Sending OTP...</>
                  ) : (
                    <><Send size={16} /> Send OTP</>
                  )}
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
            <motion.div
              key="otp"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-6 bg-card/80 backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mx-auto shadow-glow"
                  >
                    <ShieldCheck size={28} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Verify OTP</h2>
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code sent to <span className="font-bold text-foreground">+88{phone}</span>
                  </p>
                </div>

                {/* Dev OTP hint */}
                {devOtp && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center px-3 py-2 rounded-xl bg-accent/10 border border-accent/20"
                  >
                    <p className="text-[10px] text-accent font-bold uppercase tracking-wider">Dev Mode OTP</p>
                    <p className="text-lg font-mono font-bold text-accent tracking-[0.3em]">{devOtp}</p>
                  </motion.div>
                )}

                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpValue}
                    onChange={setOtpValue}
                    disabled={verifyingOtp}
                  >
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="w-11 h-13 text-lg font-bold rounded-xl border-2"
                        />
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
                    <p className="text-xs text-muted-foreground">
                      Resend in <span className="font-bold text-foreground">{resendTimer}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={handleResendOtp}
                      disabled={sendingOtp}
                      className="text-xs font-semibold text-primary flex items-center gap-1.5 mx-auto active:scale-95 transition-transform"
                    >
                      <RefreshCw size={12} /> Resend OTP
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ─── Step 3: Basic Info ─── */}
          {currentStep === "info" && (
            <motion.div
              key="info"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] space-y-5 bg-card/80 backdrop-blur-sm">
                <div className="text-center space-y-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center mx-auto shadow-glow"
                  >
                    <User size={28} className="text-primary-foreground" />
                  </motion.div>
                  <h2 className="text-lg font-bold text-foreground">Customer Details</h2>
                  <p className="text-xs text-muted-foreground">Provide basic information to create the account</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name *</Label>
                    <Input
                      placeholder="Customer's full name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="rounded-xl h-12 text-sm font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">NID Number (Optional)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="National ID number"
                      value={nid}
                      onChange={e => setNid(e.target.value.replace(/\D/g, ""))}
                      className="rounded-xl h-12 text-sm font-medium"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCreateAccount}
                  disabled={!name.trim() || creatingAccount}
                  className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-sm font-bold shadow-glow gap-2"
                >
                  {creatingAccount ? (
                    <><Loader2 size={16} className="animate-spin" /> Creating Account...</>
                  ) : (
                    <><UserPlus size={16} /> Create & Start KYC</>
                  )}
                </Button>
              </Card>
            </motion.div>
          )}

          {/* ─── Step 4: KYC Flow ─── */}
          {currentStep === "kyc" && (
            <motion.div
              key="kyc"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <KycFlow
                onClose={handleKycComplete}
                agentMode={true}
                targetUserId={newUserId || undefined}
              />
            </motion.div>
          )}

          {/* ─── Step 5: Success ─── */}
          {currentStep === "success" && (
            <motion.div
              key="success"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
            >
              <Card className="p-6 border-0 shadow-elevated rounded-[19px] text-center space-y-5 bg-card/80 backdrop-blur-sm">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-20 h-20 rounded-3xl gradient-primary flex items-center justify-center mx-auto shadow-glow"
                >
                  <CheckCircle2 size={40} className="text-primary-foreground" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">Registration Complete!</h2>
                  <p className="text-sm text-muted-foreground">Customer has been successfully onboarded</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2 text-left"
                >
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-semibold text-foreground">{name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-semibold text-foreground">+88{phone}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">KYC Status</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/15 text-accent">SUBMITTED</span>
                  </div>
                </motion.div>

                <div className="space-y-2.5">
                  <Button
                    onClick={() => {
                      setCurrentStep("phone");
                      setPhone(""); setName(""); setNid(""); setOtpValue(""); setDevOtp(""); setNewUserId(null);
                    }}
                    className="w-full gradient-primary text-primary-foreground rounded-xl h-12 text-sm font-bold shadow-glow gap-2"
                  >
                    <UserPlus size={16} /> Register Another
                  </Button>
                  <Button
                    onClick={() => navigate("/agent")}
                    variant="outline"
                    className="w-full rounded-xl h-12 text-sm font-bold gap-2"
                  >
                    <Home size={16} /> Back to Dashboard
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AgentRegister;
