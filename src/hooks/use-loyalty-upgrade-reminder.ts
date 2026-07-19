import { useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";
import { useLoyaltyPerks } from "@/hooks/use-loyalty-perks";
import { supabase } from "@/integrations/supabase/client";

const METRIC_KEYS = [
  { threshold: "min_volume_30d",         current: "volume_30d",         label: "30-day volume",       suffix: "৳" },
  { threshold: "min_lifetime_txn_count", current: "lifetime_txn_count", label: "transactions",        suffix: ""  },
  { threshold: "min_wallet_balance",     current: "wallet_balance",     label: "wallet balance",      suffix: "৳" },
  { threshold: "min_addmoney_lifetime",  current: "addmoney_lifetime",  label: "add-money",           suffix: "৳" },
  { threshold: "min_savings_balance",    current: "savings_balance",    label: "savings",             suffix: "৳" },
] as const;

const CLOSENESS_PCT = 0.9; // within 10% ⇒ pct ≥ 0.9
const LS_KEY = "loyalty_upgrade_reminder_v1";

interface Sent { tier_id: string; sent_at: string }

function readSent(): Sent[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function writeSent(s: Sent[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s.slice(-20))); } catch {}
}

/**
 * Emits a single in-app notification when a user is within 10% of every
 * remaining requirement for their next EasyPay Club tier.
 * De-duplicated per tier per 7 days via localStorage.
 */
export function useLoyaltyUpgradeReminder() {
  const { user } = useAuth();
  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty } = useMyLoyalty();
  const perks = useLoyaltyPerks();

  const nextTier: LoyaltyTier | null = useMemo(() => {
    if (!tiers) return null;
    const sorted = tiers.slice().sort((a, b) => a.rank - b.rank);
    if (!perks.tier) return sorted[0] ?? null;
    return sorted.find((t) => t.rank > perks.tier!.rank && t.is_active) ?? null;
  }, [tiers, perks.tier]);

  useEffect(() => {
    if (!user?.id || !nextTier || !loyalty) return;

    // Compute per-metric progress; every non-zero requirement must be ≥ 90%.
    const gaps = METRIC_KEYS.map((m) => {
      const target = Number((nextTier as any)[m.threshold] ?? 0);
      const current = Number((loyalty as any)[m.current] ?? 0);
      return { ...m, target, current, pct: target > 0 ? Math.min(1, current / target) : 1 };
    });
    const relevant = gaps.filter((g) => g.target > 0);
    if (!relevant.length) return;
    const close = relevant.every((g) => g.pct >= CLOSENESS_PCT);
    if (!close) return;

    // Local 7-day guard
    const sent = readSent();
    const last = sent.find((s) => s.tier_id === nextTier.id);
    if (last && Date.now() - new Date(last.sent_at).getTime() < 7 * 24 * 3600_000) return;

    (async () => {
      // Server-side de-dupe: skip if the exact reminder is already unread within 7 days.
      const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("category", "loyalty")
        .gte("created_at", since)
        .contains("metadata", { reminder_tier: nextTier.id } as any)
        .limit(1)
        .maybeSingle();
      if (existing) {
        writeSent([...sent.filter((s) => s.tier_id !== nextTier.id), { tier_id: nextTier.id, sent_at: new Date().toISOString() }]);
        return;
      }

      const worst = relevant.slice().sort((a, b) => a.pct - b.pct)[0];
      const remaining = Math.max(0, worst.target - worst.current);
      const fmt = worst.suffix === "৳" ? `৳${remaining.toLocaleString()}` : `${remaining.toLocaleString()} ${worst.label}`;

      await supabase.from("notifications").insert({
        user_id: user.id,
        title: `Almost ${nextTier.name}! 🌟`,
        body: `You're within 10% of unlocking the ${nextTier.name} tier. Just ${fmt} more on your ${worst.label} to get there.`,
        category: "loyalty",
        metadata: {
          kind: "upgrade_reminder",
          reminder_tier: nextTier.id,
          tier_name: nextTier.name,
          worst_metric: worst.current,
          worst_target: worst.target,
        },
      });

      writeSent([
        ...sent.filter((s) => s.tier_id !== nextTier.id),
        { tier_id: nextTier.id, sent_at: new Date().toISOString() },
      ]);
    })();
  }, [user?.id, nextTier, loyalty]);
}

/** Mount-only wrapper for global use in <AppLayout />. */
export default function LoyaltyUpgradeReminder() {
  useLoyaltyUpgradeReminder();
  return null;
}
