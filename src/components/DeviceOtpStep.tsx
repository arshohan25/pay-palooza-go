import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useI18n } from "@/lib/i18n";

interface DeviceOtpStepProps {
  phone: string;
  portalLabel: string;
  resendIn: number;
  loading?: boolean;
  error?: string | null;
  devOtp?: string | null;
  onVerify: (code: string) => void | Promise<void>;
  onResend: () => void | Promise<void>;
  onCancel?: () => void;
}

function maskPhone(p: string) {
  if (!p || p.length < 4) return p;
  return `••• ${p.slice(-4)}`;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function DeviceOtpStep({
  phone,
  portalLabel,
  resendIn,
  loading = false,
  error,
  devOtp,
  onVerify,
  onResend,
  onCancel,
}: DeviceOtpStepProps) {
  const { t } = useI18n();
  const [code, setCode] = useState("");

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && !loading) {
      void onVerify(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Clear on error so user can retype
  useEffect(() => {
    if (error) setCode("");
  }, [error]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[19px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-7"
    >
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[19px] border border-emerald-300/30 bg-emerald-400/10 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.6)]">
          <ShieldCheck className="h-7 w-7 text-emerald-300" strokeWidth={1.8} />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-emerald-200">
          {portalLabel} · device verification
        </span>
        <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
          Verify this device
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug text-white/60">
          We sent a 6-digit code to <span className="font-semibold text-white/85">{maskPhone(phone)}</span>.
          You'll only need to do this once on this device.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          disabled={loading}
          containerClassName="justify-center"
          autoFocus
        >
          <InputOTPGroup className="gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className="h-12 w-10 rounded-xl border-white/15 bg-white/[0.06] text-lg font-semibold text-white"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 text-center text-[12.5px] font-medium text-rose-300"
        >
          {error}
        </p>
      )}

      {devOtp && (
        <p className="mt-3 text-center text-[11px] uppercase tracking-wider text-amber-200/70">
          Dev OTP: <span className="font-mono font-semibold text-amber-200">{devOtp}</span>
        </p>
      )}

      <Button
        type="button"
        disabled={loading || code.length !== 6}
        onClick={() => void onVerify(code)}
        className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)] transition-transform hover:scale-[1.01] hover:from-emerald-400 hover:to-teal-400 disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            Verify code
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-white/60">
        <button
          type="button"
          onClick={() => void onResend()}
          disabled={resendIn > 0 || loading}
          className="inline-flex items-center gap-1.5 font-medium text-emerald-300 transition-opacity hover:text-emerald-200 disabled:cursor-not-allowed disabled:text-white/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {resendIn > 0 ? `Resend in ${fmt(resendIn)}` : "Resend code"}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="font-medium text-white/60 hover:text-white/85"
          >
            Cancel
          </button>
        )}
      </div>
    </motion.div>
  );
}
