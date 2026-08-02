import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LedgerRowLite {
  id: string;
  user_id: string;
  kind: string;
  points: number;
  txn_type: string | null;
  tier_code: string | null;
  created_at: string;
}

export interface DailyPointsPoint {
  day: string;
  earned: number;
  redeemed: number;
  expired: number;
}

const dayKey = (iso: string) => iso.slice(0, 10);

/** Raw ledger rows for the last `days` days (admin-only via RLS). */
export function useLoyaltyLedgerWindow(days = 30) {
  return useQuery({
    queryKey: ["admin-loyalty-ledger-window", days],
    staleTime: 60_000,
    queryFn: async (): Promise<LedgerRowLite[]> => {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("loyalty_point_ledger" as any)
        .select("id, user_id, kind, points, txn_type, tier_code, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return ((data ?? []) as unknown as LedgerRowLite[]).map((r) => ({
        ...r,
        points: Number(r.points),
      }));
    },
  });
}

/** Daily accrual / redemption / expiry series. */
export function buildDailySeries(rows: LedgerRowLite[], days = 30): DailyPointsPoint[] {
  const map = new Map<string, DailyPointsPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    map.set(d, { day: d, earned: 0, redeemed: 0, expired: 0 });
  }
  for (const r of rows) {
    const bucket = map.get(dayKey(r.created_at));
    if (!bucket) continue;
    if (r.points > 0) bucket.earned += r.points;
    else if (r.kind?.includes("expir")) bucket.expired += Math.abs(r.points);
    else bucket.redeemed += Math.abs(r.points);
  }
  return [...map.values()];
}

export interface TierDistributionRow {
  code: string;
  name: string;
  color: string;
  users: number;
}

/** Users per loyalty tier (effective = override when active, else current). */
export function useTierDistribution() {
  return useQuery({
    queryKey: ["admin-loyalty-tier-distribution"],
    staleTime: 60_000,
    queryFn: async (): Promise<TierDistributionRow[]> => {
      const [{ data: tiers, error: te }, { data: rows, error: re }] = await Promise.all([
        supabase.from("loyalty_tiers" as any).select("id, code, name, badge_color, rank").order("rank"),
        supabase.from("user_loyalty" as any).select("current_tier_id, override_tier_id, override_until").limit(5000),
      ]);
      if (te) throw te;
      if (re) throw re;

      const counts = new Map<string, number>();
      for (const r of (rows ?? []) as any[]) {
        const overrideActive =
          !!r.override_tier_id && (!r.override_until || new Date(r.override_until) > new Date());
        const id = overrideActive ? r.override_tier_id : r.current_tier_id;
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return ((tiers ?? []) as any[]).map((t) => ({
        code: t.code,
        name: t.name,
        color: t.badge_color ?? "hsl(var(--primary))",
        users: counts.get(t.id) ?? 0,
      }));
    },
  });
}

export interface CampaignPerformanceRow {
  id: string;
  name: string;
  txn_type: string;
  multiplier: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  points_earned: number;
  participants: number;
  daily: { day: string; points: number }[];
}

/** Campaign multipliers enriched with the points earned inside their window. */
export function useCampaignPerformance(rows: LedgerRowLite[] | undefined) {
  return useQuery({
    queryKey: ["admin-loyalty-campaign-perf", rows?.length ?? 0],
    staleTime: 60_000,
    queryFn: async (): Promise<CampaignPerformanceRow[]> => {
      const { data, error } = await supabase
        .from("loyalty_point_multipliers" as any)
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;

      const ledger = rows ?? [];
      return ((data ?? []) as any[]).map((c) => {
        const from = new Date(c.starts_at).getTime();
        const to = c.ends_at ? new Date(c.ends_at).getTime() : Date.now();
        const matched = ledger.filter((r) => {
          if (r.points <= 0) return false;
          if (c.txn_type && c.txn_type !== "all" && r.txn_type !== c.txn_type) return false;
          const ts = new Date(r.created_at).getTime();
          return ts >= from && ts <= to;
        });
        const perDay = new Map<string, number>();
        for (const r of matched) perDay.set(dayKey(r.created_at), (perDay.get(dayKey(r.created_at)) ?? 0) + r.points);
        return {
          id: c.id,
          name: c.name,
          txn_type: c.txn_type ?? "all",
          multiplier: Number(c.multiplier),
          starts_at: c.starts_at,
          ends_at: c.ends_at,
          is_active: !!c.is_active,
          points_earned: matched.reduce((s, r) => s + r.points, 0),
          participants: new Set(matched.map((r) => r.user_id)).size,
          daily: [...perDay.entries()].sort().map(([day, points]) => ({ day, points })),
        };
      });
    },
  });
}
