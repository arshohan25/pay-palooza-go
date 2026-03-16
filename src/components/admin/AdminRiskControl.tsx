import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, AlertTriangle, Eye, Ban, TrendingUp, Activity, Shield, Clock, Users } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";

/* ─── Tab 1: Agent Fraud ─── */
const AgentFraudTab = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [freezing, setFreezing] = useState<string | null>(null);

  const fetchAgents = async () => {
    const { data } = await supabase
      .from("agents")
      .select("id, user_id, business_name, max_float, territory_code, status, commission_earned, customers_onboarded")
      .eq("status", "active");
    setAgents(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAgents(); }, []);

  const flagLevel = (a: any) => {
    const util = a.commission_earned / Math.max(a.max_float, 1);
    if (util > 1.5) return "critical";
    if (util > 1) return "high";
    if (util > 0.8) return "medium";
    return "low";
  };

  const handleView = async (agent: any) => {
    setSelectedAgent(agent);
    setSheetOpen(true);
  };

  const handleFreeze = async (agent: any) => {
    setFreezing(agent.id);
    try {
      const { error } = await supabase.from("agents").update({ status: "suspended" as any }).eq("id", agent.id);
      if (error) throw error;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: "freeze_agent",
          entity_type: "agent",
          entity_id: agent.id,
          details: { business_name: agent.business_name, risk_level: flagLevel(agent) },
        });
      }
      toast.success(`Agent "${agent.business_name}" frozen`);
      fetchAgents();
    } catch {
      toast.error("Failed to freeze agent");
    } finally {
      setFreezing(null);
    }
  };

  const SEVERITY_BADGE: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading agents…</div>;

  const sorted = [...agents].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[flagLevel(a) as keyof typeof order] ?? 3) - (order[flagLevel(b) as keyof typeof order] ?? 3);
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {["critical", "high", "medium", "low"].map(sev => (
          <Card key={sev} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground capitalize">{sev}</p>
              <p className="text-2xl font-bold">{sorted.filter(a => flagLevel(a) === sev).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Territory</TableHead>
            <TableHead>Float Util.</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.slice(0, 20).map(a => {
            const level = flagLevel(a);
            const util = ((a.commission_earned / Math.max(a.max_float, 1)) * 100).toFixed(0);
            return (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.business_name || "—"}</TableCell>
                <TableCell>{a.territory_code || "N/A"}</TableCell>
                <TableCell>{util}%</TableCell>
                <TableCell><Badge className={SEVERITY_BADGE[level]}>{level}</Badge></TableCell>
                <TableCell className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleView(a)}>
                    <Eye className="w-3 h-3 mr-1" />View
                  </Button>
                  {(level === "critical" || level === "high") && (
                    <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={freezing === a.id} onClick={() => handleFreeze(a)}>
                      <Ban className="w-3 h-3 mr-1" />{freezing === a.id ? "…" : "Freeze"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {agents.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No agents found</TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Agent Details</SheetTitle></SheetHeader>
          {selectedAgent && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Business</span><span className="text-sm font-medium">{selectedAgent.business_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Territory</span><span className="text-sm font-medium">{selectedAgent.territory_code || "N/A"}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Max Float</span><span className="text-sm font-medium">৳{Number(selectedAgent.max_float).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Commission Earned</span><span className="text-sm font-medium">৳{Number(selectedAgent.commission_earned).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Customers Onboarded</span><span className="text-sm font-medium">{selectedAgent.customers_onboarded}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Float Utilization</span><span className="text-sm font-medium">{((selectedAgent.commission_earned / Math.max(selectedAgent.max_float, 1)) * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Risk Level</span><Badge className={SEVERITY_BADGE[flagLevel(selectedAgent)]}>{flagLevel(selectedAgent)}</Badge></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Status</span><Badge variant="outline">{selectedAgent.status}</Badge></div>
              </div>
              {(flagLevel(selectedAgent) === "critical" || flagLevel(selectedAgent) === "high") && (
                <Button variant="destructive" className="w-full" onClick={() => { handleFreeze(selectedAgent); setSheetOpen(false); }}>
                  <Ban className="w-4 h-4 mr-2" />Freeze This Agent
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

/* ─── Tab 2: Suspicious Cash Out ─── */
const SuspiciousCashOutTab = () => {
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date();
      today.setDate(today.getDate() - 7);
      const { data } = await supabase
        .from("transactions")
        .select("id, user_id, amount, fee, created_at, recipient_name, short_id")
        .eq("type", "cashout" as any)
        .eq("status", "completed" as any)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      setTxns(data ?? []);
      setLoading(false);
    })();
  }, []);

  const largeTxns = txns.filter(t => Number(t.amount) > 25000);
  const roundTxns = txns.filter(t => Number(t.amount) % 5000 === 0 && Number(t.amount) >= 10000);
  const nightTxns = txns.filter(t => {
    const h = new Date(t.created_at).getHours();
    return h >= 0 && h < 6;
  });

  // Smurfing: same user, same amount, multiple times
  const amountMap = new Map<string, number>();
  txns.forEach(t => {
    const key = `${t.user_id}-${t.amount}`;
    amountMap.set(key, (amountMap.get(key) || 0) + 1);
  });
  const smurfCount = [...amountMap.values()].filter(v => v >= 3).length;

  if (loading) return <div className="text-center py-8 text-muted-foreground">Scanning cashouts…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Large (>৳25K)", count: largeTxns.length, color: "text-red-600" },
          { label: "Round Amounts", count: roundTxns.length, color: "text-amber-600" },
          { label: "Night (12-6AM)", count: nightTxns.length, color: "text-purple-600" },
          { label: "Smurfing Patterns", count: smurfCount, color: "text-orange-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Large Cashouts</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {largeTxns.slice(0, 15).map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.short_id}</TableCell>
                  <TableCell className="font-medium">৳{Number(t.amount).toLocaleString()}</TableCell>
                  <TableCell>{t.recipient_name || "—"}</TableCell>
                  <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("en-BD", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</TableCell>
                  <TableCell><Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">High Value</Badge></TableCell>
                </TableRow>
              ))}
              {largeTxns.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No large cashouts in last 7 days</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Tab 3: AML Rules ─── */
const AmlRulesTab = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = async () => {
    const { data } = await supabase.from("aml_rules").select("*").order("created_at");
    setRules(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const toggleRule = async (id: string, current: boolean) => {
    await supabase.from("aml_rules").update({ is_active: !current, updated_at: new Date().toISOString() }).eq("id", id);
    toast.success(`Rule ${!current ? "enabled" : "disabled"}`);
    fetchRules();
  };

  const ACTION_BADGE: Record<string, string> = {
    flag: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    block: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    alert: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading rules…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rules.filter(r => r.is_active).length} active rules</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>Condition</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Triggers</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map(r => (
            <TableRow key={r.id} className={!r.is_active ? "opacity-50" : ""}>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{r.rule_name}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </div>
              </TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{r.condition_type}</Badge></TableCell>
              <TableCell className="font-mono">{Number(r.threshold).toLocaleString()}</TableCell>
              <TableCell className="text-sm">{r.time_window_minutes}m</TableCell>
              <TableCell><Badge className={ACTION_BADGE[r.action] || "bg-muted"}>{r.action}</Badge></TableCell>
              <TableCell className="font-mono">{r.trigger_count}</TableCell>
              <TableCell>
                <Switch checked={r.is_active} onCheckedChange={() => toggleRule(r.id, r.is_active)} />
              </TableCell>
            </TableRow>
          ))}
          {rules.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No AML rules configured</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

/* ─── Tab 4: Transaction Limits ─── */
const TxnLimitsTab = () => {
  const [limits, setLimits] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: lim }, { data: ovr }] = await Promise.all([
        supabase.from("transaction_limits").select("*").eq("is_active", true).order("txn_type"),
        supabase.from("user_limit_overrides").select("*").eq("is_active", true).limit(50),
      ]);
      setLimits(lim ?? []);
      setOverrides(ovr ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading limits…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Global Limits</p>
            <p className="text-2xl font-bold">{limits.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Active Overrides</p>
            <p className="text-2xl font-bold">{overrides.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
            <p className="text-2xl font-bold text-amber-600">
              {overrides.filter(o => o.expires_at && new Date(o.expires_at) < new Date(Date.now() + 86400000 * 3)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Active Global Limits</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Max Amount</TableHead>
                <TableHead>Applies To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium capitalize">{l.txn_type}</TableCell>
                  <TableCell>{l.period}</TableCell>
                  <TableCell className="font-mono">৳{Number(l.max_amount).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{l.applies_to}</Badge></TableCell>
                </TableRow>
              ))}
              {limits.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No global limits set</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Tab 5: Risk Dashboard ─── */
const RiskDashboardTab = () => {
  const [fraudCount, setFraudCount] = useState(0);
  const [amlActive, setAmlActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<{ day: string; risk: number }[]>([]);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [{ count: fc }, { data: aml }, { data: alerts7d }] = await Promise.all([
        supabase.from("fraud_alerts").select("*", { count: "exact", head: true }).in("status", ["open", "investigating"]),
        supabase.from("aml_rules").select("id").eq("is_active", true),
        supabase.from("fraud_alerts").select("created_at, severity").gte("created_at", weekAgo),
      ]);
      setFraudCount(fc ?? 0);
      setAmlActive(aml?.length ?? 0);

      // Build real 7-day trend from fraud_alerts
      const dayCounts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayCounts[d.toLocaleDateString("en", { weekday: "short" })] = 0;
      }
      for (const alert of (alerts7d ?? [])) {
        const d = new Date(alert.created_at);
        const key = d.toLocaleDateString("en", { weekday: "short" });
        if (key in dayCounts) {
          const weight = alert.severity === "critical" ? 3 : alert.severity === "high" ? 2 : 1;
          dayCounts[key] += weight;
        }
      }
      const maxVal = Math.max(...Object.values(dayCounts), 1);
      setTrendData(Object.entries(dayCounts).map(([day, val]) => ({
        day,
        risk: Math.min(100, Math.round((val / maxVal) * 80 + 10)),
      })));

      setLoading(false);
    })();
  }, []);

  const riskScore = Math.min(100, fraudCount * 15 + (amlActive > 3 ? 10 : 0) + 25);
  const riskColor = riskScore > 70 ? "text-red-600" : riskScore > 40 ? "text-amber-600" : "text-emerald-600";

  if (loading) return <div className="text-center py-8 text-muted-foreground">Calculating risk…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Platform Risk Score</p>
            <p className={`text-3xl font-bold ${riskColor}`}>{riskScore}</p>
            <p className="text-xs text-muted-foreground">/100</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Open Fraud Alerts</p>
            <p className="text-2xl font-bold text-red-600">{fraudCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Active AML Rules</p>
            <p className="text-2xl font-bold">{amlActive}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Risk Trend</p>
            <p className="text-2xl font-bold text-muted-foreground">7d</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Score Trend (7 days)</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={{ risk: { label: "Risk", color: "hsl(var(--destructive))" } }} className="h-[200px]">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis domain={[0, 100]} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="risk" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

/* ─── Main Component ─── */
export default function AdminRiskControl() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Risk Control Center</h2>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="text-xs">Risk Dashboard</TabsTrigger>
          <TabsTrigger value="agent_fraud" className="text-xs">Agent Fraud</TabsTrigger>
          <TabsTrigger value="cash_out" className="text-xs">Suspicious Cash Out</TabsTrigger>
          <TabsTrigger value="aml" className="text-xs">AML Rules</TabsTrigger>
          <TabsTrigger value="limits" className="text-xs">Txn Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><RiskDashboardTab /></TabsContent>
        <TabsContent value="agent_fraud"><AgentFraudTab /></TabsContent>
        <TabsContent value="cash_out"><SuspiciousCashOutTab /></TabsContent>
        <TabsContent value="aml"><AmlRulesTab /></TabsContent>
        <TabsContent value="limits"><TxnLimitsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
