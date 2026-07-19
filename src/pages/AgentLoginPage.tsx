import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Smartphone, Lock, ShieldCheck, ArrowRight, Loader2, AlertCircle, WifiOff } from "lucide-react";
import { signIn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  APP_ROLE_HOME,
  APP_ROLE_LABEL,
  isRoleAllowedForApp,
} from "@/lib/appRole";
import { haptics } from "@/lib/haptics";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import { useDeviceOtpVerification } from "@/hooks/use-device-otp-verification";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import DeviceOtpStep from "@/components/DeviceOtpStep";

const AGENT_LAST_PHONE_KEY = "easypay_agent_last_phone";

/**
 * Dedicated Agent login screen — agent-specific copy, phone + 4-digit PIN,
 * with device OTP verification for first-time login on a new device.
 */
const AgentLoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading } = useUserRoles();

  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(AGENT_LAST_PHONE_KEY) || "";
  });
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const phoneVal = usePhoneValidation(phone);
  const otp = useDeviceOtpVerification("agent");

  // Auto-redirect an already-signed-in agent to the agent home.
  useEffect(() => {
    if (authLoading || rolesLoading || !isAuthenticated) return;
    if (otpMode) return; // block redirect while awaiting device OTP
    if (isRoleAllowedForApp("agent", roles as string[])) {
      navigate(APP_ROLE_HOME.agent, { replace: true });
    }
  }, [isAuthenticated, authLoading, rolesLoading, roles, navigate, otpMode]);

  const finishLogin = () => {
    localStorage.setItem(AGENT_LAST_PHONE_KEY, phone);
    localStorage.setItem("mfs_has_authenticated", "1");
    haptics.success();
    toast.success("Signed in");
    navigate(APP_ROLE_HOME.agent, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (phoneVal.triggerShake()) {
      setError(phoneVal.errorMessage || "Enter a valid 11-digit agent mobile number starting with 01.");
      haptics.error();
      return;
    }
    if (pin.length !== 4) {
      setError("Please enter your 4-digit PIN.");
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      await signIn(phone, pin);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        const { data: statusRows } = await (supabase as any).rpc("agent_temp_pin_status", { _agent_user_id: uid });
        const st = Array.isArray(statusRows) ? statusRows[0] : statusRows;
        if (st?.state === "expired") {
          await supabase.auth.signOut();
          throw new Error("Your temporary PIN has expired. Please ask your admin to resend a new one.");
        }
      }

      // Device trust gate: if this device is not yet trusted, require OTP.
      const trusted = await otp.checkTrusted(phone);
      if (trusted) {
        finishLogin();
        return;
      }
      setOtpMode(true);
      await otp.sendOtp(phone);
    } catch (err) {
      haptics.error();
      const raw = err instanceof Error ? err.message : String(err ?? "");
      let msg = "Unable to sign in right now. Please try again.";
      if (/Failed to fetch|NetworkError|network|ECONN/i.test(raw) || !navigator.onLine) {
        msg = "You appear to be offline. Check your connection and try again.";
      } else if (/Invalid login credentials/i.test(raw)) {
        msg = "Incorrect phone number or PIN.";
      } else if (/temporary PIN has expired/i.test(raw)) {
        msg = raw;
      } else if (/rate|too many/i.test(raw)) {
        msg = "Too many attempts. Please wait a moment and try again.";
      } else if (raw) {
        msg = raw;
      }
      setError(msg);
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (code: string) => {
    setFinalizing(true);
    try {
      const ticket = await otp.verifyOtp(phone, code);
      if (!ticket) return;
      const device_fp = await getDeviceFingerprint();
      const { data, error: mintErr } = await supabase.functions.invoke("mint-device-trust-token", {
        body: { phone, device_fp, portal: "agent", otp_ticket: ticket },
      });
      if (mintErr) throw mintErr;
      const token = (data as any)?.device_token;
      const expires_at = (data as any)?.device_token_expires_at;
      if (!token || !expires_at) throw new Error("Could not trust this device. Please try again.");
      otp.saveTrustToken(phone, token, expires_at);
      finishLogin();
    } catch (err: any) {
      const raw = err?.message || String(err ?? "");
      let msg = "Verification failed. Please try again.";
      if (/Failed to fetch|NetworkError|network/i.test(raw) || !navigator.onLine) {
        msg = "Network error. Please check your connection and retry.";
      } else if (/expired/i.test(raw)) {
        msg = "This code has expired. Tap Resend to get a new one.";
      } else if (/invalid|incorrect|mismatch/i.test(raw)) {
        msg = "Incorrect code. Please double-check and try again.";
      } else if (/too many|rate/i.test(raw)) {
        msg = "Too many attempts. Please wait before retrying.";
      } else if (raw) {
        msg = raw;
      }
      toast.error(msg);
    } finally {
      setFinalizing(false);
    }
  };

  const handleCancelOtp = async () => {
    setOtpMode(false);
    otp.reset();
    setPin("");
    try { await supabase.auth.signOut(); } catch {}
  };

  const title = `${APP_ROLE_LABEL.agent} — Sign in`;

  return (
    <div className="min-h-screen bg-[#0b1512] text-white flex flex-col">
      <Helmet>
        <title>{title}</title>
        <meta
          name="description"
          content="EasyPay Agent sign-in — cash-in, cash-out, bill pay and customer onboarding."
        />
        <link rel="icon" href="/icons/role-agent.png" />
        <link rel="apple-touch-icon" href="/icons/role-agent.png" />
      </Helmet>

      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 px-6 pt-8 pb-8 text-center rounded-b-[28px]">
        <div className="absolute inset-0 opacity-20 pointer-events-none [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-2 shadow-lg">
            <ShieldCheck size={26} />
          </div>
          <p className="text-[10px] uppercase tracking-[0.25em] opacity-80">EasyPay</p>
          <h1 className="text-xl font-extrabold mt-0.5">EasyPay Agent Portal</h1>
          <p className="text-xs opacity-90 mt-1 max-w-[280px] mx-auto">
            {otpMode
              ? "Verify this device to keep your agent account secure."
              : "Sign in to serve customers — cash-in, cash-out & bill pay."}
          </p>
        </div>
      </header>

      <div className="flex-1 px-5 pt-5">
        {otpMode ? (
          <DeviceOtpStep
            phone={phone}
            portalLabel="Agent"
            resendIn={otp.resendIn}
            loading={otp.status === "verifying" || otp.status === "sending" || finalizing}
            error={otp.error}
            devOtp={otp.devOtp}
            onVerify={handleVerify}
            onResend={() => otp.sendOtp(phone)}
            onCancel={handleCancelOtp}
          />
        ) : (
          <motion.form
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.35 }}
            onSubmit={handleSubmit}
            className="bg-[#111d1a] border border-white/10 rounded-[22px] p-5 space-y-4 shadow-2xl"
          >
            <div className="space-y-1">
              <label htmlFor="agent-phone" className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Agent mobile number
              </label>
              <div className="relative">
                <input
                  id="agent-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                  maxLength={11}
                  value={phone}
                  aria-invalid={phoneVal.showError}
                  aria-describedby={phoneVal.showError ? "agent-phone-err" : undefined}
                  onBlur={() => phoneVal.setTouched(true)}
                  onChange={(e) => {
                    setError(null);
                    setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 11));
                  }}
                  className={`w-full h-12 px-3 rounded-xl bg-black/30 border text-white text-base tracking-[0.3em] text-center placeholder:text-white/30 placeholder:tracking-wider focus:outline-none transition-colors ${
                    phoneVal.showError
                      ? "border-red-500/70 focus:border-red-400"
                      : "border-white/10 focus:border-orange-400"
                  } ${phoneVal.shakeClass}`}
                />
                <Smartphone
                  size={18}
                  className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
                    phoneVal.showError ? "text-red-400" : "text-orange-400"
                  }`}
                />
              </div>
              {phoneVal.showError && (
                <p id="agent-phone-err" role="alert" className="flex items-center gap-1.5 text-[11.5px] text-red-400 mt-1">
                  <AlertCircle size={12} />
                  {phoneVal.errorMessage}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="agent-pin" className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                4-digit PIN
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400"
                />
                <input
                  id="agent-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    setError(null);
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (v.length > pin.length) haptics.light();
                    setPin(v);
                  }}
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-black/30 border border-white/10 text-white text-2xl text-center tracking-[0.8rem] focus:outline-none focus:border-orange-400"
                  placeholder="••••"
                />
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
              >
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => navigate("/forgot-pin")}
                className="text-orange-400 font-semibold hover:underline"
              >
                Forgot PIN?
              </button>
              <span className="text-white/40">Agents only</span>
            </div>
          </motion.form>
        )}
      </div>
    </div>
  );
};

export default AgentLoginPage;
