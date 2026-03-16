import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, RefreshCw, Users, Building2, TrendingUp } from "lucide-react";

export default function AdminCommissionLedger() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("commission_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (typeFilter !== "all") q = q.eq("txn_type", typeFilter);
    const { data } = await q;
    setLogs(data ?? []);
    setLoading(false);
  }, [typeFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalFees = logs.reduce((s, l) => s + Number(l.total_fee), 0);
  const totalAgent = logs.reduce((s, l) => s + Number(l.agent_amount), 0);
  const totalDistributor = logs.reduce((s, l) => s + Number(l.distributor_amount), 0);
  const totalCompany = logs.reduce((s, l) => s + Number(l.company_amount), 0);

  const txnTypes = [...new Set(logs.map(l => l.txn_type))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Commission Ledger</h3>
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw size={14} className="mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Coins className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-xl font-bold text-foreground">৳{totalFees.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Fees</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Users className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-foreground">৳{totalAgent.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Agent Share</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Building2 className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-foreground">৳{totalDistributor.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Distributor Share</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold text-foreground">৳{totalCompany.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Company Share</p>
        </CardContent></Card>
      </div>

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-40"><SelectValue placeholder="All Types" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {txnTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No commission logs found</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Txn Amount</TableHead>
                <TableHead>Total Fee</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Distributor</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(l => (
                <TableRow key={l.id}>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{l.txn_type}</Badge></TableCell>
                  <TableCell className="font-semibold text-foreground">৳{Number(l.txn_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-foreground">৳{Number(l.total_fee).toLocaleString()}</TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400">৳{Number(l.agent_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-blue-600 dark:text-blue-400">৳{Number(l.distributor_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-amber-600 dark:text-amber-400">৳{Number(l.company_amount).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
