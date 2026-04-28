import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeviceVerifiedConfirmProps {
  phone: string;
  portalLabel: string;
  loading?: boolean;
  onContinue: () => void;
}

function maskPhone(p: string) {
  if (!p || p.length < 4) return p;
  return `••• ${p.slice(-4)}`;
}

export default function DeviceVerifiedConfirm({
  phone,
  portalLabel,
  loading = false,
  onContinue,
}: DeviceVerifiedConfirmProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-[19px] border border-emerald-300/20 bg-white/[0.04] p-7 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: "spring", stiffness: 320, damping: 22 }}
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[19px] border border-emerald-300/40 bg-emerald-400/15 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.7)]"
      >
        <CheckCircle2 className="h-8 w-8 text-emerald-300" strokeWidth={1.8} />
      </motion.div>

      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-emerald-200">
        Device verified
      </span>

      <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
        You're all set
      </h2>
      <p className="mt-1.5 text-[13px] leading-snug text-white/60">
        This device is now trusted for the {portalLabel.toLowerCase()} portal on{" "}
        <span className="font-semibold text-white/85">{maskPhone(phone)}</span>.
        We won't ask for a code again on this device.
      </p>

      <Button
        type="button"
        onClick={onContinue}
        disabled={loading}
        className="mt-6 h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)] transition-transform hover:scale-[1.01] hover:from-emerald-400 hover:to-teal-400 disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening dashboard...
          </>
        ) : (
          <>
            Continue to dashboard
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </motion.div>
  );
}
