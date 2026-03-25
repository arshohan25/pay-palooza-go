import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, Coins, Receipt, BarChart3, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AdminRevenueDashboard() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Revenue Dashboard
      </h3>
      <Tabs defaultValue="total" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="total" className="text-xs">Total Revenue</TabsTrigger>
          <TabsTrigger value="commission" className="text-xs">Commission</TabsTrigger>
          <TabsTrigger value="charges" className="text-xs">Charges</TabsTrigger>
          <TabsTrigger value="profit" className="text-xs">Profit</TabsTrigger>
        </TabsList>
        <TabsContent value="total"><TotalRevenueTab /></TabsContent>
        <TabsContent value="commission"><CommissionIncomeTab /></TabsContent>
        <TabsContent value="charges"><ChargeIncomeTab /></TabsContent>
        <TabsContent value="profit"><ProfitReportTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ProfitReportTab date filters moved to header row below

function TotalRevenueTab() {
  const [treasury, setTreasury] = useState<any>(null);
  const [txnStats, setTxnStats] = useState({ totalFees: 0, totalCommissions: 0, txnCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: txns }] = await Promise.all([
        supabase.from("platform_treasury").select("*").limit(1).single(),
        supabase.from("transactions").select("fee, commission").eq("status", "completed"),
      ]);
      setTreasury(t);
      const totalFees = (txns ?? []).reduce((s, t) => s + Number(t.fee ?? 0), 0);
      const totalCommissions = (txns ?? []).reduce((s, t) => s + Number(t.commission ?? 0), 0);
      setTxnStats({ totalFees, totalCommissions, txnCount: txns?.length ?? 0 });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Total Earnings" value={`৳${Number(treasury?.total_earnings ?? 0).toLocaleString()}`} color="text-primary" />
        <StatCard label="Commissions Paid" value={`৳${Number(treasury?.total_commissions_paid ?? 0).toLocaleString()}`} color="text-amber-600" />
        <StatCard label="Fee Revenue" value={`৳${txnStats.totalFees.toLocaleString()}`} color="text-emerald-600" />
        <StatCard label="Total Transactions" value={txnStats.txnCount.toLocaleString()} color="text-foreground" />
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-2">Revenue Breakdown</p>
          <div className="space-y-2">
            {[
              { label: "Transaction Fees", amount: txnStats.totalFees, pct: txnStats.totalFees + txnStats.totalCommissions > 0 ? ((txnStats.totalFees / (txnStats.totalFees + txnStats.totalCommissions)) * 100).toFixed(1) : "0" },
              { label: "Commission Pool", amount: txnStats.totalCommissions, pct: txnStats.totalFees + txnStats.totalCommissions > 0 ? ((txnStats.totalCommissions / (txnStats.totalFees + txnStats.totalCommissions)) * 100).toFixed(1) : "0" },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-foreground">{r.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">৳{r.amount.toLocaleString()}</span>
                  <Badge variant="secondary" className="text-[10px]">{r.pct}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommissionIncomeTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("commission_logs").select("*").order("created_at", { ascending: false }).limit(100);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader />;

  const totalAgent = logs.reduce((s, l) => s + Number(l.agent_amount), 0);
  const totalDistributor = logs.reduce((s, l) => s + Number(l.distributor_amount), 0);
  const totalMD = logs.reduce((s, l) => s + Number(l.master_distributor_amount), 0);
  const totalCompany = logs.reduce((s, l) => s + Number(l.company_amount), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Agent Commissions" value={`৳${totalAgent.toLocaleString()}`} color="text-emerald-600" />
        <StatCard label="Distributor" value={`৳${totalDistributor.toLocaleString()}`} color="text-blue-600" />
        <StatCard label="Master Distributor" value={`৳${totalMD.toLocaleString()}`} color="text-purple-600" />
        <StatCard label="Company Share" value={`৳${totalCompany.toLocaleString()}`} color="text-primary" />
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Txn Type</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Amount</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Fee</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Company</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Date</th>
            </tr></thead>
            <tbody>
              {logs.slice(0, 30).map(l => (
                <tr key={l.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{l.txn_type}</Badge></td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-right">৳{Number(l.txn_amount).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-right">৳{Number(l.total_fee).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-right text-primary hidden sm:table-cell">৳{Number(l.company_amount).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(l.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No commission logs</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ChargeIncomeTab() {
  const [feeConfigs, setFeeConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("fee_config").select("*").order("txn_type");
      setFeeConfigs(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Active fee configurations driving charge income</p>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">Txn Type</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Fee Type</th>
              <th className="text-right px-3 py-2.5 font-medium text-xs">Fee Value</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Range</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
            </tr></thead>
            <tbody>
              {feeConfigs.map(fc => (
                <tr key={fc.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{fc.txn_type}</Badge></td>
                  <td className="px-3 py-2.5 text-xs capitalize">{fc.fee_type}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-right">{fc.fee_type === "percent" ? `${fc.fee_value}%` : `৳${fc.fee_value}`}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    ৳{Number(fc.min_amount ?? 0).toLocaleString()} — {fc.max_amount ? `৳${Number(fc.max_amount).toLocaleString()}` : "∞"}
                  </td>
                  <td className="px-3 py-2.5"><Badge variant={fc.is_active ? "default" : "secondary"} className="text-[10px]">{fc.is_active ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
          {feeConfigs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No fee configs</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfitReportTab() {
  const [data, setData] = useState({ totalFees: 0, totalCommPaid: 0, treasuryEarnings: 0, treasuryDisbursed: 0 });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("transactions").select("fee, commission").eq("status", "completed");
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) q = q.lte("created_at", new Date(dateTo).toISOString());
    const [{ data: txns }, { data: treasury }] = await Promise.all([
      q,
      supabase.from("platform_treasury").select("*").limit(1).single(),
    ]);
    const totalFees = (txns ?? []).reduce((s, t) => s + Number(t.fee ?? 0), 0);
    const totalComm = (txns ?? []).reduce((s, t) => s + Number(t.commission ?? 0), 0);
    setData({
      totalFees,
      totalCommPaid: totalComm,
      treasuryEarnings: Number(treasury?.total_earnings ?? 0),
      treasuryDisbursed: Number(treasury?.total_disbursed ?? 0),
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const netProfit = data.totalFees - data.totalCommPaid;

  const exportCSV = () => {
    const rows = [
      ["Metric", "Amount (BDT)"],
      ["Total Fee Revenue", data.totalFees],
      ["Commissions Paid", data.totalCommPaid],
      ["Net Profit", netProfit],
      ["Treasury Earnings", data.treasuryEarnings],
      ["Treasury Disbursed", data.treasuryDisbursed],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `profit-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium text-foreground">Profit Report</p>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 w-32 text-xs" />
          <span className="text-muted-foreground text-xs">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 w-32 text-xs" />
          <Button size="sm" className="h-7 text-xs px-2" onClick={load}>Apply</Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={exportCSV}><Download className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      {loading ? <Loader /> : (
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Fee Revenue" value={`৳${data.totalFees.toLocaleString()}`} color="text-emerald-600" />
          <StatCard label="Commissions Paid" value={`৳${data.totalCommPaid.toLocaleString()}`} color="text-amber-600" />
          <StatCard label="Net Profit" value={`৳${netProfit.toLocaleString()}`} color={netProfit >= 0 ? "text-primary" : "text-destructive"} />
          <StatCard label="Treasury Earnings" value={`৳${data.treasuryEarnings.toLocaleString()}`} color="text-foreground" />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-3 text-center">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={`text-sm font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Loader() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}
