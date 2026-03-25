import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { Activity, TrendingUp, AlertTriangle, Clock } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(45 93% 47%)"];
const RANGES = [
  { key: "24h", label: "24h", ms: 86400000 },
  { key: "7d", label: "7 Days", ms: 604800000 },
  { key: "30d", label: "30 Days", ms: 2592000000 },
] as const;

interface LogRow {
  id: string;
  merchant_id: string;
  status_code: number;
  response_time_ms: number;
  created_at: string;
  action: string;
}

export default function AdminApiUsageAnalytics({ search }: { search: string }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"24h" | "7d" | "30d">("7d");
  const [merchantNames, setMerchantNames] = useState<Record<string, string>>({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - RANGES.find(r => r.key === range)!.ms).toISOString();
    const { data } = await (supabase as any)
      .from("merchant_api_logs")
      .select("id, merchant_id, status_code, response_time_ms, created_at, action")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const rows = (data || []) as LogRow[];
    setLogs(rows);

    const ids = [...new Set(rows.map(r => r.merchant_id).filter(Boolean))];
    if (ids.length) {
      const { data: merchants } = await supabase.from("merchants").select("id, business_name").in("id", ids);
      setMerchantNames(Object.fromEntries((merchants ?? []).map(m => [m.id, m.business_name])));
    }
    setLoading(false);
  }, [range]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter(l => l.status_code >= 200 && l.status_code < 300).length;
    const errors = logs.filter(l => l.status_code >= 400).length;
    const avgTime = total ? Math.round(logs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / total) : 0;
    return { total, success, errors, avgTime, successRate: total ? Math.round((success / total) * 100) : 0 };
  }, [logs]);

  // Daily chart data
  const dailyData = useMemo(() => {
    const map: Record<string, { date: string; requests: number; errors: number }> = {};
    logs.forEach(l => {
      const d = l.created_at.slice(0, 10);
      if (!map[d]) map[d] = { date: d, requests: 0, errors: 0 };
      map[d].requests++;
      if (l.status_code >= 400) map[d].errors++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs]);

  // Status code breakdown
  const statusBreakdown = useMemo(() => {
    const s2 = logs.filter(l => l.status_code >= 200 && l.status_code < 300).length;
    const s4 = logs.filter(l => l.status_code >= 400 && l.status_code < 500).length;
    const s5 = logs.filter(l => l.status_code >= 500).length;
    return [
      { name: "2xx Success", value: s2 },
      { name: "4xx Client", value: s4 },
      { name: "5xx Server", value: s5 },
    ].filter(d => d.value > 0);
  }, [logs]);

  // Top merchants
  const topMerchants = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => { counts[l.merchant_id] = (counts[l.merchant_id] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ name: merchantNames[id] || id.slice(0, 8), count }));
  }, [logs, merchantNames]);

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="bg-muted/50 rounded-lg p-1 flex gap-0.5 w-fit">
        {RANGES.map(r => (
          <button
            key={r.key}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${range === r.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setRange(r.key as any)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Activity className="w-7 h-7 text-primary" />
          <div><p className="text-2xl font-bold text-foreground">{stats.total}</p><p className="text-xs text-muted-foreground">Total Requests</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-emerald-500" />
          <div><p className="text-2xl font-bold text-foreground">{stats.successRate}%</p><p className="text-xs text-muted-foreground">Success Rate</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-destructive" />
          <div><p className="text-2xl font-bold text-foreground">{stats.errors}</p><p className="text-xs text-muted-foreground">Errors</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="w-7 h-7 text-amber-500" />
          <div><p className="text-2xl font-bold text-foreground">{stats.avgTime}ms</p><p className="text-xs text-muted-foreground">Avg Response</p></div>
        </CardContent></Card>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Loading analytics...</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Daily requests chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Requests</CardTitle></CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="errors" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Status breakdown pie */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Status Breakdown</CardTitle></CardHeader>
            <CardContent>
              {statusBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                        {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {statusBreakdown.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{item.name}</span>
                        <Badge variant="secondary" className="text-xs">{item.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top merchants */}
          <Card className="col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Merchants by Volume</CardTitle></CardHeader>
            <CardContent>
              {topMerchants.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="space-y-2">
                  {topMerchants.map((m, i) => (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                      <span className="text-sm font-medium text-foreground flex-1">{m.name}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(m.count / (topMerchants[0]?.count || 1)) * 100}%` }}
                        />
                      </div>
                      <Badge variant="outline" className="text-xs">{m.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
