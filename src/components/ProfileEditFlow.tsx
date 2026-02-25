import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Camera, CheckCircle2, AlertCircle, User, Mail, Pencil, Send, ShieldCheck, MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import SupportChat from "@/components/SupportChat";
import { haptics } from "@/lib/haptics";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Storage keys ─────────────────────────────────────────────────────────────
const NAME_KEY   = "mfs_display_name";
const PHOTO_KEY  = "mfs_display_photo";  // base64

export const getDisplayName  = () => localStorage.getItem(NAME_KEY) ?? "Tanvir Hasan";
export const getDisplayPhoto = () => localStorage.getItem(PHOTO_KEY) ?? "";
export const setDisplayName  = (v: string) => localStorage.setItem(NAME_KEY, v);
export const setDisplayPhoto = (v: string) => localStorage.setItem(PHOTO_KEY, v);

// ─── Validation ───────────────────────────────────────────────────────────────
const validateName = (n: string) => {
  if (!n.trim()) return "Display name is required.";
  if (n.trim().length < 2) return "Name must be at least 2 characters.";
  if (n.trim().length > 40) return "Name must be under 40 characters.";
  if (!/^[\p{L}\s'-]+$/u.test(n.trim())) return "Name can only contain letters, spaces, hyphens and apostrophes.";
  return "";
};

const validateEmail = (e: string) => {
  if (!e.trim()) return ""; // optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) return "Please enter a valid email address.";
  if (e.trim().length > 255) return "Email must be under 255 characters.";
  return "";
};

// ─── Avatar display ───────────────────────────────────────────────────────────
const AvatarDisplay = ({
  photo, name, size = 80,
}: { photo: string; name: string; size?: number }) => (
  photo ? (
    <img
      src={photo}
      alt="Profile"
      style={{ width: size, height: size }}
      className="rounded-3xl object-cover"
    />
  ) : (
    <div
      style={{ width: size, height: size }}
      className="gradient-hero rounded-3xl flex items-center justify-center text-white font-black text-3xl"
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </div>
  )
);

// ─── Main ─────────────────────────────────────────────────────────────────────
interface ProfileEditFlowProps {
  onClose: () => void;
  onSaved?: () => void;
}

const ProfileEditFlow = ({ onClose, onSaved }: ProfileEditFlowProps) => {
  const [name, setName]           = useState(getDisplayName());
  const [photo, setPhoto]         = useState(getDisplayPhoto());
  const [nameError, setNameError] = useState("");
  const [email, setEmail]         = useState("");
  const [emailError, setEmailError]     = useState("");
  const [savedEmail, setSavedEmail]     = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent]     = useState(false);
  const [otp, setOtp]             = useState("");
  const [otpError, setOtpError]   = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown]   = useState(0);
  const [saved, setSaved]         = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [userId, setUserId]       = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing email from profile
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", session.user.id)
        .single();
      if (data?.email) {
        setEmail(data.email);
        setSavedEmail(data.email);
        setEmailVerified(true);
      }
    };
    load();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhoto(e.target?.result as string);
      haptics.light();
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePhotoFile(file);
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (nameError) setNameError(validateName(v));
  };

  const handleSendOtp = async () => {
    const trimmed = email.trim();
    const emailErr = validateEmail(trimmed);
    if (emailErr || !trimmed) { setEmailError(emailErr || "Email is required."); haptics.error(); return; }

    setSendingOtp(true);
    setEmailError("");
    setOtpError("");
    try {
      const { data, error } = await supabase.functions.invoke("send-email-otp", {
        body: { email: trimmed, action: "send" },
      });
      if (error) throw error;
      if (data?.error) { setEmailError(data.error); haptics.error(); return; }
      setOtpSent(true);
      setOtpCooldown(60);
      haptics.light();
      // DEV: show OTP in toast for testing
      if (data?.dev_otp) {
        toast.info(`Dev OTP: ${data.dev_otp}`, { duration: 15000 });
      }
      toast.success("OTP sent to your email");
    } catch {
      toast.error("Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { setOtpError("Enter the 6-digit OTP"); haptics.error(); return; }
    setVerifyingOtp(true);
    setOtpError("");
    try {
      const { data, error } = await supabase.functions.invoke("send-email-otp", {
        body: { email: email.trim(), action: "verify", code: otp },
      });
      if (error) throw error;
      if (data?.error) { setOtpError(data.error); haptics.error(); return; }
      if (data?.verified) {
        setEmailVerified(true);
        haptics.success();
        toast.success("Email verified!");
      }
    } catch {
      toast.error("Verification failed");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (emailError) setEmailError("");
    // If email changed from saved, reset verification
    if (v.trim() !== (savedEmail ?? "")) {
      setEmailVerified(false);
      setOtpSent(false);
      setOtp("");
      setOtpError("");
    } else {
      setEmailVerified(true); // back to saved email = already verified
    }
  };

  const handleSave = async () => {
    const nameErr = validateName(name);
    if (nameErr) { setNameError(nameErr); haptics.error(); return; }

    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      const emailErr = validateEmail(trimmedEmail);
      if (emailErr) { setEmailError(emailErr); haptics.error(); return; }
      // Must verify if email changed
      if (trimmedEmail !== (savedEmail ?? "") && !emailVerified) {
        setEmailError("Please verify your email with OTP first.");
        haptics.error();
        return;
      }
    }

    setSaving(true);
    setDisplayName(name.trim());
    setDisplayPhoto(photo);

    if (trimmedEmail !== (savedEmail ?? "")) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase
          .from("profiles")
          .update({ email: trimmedEmail || null } as any)
          .eq("user_id", session.user.id);
        if (error) {
          toast.error("Failed to save email");
          setSaving(false);
          return;
        }
      }
    }

    setSaving(false);
    haptics.success();
    setSaved(true);
    setTimeout(() => {
      onSaved?.();
      onClose();
    }, 1200);
  };

  const emailChanged = email.trim() !== (savedEmail ?? "");
  const hasChanges = name !== getDisplayName() || photo !== getDisplayPhoto() || (emailChanged && emailVerified);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      <motion.div
        className="gradient-primary px-4 pt-3 pb-3 text-primary-foreground"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight">Edit Profile</h1>
            <p className="text-xs text-white/70 mt-0.5">Update your display name & photo</p>
          </div>
        </div>
      </motion.div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center gap-5 pt-16 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="w-20 h-20 gradient-addmoney rounded-3xl flex items-center justify-center text-primary-foreground shadow-glow"
              >
                <CheckCircle2 size={40} strokeWidth={1.5} />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Profile Updated!</h2>
                <p className="text-sm text-muted-foreground mt-1">Your changes have been saved.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {/* Photo section */}
              <div className="flex flex-col items-center gap-4">
                <div
                  className={`relative cursor-pointer group transition-all duration-200 ${isDragging ? "scale-105" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <div className={`rounded-3xl overflow-hidden shadow-elevated transition-all duration-200 ring-2 ${isDragging ? "ring-primary ring-offset-2" : "ring-border/40"}`}>
                    <AvatarDisplay photo={photo} name={name} size={96} />
                  </div>
                  {/* Overlay */}
                  <div className="absolute inset-0 rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={22} className="text-white" />
                  </div>
                  {/* Camera badge */}
                  <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 gradient-primary rounded-full flex items-center justify-center border-2 border-background shadow-card">
                    <Pencil size={13} className="text-primary-foreground" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Profile Photo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tap to upload · JPEG / PNG · max 5 MB</p>
                </div>

                {photo && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setPhoto("")}
                    className="text-xs text-destructive font-semibold py-1 px-3 rounded-full border border-destructive/30 hover:bg-destructive/8 transition-colors"
                  >
                    Remove photo
                  </motion.button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); }}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* Name field */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground px-1 flex items-center gap-1.5">
                  <User size={11} /> Display Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    maxLength={40}
                    placeholder="Your full name"
                    className={`w-full h-14 px-4 pr-14 text-base font-semibold bg-card border-2 rounded-2xl focus:outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground/40 ${
                      nameError ? "border-destructive" : "border-border focus:border-primary focus:shadow-glow"
                    }`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 tabular-nums">
                    {name.length}/40
                  </span>
                </div>
                <AnimatePresence>
                  {nameError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-destructive flex items-center gap-1.5 px-1"
                    >
                      <AlertCircle size={12} /> {nameError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Email Address */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground px-1 flex items-center gap-1.5">
                  <Mail size={11} /> Email Address
                </label>

                {/* Warning: email cannot be changed after saving */}
                {!savedEmail && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5"
                  >
                    <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      <span className="font-bold">Important:</span> Once your email is verified and saved, it cannot be changed or removed without contacting support.
                    </p>
                  </motion.div>
                )}

                {savedEmail && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 bg-muted/60 border border-border rounded-xl px-3 py-2.5"
                  >
                    <AlertCircle size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Your email is locked. To change it, please contact support.
                      </p>
                      <button
                        onClick={() => setShowSupport(true)}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
                      >
                        <MessageCircle size={12} /> Open Live Chat
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    maxLength={255}
                    placeholder="your@email.com"
                    disabled={!!savedEmail}
                    className={`w-full h-14 px-4 pr-24 text-base font-semibold bg-card border-2 rounded-2xl focus:outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground/40 disabled:opacity-60 disabled:cursor-not-allowed ${
                      emailError ? "border-destructive" : emailVerified && email.trim() ? "border-primary/50" : "border-border focus:border-primary focus:shadow-glow"
                    }`}
                  />
                  {email.trim() && emailVerified && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      <ShieldCheck size={11} /> Verified
                    </span>
                  )}
                  {email.trim() && !emailVerified && !otpSent && (
                    <button
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-bold text-primary-foreground gradient-primary px-3 py-1.5 rounded-xl disabled:opacity-50 transition-opacity"
                    >
                      <Send size={11} /> {sendingOtp ? "Sending…" : "Send OTP"}
                    </button>
                  )}
                </div>

                {/* OTP input */}
                <AnimatePresence>
                  {otpSent && !emailVerified && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 pt-1"
                    >
                      <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground px-1 flex items-center gap-1.5">
                        <ShieldCheck size={11} /> Enter OTP
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otp}
                          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); if (otpError) setOtpError(""); }}
                          maxLength={6}
                          placeholder="6-digit code"
                          className={`flex-1 h-14 px-4 text-center text-lg font-bold tracking-[0.3em] bg-card border-2 rounded-2xl focus:outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground/40 placeholder:tracking-normal ${
                            otpError ? "border-destructive" : "border-border focus:border-primary focus:shadow-glow"
                          }`}
                        />
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handleVerifyOtp}
                          disabled={otp.length !== 6 || verifyingOtp}
                          className="h-14 px-5 gradient-primary text-primary-foreground font-bold text-sm rounded-2xl shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={15} />
                          {verifyingOtp ? "…" : "Verify"}
                        </motion.button>
                      </div>
                      {otpError && (
                        <p className="text-xs text-destructive flex items-center gap-1.5 px-1">
                          <AlertCircle size={12} /> {otpError}
                        </p>
                      )}
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[11px] text-muted-foreground">
                          Check your email for the verification code
                        </p>
                        <button
                          onClick={handleSendOtp}
                          disabled={otpCooldown > 0 || sendingOtp}
                          className="text-[11px] font-semibold text-primary disabled:text-muted-foreground transition-colors"
                        >
                          {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : "Resend OTP"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {emailError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs text-destructive flex items-center gap-1.5 px-1"
                    >
                      <AlertCircle size={12} /> {emailError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Save button */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="w-full h-14 gradient-primary text-primary-foreground font-bold text-[15px] rounded-2xl shadow-glow flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                <CheckCircle2 size={17} />
                Save Changes
              </motion.button>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Support Chat Sheet */}
      <Sheet open={showSupport} onOpenChange={setShowSupport}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-5 pb-3">
            <SheetTitle className="text-base">Support — Email Change Request</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {userId ? (
              <SupportChat userId={userId} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Please sign in to contact support.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProfileEditFlow;
