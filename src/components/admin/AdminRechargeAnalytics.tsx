import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#f59e0b", "#10b981", "#6366f1", "#ec4899", "#8b5cf6",
];

interface PackStat {
  name: string;
  count: number;
  revenue: number;
  operator?: string;
}

export default function AdminRechargeAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PackStat[]>([]);
  const [period, setPeriod] = useState("30");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);

    const since = new Date();
    since.setDate(since.getDate() - Number(period));

    // Fetch recharge transactions
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("description, amount, recipient_name")
      .eq("type", "recharge")
      .eq("status", "completed")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error || !txns) {
      setLoading(false);
      return;
    }

    // Group by pack name (description)
    const map = new Map<string, PackStat>();
    let rev = 0;
    for (const t of txns) {
      const key = t.description || "Custom Amount";
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.revenue += t.amount;
      } else {
        map.set(key, {
          name: key,
          count: 1,
          revenue: t.amount,
          operator: t.recipient_name || undefined,
        });
      }
      rev += t.amount;
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.count - a.count);
    setStats(sorted);
    setTotalRevenue(rev);
    setTotalCount(txns.length);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const top10 = stats.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Pack Popularity Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Which recharge packs customers use the most
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{totalCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Recharges</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">৳{totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.length}</p>
            <p className="text-xs text-muted-foreground">Unique Packs</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {top10.length > 0 && (
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground mb-3">Top 10 Packs by Usage</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + "…" : v}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, "Uses"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {top10.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranked list */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {stats.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm font-bold text-muted-foreground w-6 text-right">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    {s.operator && (
                      <Badge variant="outline" className="text-[10px]">{s.operator}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ৳{s.revenue.toLocaleString()} revenue
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{s.count}</span>
                </div>
              </div>
            ))}
          </div>
          {stats.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No recharge transactions found for this period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
