import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Loader2,
  LifeBuoy,
  Phone,
  Send,
  Clock,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  MessageCircle,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

interface MerchantForgotPinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string;
  source?: "merchant-login" | "merchant-manager-login";
  accent?: "amber" | "sky";
}

export function maskBdPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "").replace(/^88/, "");
  if (clean.length !== 11) return phone;
  return `${clean.slice(0, 3)}•••••${clean.slice(8)}`;
}

const RESEND_SECONDS = 60;
type Step = "request" | "verify" | "handoff";

export default function MerchantForgotPinSheet({
  open,
  onOpenChange,
  defaultPhone = "",
  source = "merchant-login",
  accent = "amber",
}: MerchantForgotPinSheetProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("request");
  const [phone, setPhone] = useState(defaultPhone);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [ticket, setTicket] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const tickerRef = useRef<number | null>(null);

  // Reset everything whenever the sheet opens
  useEffect(() => {
    if (open) {
      setStep("request");
      setPhone(defaultPhone);
      setNote("");
      setCode("");
      setOtpError(null);
      setDevOtp(null);
      setResendIn(0);
      setTicket(null);
      setRequestId(null);
    }
  }, [open, defaultPhone]);

  // Resend countdown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    tickerRef.current = window.setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
    };
  }, [resendIn]);

  const accentRing = accent === "sky" ? "focus-within:border-sky-200/50" : "focus-within:border-amber-200/50";
  const accentIcon = accent === "sky" ? "text-sky-200" : "text-amber-200";
  const accentBtn =
    accent === "sky"
      ? "bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 hover:from-sky-400 hover:via-indigo-400 hover:to-violet-500 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.7)]"
      : "bg-gradient-to-r from-orange-500 via-rose-500 to-rose-600 hover:from-orange-400 hover:via-rose-400 hover:to-rose-500 shadow-[0_10px_30px_-10px_rgba(244,63,94,0.7)]";
  const accentRingHex = accent === "sky" ? "ring-sky-200/40" : "ring-amber-200/40";

  const cleanedPhone = phone.replace(/\D/g, "").replace(/^88/, "");
  const phoneValid = /^01[3-9]\d{8}$/.test(cleanedPhone);

  // ── Step 1: Send OTP ─────────────────────────────────────────────
  const sendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phoneValid) {
      toast.error(t("mfpErrInvalidPhone"));
      return;
    }
    setLoading(true);
    setOtpError(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone: cleanedPhone, purpose: "merchant_pin_reset" },
      });
      if (error) throw error;
      const payload: any = data;
      if (payload?.error) throw new Error(payload.error);
      if (payload?.dev_otp) setDevOtp(String(payload.dev_otp));
      setResendIn(RESEND_SECONDS);
      setCode("");
      setStep("verify");
      toast.success(t("mfpToastCodeSent").replace("{phone}", maskBdPhone(cleanedPhone)));
    } catch (err: any) {
      toast.error(err?.message || t("mfpErrSendCode"));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ───────────────────────────────────────────
  const verifyOtp = async (codeValue: string) => {
    setLoading(true);
    setOtpError(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone: cleanedPhone, code: codeValue, purpose: "merchant_pin_reset" },
      });
      if (error) throw error;
      const payload: any = data;
      if (!payload?.verified) {
        setOtpError(payload?.error || t("mfpErrIncorrect"));
        setCode("");
        return;
      }
      const ticketValue: string | null = payload?.otp_ticket ?? null;
      if (!ticketValue) {
        setOtpError(t("mfpErrVerifyFailedNew"));
        setCode("");
        return;
      }

      // Fire the request-creation in the BACKGROUND so we can navigate immediately.
      // The chat screen waits for the resolved request_id via window event below.
      const forgotPromise = supabase.functions
        .invoke("merchant-forgot-pin", {
          body: {
            phone: cleanedPhone,
            note: note.trim(),
            source,
            otp_ticket: ticketValue,
          },
        })
        .then(({ data: forgotData }: any) => {
          const newRequestId: string | null = forgotData?.request_id ?? null;
          if (newRequestId) {
            // Stash for late-mounting chat listeners (race: event may fire before mount).
            try { (window as any).__pinResetResolvedId = newRequestId; } catch { /* noop */ }
            window.dispatchEvent(
              new CustomEvent("pin-reset-request-resolved", { detail: { requestId: newRequestId } }),
            );
          }
          return newRequestId;
        })
        .catch(() => null);

      // Navigate instantly — chat sheet renders skeletons + welcome while request_id resolves.
      onOpenChange(false);
      const masked = encodeURIComponent(maskBdPhone(cleanedPhone));
      navigate(
        `/merchant-support?ticket=pending&t=${encodeURIComponent(ticketValue)}&masked=${masked}`,
      );
      // Keep the promise alive
      void forgotPromise;
    } catch (err: any) {
      setOtpError(err?.message || t("mfpErrVerifyFailed"));
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (step === "verify" && code.length === 6 && !loading) {
      void verifyOtp(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  // ── Step 3: Handoff to live chat ─────────────────────────────────
  const goToLiveSupport = () => {
    if (!ticket || !requestId) {
      toast.error(t("mfpErrExpired"));
      setStep("request");
      return;
    }
    onOpenChange(false);
    const masked = encodeURIComponent(maskBdPhone(cleanedPhone));
    navigate(
      `/merchant-support?ticket=${encodeURIComponent(requestId)}&t=${encodeURIComponent(ticket)}&masked=${masked}`,
    );
  };

  const fmtCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[28px] border-white/10 bg-gradient-to-b from-[#1a1424] via-[#221728] to-[#1a1424] text-white p-0 max-h-[92vh] overflow-y-auto [&>button]:text-white/70"
      >
        <div className="px-5 pt-5 pb-6">
          <SheetHeader className="space-y-2 text-left">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] ${accentIcon}`}>
              {step === "handoff" ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <LifeBuoy className="h-5 w-5" />}
            </div>
            <SheetTitle className="text-lg font-semibold text-white">
              {step === "request" && t("mfpTitleRequest")}
              {step === "verify" && t("mfpTitleVerify")}
              {step === "handoff" && t("mfpTitleHandoff")}
            </SheetTitle>
            <SheetDescription className="text-[13px] leading-snug text-white/60">
              {step === "request" && t("mfpDescRequest")}
              {step === "verify" && (
                <>{t("mfpDescVerifyPrefix")}<span className="text-white/85 font-medium">+88 {maskBdPhone(cleanedPhone)}</span>{t("mfpDescVerifySuffix")}</>
              )}
              {step === "handoff" && t("mfpDescHandoff")}
            </SheetDescription>
          </SheetHeader>

          {/* Step indicator */}
          <div className="mt-4 flex items-center gap-1.5">
            {(["request", "verify", "handoff"] as Step[]).map((s, i) => {
              const active = step === s;
              const done =
                (step === "verify" && s === "request") ||
                (step === "handoff" && s !== "handoff");
              return (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    done ? "bg-emerald-400/70" : active ? (accent === "sky" ? "bg-sky-300" : "bg-amber-300") : "bg-white/10"
                  }`}
                />
              );
            })}
          </div>

          {/* ── Step 1: Request code ─────────────────────────── */}
          {step === "request" && (
            <form onSubmit={sendOtp} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-phone" className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                  {t("mfpRegisteredMobile")}
                </Label>
                <div className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1 transition-colors ${accentRing}`}>
                  <div className="flex items-center gap-1.5 border-r border-white/10 pr-2.5 text-sm text-white/70">
                    <Phone className={`h-4 w-4 ${accentIcon}`} />
                    <span className="font-medium">+88</span>
                  </div>
                  <Input
                    id="forgot-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="h-9 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                {phone.length === 11 && (
                  <p className="text-[11px] text-white/50">
                    {t("mfpCodeWillBeSent")}<span className="text-white/80 font-medium">+88 {maskBdPhone(phone)}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="forgot-note" className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                  {t("mfpAnythingWeKnowLabel")} <span className="text-white/40 normal-case">{t("mfpOptional")}</span>
                </Label>
                <Textarea
                  id="forgot-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  placeholder={t("mfpNotePlaceholder")}
                  className="min-h-[72px] rounded-2xl border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus-visible:ring-amber-200/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70">
                  <Clock className={`h-3.5 w-3.5 ${accentIcon}`} />
                  {t("mfpResponseTime")}
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70">
                  <ShieldCheck className={`h-3.5 w-3.5 ${accentIcon}`} />
                  {t("mfpOtpProtected")}
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !phoneValid}
                className={`h-11 w-full rounded-2xl text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-70 ${accentBtn}`}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t("mfpSendingCode")}</>
                ) : (
                  <><Send className="h-4 w-4" /> {t("mfpSendCode")}</>
                )}
              </Button>

              <p className="text-center text-[11px] text-white/45">
                {t("mfpDisclaimer")}
              </p>
            </form>
          )}

          {/* ── Step 2: Verify OTP ───────────────────────────── */}
          {step === "verify" && (
            <div className="mt-5 space-y-4">
              <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-3 ring-1 ${accentRingHex}`}>
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(v) => { setCode(v); if (otpError) setOtpError(null); }}
                  disabled={loading}
                  containerClassName="justify-center"
                  autoFocus
                >
                  <InputOTPGroup className="gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className={`h-12 w-10 rounded-xl border-white/15 bg-white/[0.06] text-lg font-semibold text-white ${otpError ? "border-rose-400/60 bg-rose-500/10" : ""}`}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {otpError && (
                <p role="alert" className="text-center text-[12.5px] font-medium text-rose-300">{otpError}</p>
              )}
              {devOtp && (
                <p className="text-center text-[11px] uppercase tracking-wider text-amber-200/70">
                  {t("mfpDevOtp")} <span className="font-mono font-semibold text-amber-200">{devOtp}</span>
                </p>
              )}

              <div className="flex items-center justify-between text-[12.5px] text-white/60">
                <button
                  type="button"
                  onClick={() => void sendOtp()}
                  disabled={resendIn > 0 || loading}
                  className={`inline-flex items-center gap-1.5 font-medium transition-opacity disabled:cursor-not-allowed disabled:text-white/40 ${accent === "sky" ? "text-sky-300 hover:text-sky-200" : "text-amber-300 hover:text-amber-200"}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {resendIn > 0 ? t("mfpResendIn").replace("{time}", fmtCountdown(resendIn)) : t("mfpResendCode")}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("request"); setCode(""); setOtpError(null); }}
                  disabled={loading}
                  className="font-medium text-white/60 hover:text-white/85"
                >
                  {t("mfpChangeNumber")}
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 text-[12px] text-white/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying…
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Live-support handoff ─────────────────── */}
          {step === "handoff" && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-col items-center rounded-2xl border border-emerald-300/30 bg-emerald-400/[0.06] p-5 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/15 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.6)]">
                  <KeyRound className="h-6 w-6 text-emerald-200" />
                </div>
                <p className="text-[13px] text-emerald-100/85">
                  +88 <span className="font-semibold text-white">{maskBdPhone(cleanedPhone)}</span> verified
                </p>
                <p className="mt-1 text-[12px] text-white/55">
                  Continue to live support to set your new PIN safely with our team.
                </p>
              </div>

              <Button
                type="button"
                onClick={goToLiveSupport}
                className={`h-11 w-full rounded-2xl text-sm font-semibold text-white transition-transform hover:scale-[1.01] ${accentBtn}`}
              >
                <MessageCircle className="h-4 w-4" />
                Open live support to finish reset
                <ArrowRight className="h-4 w-4" />
              </Button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="block w-full text-center text-[12px] font-medium text-white/55 hover:text-white/80"
              >
                I'll wait for a callback instead
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
