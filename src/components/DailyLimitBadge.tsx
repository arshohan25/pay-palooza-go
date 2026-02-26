import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, TrendingUp } from "lucide-react";

const DAILY_LIMITS: Record<string, { limit: number; label: string }> = {
  send:         { limit: 50000,  label: "Send" },
  cashout:      { limit: 35000,  label: "Cash Out" },
  banktransfer: { limit: 50000,  label: "Bank Transfer" },
  recharge:     { limit: 50000,  label: "Recharge" },
  addmoney:     { limit: 50000,  label: "Add Money" },
  cashin:       { limit: 50000,  label: "Cash In" },
};

interface DailyLimitBadgeProps {
  txnType: string;
  className?: string;
}

const DailyLimitBadge = ({ txnType, className = "" }: DailyLimitBadgeProps) => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const config = DAILY_LIMITS[txnType];
      if (!config) return;
      setLimit(config.limit);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", session.user.id)
        .eq("type", txnType as any)
        .eq("status", "completed")
        .gte("created_at", today.toISOString());

      const used = (data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
      setRemaining(config.limit - used);
    };
    fetch();
  }, [txnType]);

  if (remaining === null) return null;

  const pct = ((limit - remaining) / limit) * 100;
  const isLow = remaining < limit * 0.2;
  const isExhausted = remaining <= 0;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {isLow ? (
        <AlertTriangle size={11} className={isExhausted ? "text-destructive" : "text-amber-500"} />
      ) : (
        <TrendingUp size={11} className="text-primary" />
      )}
      <span
        className={`text-[11px] font-semibold ${
          isExhausted
            ? "text-destructive"
            : isLow
            ? "text-amber-500"
            : "text-muted-foreground"
        }`}
      >
        {isExhausted
          ? "Daily limit reached"
          : `৳${remaining.toLocaleString("en-BD")} left today`}
      </span>
      {!isExhausted && (
        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden ml-1">
          <div
            className={`h-full rounded-full transition-all ${
              isLow ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default DailyLimitBadge;
