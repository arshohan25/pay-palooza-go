import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Props { merchantId: string }

interface Row { subtotal: number | null; created_at: string; product_name: string | null; }

const fmt = (n: number) => new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(n);

export default function MerchantWeeklyDigestCard({ merchantId }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const { t } = useI18n();
  const dowKeys = ["mdDowSun","mdDowMon","mdDowTue","mdDowWed","mdDowThu","mdDowFri","mdDowSat"] as const;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase as any)
        .from("order_items")
        .select("subtotal, created_at, product_name")
        .eq("merchant_id", merchantId)
        .gte("created_at", since)
        .limit(2000);
      if (alive) setRows((data as Row[]) ?? []);
    };
    load();
    const ch = supabase
      .channel(`merchant-digest-${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `merchant_id=eq.${merchantId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [merchantId]);

  const insight = useMemo(() => {
    if (!rows) return null;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    let thisRev = 0, lastRev = 0, thisOrders = 0, lastOrders = 0;
    const productTotals = new Map<string, number>();
    const dayCounts = new Array(7).fill(0);
    for (const r of rows) {
      const t = new Date(r.created_at).getTime();
      const rev = Number(r.subtotal || 0);
      if (now - t < weekMs) {
        thisRev += rev; thisOrders += 1;
        if (r.product_name) productTotals.set(r.product_name, (productTotals.get(r.product_name) || 0) + rev);
        const dow = new Date(r.created_at).getDay();
        dayCounts[dow] += 1;
      } else if (now - t < weekMs * 2) {
        lastRev += rev; lastOrders += 1;
      }
    }
    const delta = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : (thisRev > 0 ? 100 : 0);
    const topProduct = [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
    const bestDay = dayCounts[bestDayIdx] > 0 ? ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][bestDayIdx] : null;
    return { thisRev, lastRev, thisOrders, lastOrders, delta, topProduct, bestDay };
  }, [rows]);

  if (!rows) {
    return (
      <Card className="border-0 shadow-elevated bg-gradient-to-br from-accent/10 via-background to-primary/5 p-4 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading weekly insights…</span>
      </Card>
    );
  }

  if (!insight || insight.thisOrders + insight.lastOrders === 0) {
    return (
      <Card className="border-0 shadow-elevated bg-gradient-to-br from-accent/10 via-background to-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold">Weekly insights</span>
        </div>
        <p className="text-xs text-muted-foreground">Ship a few orders to unlock trend insights.</p>
      </Card>
    );
  }

  const up = insight.delta >= 0;

  return (
    <Card className="border-0 shadow-elevated bg-gradient-to-br from-accent/10 via-background to-primary/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold">Weekly insights</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold ${up ? "text-emerald-500" : "text-rose-500"}`}>
          {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {Math.abs(insight.delta).toFixed(1)}%
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">This week</div>
          <div className="text-lg font-bold">৳{fmt(insight.thisRev)}</div>
          <div className="text-[11px] text-muted-foreground">{insight.thisOrders} items</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Last week</div>
          <div className="text-lg font-semibold text-muted-foreground">৳{fmt(insight.lastRev)}</div>
          <div className="text-[11px] text-muted-foreground">{insight.lastOrders} items</div>
        </div>
      </div>
      {(insight.topProduct || insight.bestDay) && (
        <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
          {insight.topProduct && (
            <div className="text-xs"><span className="text-muted-foreground">Top seller: </span><span className="font-medium truncate">{insight.topProduct}</span></div>
          )}
          {insight.bestDay && (
            <div className="text-xs"><span className="text-muted-foreground">Busiest day: </span><span className="font-medium">{insight.bestDay}</span></div>
          )}
        </div>
      )}
    </Card>
  );
}
