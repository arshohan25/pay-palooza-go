import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Camera, CheckCircle2, AlertCircle, User, Mail, Pencil } from "lucide-react";
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
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailError, setEmailError]     = useState("");
  const [savedEmail, setSavedEmail]     = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing email from profile
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", session.user.id)
        .single();
      if (data?.email) {
        setEmail(data.email);
        setConfirmEmail(data.email);
        setSavedEmail(data.email);
      }
    };
    load();
  }, []);

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

  const handleSave = async () => {
    const nameErr = validateName(name);
    if (nameErr) { setNameError(nameErr); haptics.error(); return; }

    // Validate email
    const trimmedEmail = email.trim();
    if (trimmedEmail) {
      const emailErr = validateEmail(trimmedEmail);
      if (emailErr) { setEmailError(emailErr); haptics.error(); return; }
      if (trimmedEmail !== confirmEmail.trim()) {
        setEmailError("Email addresses do not match.");
        haptics.error();
        return;
      }
    }

    setSaving(true);
    setDisplayName(name.trim());
    setDisplayPhoto(photo);

    // Save email to database if changed
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
  const hasChanges = name !== getDisplayName() || photo !== getDisplayPhoto() || emailChanged;

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
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                  maxLength={255}
                  placeholder="your@email.com"
                  className={`w-full h-14 px-4 text-base font-semibold bg-card border-2 rounded-2xl focus:outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground/40 ${
                    emailError ? "border-destructive" : "border-border focus:border-primary focus:shadow-glow"
                  }`}
                />
                {email.trim() && (
                  <div className="pt-1">
                    <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground px-1 flex items-center gap-1.5 mb-2">
                      <Mail size={11} /> Confirm Email
                    </label>
                    <input
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => { setConfirmEmail(e.target.value); if (emailError) setEmailError(""); }}
                      maxLength={255}
                      placeholder="Re-enter your email"
                      className={`w-full h-14 px-4 text-base font-semibold bg-card border-2 rounded-2xl focus:outline-none transition-all placeholder:font-normal placeholder:text-muted-foreground/40 ${
                        emailError ? "border-destructive" : "border-border focus:border-primary focus:shadow-glow"
                      }`}
                    />
                  </div>
                )}
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
                <p className="text-[11px] text-muted-foreground px-1">
                  Enter your email twice to confirm. This prevents typos.
                </p>
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
    </div>
  );
};

export default ProfileEditFlow;
