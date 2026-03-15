import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, Loader2, ArrowUpDown, Send, CreditCard, Smartphone, Zap, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TypeStats {
  type: string;
  count: number;
  volume: number;
  fees: number;
  todayCount: number;
  todayVolume: number;
}

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  send: { label: "Send Money", icon: Send, color: "text-pink-600" },
  receive: { label: "Receive", icon: Send, color: "text-emerald-600" },
  cashout: { label: "Cash Out", icon: ArrowUpDown, color: "text-orange-600" },
  cashin: { label: "Cash In", icon: ArrowUpDown, color: "text-green-600" },
  payment: { label: "Payment", icon: CreditCard, color: "text-purple-600" },
  recharge: { label: "Recharge", icon: Smartphone, color: "text-cyan-600" },
  paybill: { label: "Bill Pay", icon: Zap, color: "text-amber-600" },
  addmoney: { label: "Add Money", icon: CreditCard, color: "text-blue-600" },
  banktransfer: { label: "Bank Transfer", icon: Landmark, color: "text-indigo-600" },
};

export default function AdminMfsMonitor() {
  const [stats, setStats] = useState<TypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalToday, setTotalToday] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);

  const load = async () => {
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: allTxns } = await supabase
      .from("transactions")
      .select("type, amount, fee, created_at")
      .eq("status", "completed");

    const txns = allTxns ?? [];
    const typeMap: Record<string, TypeStats> = {};

    for (const txn of txns) {
      const t = txn.type;
      if (!typeMap[t]) typeMap[t] = { type: t, count: 0, volume: 0, fees: 0, todayCount: 0, todayVolume: 0 };
      typeMap[t].count++;
      typeMap[t].volume += Number(txn.amount);
      typeMap[t].fees += Number(txn.fee ?? 0);
      if (new Date(txn.created_at) >= todayStart) {
        typeMap[t].todayCount++;
        typeMap[t].todayVolume += Number(txn.amount);
      }
    }

    const sorted = Object.values(typeMap).sort((a, b) => b.volume - a.volume);
    setStats(sorted);
    setTotalToday(sorted.reduce((s, t) => s + t.todayCount, 0));
    setTotalVolume(sorted.reduce((s, t) => s + t.volume, 0));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("mfs-monitor")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> MFS Operations Monitor
        </h3>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Today's Txns</p>
                <p className="text-lg font-bold text-primary">{totalToday.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Total Volume</p>
                <p className="text-lg font-bold text-foreground">৳{totalVolume.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Active Types</p>
                <p className="text-lg font-bold text-foreground">{stats.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Per-type cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.map(s => {
              const meta = TYPE_META[s.type] || { label: s.type, icon: Activity, color: "text-foreground" };
              const Icon = meta.icon;
              return (
                <Card key={s.type} className="border-0 shadow-[var(--shadow-card)] hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-4 h-4 ${meta.color}`} />
                      <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Total Txns</p>
                        <p className="font-bold text-foreground">{s.count.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Volume</p>
                        <p className="font-bold text-foreground">৳{s.volume.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Today</p>
                        <p className="font-bold text-primary">{s.todayCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fees Earned</p>
                        <p className="font-bold text-emerald-600">৳{s.fees.toLocaleString()}</p>
                      </div>
                    </div>
                    {totalVolume > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Volume Share</span>
                          <span>{((s.volume / totalVolume) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(s.volume / totalVolume) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {stats.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No transaction data</p>}
        </>
      )}
    </div>
  );
}
