import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface DailyVolume {
  date: string;
  count: number;
  volume: number;
}

interface TypeBreakdown {
  type: string;
  count: number;
  volume: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(200, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(350, 65%, 50%)",
  "hsl(180, 55%, 45%)",
  "hsl(20, 70%, 50%)",
  "hsl(100, 50%, 45%)",
];

export default function AdminReporting() {
  const [dailyData, setDailyData] = useState<DailyVolume[]>([]);
  const [typeData, setTypeData] = useState<TypeBreakdown[]>([]);
  const [totals, setTotals] = useState({ txnCount: 0, totalVolume: 0, totalFees: 0, totalCommissions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Fetch all transactions for reporting
      const { data: txns } = await supabase
        .from("transactions")
        .select("type, amount, fee, commission, created_at, status")
        .eq("status", "completed")
        .order("created_at", { ascending: true })
        .limit(1000);

      if (!txns || txns.length === 0) { setLoading(false); return; }

      // Calculate totals
      let totalVol = 0, totalFee = 0, totalComm = 0;
      txns.forEach(t => {
        totalVol += t.amount;
        totalFee += t.fee;
        totalComm += t.commission;
      });
      setTotals({ txnCount: txns.length, totalVolume: totalVol, totalFees: totalFee, totalCommissions: totalComm });

      // Group by day (last 14 days)
      const dayMap = new Map<string, { count: number; volume: number }>();
      txns.forEach(t => {
        const day = t.created_at.slice(0, 10);
        const prev = dayMap.get(day) ?? { count: 0, volume: 0 };
        dayMap.set(day, { count: prev.count + 1, volume: prev.volume + t.amount });
      });
      const daily = Array.from(dayMap.entries())
        .map(([date, v]) => ({ date: date.slice(5), ...v }))
        .slice(-14);
      setDailyData(daily);

      // Group by type
      const typeMap = new Map<string, { count: number; volume: number }>();
      txns.forEach(t => {
        const prev = typeMap.get(t.type) ?? { count: 0, volume: 0 };
        typeMap.set(t.type, { count: prev.count + 1, volume: prev.volume + t.amount });
      });
      setTypeData(Array.from(typeMap.entries()).map(([type, v]) => ({ type, ...v })));

      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Total Transactions", value: totals.txnCount.toLocaleString() },
          { label: "Total Volume", value: `৳${(totals.totalVolume / 1000).toFixed(1)}K` },
          { label: "Total Fees", value: `৳${totals.totalFees.toLocaleString()}` },
          { label: "Commissions Paid", value: `৳${totals.totalCommissions.toLocaleString()}` },
        ].map(kpi => (
          <Card key={kpi.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Volume Chart */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" /> Daily Transaction Volume
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(v: number) => [`৳${v.toLocaleString()}`, "Volume"]}
                />
                <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Transaction Count Trend */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-3">Daily Txn Count</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Type Breakdown Pie */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-3">Volume by Type</p>
            <div className="h-52 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="volume"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                  >
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => `৳${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 text-xs">
                {typeData.map((d, i) => (
                  <div key={d.type} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="capitalize text-muted-foreground">{d.type}</span>
                    <span className="ml-auto font-medium text-foreground">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
