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
  Eye,
  EyeOff,
  AlertTriangle,
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
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
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
    if (bound) setPhone(bound.replace(/^88/, ""));

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
        const msg = result.attempts_remaining != null && result.message === "Wrong phone or PIN"
          ? `Wrong phone or PIN — ${result.attempts_remaining} attempt${result.attempts_remaining === 1 ? "" : "s"} left`
          : result.message || "Sign-in failed";
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
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Top hero band — matches dashboard gradient-hero header */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[340px] gradient-hero"
      />
      {/* Soft ambient orbs over the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-20 h-[320px] w-[320px] rounded-full bg-white/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-16 h-[280px] w-[280px] rounded-full bg-white/5 blur-[110px]"
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-md animate-fade-in"
          style={{ animationDuration: "500ms" }}
        >
          {/* Logo + eyebrow (sits on the gradient-hero band — keep light text here) */}
          <div className="mb-6 flex flex-col items-center text-center animate-scale-in">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[19px] border border-white/20 bg-white/15 shadow-float backdrop-blur-2xl">
              <Store className="h-8 w-8 text-white" strokeWidth={1.8} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              Merchant Portal
            </span>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
              Welcome back
            </h1>
            <p className="mt-1.5 max-w-xs text-sm text-white/75">
              Sign in to manage your store, orders, payouts and QR.
            </p>
          </div>

          {step === "otp" && (
            <DeviceOtpStep
              phone={pendingSessionRef.current?.cleanedPhone || ""}
              portalLabel="Merchant"
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
          /* Card on background */
          <form
            onSubmit={handleSignIn}
            aria-disabled={isLocked}
            className="rounded-[19px] border border-border bg-card p-6 shadow-elevated sm:p-7"
          >
            <fieldset disabled={isLocked} className="m-0 border-0 p-0 disabled:opacity-100">
            {/* Lockout banner */}
            {isLocked && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-destructive"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wider">
                    Account temporarily locked
                  </p>
                  <p className="text-[13px] leading-snug">
                    Too many failed sign-in attempts. Try again in{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCountdown(remainingSeconds)}
                    </span>
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Attempts warning (when not locked but some attempts used) */}
            {!isLocked &&
              attemptsRemaining !== null &&
              attemptsRemaining > 0 &&
              attemptsRemaining <= 3 && (
                <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-accent/30 bg-accent/10 p-3 text-accent-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-[13px] leading-snug text-foreground">
                    {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
                    before this account is temporarily locked.
                  </p>
                </div>
              )}

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="merchant-phone" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Mobile number
              </Label>
              <div className="flex items-center gap-2 rounded-2xl border border-input bg-background px-3 py-1.5 transition-colors focus-within:border-primary focus-within:shadow-glow">
                <div className="flex items-center gap-1.5 border-r border-border pr-3 text-sm text-foreground/80">
                  <Phone className="h-4 w-4 text-primary" />
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
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="h-10 border-0 bg-transparent px-0 text-base text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
                />
              </div>
            </div>

            {/* PIN */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  4-digit PIN
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPin ? "Hide" : "Show"}
                </button>
              </div>
              <div className="rounded-2xl border border-input bg-background p-3 transition-colors focus-within:border-primary focus-within:shadow-glow">
                <InputOTP
                  maxLength={4}
                  value={pin}
                  onChange={setPin}
                  disabled={isLocked}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-12 w-12 rounded-xl border-input bg-card text-lg font-semibold text-foreground"
                        // mask via CSS when hidden
                        style={
                          !showPin && pin[i]
                            ? { color: "transparent", textShadow: "0 0 0 hsl(var(--foreground))", caretColor: "transparent" }
                            : undefined
                        }
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
              className="mt-6 h-12 w-full rounded-2xl gradient-hero text-base font-semibold text-white shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-70"
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
                  Sign in to dashboard
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Trust pills */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { icon: Lock, label: "Secure PIN" },
                { icon: ShieldCheck, label: "Encrypted" },
                { icon: Sparkles, label: "Bank-grade" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-1.5 text-[10.5px] font-medium text-muted-foreground"
                >
                  <Icon className="h-3 w-3 text-primary" />
                  {label}
                </div>
              ))}
            </div>

            {/* Perks strip */}
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
              {[
                { icon: ShoppingBag, label: "Orders" },
                { icon: Wallet, label: "Payouts" },
                { icon: QrCode, label: "QR" },
                { icon: BarChart3, label: "Insights" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
            </fieldset>
          </form>
          )}

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={() => navigate("/merchant")}
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              New here? Apply as a merchant
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="hover:text-foreground"
              >
                Customer login
              </button>
              <span className="h-3 w-px bg-border" />
              <button
                type="button"
                onClick={() => navigate("/team-login")}
                className="hover:text-foreground"
              >
                Staff login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
