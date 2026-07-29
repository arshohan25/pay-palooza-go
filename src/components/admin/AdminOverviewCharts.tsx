import { useState, useEffect, useMemo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Users, Clock, PieChart as PieIcon, DollarSign, CheckCircle, Building2, GripVertical, RotateCcw, Wallet, Coins, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, ComposedChart, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { subDays, subWeeks, subMonths, format, startOfWeek, startOfMonth, getHours } from "date-fns";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, rectSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Period = "daily" | "weekly" | "monthly";

interface TxnRow { type: string; amount: number; fee: number; commission: number; created_at: string; }
interface StatusRow { status: string; }

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
};

const TYPE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(160, 60%, 45%)",
  "hsl(40, 80%, 50%)", "hsl(280, 60%, 55%)", "hsl(200, 70%, 50%)",
  "hsl(20, 80%, 55%)", "hsl(320, 60%, 50%)",
];

const STATUS_COLORS = {
  completed: "hsl(160, 60%, 45%)",
  failed: "hsl(var(--destructive))",
  pending: "hsl(40, 80%, 50%)",
};

const DEFAULT_ORDER = [
  "net_revenue_trend", "revenue_by_type",
  "txn_volume", "cumulative", "type_breakdown", "revenue_fees",
  "signups", "active_hours", "success_ratio", "growth",
];

const STORAGE_KEY = "admin_chart_order";

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as string[];
    // Merge: keep saved order, append any new panels
    const merged = parsed.filter(id => DEFAULT_ORDER.includes(id));
    DEFAULT_ORDER.forEach(id => { if (!merged.includes(id)) merged.push(id); });
    return merged;
  } catch { return DEFAULT_ORDER; }
}

