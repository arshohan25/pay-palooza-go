import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Ticket, CreditCard, Sparkles, ChevronRight, X, Clock, BadgePercent, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AiReward {
  id: string;
  reward_type: string;
  title: string;
  description: string;
  details: any;
  status: string;
  segment: string;
  expires_at: string;
  claimed_at: string | null;
  created_at: string;
}

const typeConfig: Record<string, { icon: typeof Gift; gradient: string; badge: string }> = {
  coupon: { icon: BadgePercent, gradient: "from-emerald-500/20 to-teal-500/10", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  loan: { icon: Landmark, gradient: "from-blue-500/20 to-indigo-500/10", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  gift_card: { icon: Gift, gradient: "from-purple-500/20 to-pink-500/10", badge: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  offer: { icon: Ticket, gradient: "from-amber-500/20 to-orange-500/10", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

export default function AiPersonalOffers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rewards, setRewards] = useState<AiReward[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("ai_auto_rewards")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);
      if (data) setRewards(data as any);
    };
    fetch();

    // Realtime
    const channel = supabase
      .channel("ai-rewards-user")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ai_auto_rewards",
        filter: `user_id=eq.${user.id}`,
      }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleClaim = async (reward: AiReward) => {
    if (reward.reward_type === "loan") {
      navigate("/loan");
      return;
    }

    const { error } = await supabase
      .from("ai_auto_rewards")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", reward.id);

    if (!error) {
      toast.success("Reward claimed! 🎉");
      setRewards(prev => prev.filter(r => r.id !== reward.id));
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const visible = rewards.filter(r => !dismissed.has(r.id));
  if (visible.length === 0) return null;

  const daysLeft = (d: string) => {
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Personalized For You</h3>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">AI</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory -mx-1 px-1">
        <AnimatePresence mode="popLayout">
          {visible.map((reward, i) => {
            const cfg = typeConfig[reward.reward_type] || typeConfig.offer;
            const Icon = cfg.icon;
            const days = daysLeft(reward.expires_at);

            return (
              <motion.div
                key={reward.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, x: -20 }}
                transition={{ delay: i * 0.05 }}
                className="snap-start shrink-0 w-[260px] relative group"
              >
                <div className={`relative rounded-2xl border border-border/50 bg-gradient-to-br ${cfg.gradient} backdrop-blur-sm p-4 space-y-3 h-full`}>
                  {/* Dismiss */}
                  <button
                    onClick={() => handleDismiss(reward.id)}
                    className="absolute top-2 right-2 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/50 hover:bg-background"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>

                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-background/60 shadow-sm">
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight truncate">{reward.title}</p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                        {reward.reward_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {reward.description}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{days}d left</span>
                    </div>
                    <button
                      onClick={() => handleClaim(reward)}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      {reward.reward_type === "loan" ? "Apply" : "Claim"}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
