import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, Clock, PieChart as PieIcon, DollarSign, CheckCircle, Building2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart, PieChart, Pie, Cell, Legend,
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

interface StatusRow {
  status: string;
}

interface CreatedAtRow {
  created_at: string;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
};

const TYPE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(160, 60%, 45%)",
  "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 55%)",
  "hsl(200, 70%, 50%)",
  "hsl(20, 80%, 55%)",
  "hsl(320, 60%, 50%)",
];

const STATUS_COLORS = {
  completed: "hsl(160, 60%, 45%)",
  failed: "hsl(var(--destructive))",
  pending: "hsl(40, 80%, 50%)",
};

export default function AdminOverviewCharts() {
  const [period, setPeriod] = useState<Period>("daily");
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [signups, setSignups] = useState<string[]>([]);
  const [statusData, setStatusData] = useState<StatusRow[]>([]);
  const [agentDates, setAgentDates] = useState<string[]>([]);
  const [merchantDates, setMerchantDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = subMonths(new Date(), 6).toISOString();

      const [txnRes, signupRes, statusRes, agentRes, merchantRes] = await Promise.all([
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
        supabase
          .from("transactions")
          .select("status")
          .gte("created_at", since)
          .limit(1000),
        supabase
          .from("agents")
          .select("created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(1000),
        supabase
          .from("merchants")
          .select("created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: true })
          .limit(1000),
      ]);

      setTxns((txnRes.data as TxnRow[]) ?? []);
      setSignups((signupRes.data ?? []).map((r: any) => r.created_at));
      setStatusData((statusRes.data as StatusRow[]) ?? []);
      setAgentDates((agentRes.data ?? []).map((r: any) => r.created_at));
      setMerchantDates((merchantRes.data ?? []).map((r: any) => r.created_at));
      setLoading(false);
    };
    load();
  }, []);

  // Daily data (last 14 days)
  const dailyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; fees: number }>();
    const cutoff = subDays(new Date(), 14);
    txns.filter(t => new Date(t.created_at) >= cutoff).forEach(t => {
      const day = t.created_at.slice(0, 10);
      const prev = map.get(day) ?? { count: 0, volume: 0, fees: 0 };
      map.set(day, { count: prev.count + 1, volume: prev.volume + t.amount, fees: prev.fees + t.fee });
    });
    return Array.from(map.entries()).map(([date, v]) => ({
      date: format(new Date(date), "MMM dd"),
      ...v,
    }));
  }, [txns]);

  // Weekly data (last 8 weeks)
  const weeklyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; fees: number }>();
    const cutoff = subWeeks(new Date(), 8);
    txns.filter(t => new Date(t.created_at) >= cutoff).forEach(t => {
      const week = format(startOfWeek(new Date(t.created_at), { weekStartsOn: 0 }), "MMM dd");
      const prev = map.get(week) ?? { count: 0, volume: 0, fees: 0 };
      map.set(week, { count: prev.count + 1, volume: prev.volume + t.amount, fees: prev.fees + t.fee });
    });
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [txns]);

  // Monthly data (last 6 months)
  const monthlyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; fees: number }>();
    txns.forEach(t => {
      const month = format(startOfMonth(new Date(t.created_at)), "MMM yy");
      const prev = map.get(month) ?? { count: 0, volume: 0, fees: 0 };
      map.set(month, { count: prev.count + 1, volume: prev.volume + t.amount, fees: prev.fees + t.fee });
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

  // Transaction type breakdown (donut)
  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    txns.forEach(t => {
      map.set(t.type, (map.get(t.type) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [txns]);

  // Revenue / fees trend (follows period toggle)
  const feeData = useMemo(() => {
    if (period === "daily") return dailyData;
    if (period === "weekly") return weeklyData;
    return monthlyData;
  }, [period, dailyData, weeklyData, monthlyData]);

  // Success vs Failed ratio (donut)
  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    statusData.forEach(s => {
      map.set(s.status, (map.get(s.status) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [statusData]);

  const successRate = useMemo(() => {
    const total = statusData.length;
    if (total === 0) return 0;
    const completed = statusData.filter(s => s.status === "completed").length;
    return Math.round((completed / total) * 100);
  }, [statusData]);

  // Agent & Merchant growth (cumulative)
  const growthData = useMemo(() => {
    const map = new Map<string, { agents: number; merchants: number }>();
    const allDates = [...agentDates, ...merchantDates].map(d =>
      format(startOfMonth(new Date(d)), "MMM yy")
    );
    const uniqueMonths = [...new Set(allDates)];

    agentDates.forEach(d => {
      const m = format(startOfMonth(new Date(d)), "MMM yy");
      const prev = map.get(m) ?? { agents: 0, merchants: 0 };
      map.set(m, { ...prev, agents: prev.agents + 1 });
    });
    merchantDates.forEach(d => {
      const m = format(startOfMonth(new Date(d)), "MMM yy");
      const prev = map.get(m) ?? { agents: 0, merchants: 0 };
      map.set(m, { ...prev, merchants: prev.merchants + 1 });
    });

    let cumAgents = 0;
    let cumMerchants = 0;
    return uniqueMonths.sort().map(month => {
      const v = map.get(month) ?? { agents: 0, merchants: 0 };
      cumAgents += v.agents;
      cumMerchants += v.merchants;
      return { month, agents: cumAgents, merchants: cumMerchants };
    });
  }, [agentDates, merchantDates]);

  const chartData = period === "daily" ? dailyData : period === "weekly" ? weeklyData : monthlyData;

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <Card key={i} className="border-0 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2"><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-48 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const renderDonutLabel = ({ name, percent }: { name: string; percent: number }) =>
    percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : "";

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

        {/* Transaction Type Breakdown (Donut) */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-violet-500" />
              Transaction Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={renderDonutLabel}
                  >
                    {typeBreakdown.map((_, i) => (
                      <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue & Fees Trend */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              Revenue & Fees Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={feeData}>
                  <defs>
                    <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`৳${v.toLocaleString()}`, "Fees"]} />
                  <Area type="monotone" dataKey="fees" stroke="hsl(160, 60%, 45%)" fill="url(#feeGrad)" strokeWidth={2} />
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

        {/* Success vs Failed Ratio (Donut) */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Success vs Failed Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className="text-2xl font-bold text-foreground">{successRate}%</span>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusBreakdown.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? "hsl(var(--muted))"}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Agent & Merchant Growth */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-500" />
              Agent & Merchant Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="agents" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Agents" />
                  <Line type="monotone" dataKey="merchants" stroke="hsl(280, 60%, 55%)" strokeWidth={2} dot={{ r: 3 }} name="Merchants" />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