/* ─── Sortable wrapper ─── */
function SortableChartCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative group">
        <button
          {...listeners}
          className="absolute top-3 right-3 z-10 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing hover:bg-muted"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function AdminOverviewCharts() {
  const [period, setPeriod] = useState<Period>("daily");
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [signups, setSignups] = useState<string[]>([]);
  const [statusData, setStatusData] = useState<StatusRow[]>([]);
  const [agentDates, setAgentDates] = useState<string[]>([]);
  const [merchantDates, setMerchantDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOrder, setPanelOrder] = useState<string[]>(loadOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const since = subMonths(new Date(), 6).toISOString();
      const [txnRes, signupRes, statusRes, agentRes, merchantRes] = await Promise.all([
        supabase.from("transactions").select("type, amount, fee, commission, created_at").eq("status", "completed").gte("created_at", since).order("created_at", { ascending: true }).limit(2000),
        supabase.from("profiles").select("created_at").gte("created_at", subDays(new Date(), 14).toISOString()).order("created_at", { ascending: true }).limit(1000),
        supabase.from("transactions").select("status").gte("created_at", since).limit(1000),
        supabase.from("agents").select("created_at").gte("created_at", since).order("created_at", { ascending: true }).limit(1000),
        supabase.from("merchants").select("created_at").gte("created_at", since).order("created_at", { ascending: true }).limit(1000),
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

  // ─── Computed data ───
  const dailyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; fees: number; commission: number; net: number }>();
    const cutoff = subDays(new Date(), 14);
    txns.filter(t => new Date(t.created_at) >= cutoff).forEach(t => {
      const day = t.created_at.slice(0, 10);
      const prev = map.get(day) ?? { count: 0, volume: 0, fees: 0, commission: 0, net: 0 };
      const c = Number(t.commission) || 0;
      const f = Number(t.fee) || 0;
      map.set(day, { count: prev.count + 1, volume: prev.volume + t.amount, fees: prev.fees + f, commission: prev.commission + c, net: prev.net + (f - c) });
    });
    return Array.from(map.entries()).map(([date, v]) => ({ date: format(new Date(date), "MMM dd"), ...v }));
  }, [txns]);

  const weeklyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; fees: number; commission: number; net: number }>();
    const cutoff = subWeeks(new Date(), 8);
    txns.filter(t => new Date(t.created_at) >= cutoff).forEach(t => {
      const week = format(startOfWeek(new Date(t.created_at), { weekStartsOn: 0 }), "MMM dd");
      const prev = map.get(week) ?? { count: 0, volume: 0, fees: 0, commission: 0, net: 0 };
      const c = Number(t.commission) || 0;
      const f = Number(t.fee) || 0;
      map.set(week, { count: prev.count + 1, volume: prev.volume + t.amount, fees: prev.fees + f, commission: prev.commission + c, net: prev.net + (f - c) });
    });
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [txns]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; fees: number; commission: number; net: number }>();
    txns.forEach(t => {
      const month = format(startOfMonth(new Date(t.created_at)), "MMM yy");
      const prev = map.get(month) ?? { count: 0, volume: 0, fees: 0, commission: 0, net: 0 };
      const c = Number(t.commission) || 0;
      const f = Number(t.fee) || 0;
      map.set(month, { count: prev.count + 1, volume: prev.volume + t.amount, fees: prev.fees + f, commission: prev.commission + c, net: prev.net + (f - c) });
    });
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [txns]);

  const signupData = useMemo(() => {
    const map = new Map<string, number>();
    signups.forEach(d => { const day = d.slice(0, 10); map.set(day, (map.get(day) ?? 0) + 1); });
    return Array.from(map.entries()).map(([date, count]) => ({ date: format(new Date(date), "MMM dd"), count }));
  }, [signups]);

  const hourlyData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }));
    txns.filter(t => t.created_at.startsWith(today)).forEach(t => { hours[getHours(new Date(t.created_at))].count++; });
    return hours;
  }, [txns]);

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    txns.forEach(t => { map.set(t.type, (map.get(t.type) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [txns]);

  const feeData = useMemo(() => {
    if (period === "daily") return dailyData;
    if (period === "weekly") return weeklyData;
    return monthlyData;
  }, [period, dailyData, weeklyData, monthlyData]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    statusData.forEach(s => { map.set(s.status, (map.get(s.status) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [statusData]);

  const successRate = useMemo(() => {
    const total = statusData.length;
    if (total === 0) return 0;
    return Math.round((statusData.filter(s => s.status === "completed").length / total) * 100);
  }, [statusData]);

  const growthData = useMemo(() => {
    const map = new Map<string, { agents: number; merchants: number }>();
    agentDates.forEach(d => { const m = format(startOfMonth(new Date(d)), "MMM yy"); const prev = map.get(m) ?? { agents: 0, merchants: 0 }; map.set(m, { ...prev, agents: prev.agents + 1 }); });
    merchantDates.forEach(d => { const m = format(startOfMonth(new Date(d)), "MMM yy"); const prev = map.get(m) ?? { agents: 0, merchants: 0 }; map.set(m, { ...prev, merchants: prev.merchants + 1 }); });
    let cumA = 0, cumM = 0;
    return [...map.keys()].sort().map(month => { const v = map.get(month)!; cumA += v.agents; cumM += v.merchants; return { month, agents: cumA, merchants: cumM }; });
  }, [agentDates, merchantDates]);

  const revenueByType = useMemo(() => {
    const map = new Map<string, { fees: number; commission: number; net: number }>();
    txns.forEach(t => {
      const f = Number(t.fee) || 0;
      const c = Number(t.commission) || 0;
      const prev = map.get(t.type) ?? { fees: 0, commission: 0, net: 0 };
      map.set(t.type, { fees: prev.fees + f, commission: prev.commission + c, net: prev.net + (f - c) });
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .filter(r => r.fees > 0 || r.commission > 0)
      .sort((a, b) => b.net - a.net)
      .slice(0, 8);
  }, [txns]);

  const revenueKpis = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStart = startOfMonth(new Date()).toISOString().slice(0, 10);
    const prevMonthStart = startOfMonth(subMonths(new Date(), 1)).toISOString().slice(0, 10);
    let today = 0, mtd = 0, prevMtd = 0, totalFees = 0, totalCommission = 0;
    txns.forEach(t => {
      const f = Number(t.fee) || 0;
      const c = Number(t.commission) || 0;
      const net = f - c;
      const d = t.created_at.slice(0, 10);
      totalFees += f;
      totalCommission += c;
      if (d === todayStr) today += net;
      if (d >= monthStart) mtd += net;
      else if (d >= prevMonthStart && d < monthStart) prevMtd += net;
    });
    const delta = prevMtd > 0 ? ((mtd - prevMtd) / prevMtd) * 100 : (mtd > 0 ? 100 : 0);
    return { today, mtd, prevMtd, delta, totalFees, totalCommission, netRevenue: totalFees - totalCommission };
  }, [txns]);

  const chartData = period === "daily" ? dailyData : period === "weekly" ? weeklyData : monthlyData;

  const renderDonutLabel = ({ name, percent }: { name: string; percent: number }) =>
    percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : "";


  // ─── Chart panels map ───
  const panels: Record<string, ReactNode> = {
    net_revenue_trend: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" />Net Revenue Trend (Fees − Commission)</CardTitle></CardHeader>
        <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData}><defs><linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.35} /><stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`৳${Number(v).toLocaleString()}`, name === "fees" ? "Fees" : name === "commission" ? "Commission" : "Net"]} /><Legend wrapperStyle={{ fontSize: 10 }} /><Area type="monotone" dataKey="net" name="Net" stroke="hsl(160, 60%, 45%)" fill="url(#netGrad)" strokeWidth={2} /><Line type="monotone" dataKey="fees" name="Fees" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="commission" name="Commission" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    revenue_by_type: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" />Revenue by Transaction Type</CardTitle></CardHeader>
        <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={revenueByType} layout="vertical" margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis type="category" dataKey="name" width={80} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`৳${Number(v).toLocaleString()}`, name === "fees" ? "Fees" : name === "commission" ? "Commission" : "Net"]} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="fees" name="Fees" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} /><Bar dataKey="commission" name="Commission" fill="hsl(var(--destructive))" radius={[0, 3, 3, 0]} /><Bar dataKey="net" name="Net" fill="hsl(160, 60%, 45%)" radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    txn_volume: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Transaction Volume & Count</CardTitle></CardHeader>
        <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis yAxisId="left" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis yAxisId="right" orientation="right" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [name === "volume" ? `৳${v.toLocaleString()}` : v, name === "volume" ? "Volume" : "Count"]} /><Bar yAxisId="left" dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} /><Line yAxisId="right" type="monotone" dataKey="count" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} /></ComposedChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    cumulative: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-500" />Cumulative Volume (6 Months)</CardTitle></CardHeader>
        <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyData}><defs><linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`৳${v.toLocaleString()}`, "Volume"]} /><Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" fill="url(#volumeGrad)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    type_breakdown: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieIcon className="w-4 h-4 text-violet-500" />Transaction Type Breakdown</CardTitle></CardHeader>
        <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label={renderDonutLabel}>{typeBreakdown.map((_, i) => (<Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />))}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    revenue_fees: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" />Revenue & Fees Trend</CardTitle></CardHeader>
        <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={feeData}><defs><linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(160, 60%, 45%)" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`৳${v.toLocaleString()}`, "Fees"]} /><Area type="monotone" dataKey="fees" stroke="hsl(160, 60%, 45%)" fill="url(#feeGrad)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    signups: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" />User Signups (14 Days)</CardTitle></CardHeader>
        <CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={signupData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="count" stroke="hsl(200, 70%, 50%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(200, 70%, 50%)" }} /></LineChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    active_hours: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" />Active Hours (Today)</CardTitle></CardHeader>
        <CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={hourlyData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} interval={2} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="hsl(40, 80%, 50%)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    success_ratio: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" />Success vs Failed Ratio</CardTitle></CardHeader>
        <CardContent><div className="h-48 relative"><div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><span className="text-2xl font-bold text-foreground">{successRate}%</span></div><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value">{statusBreakdown.map((entry) => (<Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? "hsl(var(--muted))"} />))}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /></PieChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
    growth: (
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-violet-500" />Agent & Merchant Growth</CardTitle></CardHeader>
        <CardContent><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={growthData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} /><YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} allowDecimals={false} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="agents" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Agents" /><Line type="monotone" dataKey="merchants" stroke="hsl(280, 60%, 55%)" strokeWidth={2} dot={{ r: 3 }} name="Merchants" /><Legend wrapperStyle={{ fontSize: 10 }} /></LineChart></ResponsiveContainer></div></CardContent>
      </Card>
    ),
  };

  // ─── DnD handler ───
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPanelOrder(prev => {
      const oldIdx = prev.indexOf(active.id as string);
      const newIdx = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIdx, newIdx);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function resetOrder() {
    setPanelOrder(DEFAULT_ORDER);
    localStorage.removeItem(STORAGE_KEY);
  }

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

  const isCustomOrder = JSON.stringify(panelOrder) !== JSON.stringify(DEFAULT_ORDER);

  return (
    <div className="space-y-4">
      {/* Period Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-foreground">Analytics</span>
        <div className="ml-auto flex gap-1 items-center">
          {isCustomOrder && (
            <Button size="sm" variant="ghost" className="text-xs h-7 px-2 gap-1" onClick={resetOrder}>
              <RotateCcw className="w-3 h-3" /> Reset layout
            </Button>
          )}
          <div className="bg-muted/50 rounded-lg p-1 flex gap-0.5">
            {(["daily", "weekly", "monthly"] as Period[]).map(p => (
              <button key={p} className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${period === p ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setPeriod(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Net Revenue (6M)", value: `৳${revenueKpis.netRevenue.toLocaleString()}`, icon: Wallet, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Total Fees Collected", value: `৳${revenueKpis.totalFees.toLocaleString()}`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
          { label: "Commissions Paid", value: `৳${revenueKpis.totalCommission.toLocaleString()}`, icon: Coins, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Today (Net)", value: `৳${revenueKpis.today.toLocaleString()}`, icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10", delta: revenueKpis.delta },
        ].map((k) => (
          <Card key={k.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center ${k.color}`}><k.icon className="w-5 h-5" /></div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="text-base font-bold text-foreground truncate">{k.value}</p>
                {typeof k.delta === "number" && (
                  <p className={`text-[10px] flex items-center gap-0.5 ${k.delta >= 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {k.delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(k.delta).toFixed(1)}% MTD vs prev
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>


      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={panelOrder} strategy={rectSortingStrategy}>
          <div className="grid md:grid-cols-2 gap-4">
            {panelOrder.map(id => (
              <SortableChartCard key={id} id={id}>
                {panels[id]}
              </SortableChartCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
