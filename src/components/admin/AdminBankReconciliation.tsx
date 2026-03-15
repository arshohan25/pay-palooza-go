import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Download, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminBankReconciliation() {
  const [subTab, setSubTab] = useState<"overview" | "transfers" | "reconcile">("overview");
  const [transfers, setTransfers] = useState<any[]>([]);
  const [fundRequests, setFundRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [txnRes, frRes] = await Promise.all([
        supabase.from("transactions")
          .select("*")
          .eq("type", "banktransfer")
          .eq("status", "completed")
          .gte("created_at", new Date(dateFrom).toISOString())
          .lte("created_at", new Date(dateTo + "T23:59:59").toISOString())
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("fund_requests")
          .select("*")
          .gte("created_at", new Date(dateFrom).toISOString())
          .lte("created_at", new Date(dateTo + "T23:59:59").toISOString())
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      setTransfers(txnRes.data ?? []);
      setFundRequests(frRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [dateFrom, dateTo]);

  const totalOutflow = transfers.reduce((s, t) => s + Number(t.amount), 0);
  const totalFees = transfers.reduce((s, t) => s + Number(t.fee), 0);
  const totalInflow = fundRequests.filter(f => f.type === "add_money" && f.status === "approved").reduce((s, f) => s + Number(f.amount), 0);
  const pendingWithdrawals = fundRequests.filter(f => f.type === "withdraw" && f.status === "pending");
  const approvedDeposits = fundRequests.filter(f => f.type === "add_money" && f.status === "approved");

  // Daily chart data
  const dayMap = new Map<string, { inflow: number; outflow: number }>();
  transfers.forEach(t => {
    const day = t.created_at.slice(0, 10);
    const prev = dayMap.get(day) ?? { inflow: 0, outflow: 0 };
    dayMap.set(day, { ...prev, outflow: prev.outflow + Number(t.amount) });
  });
  fundRequests.filter(f => f.status === "approved" && f.type === "add_money").forEach(f => {
    const day = f.created_at.slice(0, 10);
    const prev = dayMap.get(day) ?? { inflow: 0, outflow: 0 };
    dayMap.set(day, { ...prev, inflow: prev.inflow + Number(f.amount) });
  });
  const chartData = Array.from(dayMap.entries()).map(([date, v]) => ({ date: date.slice(5), ...v })).slice(-14);

  const exportCSV = () => {
    const allRows = [
      ...transfers.map(t => ({ type: "Bank Transfer (Out)", amount: t.amount, fee: t.fee, recipient: t.recipient_name || t.recipient_phone || "", date: t.created_at?.slice(0, 10), ref: t.short_id, status: t.status })),
      ...fundRequests.map(f => ({ type: f.type === "add_money" ? "Deposit (In)" : "Withdrawal", amount: f.amount, fee: 0, recipient: f.account_number || "", date: f.created_at?.slice(0, 10), ref: f.transaction_id_proof || "", status: f.status })),
    ];
    const headers = ["Type", "Amount", "Fee", "Recipient/Account", "Date", "Reference", "Status"];
    const csv = [headers.join(","), ...allRows.map(r => [r.type, r.amount, r.fee, r.recipient, r.date, r.ref, r.status].map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `bank-reconciliation-${dateFrom}-to-${dateTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Bank Reconciliation
          </h3>
          <p className="text-sm text-muted-foreground">Track bank transfers, deposits, and reconcile accounts</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> Export</Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[
          { key: "overview" as const, label: "Overview" },
          { key: "transfers" as const, label: "Bank Transfers" },
          { key: "reconcile" as const, label: "Reconciliation" },
        ].map(t => (
          <Button key={t.key} variant={subTab === t.key ? "default" : "outline"} size="sm" onClick={() => setSubTab(t.key)}>{t.label}</Button>
        ))}
      </div>

      {/* Date filters */}
      <div className="flex gap-2 items-center">
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        <span className="text-muted-foreground">to</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {subTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ArrowDownRight className="w-5 h-5 text-emerald-500" /></div>
                  <div><p className="text-xs text-muted-foreground">Total Inflow</p><p className="text-xl font-bold text-emerald-600">৳{totalInflow.toLocaleString()}</p></div>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center"><ArrowUpRight className="w-5 h-5 text-red-500" /></div>
                  <div><p className="text-xs text-muted-foreground">Total Outflow</p><p className="text-xl font-bold text-red-600">৳{totalOutflow.toLocaleString()}</p></div>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Scale className="w-5 h-5 text-blue-500" /></div>
                  <div><p className="text-xs text-muted-foreground">Net Position</p><p className={`text-xl font-bold ${totalInflow - totalOutflow >= 0 ? "text-emerald-600" : "text-red-600"}`}>৳{(totalInflow - totalOutflow).toLocaleString()}</p></div>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-amber-500" /></div>
                  <div><p className="text-xs text-muted-foreground">Fees Earned</p><p className="text-xl font-bold text-amber-600">৳{totalFees.toLocaleString()}</p></div>
                </CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Inflow vs Outflow</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Bar dataKey="inflow" name="Inflow" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="outflow" name="Outflow" fill="hsl(350, 65%, 50%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {subTab === "transfers" && (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Fee</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No bank transfers in period</TableCell></TableRow>
                      ) : transfers.map(t => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs">{t.short_id}</TableCell>
                          <TableCell>
                            <div><p className="text-sm text-foreground">{t.recipient_name || "—"}</p><p className="text-xs text-muted-foreground">{t.recipient_phone}</p></div>
                          </TableCell>
                          <TableCell className="text-right font-mono">৳{Number(t.amount).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-amber-600">৳{Number(t.fee).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-BD", { month: "short", day: "numeric" })}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{t.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {subTab === "reconcile" && (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Reconciliation Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Approved Deposits</span>
                      <span className="font-bold text-emerald-600">+৳{totalInflow.toLocaleString()} ({approvedDeposits.length} txns)</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Bank Transfers Out</span>
                      <span className="font-bold text-red-600">-৳{totalOutflow.toLocaleString()} ({transfers.length} txns)</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Fees Collected</span>
                      <span className="font-bold text-amber-600">+৳{totalFees.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border/50">
                      <span className="text-sm text-muted-foreground">Pending Withdrawals</span>
                      <span className="font-bold text-amber-500">{pendingWithdrawals.length} requests (৳{pendingWithdrawals.reduce((s, f) => s + Number(f.amount), 0).toLocaleString()})</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-muted/30 rounded-lg px-3">
                      <span className="text-sm font-semibold text-foreground">Net Position</span>
                      <span className={`text-xl font-bold ${totalInflow - totalOutflow + totalFees >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        ৳{(totalInflow - totalOutflow + totalFees).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
