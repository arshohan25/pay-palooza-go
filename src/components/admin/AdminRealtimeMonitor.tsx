import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Zap, Users, ArrowLeftRight, Clock, TrendingUp, Pause, Play } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface LiveEvent {
  id: string;
  type: "transaction" | "user" | "alert" | "kyc";
  label: string;
  detail: string;
  time: string;
  severity?: string;
}

export default function AdminRealtimeMonitor() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [txnRate, setTxnRate] = useState<{ time: string; count: number }[]>([]);
  const [activeUsers, setActiveUsers] = useState(0);
  const [todayTxns, setTodayTxns] = useState(0);
  const [todayVolume, setTodayVolume] = useState(0);
  const pauseRef = useRef(false);
  pauseRef.current = paused;

  useEffect(() => {
    // Load today's stats
    const loadStats = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data, count } = await supabase.from("transactions")
        .select("amount", { count: "exact" })
        .eq("status", "completed")
        .gte("created_at", todayStart.toISOString());
      setTodayTxns(count ?? 0);
      setTodayVolume((data ?? []).reduce((s, t) => s + Number(t.amount), 0));

      // Active users (profiles updated in last 24h)
      const { count: activeCount } = await supabase.from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      setActiveUsers(activeCount ?? 0);
    };
    loadStats();

    // Seed txn rate chart
    const now = new Date();
    const initial: { time: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 5 * 60 * 1000);
      initial.push({ time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), count: 0 });
    }
    setTxnRate(initial);

    // Subscribe to real-time events
    const channel = supabase.channel("admin-live-monitor")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        if (pauseRef.current) return;
        const txn = payload.new as any;
        setEvents(prev => [{
          id: txn.id,
          type: "transaction" as const,
          label: `${txn.type} ৳${Number(txn.amount).toLocaleString()}`,
          detail: txn.recipient_phone || txn.short_id || "",
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 50));
        setTodayTxns(c => c + 1);
        setTodayVolume(v => v + Number(txn.amount));
        setTxnRate(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], count: updated[updated.length - 1].count + 1 };
          return updated;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fraud_alerts" }, (payload) => {
        if (pauseRef.current) return;
        const alert = payload.new as any;
        setEvents(prev => [{
          id: alert.id,
          type: "alert",
          label: `🚨 ${alert.rule_triggered}`,
          detail: `Severity: ${alert.severity}`,
          time: new Date().toLocaleTimeString(),
          severity: alert.severity,
        }, ...prev].slice(0, 50));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (payload) => {
        if (pauseRef.current) return;
        const p = payload.new as any;
        setEvents(prev => [{
          id: p.id,
          type: "user",
          label: `New user: ${p.name || p.phone || "Unknown"}`,
          detail: p.phone || "",
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 50));
        setActiveUsers(c => c + 1);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "kyc_verifications" }, (payload) => {
        if (pauseRef.current) return;
        setEvents(prev => [{
          id: (payload.new as any).id,
          type: "kyc",
          label: "New KYC submission",
          detail: `Status: ${(payload.new as any).status}`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 50));
      })
      .subscribe();

    // Rotate rate chart every 5 min
    const rateInterval = setInterval(() => {
      setTxnRate(prev => {
        const now = new Date();
        return [...prev.slice(1), { time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }), count: 0 }];
      });
    }, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(rateInterval);
    };
  }, []);

  const eventTypeColors: Record<string, string> = {
    transaction: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    user: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    alert: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    kyc: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Real-time Monitor</h2>
          <span className="relative flex h-2.5 w-2.5">
            {!paused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${paused ? "bg-amber-500" : "bg-emerald-500"}`} />
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPaused(p => !p)}>
          {paused ? <><Play className="w-3.5 h-3.5 mr-1.5" /> Resume</> : <><Pause className="w-3.5 h-3.5 mr-1.5" /> Pause</>}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Active Users</p>
          <p className="text-2xl font-bold text-foreground">{activeUsers.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Today's Txns</p>
          <p className="text-2xl font-bold text-foreground">{todayTxns.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Today's Volume</p>
          <p className="text-2xl font-bold text-foreground">৳{todayVolume.toLocaleString()}</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Live Events</p>
          <p className="text-2xl font-bold text-foreground">{events.length}</p>
        </CardContent></Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Transaction Rate (5-min intervals)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={txnRate}>
              <XAxis dataKey="time" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" /> Live Event Stream
            {paused && <Badge variant="outline" className="text-[9px]">Paused</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[350px]">
            <div className="divide-y divide-border/50">
              {events.map(e => (
                <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                  <Badge variant="secondary" className={`text-[9px] shrink-0 ${eventTypeColors[e.type] || ""}`}>{e.type}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.label}</p>
                    {e.detail && <p className="text-xs text-muted-foreground truncate">{e.detail}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1"><Clock className="w-3 h-3" />{e.time}</span>
                </div>
              ))}
              {events.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Activity className="w-10 h-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Waiting for live events…</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
