import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, TrendingUp, DollarSign, Users, Coins, ArrowLeftRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

type ReportTab = "transactions" | "revenue" | "commissions" | "settlements";

const COLORS = ["hsl(var(--primary))", "hsl(200,70%,50%)", "hsl(150,60%,45%)", "hsl(40,80%,50%)", "hsl(280,60%,55%)", "hsl(350,65%,50%)", "hsl(180,55%,45%)", "hsl(20,70%,50%)"];

export default function AdminAdvancedReports() {
  const [tab, setTab] = useState<ReportTab>("transactions");
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [txns, setTxns] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const from = new Date(dateFrom).toISOString();
      const to = new Date(dateTo + "T23:59:59").toISOString();
      const [txnRes, ledgerRes, stlRes] = await Promise.all([
        supabase.from("transactions").select("type, amount, fee, commission, created_at, status").eq("status", "completed").gte("created_at", from).lte("created_at", to).order("created_at", { ascending: true }).limit(1000),
        supabase.from("treasury_ledger").select("type, amount, balance_after, created_at, description").gte("created_at", from).lte("created_at", to).order("created_at", { ascending: true }).limit(500),
        supabase.from("settlements").select("*").gte("created_at", from).lte("created_at", to).order("created_at", { ascending: false }).limit(200),
      ]);
      setTxns(txnRes.data ?? []);
      setLedger(ledgerRes.data ?? []);
      setSettlements((stlRes.data ?? []) as any[]);
      setLoading(false);
    };
    load();
  }, [dateFrom, dateTo]);

  // Computed metrics
  const totalVolume = txns.reduce((s, t) => s + Number(t.amount), 0);
  const totalFees = txns.reduce((s, t) => s + Number(t.fee), 0);
  const totalCommissions = txns.reduce((s, t) => s + Number(t.commission), 0);
  const netRevenue = totalFees - totalCommissions;

  // Daily aggregation
  const dayMap = new Map<string, { volume: number; fees: number; commissions: number; count: number }>();
  txns.forEach(t => {
    const day = t.created_at.slice(0, 10);
    const prev = dayMap.get(day) ?? { volume: 0, fees: 0, commissions: 0, count: 0 };
    dayMap.set(day, { volume: prev.volume + Number(t.amount), fees: prev.fees + Number(t.fee), commissions: prev.commissions + Number(t.commission), count: prev.count + 1 });
  });
  const dailyData = Array.from(dayMap.entries()).map(([date, v]) => ({ date: date.slice(5), ...v }));

  // Type breakdown
  const typeMap = new Map<string, { count: number; volume: number; fees: number; commissions: number }>();
  txns.forEach(t => {
    const prev = typeMap.get(t.type) ?? { count: 0, volume: 0, fees: 0, commissions: 0 };
    typeMap.set(t.type, { count: prev.count + 1, volume: prev.volume + Number(t.amount), fees: prev.fees + Number(t.fee), commissions: prev.commissions + Number(t.commission) });
  });
  const typeData = Array.from(typeMap.entries()).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.volume - a.volume);

  // Settlement summary
  const stlCompleted = settlements.filter(s => s.status === "completed");
  const stlPending = settlements.filter(s => s.status === "pending");

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(","), ...data.map(r => headers.map(h => `"${r[h] ?? ""}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Advanced Reports
          </h3>
          <p className="text-sm text-muted-foreground">Comprehensive analytics with date filtering and export</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5">
        {([
          { key: "transactions" as const, label: "Transactions", icon: ArrowLeftRight },
          { key: "revenue" as const, label: "Revenue", icon: DollarSign },
          { key: "commissions" as const, label: "Commissions", icon: Coins },
          { key: "settlements" as const, label: "Settlements", icon: TrendingUp },
        ] as const).map(t => (
          <button key={t.key} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
            tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`} onClick={() => setTab(t.key)}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        <Button variant="outline" size="sm" onClick={() => {
          const data = tab === "settlements" ? settlements : typeData.map(d => ({ ...d, fees: d.fees.toFixed(2), commissions: d.commissions.toFixed(2) }));
          exportCSV(data, `${tab}-report-${dateFrom}-to-${dateTo}.csv`);
        }}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* TRANSACTION REPORT */}
          {tab === "transactions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Transactions</p><p className="text-xl font-bold text-foreground">{txns.length.toLocaleString()}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Volume</p><p className="text-xl font-bold text-emerald-600">৳{(totalVolume / 1000).toFixed(1)}K</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg per Day</p><p className="text-xl font-bold text-foreground">{dailyData.length ? Math.round(txns.length / dailyData.length) : 0}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Amount</p><p className="text-xl font-bold text-foreground">৳{txns.length ? Math.round(totalVolume / txns.length).toLocaleString() : 0}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Volume</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => `৳${v.toLocaleString()}`} />
                        <Area type="monotone" dataKey="volume" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Breakdown by Type</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeData.map((d, i) => (
                        <TableRow key={d.type}>
                          <TableCell><Badge variant="secondary" className="text-xs capitalize">{d.type}</Badge></TableCell>
                          <TableCell className="text-right font-mono">{d.count}</TableCell>
                          <TableCell className="text-right font-mono">৳{d.volume.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-amber-600">৳{d.fees.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{totalVolume > 0 ? ((d.volume / totalVolume) * 100).toFixed(1) : 0}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* REVENUE REPORT */}
          {tab === "revenue" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Fees</p><p className="text-xl font-bold text-amber-600">৳{totalFees.toLocaleString()}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Commissions Paid</p><p className="text-xl font-bold text-blue-600">৳{totalCommissions.toLocaleString()}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Net Revenue</p><p className={`text-xl font-bold ${netRevenue >= 0 ? "text-emerald-600" : "text-red-600"}`}>৳{netRevenue.toLocaleString()}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Fee/Txn</p><p className="text-xl font-bold text-foreground">৳{txns.length ? (totalFees / txns.length).toFixed(2) : 0}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Revenue (Fees vs Commissions)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Bar dataKey="fees" name="Fees" fill="hsl(40,80%,50%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="commissions" name="Commissions" fill="hsl(200,70%,50%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue by Transaction Type</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-52 flex items-center">
                    <ResponsiveContainer width="60%" height="100%">
                      <PieChart>
                        <Pie data={typeData.filter(d => d.fees > 0)} dataKey="fees" nameKey="type" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                          {typeData.filter(d => d.fees > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => `৳${v.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5 text-xs">
                      {typeData.filter(d => d.fees > 0).map((d, i) => (
                        <div key={d.type} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="capitalize text-muted-foreground">{d.type}</span>
                          <span className="ml-auto font-medium text-foreground">৳{d.fees.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* COMMISSION REPORT */}
          {tab === "commissions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Commissions</p><p className="text-xl font-bold text-blue-600">৳{totalCommissions.toLocaleString()}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Commission Txns</p><p className="text-xl font-bold text-foreground">{txns.filter(t => Number(t.commission) > 0).length}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Commission</p><p className="text-xl font-bold text-foreground">৳{txns.filter(t => Number(t.commission) > 0).length ? (totalCommissions / txns.filter(t => Number(t.commission) > 0).length).toFixed(2) : 0}</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Commission Payouts</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyData.filter(d => d.commissions > 0)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => `৳${v.toLocaleString()}`} />
                        <Line type="monotone" dataKey="commissions" stroke="hsl(200,70%,50%)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Commission by Transaction Type</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Txns with Commission</TableHead>
                        <TableHead className="text-right">Total Commission</TableHead>
                        <TableHead className="text-right">Avg/Txn</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeData.filter(d => d.commissions > 0).map(d => (
                        <TableRow key={d.type}>
                          <TableCell><Badge variant="secondary" className="text-xs capitalize">{d.type}</Badge></TableCell>
                          <TableCell className="text-right font-mono">{d.count}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600">৳{d.commissions.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">৳{(d.commissions / d.count).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {typeData.filter(d => d.commissions > 0).length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No commission data in period</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* SETTLEMENT REPORT */}
          {tab === "settlements" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Settlements</p><p className="text-xl font-bold text-foreground">{settlements.length}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold text-emerald-600">৳{stlCompleted.reduce((s: number, st: any) => s + Number(st.net_amount), 0).toLocaleString()}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold text-amber-600">৳{stlPending.reduce((s: number, st: any) => s + Number(st.net_amount), 0).toLocaleString()}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Avg Settlement</p><p className="text-xl font-bold text-foreground">৳{settlements.length ? Math.round(settlements.reduce((s: number, st: any) => s + Number(st.net_amount), 0) / settlements.length).toLocaleString() : 0}</p></CardContent></Card>
              </div>

              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ref</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Period</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settlements.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No settlements in period</TableCell></TableRow>
                        ) : settlements.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs">{s.settlement_ref || s.id.slice(0, 8)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs capitalize">{s.entity_type}</Badge></TableCell>
                            <TableCell className="text-sm text-foreground">{s.entity_name || "—"}</TableCell>
                            <TableCell className="text-right font-mono">৳{Number(s.gross_amount).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono font-bold">৳{Number(s.net_amount).toLocaleString()}</TableCell>
                            <TableCell><Badge className={`text-xs ${s.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : s.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : ""}`}>{s.status}</Badge></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.period_start?.slice(0, 10)} → {s.period_end?.slice(0, 10)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
