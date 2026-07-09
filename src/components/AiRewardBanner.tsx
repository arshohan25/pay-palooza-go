import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Clock, ChevronRight, Gift, BadgePercent, Landmark, Ticket } from "lucide-react";
import { toast } from "sonner";
import type { AiReward } from "@/hooks/use-ai-rewards";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const typeConfig: Record<string, { icon: typeof Gift; gradient: string; badge: string; actionKey: TranslationKey }> = {
  coupon: { icon: BadgePercent, gradient: "from-emerald-500/15 to-teal-500/5", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", actionKey: "arbClaim" },
  loan: { icon: Landmark, gradient: "from-blue-500/15 to-indigo-500/5", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400", actionKey: "arbApply" },
  gift_card: { icon: Gift, gradient: "from-purple-500/15 to-pink-500/5", badge: "bg-purple-500/15 text-purple-700 dark:text-purple-400", actionKey: "arbClaim" },
  offer: { icon: Ticket, gradient: "from-amber-500/15 to-orange-500/5", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400", actionKey: "arbClaim" },
};

interface Props {
  rewards: AiReward[];
  onClaim: (id: string) => Promise<boolean>;
  onApply?: (reward: AiReward) => void;
}

export default function AiRewardBanner({ rewards, onClaim, onApply }: Props) {
  const { t } = useI18n();
  if (rewards.length === 0) return null;

  const daysLeft = (d: string) => Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const handleAction = async (reward: AiReward) => {
    if (onApply && reward.reward_type === "loan") {
      onApply(reward);
      return;
    }
    const ok = await onClaim(reward.id);
    if (ok) toast.success(t("arbClaimed"));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-0.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">{t("arbTitle")}</span>
        <span className="text-[9px] px-1.5 py-px rounded-full bg-primary/10 text-primary font-medium">{t("arbSmart")}</span>
      </div>
      <AnimatePresence mode="popLayout">
        {rewards.map((reward, i) => {
          const cfg = typeConfig[reward.reward_type] || typeConfig.offer;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={reward.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border border-border/50 bg-gradient-to-r ${cfg.gradient} p-3 flex items-center gap-3`}
            >
              <div className="p-2 rounded-lg bg-background/70 shadow-sm shrink-0">
                <Icon className="w-4 h-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{reward.title}</p>
                <p className="text-[10px] text-muted-foreground truncate">{reward.description}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{daysLeft(reward.expires_at)}{t("arbDaysLeft")}</span>
                </div>
              </div>
              <button
                onClick={() => handleAction(reward)}
                className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0"
              >
                {t(cfg.actionKey)}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
