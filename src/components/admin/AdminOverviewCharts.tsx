import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { subDays, subWeeks, subMonths, format, startOfWeek, startOfMonth, getHours } from "date-fns";

type Period = "daily" | "weekly" | "monthly";

interface TxnRow {
  type: string;
  amount: number;
  fee: number;
  created_at: string;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
};

export default function AdminOverviewCharts() {
  const [period, setPeriod] = useState<Period>("daily");
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [signups, setSignups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = subMonths(new Date(), 6).toISOString();

      const [txnRes, signupRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("type, amount, fee, created_at")
          .eq("status", "completed")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(1000),
        supabase
          .from("profiles")
          .select("created_at")
          .gte("created_at", subDays(new Date(), 14).toISOString())
          .order("created_at", { ascending: true })
          .limit(1000),
      ]);

      setTxns((txnRes.data as TxnRow[]) ?? []);
      setSignups((signupRes.data ?? []).map((r: any) => r.created_at));
      setLoading(false);
    };
    load();
  }, []);

  // Daily data (last 14 days)
  const dailyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();
    const cutoff = subDays(new Date(), 14);
    txns.filter(t => new Date(t.created_at) >= cutoff).forEach(t => {
      const day = t.created_at.slice(0, 10);
      const prev = map.get(day) ?? { count: 0, volume: 0 };
      map.set(day, { count: prev.count + 1, volume: prev.volume + t.amount });
    });
    return Array.from(map.entries()).map(([date, v]) => ({
      date: format(new Date(date), "MMM dd"),
      ...v,
    }));
  }, [txns]);

  // Weekly data (last 8 weeks)
  const weeklyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();
    const cutoff = subWeeks(new Date(), 8);
    txns.filter(t => new Date(t.created_at) >= cutoff).forEach(t => {
      const week = format(startOfWeek(new Date(t.created_at), { weekStartsOn: 0 }), "MMM dd");
      const prev = map.get(week) ?? { count: 0, volume: 0 };
      map.set(week, { count: prev.count + 1, volume: prev.volume + t.amount });
    });
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [txns]);

  // Monthly data (last 6 months)
  const monthlyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number }>();
    txns.forEach(t => {
      const month = format(startOfMonth(new Date(t.created_at)), "MMM yy");
      const prev = map.get(month) ?? { count: 0, volume: 0 };
      map.set(month, { count: prev.count + 1, volume: prev.volume + t.amount });
    });
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [txns]);

  // Signup trend (last 14 days)
  const signupData = useMemo(() => {
    const map = new Map<string, number>();
    signups.forEach(d => {
      const day = d.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({
      date: format(new Date(date), "MMM dd"),
      count,
    }));
  }, [signups]);

  // Active hours (today)
  const hourlyData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }));
    txns.filter(t => t.created_at.startsWith(today)).forEach(t => {
      const h = getHours(new Date(t.created_at));
      hours[h].count++;
    });
    return hours;
  }, [txns]);

  const chartData = period === "daily" ? dailyData : period === "weekly" ? weeklyData : monthlyData;

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Toggle */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-foreground">Analytics</span>
        <div className="ml-auto flex gap-1">
          {(["daily", "weekly", "monthly"] as Period[]).map(p => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "outline"}
              className="text-xs h-7 px-3 capitalize"
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Transaction Volume + Count */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Transaction Volume & Count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [
                    name === "volume" ? `৳${v.toLocaleString()}` : v, name === "volume" ? "Volume" : "Count"
                  ]} />
                  <Bar yAxisId="left" dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
                  <Line yAxisId="right" type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Area Chart */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" />
              Cumulative Volume (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`৳${v.toLocaleString()}`, "Volume"]} />
                  <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fill="url(#volumeGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Signups */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              User Signups (14 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signupData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="count" stroke="hsl(200, 70%, 50%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(200, 70%, 50%)" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Active Hours */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Active Hours (Today)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} interval={2} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(40, 80%, 50%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
