import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import {
  useDeviceOtpVerification,
  getStoredDeviceToken,
  clearDeviceToken,
} from "@/hooks/use-device-otp-verification";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import DeviceOtpStep from "@/components/DeviceOtpStep";
import MerchantForgotPinSheet, { maskBdPhone } from "@/components/merchant/MerchantForgotPinSheet";
import {
  Store,
  ShieldCheck,
  Lock,
  Phone,
  Sparkles,
  Loader2,
  ArrowRight,
  ShoppingBag,
  Wallet,
  QrCode,
  BarChart3,
  AlertTriangle,
  UserCog,
  HelpCircle,
  X,
} from "lucide-react";

const LS_LOCKED_UNTIL = "mfs_merchant_login_locked_until";

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = useMemo(() => {
    const raw = searchParams.get("redirect");
    if (raw && raw.startsWith("/merchant") && !raw.startsWith("/merchant-login")) {
      return raw;
    }
    return "/merchant";
  }, [searchParams]);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loginMode, setLoginMode] = useState<"owner" | "manager">("owner");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [wrongPin, setWrongPin] = useState(false);
  const [boundPhone, setBoundPhone] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const tickerRef = useRef<number | null>(null);

  // Device-bound OTP flow
  type Step = "signin" | "otp";
  const [step, setStep] = useState<Step>("signin");
  const pendingSessionRef = useRef<{
    access_token: string;
    refresh_token: string;
    cleanedPhone: string;
  } | null>(null);
  const otp = useDeviceOtpVerification("merchant");

  // Restore device-bound phone + persisted lockout
  useEffect(() => {
    const bound = typeof window !== "undefined" ? localStorage.getItem("mfs_device_phone") : null;
    if (bound) {
      const cleaned = bound.replace(/^88/, "").replace(/\D/g, "");
      if (/^01[3-9]\d{8}$/.test(cleaned)) {
        setBoundPhone(cleaned);
        setPhone(cleaned);
      }
    }
    try {
      const raw = localStorage.getItem(LS_LOCKED_UNTIL);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (Number.isFinite(ts) && ts > Date.now()) {
          setLockedUntil(ts);
        } else {
          localStorage.removeItem(LS_LOCKED_UNTIL);
        }
      }
    } catch {}
  }, []);

  // Cross-tab sync: react to lockout set/clear in any other tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_LOCKED_UNTIL) return;
      if (!e.newValue) {
        setLockedUntil(null);
        return;
      }
      const ts = parseInt(e.newValue, 10);
      if (Number.isFinite(ts) && ts > Date.now()) {
        setLockedUntil(ts);
      } else {
        setLockedUntil(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Live countdown ticker while locked
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        setLockedUntil(null);
        setAttemptsRemaining(null);
        try {
          localStorage.removeItem(LS_LOCKED_UNTIL);
        } catch {}
      }
    };
    tick();
    tickerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && now < lockedUntil;
  const remainingSeconds = isLocked ? Math.max(0, Math.ceil((lockedUntil! - now) / 1000)) : 0;

  // Read freshest lock from storage (in case ticker hasn't fired yet)
  const readPersistedLock = (): number | null => {
    try {
      const raw = localStorage.getItem(LS_LOCKED_UNTIL);
      if (!raw) return null;
      const ts = parseInt(raw, 10);
      return Number.isFinite(ts) && ts > Date.now() ? ts : null;
    } catch {
      return null;
    }
  };

  const applyLockout = (retryAfterSeconds: number) => {
    const ts = Date.now() + Math.max(1, retryAfterSeconds) * 1000;
    setLockedUntil(ts);
    setAttemptsRemaining(0);
    try {
      localStorage.setItem(LS_LOCKED_UNTIL, String(ts));
    } catch {}
  };

  const clearLockout = () => {
    setLockedUntil(null);
    setAttemptsRemaining(null);
    try {
      localStorage.removeItem(LS_LOCKED_UNTIL);
    } catch {}
  };

  /**
   * Calls the merchant-login edge function. The server gates session creation
   * on a valid device trust token OR a single-use OTP ticket.
   *
   * Returns one of:
   *  - { kind: "session", body }   → session tokens issued, ready to confirm
   *  - { kind: "otp_required" }    → device not trusted, OTP must be verified
   *  - { kind: "locked", retry }   → account temporarily locked
   *  - { kind: "error", message }  → other terminal failure
   */
  const callMerchantLogin = async (
    cleanedPhone: string,
    pinValue: string,
    extras: { device_token?: string; otp_ticket?: string },
  ): Promise<
    | { kind: "session"; body: any }
    | { kind: "otp_required" }
    | { kind: "locked"; retry: number; message?: string }
    | { kind: "wrong_credentials"; attempts_remaining: number | null; message?: string }
    | { kind: "error"; message: string }
  > => {
    const device_fp = await getDeviceFingerprint();
    const { data, error } = await supabase.functions.invoke("merchant-login", {
      body: {
        phone: cleanedPhone,
        pin: pinValue,
        device_fp,
        mode: loginMode,
        ...extras,
      },
    });

    const ctx: any = (error as any)?.context;
    let body: any = data ?? ctx?.body ?? null;
    if (!body && ctx?.json) { try { body = await ctx.json(); } catch {} }
    if (!body && ctx?.text) {
      try { body = JSON.parse(await ctx.text()); } catch {}
    }
    const status: number | undefined = ctx?.status;
    const headerRetry = (() => {
      try {
        const h = ctx?.headers?.get?.("retry-after");
        const n = h ? parseInt(h, 10) : NaN;
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch { return null; }
    })();

    if (body?.locked || status === 429) {
      return {
        kind: "locked",
        retry: body?.retry_after_seconds ?? headerRetry ?? 900,
        message: body?.message,
      };
    }
    if (body?.ok === true && body?.requires_device_verification) {
      return { kind: "otp_required" };
    }
    if (body?.ok === true && body?.session) {
      return { kind: "session", body };
    }
    if (body?.ok === false) {
      return {
        kind: "wrong_credentials",
        attempts_remaining: typeof body.attempts_remaining === "number" ? body.attempts_remaining : null,
        message: body.message,
      };
    }
    return { kind: "error", message: error?.message || "Sign-in failed" };
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isLocked) return;

    const persisted = readPersistedLock();
    if (persisted) { setLockedUntil(persisted); return; }

    const cleanedPhone = phone.replace(/\D/g, "").replace(/^88/, "");
    if (!/^01[3-9]\d{8}$/.test(cleanedPhone)) {
      toast.error("Enter a valid 11-digit Bangladeshi mobile number");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Enter your 4-digit PIN");
      return;
    }

    setLoading(true);
    try {
      const stored = getStoredDeviceToken(cleanedPhone, "merchant");
      const result = await callMerchantLogin(cleanedPhone, pin, {
        device_token: stored ?? undefined,
      });

      if (result.kind === "locked") {
        applyLockout(result.retry);
        setPin("");
        toast.error(result.message || "Too many failed attempts. Please wait.");
        return;
      }
      if (result.kind === "wrong_credentials") {
        if (result.attempts_remaining != null) setAttemptsRemaining(result.attempts_remaining);
        setWrongPin(true);
        const msg = result.attempts_remaining != null && result.message === "Wrong phone or PIN"
          ? `Incorrect PIN — ${result.attempts_remaining} attempt${result.attempts_remaining === 1 ? "" : "s"} left`
          : result.message || "Incorrect PIN";
        toast.error(msg);
        setPin("");
        return;
      }
      if (result.kind === "error") {
        toast.error(result.message);
        return;
      }

      clearLockout();

      if (result.kind === "session") {
        // Returning trusted device — server already validated the device token.
        // Persist any rotated trust token (if server reissued one).
        if (result.body.device_token && result.body.device_token_expires_at) {
          otp.saveTrustToken(cleanedPhone, result.body.device_token, result.body.device_token_expires_at);
        }
        await finalizeSession({
          access_token: result.body.session.access_token,
          refresh_token: result.body.session.refresh_token,
          cleanedPhone,
        });
        return;
      }

      // result.kind === "otp_required"
      // The stored token (if any) was rejected by the server. Drop it.
      clearDeviceToken(cleanedPhone, "merchant");
      try {
        await otp.sendOtp(cleanedPhone);
        // Stash the phone for the OTP step retry.
        pendingSessionRef.current = {
          access_token: "",
          refresh_token: "",
          cleanedPhone,
        };
        setStep("otp");
      } catch (sendErr: any) {
        toast.error(sendErr?.message || "Couldn't send verification code");
      }
    } catch (err: any) {
      toast.error(err?.message || "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    const cleanedPhone = pendingSessionRef.current?.cleanedPhone;
    if (!cleanedPhone) {
      toast.error("Session expired. Please sign in again.");
      setStep("signin");
      return;
    }
    const ticket = await otp.verifyOtp(cleanedPhone, code);
    if (!ticket) return;

    // Re-call merchant-login with the OTP ticket so the server can mint a session
    // + a fresh device trust token.
    const result = await callMerchantLogin(cleanedPhone, pin, { otp_ticket: ticket });
    if (result.kind !== "session") {
      const msg = (result as any).message || "Verification didn't unlock the session.";
      toast.error(msg);
      return;
    }

    if (result.body.device_token && result.body.device_token_expires_at) {
      otp.saveTrustToken(cleanedPhone, result.body.device_token, result.body.device_token_expires_at);
    }
    await finalizeSession({
      access_token: result.body.session.access_token,
      refresh_token: result.body.session.refresh_token,
      cleanedPhone,
    });
  };

  const handleResendOtp = async () => {
    const phoneForVerify = pendingSessionRef.current?.cleanedPhone;
    if (!phoneForVerify) return;
    try {
      await otp.sendOtp(phoneForVerify);
      toast.success("New code sent");
    } catch {}
  };

  const finalizeSession = async (pending: {
    access_token: string;
    refresh_token: string;
    cleanedPhone: string;
  }) => {
    try {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: pending.access_token,
        refresh_token: pending.refresh_token,
      });
      if (setErr) throw setErr;

      try {
        localStorage.setItem("mfs_device_phone", pending.cleanedPhone);
        localStorage.setItem("mfs_has_authenticated", "1");
      } catch {}

      pendingSessionRef.current = null;
      toast.success("Welcome back, merchant!");
      navigate(redirectTarget, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Failed to start session");
    }
  };

  const handleCancelOtp = () => {
    pendingSessionRef.current = null;
    otp.reset();
    setPin("");
    setStep("signin");
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{
        background:
          "linear-gradient(150deg, hsl(24 90% 50%) 0%, hsl(16 82% 40%) 40%, hsl(350 65% 35%) 100%)",
      }}
    >
      {/* Warm bokeh blobs matching dashboard header */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(36 95% 60%) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(350 65% 45%) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(0 0% 100% / 0.15) 0%, transparent 70%)" }}
      />

      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-3">
        <div
          className="w-full max-w-md animate-fade-in"
          style={{ animationDuration: "500ms" }}
        >
          {/* Logo + eyebrow */}
          <div className="mb-3 flex flex-col items-center text-center animate-scale-in">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/15 bg-white/10 shadow-[0_10px_40px_-10px_rgba(251,146,60,0.7)] backdrop-blur-2xl">
              <Store className="h-6 w-6 text-amber-200" strokeWidth={1.8} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-amber-300/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-100">
              <Sparkles className="h-3 w-3" />
              {loginMode === "manager" ? "Store Manager" : "Merchant Portal"}
            </span>
            <h1 className="mt-2 text-xl font-semibold leading-tight tracking-tight">
              {loginMode === "manager" ? "Manager sign-in" : "Welcome back"}
            </h1>
            <p className="mt-1 text-[12px] text-white/60">
              {loginMode === "manager"
                ? "Access the store you manage."
                : "Manage your store, orders, payouts and QR."}
            </p>
          </div>

          {step === "otp" && (
            <DeviceOtpStep
              phone={pendingSessionRef.current?.cleanedPhone || ""}
              portalLabel={loginMode === "manager" ? "Manager" : "Merchant"}
              resendIn={otp.resendIn}
              loading={otp.status === "verifying" || otp.status === "sending"}
              error={otp.error}
              devOtp={otp.devOtp}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onCancel={handleCancelOtp}
            />
          )}

          {step === "signin" && (
          /* Glass card */
          <form
            onSubmit={handleSignIn}
            aria-disabled={isLocked}
            className="rounded-[19px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            <fieldset disabled={isLocked} className="m-0 border-0 p-0 disabled:opacity-100">
            {/* Lockout banner */}
            {isLocked && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Account temporarily locked
                  </p>
                  <p className="text-[13px] leading-snug text-rose-100/85">
                    Too many failed sign-in attempts. Try again in{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCountdown(remainingSeconds)}
                    </span>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Incorrect PIN alert (highest priority when not locked) */}
            {!isLocked && wrongPin && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3 text-rose-100 animate-shake"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Incorrect PIN
                  </p>
                  <p className="text-[13px] leading-snug text-rose-100/85">
                    {attemptsRemaining != null
                      ? `${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining before this account is temporarily locked.`
                      : "Please double-check your PIN and try again."}
                  </p>
                </div>
              </div>
            )}

            {/* Attempts warning (low remaining, no recent wrong-PIN event) */}
            {!isLocked &&
              !wrongPin &&
              attemptsRemaining !== null &&
              attemptsRemaining > 0 &&
              attemptsRemaining <= 3 && (
                <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p className="text-[13px] leading-snug">
                    {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
                    before this account is temporarily locked.
                  </p>
                </div>
              )}

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="merchant-phone" className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                Mobile number
              </Label>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1 transition-colors focus-within:border-amber-200/50 focus-within:bg-white/[0.06]">
                <div className="flex items-center gap-1.5 border-r border-white/10 pr-2.5 text-sm text-white/70">
                  <Phone className="h-4 w-4 text-amber-200" />
                  <span className="font-medium">+880</span>
                </div>
                <Input
                  id="merchant-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="1XXXXXXXXX"
                  value={phone}
                  disabled={isLocked}
                  onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); if (wrongPin) setWrongPin(false); }}
                  className="h-9 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
                />
              </div>
            </div>

            {/* PIN — auto-masked, no show/hide toggle */}
            <div className="mt-3 space-y-1.5">
              <Label className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                4-digit PIN
              </Label>
              <div className={`rounded-2xl border p-2 transition-colors focus-within:border-amber-200/50 ${wrongPin ? "border-rose-400/50 bg-rose-500/5" : "border-white/10 bg-white/[0.04]"}`}>
                <InputOTP
                  maxLength={4}
                  value={pin}
                  onChange={(v) => { setPin(v); if (wrongPin) setWrongPin(false); }}
                  disabled={isLocked}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        mask
                        className={`h-11 w-11 rounded-xl text-lg font-semibold text-white ${wrongPin ? "border-rose-400/60 bg-rose-500/10" : "border-white/15 bg-white/[0.06]"}`}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || isLocked}
              className="mt-3 h-11 w-full rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-rose-600 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.7)] transition-transform hover:scale-[1.01] hover:from-orange-400 hover:via-rose-400 hover:to-rose-500 disabled:opacity-70"
            >
              {isLocked ? (
                <>
                  <Lock className="h-4 w-4" />
                  Locked — try again in {formatCountdown(remainingSeconds)}
                </>
              ) : loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  {loginMode === "manager" ? "Sign in as Manager" : "Sign in to dashboard"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Trust pills */}
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                { icon: Lock, label: "Secure PIN" },
                { icon: ShieldCheck, label: "Encrypted" },
                { icon: Sparkles, label: "Bank-grade" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[10px] font-medium text-white/70"
                >
                  <Icon className="h-3 w-3 text-amber-200" />
                  {label}
                </div>
              ))}
            </div>

            {/* Perks strip */}
            <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.03] to-white/[0.06] px-3 py-1.5">
              {[
                { icon: ShoppingBag, label: "Orders" },
                { icon: Wallet, label: "Payouts" },
                { icon: QrCode, label: "QR" },
                { icon: BarChart3, label: "Insights" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-0.5 text-white/70">
                  <Icon className="h-3.5 w-3.5 text-amber-200" />
                  <span className="text-[9px] font-medium uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
            </fieldset>
          </form>
          )}

          {/* Footer: apply button + manager toggle */}
          <div className="mt-3 flex flex-col items-center gap-2 text-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigate("/");
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent("open-feature", { detail: "merchant-apply" }));
                }, 50);
              }}
              className="h-10 w-full rounded-2xl border-white/20 bg-white/[0.06] text-sm font-medium text-amber-100 hover:bg-white/[0.12] hover:text-amber-50"
            >
              New here? Apply as a merchant
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => navigate("/merchant-manager-login")}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/60 transition-colors hover:text-amber-100"
            >
              <UserCog className="h-3 w-3" />
              Manage a store as staff? Manager login
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
