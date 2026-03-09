import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Activity, TrendingUp, Banknote, Clock, ArrowDownToLine, Building2, Receipt, ArrowRightLeft, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";

const AGENT_TYPES = ["cashin", "cashout", "receive", "b2b", "banktransfer", "paybill"];

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  cashin:       { label: "Cash In",        icon: ArrowDownToLine, color: "hsl(var(--primary))" },
  cashout:      { label: "Cash Out",       icon: Banknote,        color: "hsl(var(--accent))" },
  receive:      { label: "Received",       icon: ArrowDownToLine, color: "hsl(142 71% 45%)" },
  b2b:          { label: "B2B Transfer",   icon: ArrowRightLeft,  color: "hsl(262 83% 58%)" },
  banktransfer: { label: "Bank Transfer",  icon: Building2,       color: "hsl(221 83% 53%)" },
  paybill:      { label: "Bill Pay",       icon: Receipt,         color: "hsl(25 95% 53%)" },
};

type TimePeriod = "7d" | "30d" | "thisMonth" | "prevMonth" | "all";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(Math.round(n));

const AgentAnalyticsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>("30d");

  const loadTxns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("type, amount, commission, fee, created_at, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1000);
    setTxns((data ?? []).filter((t: any) => AGENT_TYPES.includes(t.type)));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadTxns(); }, [loadTxns]);

  // Filter by period
  const filtered = useMemo(() => {
    const now = new Date();
    return txns.filter(t => {
      const d = parseISO(t.created_at);
      switch (period) {
        case "7d": return d >= subDays(now, 7);
        case "30d": return d >= subDays(now, 30);
        case "thisMonth": return isWithinInterval(d, { start: startOfMonth(now), end: now });
        case "prevMonth": {
          const prev = subMonths(now, 1);
          return isWithinInterval(d, { start: startOfMonth(prev), end: endOfMonth(prev) });
        }
        default: return true;
      }
    });
  }, [txns, period]);

  // Summary
  const summary = useMemo(() => ({
    count: filtered.length,
    volume: filtered.reduce((s, t) => s + Number(t.amount || 0), 0),
    commission: filtered.reduce((s, t) => s + Number(t.commission || 0), 0),
  }), [filtered]);

  // Trend data grouped by day
  const trendData = useMemo(() => {
    const map: Record<string, { date: string; volume: number; commission: number }> = {};
    for (const t of filtered) {
      const day = format(parseISO(t.created_at), "MMM dd");
      if (!map[day]) map[day] = { date: day, volume: 0, commission: 0 };
      map[day].volume += Number(t.amount || 0);
      map[day].commission += Number(t.commission || 0);
    }
    return Object.values(map).reverse();
  }, [filtered]);

  // Commission by type
  const commissionByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      map[t.type] = (map[t.type] || 0) + Number(t.commission || 0);
    }
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([type, commission]) => ({
        type: TYPE_META[type]?.label || type,
        commission,
        fill: TYPE_META[type]?.color || "hsl(var(--primary))",
      }))
      .sort((a, b) => b.commission - a.commission);
  }, [filtered]);

  // Peak hours
  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }));
    for (const t of filtered) {
      const h = parseISO(t.created_at).getHours();
      hours[h].count++;
    }
    return hours;
  }, [filtered]);

  // Type distribution
  const typeDistribution = useMemo(() => {
    const map: Record<string, { count: number; volume: number; commission: number }> = {};
    for (const t of filtered) {
      if (!map[t.type]) map[t.type] = { count: 0, volume: 0, commission: 0 };
      map[t.type].count++;
      map[t.type].volume += Number(t.amount || 0);
      map[t.type].commission += Number(t.commission || 0);
    }
    return Object.entries(map).sort((a, b) => b[1].volume - a[1].volume);
  }, [filtered]);

  const periods: { key: TimePeriod; label: string }[] = [
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "thisMonth", label: "This Month" },
    { key: "prevMonth", label: "Prev Month" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => navigate("/agent")}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-base font-extrabold text-foreground">Agent Analytics</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Period tabs */}
        <div className="flex gap-1 p-1 bg-muted/60 rounded-xl overflow-x-auto no-scrollbar">
          {periods.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                period === p.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 border-0 shadow-card rounded-xl text-center">
            <Activity size={16} className="mx-auto text-primary mb-1" />
            <p className="text-lg font-extrabold text-foreground">{loading ? "—" : summary.count}</p>
            <p className="text-[9px] text-muted-foreground font-semibold">Transactions</p>
          </Card>
          <Card className="p-3 border-0 shadow-card rounded-xl text-center">
            <TrendingUp size={16} className="mx-auto text-accent mb-1" />
            <p className="text-sm font-extrabold text-foreground">{loading ? "—" : `৳${fmt(summary.volume)}`}</p>
            <p className="text-[9px] text-muted-foreground font-semibold">Volume</p>
          </Card>
          <Card className="p-3 border-0 shadow-card rounded-xl text-center">
            <Banknote size={16} className="mx-auto text-primary mb-1" />
            <p className="text-sm font-extrabold text-primary">{loading ? "—" : `৳${fmt(summary.commission)}`}</p>
            <p className="text-[9px] text-muted-foreground font-semibold">Commission</p>
          </Card>
        </div>

        {/* Transaction Trend */}
        <Card className="p-4 border-0 shadow-card rounded-2xl">
          <h3 className="text-xs font-bold text-foreground mb-3">Transaction Trend</h3>
          {trendData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data for this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="comGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  formatter={(v: number) => [`৳${fmt(v)}`, ""]}
                />
                <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fill="url(#volGrad)" strokeWidth={2} name="Volume" />
                <Area type="monotone" dataKey="commission" stroke="hsl(var(--accent))" fill="url(#comGrad)" strokeWidth={2} name="Commission" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Commission Breakdown */}
        <Card className="p-4 border-0 shadow-card rounded-2xl">
          <h3 className="text-xs font-bold text-foreground mb-3">Commission by Type</h3>
          {commissionByType.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No commission data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, commissionByType.length * 40)}>
              <BarChart data={commissionByType} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={90} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  formatter={(v: number) => [`৳${fmt(v)}`, "Commission"]}
                />
                <Bar dataKey="commission" radius={[0, 6, 6, 0]} barSize={20}>
                  {commissionByType.map((entry, idx) => (
                    <rect key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Peak Hours */}
        <Card className="p-4 border-0 shadow-card rounded-2xl">
          <h3 className="text-xs font-bold text-foreground mb-1">Peak Hours</h3>
          <p className="text-[10px] text-muted-foreground mb-3">When you're busiest</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={12} name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Type Distribution */}
        <div>
          <h3 className="text-xs font-bold text-foreground mb-2">Transaction Breakdown</h3>
          <div className="space-y-2">
            {typeDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No transactions in this period</p>
            ) : (
              typeDistribution.map(([type, data]) => {
                const meta = TYPE_META[type];
                const Icon = meta?.icon || Activity;
                return (
                  <Card key={type} className="p-3 border-0 shadow-card rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground">{meta?.label || type}</p>
                        <p className="text-[10px] text-muted-foreground">{data.count} transactions</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-extrabold text-foreground">৳{fmt(data.volume)}</p>
                        {data.commission > 0 && (
                          <p className="text-[10px] font-semibold text-primary">+৳{fmt(data.commission)}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentAnalyticsPage;
