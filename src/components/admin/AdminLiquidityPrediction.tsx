import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Droplets, AlertTriangle, BarChart3, DollarSign } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts";
import { ResponsiveChartFrame } from "@/components/admin/ResponsiveChartFrame";

export default function AdminLiquidityPrediction() {
  const [loading, setLoading] = useState(true);
  const [treasury, setTreasury] = useState<any>(null);
  const [dailyFlow, setDailyFlow] = useState<{ date: string; inflow: number; outflow: number; net: number }[]>([]);
  const [prediction, setPrediction] = useState<{ date: string; predicted: number }[]>([]);
  const [alerts, setAlerts] = useState<{ message: string; severity: string }[]>([]);
  const [horizon, setHorizon] = useState("7d");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [treasuryRes, ledgerRes, txnsRes] = await Promise.all([
        supabase.from("platform_treasury").select("*").limit(1).single(),
        supabase.from("treasury_ledger").select("type, amount, created_at").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: true }).limit(500),
        supabase.from("transactions").select("type, amount, created_at").eq("status", "completed").gte("created_at", thirtyDaysAgo).limit(1000),
      ]);

      setTreasury(treasuryRes.data);
      const ledger = ledgerRes.data ?? [];
      const txns = txnsRes.data ?? [];

      // Build daily flow
      const flowMap: Record<string, { inflow: number; outflow: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        flowMap[key] = { inflow: 0, outflow: 0 };
      }

      for (const entry of ledger) {
        const key = entry.created_at.slice(0, 10);
        if (!flowMap[key]) continue;
        const amt = Number(entry.amount);
        if (entry.type === "earning" || entry.type === "initial_deposit") {
          flowMap[key].inflow += amt;
        } else {
          flowMap[key].outflow += amt;
        }
      }

      // Also count transaction fees as inflow
      for (const txn of txns) {
        const key = txn.created_at.slice(0, 10);
        if (!flowMap[key]) continue;
        const amt = Number(txn.amount);
        if (["addmoney", "cashin"].includes(txn.type)) flowMap[key].inflow += amt * 0.012;
        if (["cashout", "send"].includes(txn.type)) flowMap[key].outflow += amt * 0.005;
      }

      const dailyData = Object.entries(flowMap).map(([date, d]) => ({
        date: date.slice(5), // MM-DD
        inflow: Math.round(d.inflow),
        outflow: Math.round(d.outflow),
        net: Math.round(d.inflow - d.outflow),
      }));
      setDailyFlow(dailyData);

      // Simple linear prediction
      const recent7 = dailyData.slice(-7);
      const avgNet = recent7.reduce((s, d) => s + d.net, 0) / (recent7.length || 1);
      const currentBalance = Number(treasuryRes.data?.balance || 0);
      const days = horizon === "7d" ? 7 : horizon === "14d" ? 14 : 30;
      const pred: { date: string; predicted: number }[] = [];
      for (let i = 1; i <= days; i++) {
        const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        pred.push({
          date: d.toISOString().slice(5, 10),
          predicted: Math.round(currentBalance + avgNet * i),
        });
      }
      setPrediction(pred);

      // Generate alerts
      const newAlerts: { message: string; severity: string }[] = [];
      if (currentBalance < 50000) newAlerts.push({ message: "Treasury balance critically low (<৳50K)", severity: "critical" });
      else if (currentBalance < 200000) newAlerts.push({ message: "Treasury balance below recommended threshold (<৳200K)", severity: "warning" });
      if (avgNet < -5000) newAlerts.push({ message: `Negative daily flow trend (avg ৳${Math.round(avgNet).toLocaleString()}/day)`, severity: "warning" });
      if (pred[pred.length - 1]?.predicted < 0) newAlerts.push({ message: `Projected to run out in ~${Math.max(1, Math.round(currentBalance / Math.abs(avgNet)))} days`, severity: "critical" });
      if (newAlerts.length === 0) newAlerts.push({ message: "Treasury liquidity is healthy", severity: "ok" });
      setAlerts(newAlerts);

      setLoading(false);
    };
    load();
  }, [horizon]);

  const currentBalance = Number(treasury?.balance || 0);
  const totalEarnings = Number(treasury?.total_earnings || 0);
  const totalDisbursed = Number(treasury?.total_disbursed || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Liquidity Prediction</h2>
          <Badge variant="outline" className="text-[10px]">AI-Powered</Badge>
        </div>
        <Select value={horizon} onValueChange={setHorizon}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7-Day Forecast</SelectItem>
            <SelectItem value="14d">14-Day Forecast</SelectItem>
            <SelectItem value="30d">30-Day Forecast</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Alerts */}
          {alerts.map((a, i) => (
            <div key={i} className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${a.severity === "critical" ? "border-destructive/50 bg-destructive/5" : a.severity === "warning" ? "border-amber-500/50 bg-amber-50 dark:bg-amber-900/10" : "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/10"}`}>
              {a.severity === "critical" ? <AlertTriangle className="w-4 h-4 text-destructive shrink-0" /> :
               a.severity === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> :
               <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />}
              <span className="text-sm text-foreground">{a.message}</span>
            </div>
          ))}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className={`text-xl font-bold ${currentBalance > 100000 ? "text-emerald-600" : "text-destructive"}`}>৳{currentBalance.toLocaleString()}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Earnings</p>
              <p className="text-xl font-bold text-foreground">৳{totalEarnings.toLocaleString()}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Disbursed</p>
              <p className="text-xl font-bold text-foreground">৳{totalDisbursed.toLocaleString()}</p>
            </CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Forecast ({horizon})</p>
              <p className={`text-xl font-bold ${(prediction[prediction.length - 1]?.predicted || 0) >= currentBalance ? "text-emerald-600" : "text-destructive"}`}>
                ৳{(prediction[prediction.length - 1]?.predicted || 0).toLocaleString()}
              </p>
            </CardContent></Card>
          </div>

          {/* Daily Flow Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">30-Day Cash Flow</CardTitle></CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ResponsiveChartFrame className="h-64">
              <ResponsiveContainer width="100%" height="100%" debounce={0}>
                <BarChart data={dailyFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <Tooltip />
                  <Bar dataKey="inflow" fill="hsl(150,60%,45%)" radius={[2, 2, 0, 0]} name="Inflow" />
                  <Bar dataKey="outflow" fill="hsl(350,65%,50%)" radius={[2, 2, 0, 0]} name="Outflow" />
                </BarChart>
              </ResponsiveContainer>
              </ResponsiveChartFrame>
            </CardContent>
          </Card>

          {/* Prediction Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Balance Forecast</CardTitle></CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ResponsiveChartFrame className="h-52 md:h-56">
              <ResponsiveContainer width="100%" height="100%" debounce={0}>
                <AreaChart data={prediction} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                  <Tooltip />
                  <defs>
                    <linearGradient id="predictGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="predicted" stroke="hsl(var(--primary))" fill="url(#predictGrad)" strokeWidth={2} name="Predicted Balance" />
                </AreaChart>
              </ResponsiveContainer>
              </ResponsiveChartFrame>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
