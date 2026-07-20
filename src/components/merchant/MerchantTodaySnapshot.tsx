import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Sparkles, TrendingUp, TrendingDown, Users, ShoppingBag, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Snapshot {
  today_revenue: number;
  today_orders: number;
  yesterday_revenue: number;
  avg_ticket: number;
  top_product: string | null;
  new_customers: number;
  returning_customers: number;
  delta_pct: number;
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(n);

export default function MerchantTodaySnapshot({ merchantId }: { merchantId: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("get_merchant_today_snapshot", { p_merchant_id: merchantId });
      if (alive && data) setSnap(data as unknown as Snapshot);
    };
    load();
    const ch = supabase
      .channel(`merchant-snapshot-${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `merchant_id=eq.${merchantId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [merchantId]);

  if (!snap) return null;
  const up = snap.delta_pct >= 0;

  return (
    <Card className="border-0 shadow-elevated bg-gradient-to-br from-primary/10 via-background to-accent/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Today</p>
            <p className="text-xs font-bold text-foreground">Snapshot</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
          up ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
        }`}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(snap.delta_pct).toFixed(0)}% vs yesterday
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-background/60 rounded-xl p-2.5">
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Sales</p>
          <p className="text-lg font-extrabold text-foreground">৳{fmt(snap.today_revenue)}</p>
        </div>
        <div className="bg-background/60 rounded-xl p-2.5">
          <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><ShoppingBag size={9} /> Orders</p>
          <p className="text-lg font-extrabold text-foreground">{fmt(snap.today_orders)}</p>
        </div>
        <div className="bg-background/60 rounded-xl p-2.5">
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Avg ticket</p>
          <p className="text-lg font-extrabold text-foreground">৳{fmt(snap.avg_ticket)}</p>
        </div>
        <div className="bg-background/60 rounded-xl p-2.5">
          <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Users size={9} /> New / Return</p>
          <p className="text-lg font-extrabold text-foreground">{fmt(snap.new_customers)}<span className="text-muted-foreground text-sm"> / {fmt(snap.returning_customers)}</span></p>
        </div>
      </div>

      {snap.top_product && (
        <div className="mt-2 flex items-center gap-2 bg-primary/10 rounded-xl p-2">
          <Award size={12} className="text-primary shrink-0" />
          <p className="text-[10px] text-foreground min-w-0">
            <span className="font-bold">Top today:</span> <span className="truncate">{snap.top_product}</span>
          </p>
        </div>
      )}
    </Card>
  );
}
