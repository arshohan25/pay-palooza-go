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
import {
  UserCog,
  ShieldCheck,
  Lock,
  Phone,
  Sparkles,
  Loader2,
  ArrowRight,
  Info,
  AlertTriangle,
  Store,
} from "lucide-react";

const LS_LOCKED_UNTIL = "mfs_merchant_login_locked_until";

function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MerchantManagerLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = useMemo(() => {
    const raw = searchParams.get("redirect");
    if (raw && raw.startsWith("/merchant") && !raw.startsWith("/merchant-login") && !raw.startsWith("/merchant-manager-login")) {
      return raw;
    }
    return "/merchant";
  }, [searchParams]);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [wrongPin, setWrongPin] = useState(false);
  const tickerRef = useRef<number | null>(null);

  type Step = "signin" | "otp";
  const [step, setStep] = useState<Step>("signin");
  const pendingSessionRef = useRef<{ cleanedPhone: string } | null>(null);
  const otp = useDeviceOtpVerification("merchant");

  // Restore lockout — but DO NOT prefill device-bound owner phone (managers use their own).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_LOCKED_UNTIL);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (Number.isFinite(ts) && ts > Date.now()) setLockedUntil(ts);
        else localStorage.removeItem(LS_LOCKED_UNTIL);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_LOCKED_UNTIL) return;
      if (!e.newValue) return setLockedUntil(null);
      const ts = parseInt(e.newValue, 10);
      setLockedUntil(Number.isFinite(ts) && ts > Date.now() ? ts : null);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        setLockedUntil(null);
        setAttemptsRemaining(null);
        try { localStorage.removeItem(LS_LOCKED_UNTIL); } catch {}
      }
    };
    tick();
    tickerRef.current = window.setInterval(tick, 1000);
    return () => { if (tickerRef.current) window.clearInterval(tickerRef.current); };
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && now < lockedUntil;
  const remainingSeconds = isLocked ? Math.max(0, Math.ceil((lockedUntil! - now) / 1000)) : 0;

  const readPersistedLock = (): number | null => {
    try {
      const raw = localStorage.getItem(LS_LOCKED_UNTIL);
      if (!raw) return null;
      const ts = parseInt(raw, 10);
      return Number.isFinite(ts) && ts > Date.now() ? ts : null;
    } catch { return null; }
  };

  const applyLockout = (retryAfterSeconds: number) => {
    const ts = Date.now() + Math.max(1, retryAfterSeconds) * 1000;
    setLockedUntil(ts);
    setAttemptsRemaining(0);
    try { localStorage.setItem(LS_LOCKED_UNTIL, String(ts)); } catch {}
  };

  const clearLockout = () => {
    setLockedUntil(null);
    setAttemptsRemaining(null);
    try { localStorage.removeItem(LS_LOCKED_UNTIL); } catch {}
  };

  const callMerchantLogin = async (
    cleanedPhone: string,
    pinValue: string,
    extras: { device_token?: string; otp_ticket?: string },
  ): Promise<
    | { kind: "session"; body: any }
    | { kind: "otp_required" }
    | { kind: "locked"; retry: number; message?: string }
    | { kind: "wrong_credentials"; attempts_remaining: number | null; message?: string }
    | { kind: "not_manager"; message: string }
    | { kind: "error"; message: string }
  > => {
    const device_fp = await getDeviceFingerprint();
    const { data, error } = await supabase.functions.invoke("merchant-login", {
      body: { phone: cleanedPhone, pin: pinValue, device_fp, mode: "manager", ...extras },
    });

    const ctx: any = (error as any)?.context;
    let body: any = data ?? ctx?.body ?? null;
    if (!body && ctx?.json) { try { body = await ctx.json(); } catch {} }
    if (!body && ctx?.text) { try { body = JSON.parse(await ctx.text()); } catch {} }
    const status: number | undefined = ctx?.status;
    const headerRetry = (() => {
      try {
        const h = ctx?.headers?.get?.("retry-after");
        const n = h ? parseInt(h, 10) : NaN;
        return Number.isFinite(n) && n > 0 ? n : null;
      } catch { return null; }
    })();

    if (body?.locked || status === 429) {
      return { kind: "locked", retry: body?.retry_after_seconds ?? headerRetry ?? 900, message: body?.message };
    }
    if (body?.ok === true && body?.requires_device_verification) return { kind: "otp_required" };
    if (body?.ok === true && body?.session) return { kind: "session", body };
    if (body?.ok === false && status === 403) {
      return { kind: "not_manager", message: body?.message || "This account isn't an active store manager" };
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
      toast.error("Enter your own 11-digit Bangladeshi mobile number");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Enter your 4-digit PIN");
      return;
    }

    setLoading(true);
    try {
      const stored = getStoredDeviceToken(cleanedPhone, "merchant");
      const result = await callMerchantLogin(cleanedPhone, pin, { device_token: stored ?? undefined });

      if (result.kind === "locked") {
        applyLockout(result.retry);
        setPin("");
        toast.error(result.message || "Too many failed attempts. Please wait.");
        return;
      }
      if (result.kind === "not_manager") {
        toast.error(result.message, {
          description: "Ask the store owner to add your number as a Manager from Staff settings.",
        });
        setPin("");
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
      if (result.kind === "error") { toast.error(result.message); return; }

      clearLockout();

      if (result.kind === "session") {
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

      // otp_required
      clearDeviceToken(cleanedPhone, "merchant");
      try {
        await otp.sendOtp(cleanedPhone);
        pendingSessionRef.current = { cleanedPhone };
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
    try { await otp.sendOtp(phoneForVerify); toast.success("New code sent"); } catch {}
  };

  const finalizeSession = async (pending: { access_token: string; refresh_token: string; cleanedPhone: string }) => {
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
      toast.success("Welcome back, Manager!");
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
          "linear-gradient(150deg, hsl(220 70% 28%) 0%, hsl(230 60% 22%) 45%, hsl(260 55% 25%) 100%)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(210 95% 60%) 0%, transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(circle, hsl(265 70% 50%) 0%, transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, hsl(0 0% 100% / 0.12) 0%, transparent 70%)" }} />

      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-3">
        <div className="w-full max-w-md animate-fade-in" style={{ animationDuration: "500ms" }}>
          {/* Header */}
          <div className="mb-3 flex flex-col items-center text-center animate-scale-in">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/15 bg-white/10 shadow-[0_10px_40px_-10px_rgba(99,102,241,0.7)] backdrop-blur-2xl">
              <UserCog className="h-6 w-6 text-sky-200" strokeWidth={1.8} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/30 bg-sky-300/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-100">
              <Sparkles className="h-3 w-3" />
              Store Manager Access
            </span>
            <h1 className="mt-2 text-xl font-semibold leading-tight tracking-tight">Manager sign-in</h1>
            <p className="mt-1 text-[12px] text-white/60">Access the store you've been added to.</p>
          </div>

          {step === "otp" && (
            <DeviceOtpStep
              phone={pendingSessionRef.current?.cleanedPhone || ""}
              portalLabel="Manager"
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
            <form
              onSubmit={handleSignIn}
              aria-disabled={isLocked}
              className="rounded-[19px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            >
              <fieldset disabled={isLocked} className="m-0 border-0 p-0 disabled:opacity-100">
                {/* Manager-specific explainer */}
                <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-sky-300/25 bg-sky-400/10 p-3 text-sky-50">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-100">
                      Use your own phone & PIN
                    </p>
                    <p className="text-[12px] leading-snug text-sky-50/85">
                      Sign in with the EasyPay account the store owner invited — not the owner's number. New here?{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/auth")}
                        className="font-semibold underline underline-offset-2 hover:text-white"
                      >
                        Sign up first
                      </button>
                      , then ask the owner to add you.
                    </p>
                  </div>
                </div>

                {isLocked && (
                  <div role="alert" aria-live="polite"
                    className="mb-3 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold uppercase tracking-wider">Account temporarily locked</p>
                      <p className="text-[13px] leading-snug text-rose-100/85">
                        Too many failed sign-in attempts. Try again in{" "}
                        <span className="font-semibold tabular-nums">{formatCountdown(remainingSeconds)}</span>.
                      </p>
                    </div>
                  </div>
                )}

                {!isLocked && attemptsRemaining !== null && attemptsRemaining > 0 && attemptsRemaining <= 3 && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <p className="text-[13px] leading-snug">
                      {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining before this account is temporarily locked.
                    </p>
                  </div>
                )}

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="manager-phone" className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                    Your mobile number
                  </Label>
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1 transition-colors focus-within:border-sky-200/50 focus-within:bg-white/[0.06]">
                    <div className="flex items-center gap-1.5 border-r border-white/10 pr-2.5 text-sm text-white/70">
                      <Phone className="h-4 w-4 text-sky-200" />
                      <span className="font-medium">+880</span>
                    </div>
                    <Input
                      id="manager-phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="1XXXXXXXXX"
                      value={phone}
                      disabled={isLocked}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      className="h-9 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
                    />
                  </div>
                </div>

                {/* PIN */}
                <div className="mt-3 space-y-1.5">
                  <Label className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                    Your 4-digit PIN
                  </Label>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 transition-colors focus-within:border-sky-200/50">
                    <InputOTP maxLength={4} value={pin} onChange={setPin} disabled={isLocked} containerClassName="justify-center">
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3].map((i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            mask
                            className="h-11 w-11 rounded-xl border-white/15 bg-white/[0.06] text-lg font-semibold text-white"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || isLocked}
                  className="mt-3 h-11 w-full rounded-2xl bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.7)] transition-transform hover:scale-[1.01] hover:from-sky-400 hover:via-indigo-400 hover:to-violet-500 disabled:opacity-70"
                >
                  {isLocked ? (
                    <><Lock className="h-4 w-4" />Locked — try again in {formatCountdown(remainingSeconds)}</>
                  ) : loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Signing in...</>
                  ) : (
                    <>Sign in as Manager<ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {[
                    { icon: Lock, label: "Secure PIN" },
                    { icon: ShieldCheck, label: "Encrypted" },
                    { icon: Sparkles, label: "Bank-grade" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label}
                      className="flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[10px] font-medium text-white/70"
                    >
                      <Icon className="h-3 w-3 text-sky-200" />
                      {label}
                    </div>
                  ))}
                </div>
              </fieldset>
            </form>
          )}

          {/* Footer cross-links */}
          <div className="mt-3 flex flex-col items-center gap-2 text-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/merchant-login")}
              className="h-10 w-full rounded-2xl border-white/20 bg-white/[0.06] text-sm font-medium text-sky-100 hover:bg-white/[0.12] hover:text-white"
            >
              <Store className="mr-1 h-4 w-4" />
              Are you the store owner? Owner login
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/60 transition-colors hover:text-sky-100"
            >
              Don't have an EasyPay account? Sign up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
