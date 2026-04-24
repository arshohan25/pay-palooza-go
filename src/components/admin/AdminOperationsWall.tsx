import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Droplets,
  Pause,
  Play,
  RefreshCw,
  Router,
  ShieldAlert,
  Siren,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ResponsiveChartFrame } from "@/components/admin/ResponsiveChartFrame";

type Severity = "healthy" | "warning" | "critical";

interface GatewayHealth {
  id: string;
  name: string;
  provider: string;
  kind: "payment" | "recharge";
  status: Severity;
  detail: string;
  enabled: boolean;
  failures: number;
  successRate?: number;
  avgResponseMs?: number;
  updatedAt?: string | null;
}

interface WallEvent {
  id: string;
  source: string;
  title: string;
  detail: string;
  amount?: number;
  severity: Severity;
  createdAt: string;
}

interface LiquidityAlert {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  value?: string;
}

interface WallState {
  gateways: GatewayHealth[];
  events: WallEvent[];
  liquidityAlerts: LiquidityAlert[];
  treasuryBalance: number;
  sevenDayNet: number;
  todayFailed: number;
  hourFailed: number;
  gatewayCritical: number;
  pendingFundAmount: number;
  lowFloatAgents: number;
  apiSuccessRate: number;
  apiAvgResponse: number;
  failureTrend: { label: string; failed: number }[];
}

const currency = (value: number) => `৳${Math.round(value || 0).toLocaleString()}`;
const shortTime = (value?: string | null) => value ? new Date(value).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const isFailedStatus = (status?: string | null) => ["failed", "reversed", "cancelled", "expired", "error"].includes(String(status || "").toLowerCase());

const EMPTY_STATE: WallState = {
  gateways: [],
  events: [],
  liquidityAlerts: [],
  treasuryBalance: 0,
  sevenDayNet: 0,
  todayFailed: 0,
  hourFailed: 0,
  gatewayCritical: 0,
  pendingFundAmount: 0,
  lowFloatAgents: 0,
  apiSuccessRate: 100,
  apiAvgResponse: 0,
  failureTrend: [],
};

function severityBadge(severity: Severity) {
  if (severity === "critical") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Critical</Badge>;
  if (severity === "warning") return <Badge variant="outline" className="gap-1 border-primary/40 text-primary"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
  return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />Healthy</Badge>;
}

