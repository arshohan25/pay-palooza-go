import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Copy, CheckCheck, Gift, Users, Star,
  CheckCircle2, Clock, XCircle, Share2, Loader2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { useReferrals } from "@/hooks/use-referrals";
import { Skeleton } from "@/components/ui/skeleton";

const REWARD_PER_FRIEND = 50;

const StatusBadge = ({ status, t }: { status: string; t: (key: string) => string }) => {
  const map: Record<string, { icon: typeof CheckCircle2; label: string; cls: string }> = {
    completed: { icon: CheckCircle2, label: t("completed"), cls: "text-primary bg-primary/10" },
    active:    { icon: Clock,        label: t("active"),    cls: "text-accent bg-accent/10"   },
    pending:   { icon: Clock,        label: t("pending"),   cls: "text-muted-foreground bg-muted" },
    failed:    { icon: XCircle,      label: t("failed"),    cls: "text-destructive bg-destructive/10" },
  };
  const { icon: Icon, label, cls } = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <Icon size={10} />
      {label}
    </span>
  );
};

const MilestoneStep = ({ done, label, reward }: { done: boolean; label: string; reward: string }) => (
  <div className={`flex items-center gap-2 text-xs ${done ? "text-primary" : "text-muted-foreground"}`}>
    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-primary text-primary-foreground" : "bg-muted border border-border"}`}>
      {done ? <CheckCircle2 size={12} /> : <Clock size={10} />}
    </div>
    <span className="flex-1">{label}</span>
    <span className="font-bold">{reward}</span>
  </div>
);

interface ReferPageProps {
  onBack: () => void;
}

const ReferPage = ({ onBack }: ReferPageProps) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const { referrals, referralCode, loading, totalEarned, completedCount, activeCount } = useReferrals();

  const handleCopy = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
    } catch {
      const el = document.createElement("textarea");
      el.value = referralCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t("referralCodeCopied"));
  };

  const deepLink = `https://pay-palooza-go.lovable.app/?ref=${referralCode}`;
  const shareText = t("referShareText")
    .replace("{code}", referralCode || "")
    .replace("{reward}", String(REWARD_PER_FRIEND))
    .replace("{link}", deepLink);

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };
  const handleSMS = () => {
    window.open(`sms:?body=${encodeURIComponent(shareText)}`, "_blank");
  };
  const handleNativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: t("referShareTitle"), text: shareText }); } catch {}
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 pb-6">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center">
            <ArrowLeft size={17} className="text-foreground" strokeWidth={2.2} />
          </motion.button>
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-3xl" />)}
        </div>
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3 }} className="space-y-5 pb-6">

      {/* Top bar */}
      <div className="flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.90 }} onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center hover:bg-muted transition-colors tap-target">
          <ArrowLeft size={17} className="text-foreground" strokeWidth={2.2} />
        </motion.button>
        <div>
          <h1 className="text-[17px] font-bold text-foreground">{t("referTitle")}</h1>
          <p className="text-[11.5px] text-muted-foreground">{t("referSubtitle")}</p>
        </div>
      </div>

      {/* Hero card */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
        className="gradient-hero rounded-2xl p-5 text-primary-foreground shadow-glow">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Gift size={22} className="text-white" />
          </div>
          <div>
            <p className="text-lg font-bold">{t("referEarn")} ৳{REWARD_PER_FRIEND}</p>
            <p className="text-sm opacity-80">{t("perSuccessfulReferral")}</p>
          </div>
        </div>

        {/* Code block */}
        <div className="bg-white/15 rounded-xl px-4 py-3 flex items-center justify-between backdrop-blur-sm">
          <div>
            <p className="text-[11px] opacity-60 mb-0.5">{t("yourReferralCode")}</p>
            <p className="text-lg font-mono font-bold tracking-widest">{referralCode || "..."}</p>
          </div>
          <button onClick={handleCopy}
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center">
            {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button onClick={handleWhatsApp}
            className="bg-white/15 hover:bg-white/25 transition-colors rounded-xl py-2.5 text-xs font-semibold flex flex-col items-center gap-1">
            <span className="text-base">💬</span>{t("whatsapp")}
          </button>
          <button onClick={handleSMS}
            className="bg-white/15 hover:bg-white/25 transition-colors rounded-xl py-2.5 text-xs font-semibold flex flex-col items-center gap-1">
            <span className="text-base">📱</span>{t("sms")}
          </button>
          <button onClick={handleNativeShare}
            className="bg-white/15 hover:bg-white/25 transition-colors rounded-xl py-2.5 text-xs font-semibold flex flex-col items-center gap-1">
            <Share2 size={16} />{t("more")}
          </button>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t("totalEarned"),  value: `৳${totalEarned}`,   icon: Star,         cls: "gradient-accent"   },
          { label: t("referred"),     value: referrals.length,     icon: Users,        cls: "gradient-payment"  },
          { label: t("completed"),    value: completedCount,       icon: CheckCircle2, cls: "gradient-primary"  },
        ].map(({ label, value, icon: Icon, cls }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-3xl border border-border/60 p-3 shadow-card text-center">
            <div className={`w-8 h-8 rounded-xl ${cls} flex items-center justify-center mx-auto mb-2`}>
              <Icon size={15} className="text-primary-foreground" />
            </div>
            <p className="text-base font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Milestone reward info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3">
        <p className="text-sm font-bold text-foreground">{t("rewardProgress")}</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { at: "KYC",   reward: "৳10",  label: t("kycVerifiedMilestone") },
            { at: "1 Txn", reward: "৳20",  label: t("firstTxnMilestone")   },
            { at: "5 Txn", reward: "৳20",  label: t("fiveTxnsMilestone")   },
          ].map((m) => (
            <div key={m.at} className="rounded-xl border border-border bg-muted/40 p-2.5 text-center">
              <p className="text-sm font-bold text-foreground">{m.reward}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Referred friends list */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden">
        <p className="text-sm font-bold text-foreground px-4 pt-4 pb-2">{t("referredFriends")}</p>

        {referrals.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Users size={32} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{t("noReferralsYet")}</p>
          </div>
        ) : (
          referrals.map((ref) => (
            <div key={ref.id} className="px-4 py-3.5 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
                  {(ref.referee_name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {ref.referee_name || ref.referee_phone || t("referUserFallback")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ref.referee_phone ? `${ref.referee_phone.slice(0,3)}••••${ref.referee_phone.slice(-4)}` : ""} · {new Date(ref.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={ref.status} t={t as any} />
                  {ref.total_rewarded > 0 && (
                    <span className="text-[11px] font-semibold text-primary">+৳{ref.total_rewarded}</span>
                  )}
                </div>
              </div>
              {/* Milestone progress for this referral */}
              <div className="mt-2.5 space-y-1.5 pl-12">
                <MilestoneStep done={ref.milestone_1_paid} label={t("kycVerifiedMilestone")} reward="৳10" />
                <MilestoneStep done={ref.milestone_2_paid} label={t("firstTxnMilestone")} reward="৳20" />
                <MilestoneStep done={ref.milestone_3_paid} label={t("fiveTxnsMilestone")} reward="৳20" />
              </div>
            </div>
          ))
        )}
      </motion.div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card rounded-3xl border border-border/60 shadow-card p-4 space-y-3">
        <p className="text-sm font-bold text-foreground">{t("howItWorks")}</p>
        {[
          { step: "1", text: t("referStep1") },
          { step: "2", text: t("referStep2") },
          { step: "3", text: t("referStep3") },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 mt-0.5">
              {s.step}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.text}</p>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default ReferPage;
