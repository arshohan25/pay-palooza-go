import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, KeyRound, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
const logoImg = "/icons/easypay-logo.webp";

const SESSION_KEY = "mfs_authenticated";
const getPhone = () => localStorage.getItem("mfs_device_phone") ?? "";

// ── Check WebAuthn platform authenticator availability ───────────────────────
async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// ── Trigger a WebAuthn "get" assertion (no real RP — used as a presence check) ──
async function triggerBiometric(): Promise<boolean> {
  try {
    // We use a dummy challenge; a real app would fetch this from the server
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 30000,
        userVerification: "required",
        // No allowCredentials → triggers platform authenticator selection
        rpId: window.location.hostname,
      },
    });
    return true;
  } catch (err: unknown) {
    // NotAllowedError = user cancelled or not enrolled; treat as failure
    if (err instanceof Error && err.name === "NotSupportedError") return false;
    // Any other error (NotAllowedError, etc.) = auth failed / cancelled
    return false;
  }
}

interface BiometricAuthProps {
  onAuthenticated: () => void;
}

type AuthStep = "prompt" | "pin" | "checking" | "success";

export default function BiometricAuth({ onAuthenticated }: BiometricAuthProps) {
  const { t } = useI18n();
  const [step, setStep]             = useState<AuthStep>("prompt");
  const [biometricAvail, setBioAvail] = useState<boolean | null>(null);
  const [pin, setPin]               = useState("");
  const [pinError, setPinError]     = useState("");
  const [bioError, setBioError]     = useState("");

  // Check availability once on mount
  useEffect(() => {
    isBiometricAvailable().then(setBioAvail);
  }, []);

  // ── Biometric attempt ─────────────────────────────────────────────────────
  const handleBiometric = async () => {
    setStep("checking");
    setBioError("");
    const ok = await triggerBiometric();
    if (ok) {
      setStep("success");
      setTimeout(onAuthenticated, 900);
    } else {
      setBioError(t("baBioFailed"));
      setStep("prompt");
    }
  };

  // ── PIN attempt ───────────────────────────────────────────────────────────
  const handlePinChange = async (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    setPinError("");
    if (digits.length === 4) {
      try {
        await signIn(getPhone(), digits);
        setStep("success");
        setTimeout(onAuthenticated, 900);
      } catch {
        setPinError(t("baIncorrectPin"));
        setTimeout(() => setPin(""), 400);
      }
    }
  };

  // ── Dots ──────────────────────────────────────────────────────────────────
  const PinDots = () => (
    <div className="flex justify-center gap-4 mb-2">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{
            scale: pin.length > i ? 1.2 : 1,
            backgroundColor: pinError
              ? "hsl(var(--destructive))"
              : pin.length > i
              ? "hsl(var(--primary))"
              : "transparent",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"
        />
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center mb-10"
        >
          <img src={logoImg} alt="EasyPay" className="w-16 h-16 rounded-3xl object-contain shadow-glow mb-4" />
           <h1 className="text-2xl font-extrabold text-foreground">EasyPay</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("baSecureAccount")}</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── Prompt step ── */}
          {(step === "prompt" || step === "checking") && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-4"
            >
              {bioError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                  <AlertCircle size={15} />
                  {bioError}
                </div>
              )}

              {biometricAvail && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleBiometric}
                  disabled={step === "checking"}
                  className="w-full flex flex-col items-center gap-3 p-6 rounded-3xl bg-card border border-border shadow-elevated hover:shadow-float transition-all disabled:opacity-60"
                >
                  <motion.div
                    animate={step === "checking" ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.2 }}
                    className="w-20 h-20 gradient-primary rounded-full flex items-center justify-center shadow-glow"
                  >
                    <Fingerprint size={40} className="text-primary-foreground" />
                  </motion.div>
                  <div className="text-center">
                    <p className="font-bold text-foreground text-base">
                      {step === "checking" ? t("baVerifying") : t("baUseBio")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("baTouchSensor")}</p>
                  </div>
                </motion.button>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">
                  {biometricAvail ? t("baOr") : t("baAuthWith")}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <Button
                onClick={() => setStep("pin")}
                variant="outline"
                className="w-full h-12 rounded-2xl font-semibold gap-2"
              >
                <KeyRound size={16} />
                Use PIN
              </Button>
            </motion.div>
          )}

          {/* ── PIN step ── */}
          {step === "pin" && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              className="space-y-6"
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={26} className="text-primary" />
                </div>
                <p className="font-bold text-foreground text-lg">Enter your PIN</p>
                <p className="text-xs text-muted-foreground mt-1">Demo PIN is <strong>1234</strong></p>
              </div>

              <PinDots />

              {pinError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive flex items-center justify-center gap-1"
                >
                  <AlertCircle size={12} /> {pinError}
                </motion.p>
              )}

              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                autoFocus
                className="w-full h-14 text-center text-3xl font-bold tracking-[1.2rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors"
                placeholder="••••"
              />

              {biometricAvail && (
                <button
                  onClick={() => { setStep("prompt"); setPin(""); setPinError(""); }}
                  className="w-full text-sm text-primary font-semibold text-center"
                >
                  Use biometrics instead
                </button>
              )}
            </motion.div>
          )}

          {/* ── Success step ── */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-24 h-24 gradient-addmoney rounded-full flex items-center justify-center shadow-glow"
              >
                <ShieldCheck size={48} className="text-white" />
              </motion.div>
              <p className="text-xl font-extrabold text-foreground">Authenticated!</p>
              <p className="text-sm text-muted-foreground">Opening your wallet…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer hint */}
        {step !== "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-1.5 mt-8 text-[11px] text-muted-foreground"
          >
            <CheckCircle2 size={11} className="text-primary" />
            Protected by end-to-end encryption
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
