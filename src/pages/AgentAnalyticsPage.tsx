import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, ArrowDownToLine, Banknote, ArrowRightLeft, Building2, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  format, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isWithinInterval, parseISO, addMonths,
} from "date-fns";

const AGENT_TYPES = ["cashin", "cashout", "b2b", "banktransfer", "paybill"];

const TYPE_META: Record<string, { label: string; icon: any; accent: string }> = {
  cashin:       { label: "Cash In",       icon: ArrowDownToLine, accent: "hsl(var(--primary))" },
  cashout:      { label: "Cash Out",      icon: Banknote,        accent: "hsl(var(--accent))" },
  b2b:          { label: "B2B Transfer",  icon: ArrowRightLeft,  accent: "hsl(262 83% 58%)" },
  banktransfer: { label: "Bank Transfer", icon: Building2,       accent: "hsl(221 83% 53%)" },
  paybill:      { label: "Bill Pay",      icon: Receipt,         accent: "hsl(25 95% 53%)" },
};

type View = "daily" | "weekly" | "monthly";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(Math.round(n));

const AgentAnalyticsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("daily");
  const [monthOffset, setMonthOffset] = useState(0);

  const loadTxns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("type, amount, commission, created_at, status")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1000);
    setTxns((data ?? []).filter((t: any) => AGENT_TYPES.includes(t.type)));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadTxns(); }, [loadTxns]);

  const targetMonth = addMonths(new Date(), monthOffset);

  const filtered = useMemo(() => {
    const now = new Date();
    return txns.filter(t => {
      const d = parseISO(t.created_at);
      switch (view) {
        case "daily": return isToday(d);
        case "weekly": return isWithinInterval(d, { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) });
        case "monthly": return isWithinInterval(d, { start: startOfMonth(targetMonth), end: endOfMonth(targetMonth) });
        default: return true;
      }
    });
  }, [txns, view, targetMonth]);

  const summary = useMemo(() => ({
    count: filtered.length,
    volume: filtered.reduce((s, t) => s + Number(t.amount || 0), 0),
    commission: filtered.reduce((s, t) => s + Number(t.commission || 0), 0),
  }), [filtered]);

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
        fill: TYPE_META[type]?.accent || "hsl(var(--primary))",
      }))
      .sort((a, b) => b.commission - a.commission);
  }, [filtered]);

  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}`, count: 0 }));
    for (const t of filtered) hours[parseISO(t.created_at).getHours()].count++;
    return hours;
  }, [filtered]);

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

  const views: { key: View; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
  ];

  const tooltipStyle = { borderRadius: 10, fontSize: 11, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="sticky top-0 z-20 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl" onClick={() => navigate("/agent")}>
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-sm font-bold text-foreground tracking-tight">Analytics</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* View tabs */}
        <div className="flex gap-1 p-0.5 bg-muted/50 rounded-lg">
          {views.map(v => (
            <button
              key={v.key}
              onClick={() => { setView(v.key); setMonthOffset(0); }}
              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${
                view === v.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Month navigation */}
        {view === "monthly" && (
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setMonthOffset(o => o - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <span className="text-xs font-semibold text-foreground">{format(targetMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={monthOffset >= 0} onClick={() => setMonthOffset(o => o + 1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Transactions", value: loading ? "—" : String(summary.count) },
            { label: "Volume", value: loading ? "—" : `৳${fmt(summary.volume)}` },
            { label: "Commission", value: loading ? "—" : `৳${fmt(summary.commission)}`, highlight: true },
          ].map(c => (
            <Card key={c.label} className="p-3 border-0 shadow-sm rounded-xl text-center">
              <p className={`text-sm font-bold ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.value}</p>
              <p className="text-[9px] text-muted-foreground font-medium mt-0.5">{c.label}</p>
            </Card>
          ))}
        </div>

        {/* Trend */}
        <Card className="p-4 border-0 shadow-sm rounded-2xl">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Trend</h3>
          {trendData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="vG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`৳${fmt(v)}`, ""]} />
                <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fill="url(#vG)" strokeWidth={2} name="Volume" />
                <Area type="monotone" dataKey="commission" stroke="hsl(var(--accent))" fill="url(#cG)" strokeWidth={2} name="Commission" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Commission by Type */}
        <Card className="p-4 border-0 shadow-sm rounded-2xl">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Commission by Type</h3>
          {commissionByType.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No commission data</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(100, commissionByType.length * 36)}>
              <BarChart data={commissionByType} layout="vertical" margin={{ left: 4 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <YAxis dataKey="type" type="category" tick={{ fontSize: 10 }} width={85} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`৳${fmt(v)}`, "Commission"]} />
                <Bar dataKey="commission" radius={[0, 6, 6, 0]} barSize={16}>
                  {commissionByType.map((entry, idx) => (
                    <rect key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Peak Hours */}
        <Card className="p-4 border-0 shadow-sm rounded-2xl">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Peak Hours</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={peakHours}>
              <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} barSize={10} name="Txns" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Breakdown */}
        <div>
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Breakdown</h3>
          <div className="space-y-1.5">
            {typeDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No transactions</p>
            ) : (
              typeDistribution.map(([type, data]) => {
                const meta = TYPE_META[type];
                return (
                  <Card key={type} className="p-3 border-0 shadow-sm rounded-xl flex items-center gap-3 overflow-hidden" style={{ borderLeft: `3px solid ${meta?.accent || "hsl(var(--primary))"}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{meta?.label || type}</p>
                      <p className="text-[10px] text-muted-foreground">{data.count} txns</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-foreground">৳{fmt(data.volume)}</p>
                      {data.commission > 0 && (
                        <p className="text-[10px] font-medium text-primary">+৳{fmt(data.commission)}</p>
                      )}
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