function MetricCard({ label, value, hint, icon: Icon, severity = "healthy" }: { label: string; value: string | number; hint?: string; icon: any; severity?: Severity }) {
  const tone = severity === "critical" ? "bg-destructive/10 text-destructive" : severity === "warning" ? "bg-primary/10 text-primary" : "bg-muted text-primary";
  return (
    <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 truncate text-2xl font-bold text-foreground">{value}</p>
            {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminOperationsWall() {
  const [state, setState] = useState<WallState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const pauseRef = useRef(false);
  pauseRef.current = paused;

  const loadWall = useCallback(async () => {
    setLoading(true);
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      paymentGateways,
      rechargeConfigs,
      apiLogs,
      failedTxns,
      paymentSessions,
      merchantSessions,
      treasury,
      ledger,
      agents,
      pendingFunds,
    ] = await Promise.all([
      supabase.from("payment_gateways").select("id,provider,display_name,is_enabled,config,updated_at").order("sort_order"),
      supabase.from("recharge_api_configs").select("id,operator,display_name,is_enabled,test_status,last_tested,updated_at").order("operator"),
      supabase.from("merchant_api_logs").select("id,action,status_code,response_time_ms,error_message,created_at").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(250),
      supabase.from("transactions").select("id,type,amount,status,short_id,description,created_at").in("status", ["failed", "reversed"]).gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(200),
      supabase.from("payment_sessions").select("id,provider,status,amount,created_at,updated_at,metadata").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(200),
      supabase.from("merchant_payment_sessions").select("id,status,amount,reference,created_at,webhook_attempts,webhook_delivered").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(200),
      supabase.from("platform_treasury").select("balance,total_earnings,total_disbursed,updated_at").limit(1).maybeSingle(),
      supabase.from("treasury_ledger").select("type,amount,created_at").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(500),
      supabase.from("agents").select("id,user_id,business_name,status,max_float").eq("status", "active").limit(500),
      supabase.from("fund_requests").select("id,type,status,amount,source_method,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
    ]);

    const logs = apiLogs.data ?? [];
    const apiErrors = logs.filter((l) => Number(l.status_code) >= 400);
    const apiSuccessRate = logs.length ? Math.round(((logs.length - apiErrors.length) / logs.length) * 100) : 100;
    const apiAvgResponse = logs.length ? Math.round(logs.reduce((s, l) => s + Number(l.response_time_ms || 0), 0) / logs.length) : 0;
    const failedTransactions = failedTxns.data ?? [];
    const failedPaymentSessions = (paymentSessions.data ?? []).filter((s) => isFailedStatus(s.status));
    const failedMerchantSessions = (merchantSessions.data ?? []).filter((s) => isFailedStatus(s.status));
    const webhookProblems = (merchantSessions.data ?? []).filter((s) => !s.webhook_delivered && Number(s.webhook_attempts || 0) > 0);

    const gateways: GatewayHealth[] = [
      ...(paymentGateways.data ?? []).map((gw) => {
        const providerFailures = failedPaymentSessions.filter((s) => String(s.provider).toLowerCase() === String(gw.provider).toLowerCase()).length;
        const providerLogs = logs.filter((l) => String(l.action || "").toLowerCase().includes(String(gw.provider).toLowerCase()));
        const providerLogErrors = providerLogs.filter((l) => Number(l.status_code) >= 400).length;
        const failures = providerFailures + providerLogErrors;
        const status: Severity = !gw.is_enabled || failures >= 5 ? "critical" : failures > 0 || webhookProblems.length > 3 ? "warning" : "healthy";
        return {
          id: gw.id,
          name: gw.display_name,
          provider: gw.provider,
          kind: "payment" as const,
          status,
          detail: !gw.is_enabled ? "Gateway disabled" : failures ? `${failures} recent failure signal(s)` : "Processing normally",
          enabled: gw.is_enabled,
          failures,
          successRate: providerLogs.length ? Math.round(((providerLogs.length - providerLogErrors) / providerLogs.length) * 100) : undefined,
          avgResponseMs: providerLogs.length ? Math.round(providerLogs.reduce((s, l) => s + Number(l.response_time_ms || 0), 0) / providerLogs.length) : undefined,
          updatedAt: gw.updated_at,
        };
      }),
      ...(rechargeConfigs.data ?? []).map((cfg) => {
        const status: Severity = !cfg.is_enabled || cfg.test_status === "failed" ? "critical" : cfg.test_status ? "healthy" : "warning";
        return {
          id: cfg.id,
          name: cfg.display_name,
          provider: cfg.operator,
          kind: "recharge" as const,
          status,
          detail: cfg.test_status === "failed" ? "Last connection test failed" : cfg.test_status === "success" ? "Last test successful" : "Awaiting connection verification",
          enabled: cfg.is_enabled,
          failures: cfg.test_status === "failed" ? 1 : 0,
          updatedAt: cfg.last_tested || cfg.updated_at,
        };
      }),
    ];

    const agentRows = agents.data ?? [];
    let lowFloatAgents = 0;
    if (agentRows.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id,balance").in("user_id", agentRows.map((a) => a.user_id));
      const balances = new Map((profiles ?? []).map((p) => [p.user_id, Number(p.balance || 0)]));
      lowFloatAgents = agentRows.filter((a) => {
        const bal = balances.get(a.user_id) ?? 0;
        const threshold = Math.max(1000, Number(a.max_float || 0) * 0.08);
        return bal < threshold;
      }).length;
    }

    const treasuryBalance = Number(treasury.data?.balance || 0);
    const ledgerRows = ledger.data ?? [];
    const sevenDayNet = ledgerRows.reduce((sum, row) => {
      const amount = Math.abs(Number(row.amount || 0));
      const type = String(row.type || "").toLowerCase();
      return type.includes("credit") || type.includes("earning") || type.includes("deposit") ? sum + amount : sum - amount;
    }, 0);
    const pendingFundRows = pendingFunds.data ?? [];
    const pendingFundAmount = pendingFundRows.reduce((s, f) => s + Number(f.amount || 0), 0);

    const liquidityAlerts: LiquidityAlert[] = [];
    if (treasuryBalance < 50000) liquidityAlerts.push({ id: "treasury-critical", title: "Treasury critically low", detail: "Master liquidity is below the emergency operating threshold.", severity: "critical", value: currency(treasuryBalance) });
    else if (treasuryBalance < 200000) liquidityAlerts.push({ id: "treasury-warning", title: "Treasury below target", detail: "Top-up planning is recommended before peak transaction windows.", severity: "warning", value: currency(treasuryBalance) });
    if (sevenDayNet < -50000) liquidityAlerts.push({ id: "negative-flow", title: "Negative 7-day cash flow", detail: "Outflow is exceeding inflow across the recent operating window.", severity: "warning", value: currency(sevenDayNet) });
    if (lowFloatAgents > 0) liquidityAlerts.push({ id: "agent-low-float", title: "Agent float pressure", detail: `${lowFloatAgents} active agent(s) are below the low-float threshold.`, severity: lowFloatAgents > 10 ? "critical" : "warning", value: String(lowFloatAgents) });
    if (pendingFundAmount > Math.max(100000, treasuryBalance * 0.35)) liquidityAlerts.push({ id: "pending-funds", title: "Pending add-money exposure", detail: "Pending fund requests are high compared with available treasury.", severity: "warning", value: currency(pendingFundAmount) });
    if (liquidityAlerts.length === 0) liquidityAlerts.push({ id: "liquidity-ok", title: "Liquidity stable", detail: "Treasury, agent float, and pending fund pressure are within expected range.", severity: "healthy", value: currency(treasuryBalance) });

    const allEvents: WallEvent[] = [
      ...failedTransactions.map((t) => ({ id: `txn-${t.id}`, source: "Transaction", title: `${String(t.type).replace(/_/g, " ")} failed`, detail: t.description || t.short_id || String(t.status), amount: Number(t.amount || 0), severity: "critical" as Severity, createdAt: t.created_at })),
      ...failedPaymentSessions.map((s) => ({ id: `pay-${s.id}`, source: "Gateway", title: `${s.provider} payment ${s.status}`, detail: "Customer payment session did not complete", amount: Number(s.amount || 0), severity: "critical" as Severity, createdAt: s.created_at })),
      ...failedMerchantSessions.map((s) => ({ id: `merchant-${s.id}`, source: "Merchant API", title: `Merchant checkout ${s.status}`, detail: s.reference || "Merchant payment session failed", amount: Number(s.amount || 0), severity: "critical" as Severity, createdAt: s.created_at })),
      ...webhookProblems.map((s) => ({ id: `webhook-${s.id}`, source: "Webhook", title: "Webhook delivery pending", detail: `${s.webhook_attempts || 0} attempt(s) recorded`, amount: Number(s.amount || 0), severity: "warning" as Severity, createdAt: s.created_at })),
      ...apiErrors.map((l) => ({ id: `api-${l.id}`, source: "API", title: `${l.action || "Gateway request"} returned ${l.status_code}`, detail: l.error_message || `${l.response_time_ms || 0}ms response`, severity: Number(l.status_code) >= 500 ? "critical" as Severity : "warning" as Severity, createdAt: l.created_at })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 60);

    const failureTrend = Array.from({ length: 8 }).map((_, idx) => {
      const end = now - (7 - idx) * 3 * 60 * 60 * 1000;
      const start = end - 3 * 60 * 60 * 1000;
      const label = new Date(end).toLocaleTimeString("en-US", { hour: "2-digit" });
      const failed = allEvents.filter((event) => {
        const t = new Date(event.createdAt).getTime();
        return t >= start && t < end;
      }).length;
      return { label, failed };
    });

    const todayFailed = allEvents.filter((e) => new Date(e.createdAt) >= todayStart).length;
    const hourFailed = allEvents.filter((e) => e.createdAt >= hourAgo).length;

    setState({
      gateways,
      events: allEvents,
      liquidityAlerts,
      treasuryBalance,
      sevenDayNet,
      todayFailed,
      hourFailed,
      gatewayCritical: gateways.filter((g) => g.status === "critical").length,
      pendingFundAmount,
      lowFloatAgents,
      apiSuccessRate,
      apiAvgResponse,
      failureTrend,
    });
    setLastSync(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => { loadWall(); }, [loadWall]);

  useEffect(() => {
    const refreshIfLive = () => { if (!pauseRef.current) loadWall(); };
    const channel = supabase.channel("admin-operations-wall")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_sessions" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_payment_sessions" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_api_logs" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_gateways" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "recharge_api_configs" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_treasury" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "treasury_ledger" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, refreshIfLive)
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, refreshIfLive)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadWall]);

  const overallSeverity = useMemo<Severity>(() => {
    if (state.gatewayCritical > 0 || state.hourFailed > 8 || state.liquidityAlerts.some((a) => a.severity === "critical")) return "critical";
    if (state.todayFailed > 0 || state.liquidityAlerts.some((a) => a.severity === "warning") || state.apiSuccessRate < 95) return "warning";
    return "healthy";
  }, [state]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Siren className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">Operations Wall</h2>
              {severityBadge(overallSeverity)}
              <span className="relative flex h-2.5 w-2.5">
                {!paused && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${paused ? "bg-muted-foreground" : "bg-primary"}`} />
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Real-time gateway health, transaction failures, and liquidity pressure in one command view.</p>
            {lastSync && <p className="mt-1 text-xs text-muted-foreground">Last sync {lastSync}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
            {paused ? <><Play className="mr-2 h-4 w-4" />Resume</> : <><Pause className="mr-2 h-4 w-4" />Pause</>}
          </Button>
          <Button variant="outline" size="sm" onClick={loadWall} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Gateway Critical" value={state.gatewayCritical} hint={`${state.gateways.length} providers watched`} icon={Router} severity={state.gatewayCritical ? "critical" : "healthy"} />
        <MetricCard label="Failed Today" value={state.todayFailed} hint={`${state.hourFailed} in the last hour`} icon={ShieldAlert} severity={state.hourFailed > 3 ? "critical" : state.todayFailed ? "warning" : "healthy"} />
        <MetricCard label="API Success" value={`${state.apiSuccessRate}%`} hint={`${state.apiAvgResponse}ms avg response`} icon={Zap} severity={state.apiSuccessRate < 90 ? "critical" : state.apiSuccessRate < 97 ? "warning" : "healthy"} />
        <MetricCard label="Treasury" value={currency(state.treasuryBalance)} hint={`7d net ${currency(state.sevenDayNet)}`} icon={Wallet} severity={state.treasuryBalance < 50000 ? "critical" : state.treasuryBalance < 200000 ? "warning" : "healthy"} />
        <MetricCard label="Pending Funds" value={currency(state.pendingFundAmount)} hint={`${state.lowFloatAgents} low-float agents`} icon={Droplets} severity={state.pendingFundAmount > 100000 || state.lowFloatAgents > 0 ? "warning" : "healthy"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><CreditCard className="h-4 w-4 text-primary" />Gateway Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {state.gateways.map((gateway) => (
              <div key={`${gateway.kind}-${gateway.id}`} className="rounded-lg border border-border/70 bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{gateway.name}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{gateway.kind}</Badge>
                      {!gateway.enabled && <Badge variant="secondary" className="text-[10px]">Off</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{gateway.provider} • {gateway.detail}</p>
                  </div>
                  {severityBadge(gateway.status)}
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <div className="rounded-md bg-muted/60 p-2"><span className="text-muted-foreground">Failures</span><p className="font-semibold text-foreground">{gateway.failures}</p></div>
                  <div className="rounded-md bg-muted/60 p-2"><span className="text-muted-foreground">Success</span><p className="font-semibold text-foreground">{gateway.successRate ?? state.apiSuccessRate}%</p></div>
                  <div className="rounded-md bg-muted/60 p-2"><span className="text-muted-foreground">Updated</span><p className="font-semibold text-foreground">{shortTime(gateway.updatedAt)}</p></div>
                </div>
              </div>
            ))}
            {!state.gateways.length && <p className="py-8 text-center text-sm text-muted-foreground">No gateway sources configured.</p>}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" />Failure Trend</CardTitle></CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ResponsiveChartFrame className="h-44 md:h-48">
              <ResponsiveContainer width="100%" height="100%" debounce={0}>
                <BarChart data={state.failureTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="failed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              </ResponsiveChartFrame>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-card)]">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Droplets className="h-4 w-4 text-primary" />Liquidity Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {state.liquidityAlerts.map((alert) => (
                <div key={alert.id} className={`rounded-lg border p-3 ${alert.severity === "critical" ? "border-destructive/40 bg-destructive/5" : alert.severity === "warning" ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p>
                    </div>
                    {alert.value && <span className="shrink-0 text-sm font-bold text-foreground">{alert.value}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/60 bg-card/80 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-primary" />Live Operations Feed {paused && <Badge variant="outline" className="text-[10px]">Paused</Badge>}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[420px]">
            <div className="divide-y divide-border/60">
              {state.events.map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${event.severity === "critical" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                    {event.severity === "critical" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{event.source}</Badge>
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{event.detail}</p>
                  </div>
                  {event.amount !== undefined && <p className="hidden text-sm font-semibold text-foreground sm:block">{currency(event.amount)}</p>}
                  <span className="shrink-0 text-[10px] text-muted-foreground">{shortTime(event.createdAt)}</span>
                </div>
              ))}
              {!state.events.length && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="mb-2 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No operational failures in the current watch window.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {loading && <Progress value={70} className="h-1" />}
    </div>
  );
}