import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Brain, ShieldAlert, TrendingUp, AlertTriangle, Activity, Zap, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface RiskProfile {
  userId: string;
  name: string;
  phone: string;
  riskScore: number;
  factors: string[];
  txnCount: number;
  totalVolume: number;
  flagged: boolean;
}

const RISK_THRESHOLDS = { low: 30, medium: 60, high: 80 };

function getRiskColor(score: number) {
  if (score >= RISK_THRESHOLDS.high) return "text-destructive";
  if (score >= RISK_THRESHOLDS.medium) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

function getRiskBadge(score: number) {
  if (score >= RISK_THRESHOLDS.high) return { label: "High Risk", variant: "destructive" as const };
  if (score >= RISK_THRESHOLDS.medium) return { label: "Medium", variant: "secondary" as const };
  return { label: "Low", variant: "outline" as const };
}

export default function AdminAiFraudDetection() {
  const [subTab, setSubTab] = useState<"overview" | "profiles" | "patterns" | "velocity">("overview");
  const [loading, setLoading] = useState(true);
  const [riskProfiles, setRiskProfiles] = useState<RiskProfile[]>([]);
  const [alertStats, setAlertStats] = useState({ total: 0, open: 0, critical: 0, resolved: 0 });
  const [velocityAlerts, setVelocityAlerts] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<{ label: string; count: number; severity: string }[]>([]);

  const analyze = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [alertsRes, txnsRes, profilesRes, devicesRes] = await Promise.all([
        supabase.from("fraud_alerts").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("transactions").select("user_id, type, amount, created_at, recipient_phone, status")
          .gte("created_at", weekAgo.toISOString()).eq("status", "completed").order("created_at", { ascending: false }).limit(1000),
        supabase.from("profiles").select("user_id, name, phone, balance, status").limit(500),
        supabase.from("device_registrations").select("user_id, device_fingerprint").limit(500),
      ]);

      const alerts = alertsRes.data ?? [];
      const txns = txnsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const devices = devicesRes.data ?? [];

      // Alert stats
      setAlertStats({
        total: alerts.length,
        open: alerts.filter(a => a.status === "open").length,
        critical: alerts.filter(a => a.severity === "critical").length,
        resolved: alerts.filter(a => a.status === "resolved").length,
      });

      // Pattern detection
      const patternMap: Record<string, { count: number; severity: string }> = {};
      const userTxnCounts: Record<string, number> = {};
      const userTxnVolumes: Record<string, number> = {};
      const userRecipients: Record<string, Set<string>> = {};

      for (const txn of txns) {
        const uid = txn.user_id;
        userTxnCounts[uid] = (userTxnCounts[uid] || 0) + 1;
        userTxnVolumes[uid] = (userTxnVolumes[uid] || 0) + Number(txn.amount);
        if (txn.recipient_phone) {
          if (!userRecipients[uid]) userRecipients[uid] = new Set();
          userRecipients[uid].add(txn.recipient_phone);
        }
      }

      // Velocity checks (>10 txns/day)
      const dailyTxns: Record<string, number> = {};
      for (const txn of txns) {
        if (new Date(txn.created_at) >= dayAgo) {
          dailyTxns[txn.user_id] = (dailyTxns[txn.user_id] || 0) + 1;
        }
      }
      const velocityFlags = Object.entries(dailyTxns)
        .filter(([, count]) => count > 8)
        .map(([uid, count]) => {
          const p = profiles.find(pr => pr.user_id === uid);
          return { userId: uid, name: p?.name || "Unknown", phone: p?.phone || "", count, severity: count > 15 ? "critical" : "high" };
        })
        .sort((a, b) => b.count - a.count);
      setVelocityAlerts(velocityFlags);

      // Pattern analysis
      const highVolumeUsers = Object.entries(userTxnVolumes).filter(([, v]) => v > 50000).length;
      const multiRecipientUsers = Object.entries(userRecipients).filter(([, s]) => s.size > 10).length;
      const multiDeviceUsers = new Set<string>();
      const deviceMap: Record<string, Set<string>> = {};
      for (const d of devices) {
        if (!deviceMap[d.user_id]) deviceMap[d.user_id] = new Set();
        deviceMap[d.user_id].add(d.device_fingerprint);
        if (deviceMap[d.user_id].size > 2) multiDeviceUsers.add(d.user_id);
      }

      setPatterns([
        { label: "High-volume users (>৳50K/week)", count: highVolumeUsers, severity: highVolumeUsers > 5 ? "high" : "medium" },
        { label: "Multi-recipient senders (>10 recipients)", count: multiRecipientUsers, severity: multiRecipientUsers > 3 ? "high" : "low" },
        { label: "Multi-device accounts (>2 devices)", count: multiDeviceUsers.size, severity: multiDeviceUsers.size > 5 ? "high" : "medium" },
        { label: "Velocity violations (>8 txns/day)", count: velocityFlags.length, severity: velocityFlags.length > 3 ? "critical" : "medium" },
        { label: "Rapid-fire same-amount sends", count: alerts.filter(a => a.rule_triggered?.includes("rapid") || a.rule_triggered?.includes("velocity")).length, severity: "high" },
      ]);

      // Build risk profiles
      const riskList: RiskProfile[] = profiles.map(p => {
        const uid = p.user_id;
        let score = 0;
        const factors: string[] = [];
        const txnCount = userTxnCounts[uid] || 0;
        const volume = userTxnVolumes[uid] || 0;

        if (volume > 100000) { score += 30; factors.push("Very high volume"); }
        else if (volume > 50000) { score += 15; factors.push("High volume"); }

        if (txnCount > 20) { score += 20; factors.push("High frequency"); }
        if ((userRecipients[uid]?.size || 0) > 10) { score += 15; factors.push("Many recipients"); }
        if (multiDeviceUsers.has(uid)) { score += 20; factors.push("Multi-device"); }
        if (dailyTxns[uid] > 8) { score += 25; factors.push("Velocity violation"); }
        if (alerts.some(a => a.user_id === uid && a.status === "open")) { score += 20; factors.push("Open alert"); }

        return {
          userId: uid,
          name: p.name || "—",
          phone: p.phone || "",
          riskScore: Math.min(100, score),
          factors,
          txnCount,
          totalVolume: volume,
          flagged: score >= RISK_THRESHOLDS.medium,
        };
      }).filter(r => r.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore);

      setRiskProfiles(riskList);
    } catch (err) {
      console.error("AI fraud analysis error:", err);
      toast.error("Failed to run fraud analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { analyze(); }, []);

  const statCards = [
    { icon: ShieldAlert, label: "Total Alerts", value: alertStats.total, color: "bg-primary" },
    { icon: AlertTriangle, label: "Open", value: alertStats.open, color: "bg-destructive" },
    { icon: Zap, label: "Critical", value: alertStats.critical, color: "bg-red-600" },
    { icon: Activity, label: "Resolved", value: alertStats.resolved, color: "bg-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">AI Fraud Detection</h2>
          <Badge variant="outline" className="text-[10px]">Beta</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={analyze} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Re-analyze
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["overview", "profiles", "patterns", "velocity"] as const).map(t => (
          <Button key={t} variant={subTab === t ? "default" : "outline"} size="sm" onClick={() => setSubTab(t)} className="capitalize">
            {t === "overview" ? "Overview" : t === "profiles" ? "Risk Profiles" : t === "patterns" ? "Patterns" : "Velocity"}
          </Button>
        ))}
      </div>

      {subTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((s, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>
                    <s.icon className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Risk Users</CardTitle></CardHeader>
            <CardContent>
              {riskProfiles.slice(0, 5).map(r => (
                <div key={r.userId} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${getRiskColor(r.riskScore)}`}>{r.riskScore}</span>
                    <Badge variant={getRiskBadge(r.riskScore).variant} className="text-[10px]">{getRiskBadge(r.riskScore).label}</Badge>
                  </div>
                </div>
              ))}
              {riskProfiles.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No risks detected</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {subTab === "profiles" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead className="hidden md:table-cell">Factors</TableHead>
                    <TableHead className="hidden md:table-cell">Volume</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskProfiles.map(r => (
                    <TableRow key={r.userId}>
                      <TableCell>
                        <p className="font-medium text-foreground text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.phone}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 w-20">
                          <span className={`text-sm font-bold ${getRiskColor(r.riskScore)}`}>{r.riskScore}/100</span>
                          <Progress value={r.riskScore} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">{r.factors.map(f => <Badge key={f} variant="outline" className="text-[9px]">{f}</Badge>)}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">৳{r.totalVolume.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={getRiskBadge(r.riskScore).variant} className="text-[10px]">{getRiskBadge(r.riskScore).label}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {subTab === "patterns" && (
        <div className="space-y-3">
          {patterns.map((p, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-8 rounded-full ${p.severity === "critical" ? "bg-red-500" : p.severity === "high" ? "bg-amber-500" : p.severity === "medium" ? "bg-yellow-400" : "bg-emerald-400"}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.label}</p>
                    <Badge variant="outline" className="text-[9px] mt-1 capitalize">{p.severity}</Badge>
                  </div>
                </div>
                <span className="text-2xl font-bold text-foreground">{p.count}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {subTab === "velocity" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> Velocity Violations (Last 24h)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Txns Today</TableHead>
                    <TableHead>Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {velocityAlerts.map(v => (
                    <TableRow key={v.userId}>
                      <TableCell>
                        <p className="font-medium text-foreground text-sm">{v.name}</p>
                        <p className="text-xs text-muted-foreground">{v.phone}</p>
                      </TableCell>
                      <TableCell className="text-sm font-bold text-foreground">{v.count}</TableCell>
                      <TableCell><Badge variant={v.severity === "critical" ? "destructive" : "secondary"} className="text-[10px] capitalize">{v.severity}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {velocityAlerts.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No velocity violations detected</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
