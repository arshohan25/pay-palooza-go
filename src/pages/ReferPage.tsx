import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Copy, CheckCheck, Gift, Users, Star,
  CheckCircle2, Clock, XCircle, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const REFERRAL_CODE = "TAN-REF-4821";
const REWARD_PER_FRIEND = 50;
const TARGET_FRIENDS = 10;

const FRIENDS = [
  { name: "Rakib Hossain",  phone: "017••••3321", joined: "12 Jan 2026", status: "completed" as const, earned: 50 },
  { name: "Nusrat Jahan",   phone: "018••••9872", joined: "28 Jan 2026", status: "completed" as const, earned: 50 },
  { name: "Sabbir Ahmed",   phone: "019••••4410", joined: "3 Feb 2026",  status: "pending"   as const, earned: 0  },
  { name: "Mitu Akter",     phone: "015••••7765", joined: "9 Feb 2026",  status: "pending"   as const, earned: 0  },
  { name: "Farhan Islam",   phone: "016••••0032", joined: "—",           status: "failed"    as const, earned: 0  },
];

const completedCount = FRIENDS.filter((f) => f.status === "completed").length;
const totalEarned    = FRIENDS.reduce((s, f) => s + f.earned, 0);

const StatusBadge = ({ status }: { status: "completed" | "pending" | "failed" }) => {
  const map = {
    completed: { icon: CheckCircle2, label: "Completed", cls: "text-primary bg-primary/10" },
    pending:   { icon: Clock,        label: "Pending",   cls: "text-accent bg-accent/10"   },
    failed:    { icon: XCircle,      label: "Failed",    cls: "text-destructive bg-destructive/10" },
  };
  const { icon: Icon, label, cls } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <Icon size={10} />
      {label}
    </span>
  );
};

interface ReferPageProps {
  onBack: () => void;
}

const ReferPage = ({ onBack }: ReferPageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_CODE);
    } catch {
      const el = document.createElement("textarea");
      el.value = REFERRAL_CODE;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Referral code copied!");
  };

  const shareText = `Use my referral code ${REFERRAL_CODE} on BkashClone and we both get ৳${REWARD_PER_FRIEND}!`;

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleSMS = () => {
    window.open(`sms:?body=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "BkashClone Referral", text: shareText });
      } catch {
        // dismissed
      }
    } else {
      handleCopy();
    }
  };

  const progressPct = Math.round((completedCount / TARGET_FRIENDS) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.3 }}
      className="space-y-5 pb-6"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-card"
        >
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Refer a Friend</h1>
          <p className="text-xs text-muted-foreground">Earn ৳{REWARD_PER_FRIEND} for every successful referral</p>
        </div>
      </div>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
        className="gradient-hero rounded-2xl p-5 text-primary-foreground shadow-glow"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Gift size={22} className="text-white" />
          </div>
          <div>
            <p className="text-lg font-bold">Earn ৳{REWARD_PER_FRIEND}</p>
            <p className="text-sm opacity-80">per successful referral</p>
          </div>
        </div>

        {/* Code block */}
        <div className="bg-white/15 rounded-xl px-4 py-3 flex items-center justify-between backdrop-blur-sm">
          <div>
            <p className="text-[11px] opacity-60 mb-0.5">Your referral code</p>
            <p className="text-lg font-mono font-bold tracking-widest">{REFERRAL_CODE}</p>
          </div>
          <button
            onClick={handleCopy}
            className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
          >
            {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
          </button>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button
            onClick={handleWhatsApp}
            className="bg-white/15 hover:bg-white/25 transition-colors rounded-xl py-2.5 text-xs font-semibold flex flex-col items-center gap-1"
          >
            <span className="text-base">💬</span>
            WhatsApp
          </button>
          <button
            onClick={handleSMS}
            className="bg-white/15 hover:bg-white/25 transition-colors rounded-xl py-2.5 text-xs font-semibold flex flex-col items-center gap-1"
          >
            <span className="text-base">📱</span>
            SMS
          </button>
          <button
            onClick={handleNativeShare}
            className="bg-white/15 hover:bg-white/25 transition-colors rounded-xl py-2.5 text-xs font-semibold flex flex-col items-center gap-1"
          >
            <Share2 size={16} />
            More
          </button>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Earned",  value: `৳${totalEarned}`,   icon: Star,   cls: "gradient-accent"   },
          { label: "Referred",      value: FRIENDS.length,       icon: Users,  cls: "gradient-payment"  },
          { label: "Completed",     value: completedCount,        icon: CheckCircle2, cls: "gradient-primary" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border p-3 shadow-card text-center"
          >
            <div className={`w-8 h-8 rounded-xl ${cls} flex items-center justify-center mx-auto mb-2`}>
              <Icon size={15} className="text-primary-foreground" />
            </div>
            <p className="text-base font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Reward progress tracker */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="bg-card rounded-2xl border border-border shadow-card p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">Reward Progress</p>
          <span className="text-xs text-muted-foreground">
            {completedCount} / {TARGET_FRIENDS} friends
          </span>
        </div>

        <Progress value={progressPct} className="h-2.5" />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{progressPct}% complete</span>
          <span>{TARGET_FRIENDS - completedCount} more for next milestone</span>
        </div>

        {/* Milestone markers */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { at: 3,  reward: "৳150",  label: "Starter"  },
            { at: 5,  reward: "৳100", label: "Bonus"    },
            { at: 10, reward: "৳200", label: "Champion" },
          ].map((m) => {
            const unlocked = completedCount >= m.at;
            return (
              <div
                key={m.at}
                className={`rounded-xl border p-2.5 text-center transition-colors ${
                  unlocked ? "border-primary/40 bg-primary/8" : "border-border bg-muted/40"
                }`}
              >
                <p className={`text-sm font-bold ${unlocked ? "text-primary" : "text-muted-foreground"}`}>
                  {m.reward}
                </p>
                <p className="text-[10px] text-muted-foreground">{m.label}</p>
                <p className="text-[10px] text-muted-foreground">{m.at} friends</p>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Referred friends list */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
      >
        <p className="text-sm font-bold text-foreground px-4 pt-4 pb-2">Referred Friends</p>
        {FRIENDS.map((f, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
              {f.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.phone} · {f.joined}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={f.status} />
              {f.earned > 0 && (
                <span className="text-[11px] font-semibold text-primary">+৳{f.earned}</span>
              )}
            </div>
          </div>
        ))}
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-card rounded-2xl border border-border shadow-card p-4 space-y-3"
      >
        <p className="text-sm font-bold text-foreground">How it Works</p>
        {[
          { step: "1", text: "Share your unique referral code with friends" },
          { step: "2", text: "Friend signs up & completes first transaction" },
          { step: "3", text: "Both you & your friend earn ৳50 instantly" },
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
