import { normalizeBDPhoneInput } from "@/lib/phoneInput";
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
import { useI18n } from "@/lib/i18n";

const AGENT_LAST_PHONE_KEY = "easypay_agent_last_phone";

/**
 * Dedicated Agent login screen — agent-specific copy, phone + 4-digit PIN,
 * with device OTP verification for first-time login on a new device.
 */
const AgentLoginPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
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
    toast.success(t("alpSignedIn"));
    navigate(APP_ROLE_HOME.agent, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (phoneVal.triggerShake()) {
      setError(phoneVal.errorMessage || t("alpErrInvalidPhone"));
      haptics.error();
      return;
    }
    if (pin.length !== 4) {
      setError(t("alpErrPinRequired"));
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
          throw new Error(t("alpErrTempExpired"));
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
      let msg = t("alpErrGeneric");
      if (/Failed to fetch|NetworkError|network|ECONN/i.test(raw) || !navigator.onLine) {
        msg = t("alpErrOffline");
      } else if (/Invalid login credentials/i.test(raw)) {
        msg = t("alpErrIncorrect");
      } else if (/temporary PIN has expired/i.test(raw) || raw === t("alpErrTempExpired")) {
        msg = raw;
      } else if (/rate|too many/i.test(raw)) {
        msg = t("alpErrRate");
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
      if (!token || !expires_at) throw new Error(t("alpTrustFail"));
      otp.saveTrustToken(phone, token, expires_at);
      finishLogin();
    } catch (err: any) {
      const raw = err?.message || String(err ?? "");
      let msg = t("alpVerifyFail");
      if (/Failed to fetch|NetworkError|network/i.test(raw) || !navigator.onLine) {
        msg = t("alpVerifyNetwork");
      } else if (/expired/i.test(raw)) {
        msg = t("alpVerifyExpired");
      } else if (/invalid|incorrect|mismatch/i.test(raw)) {
        msg = t("alpVerifyIncorrect");
      } else if (/too many|rate/i.test(raw)) {
        msg = t("alpVerifyRate");
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

      <div className="flex-1 px-5 pt-6 pb-6">
        <AnimatePresence mode="wait" initial={false}>
        {otpMode ? (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {otp.status === "sending" && !otp.devOtp ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-[19px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-2xl space-y-4"
              >
                <div className="mx-auto h-14 w-14 rounded-2xl bg-white/5 animate-pulse" />
                <div className="mx-auto h-3 w-40 rounded bg-white/10 animate-pulse" />
                <div className="mx-auto h-5 w-56 rounded bg-white/10 animate-pulse" />
                <div className="flex justify-center gap-2 pt-2">
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} className="h-12 w-10 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
                <div className="h-12 w-full rounded-2xl bg-white/5 animate-pulse" />
                <p className="text-center text-[12px] text-white/60 flex items-center justify-center gap-2">
                  <Loader2 size={13} className="animate-spin" />
                  Sending verification code…
                </p>
              </div>
            ) : (
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
            )}
            {finalizing && (
              <p className="mt-3 text-center text-[12px] text-white/70 flex items-center justify-center gap-2">
                <Loader2 size={13} className="animate-spin" />
                Trusting this device…
              </p>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="login"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onSubmit={handleSubmit}
            className="bg-[#111d1a] border border-white/10 rounded-[22px] p-6 space-y-5 shadow-2xl"
          >
            <fieldset disabled={submitting} className="space-y-5 disabled:opacity-70">
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
                    setPhone(normalizeBDPhoneInput(e.target.value));
                  }}
                  className={`w-full h-12 px-3 rounded-xl bg-black/30 border text-white text-base tracking-[0.3em] text-center placeholder:text-white/30 placeholder:tracking-wider focus:outline-none transition-colors disabled:cursor-not-allowed ${
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
                  className="w-full h-12 pl-10 pr-3 rounded-xl bg-black/30 border border-white/10 text-white text-2xl text-center tracking-[0.8rem] focus:outline-none focus:border-orange-400 disabled:cursor-not-allowed"
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
              disabled={submitting || phone.length !== 11 || pin.length !== 4 || phoneVal.showError}
              aria-busy={submitting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
                className="text-orange-400 font-semibold hover:underline disabled:opacity-50"
              >
                Forgot PIN?
              </button>
              <span className="text-white/40">Agents only</span>
            </div>
            </fieldset>
          </motion.form>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AgentLoginPage;
