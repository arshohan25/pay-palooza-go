import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Download, RefreshCw, Scale, Search } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  txn_id: string;
  txn_reference: string | null;
  txn_user_id: string;
  expected_amount: number;
  ledger_amount: number;
  matches: boolean;
  entries: any;
  created_at: string;
}

const money = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD", { minimumFractionDigits: 2 })}`;

/**
 * Treasury integrity board — surfaces every transaction-vs-ledger reconciliation
 * check with the mismatch delta so finance can chase broken double entries.
 */
const AdminTreasuryIntegrity = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("mismatch");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("treasury_reconciliation_checks")
      .select("id, txn_id, txn_reference, txn_user_id, expected_amount, ledger_amount, matches, entries, created_at")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-treasury-integrity")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "treasury_reconciliation_checks" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "mismatch" && r.matches) return false;
      if (filter === "matched" && !r.matches) return false;
      if (!q) return true;
      return (
        (r.txn_reference || "").toLowerCase().includes(q) ||
        r.txn_id.toLowerCase().includes(q) ||
        r.txn_user_id.toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const bad = rows.filter((r) => !r.matches);
    return {
      total: rows.length,
      mismatched: bad.length,
      drift: bad.reduce((s, r) => s + Math.abs(Number(r.expected_amount) - Number(r.ledger_amount)), 0),
    };
  }, [rows]);

  const exportCsv = () => {
    const header = ["Date", "Txn ID", "Reference", "Expected", "Ledger", "Delta", "Matches"];
    const body = filtered.map((r) => [
      r.created_at,
      r.txn_id,
      r.txn_reference || "",
      r.expected_amount,
      r.ledger_amount,
      (Number(r.expected_amount) - Number(r.ledger_amount)).toFixed(2),
      r.matches ? "yes" : "no",
    ]);
    const csv = [header, ...body].map((l) => l.map((v) => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `treasury-integrity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="w-4 h-4 text-primary" /> Treasury Integrity Checks
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {stats.total} checks · {stats.mismatched} mismatched · {money(stats.drift)} unexplained drift
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, txn or user id"
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mismatch">Mismatched only</SelectItem>
              <SelectItem value="matched">Matched only</SelectItem>
              <SelectItem value="all">All checks</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {!loading && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No reconciliation checks match these filters.
          </p>
        )}
        {filtered.map((r) => {
          const delta = Number(r.expected_amount) - Number(r.ledger_amount);
          return (
            <div
              key={r.id}
              className={`rounded-2xl border p-3 ${
                r.matches ? "border-border/60" : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    r.matches
                      ? "text-[10px] border-emerald-500/30 text-emerald-600"
                      : "text-[10px] border-destructive/30 text-destructive"
                  }
                >
                  {r.matches ? (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 mr-1" />
                  )}
                  {r.matches ? "Balanced" : "Mismatch"}
                </Badge>
                <p className="font-mono text-xs">{r.txn_reference || r.txn_id.slice(0, 8)}</p>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Expected</p>
                  <p className="font-semibold tabular-nums">{money(r.expected_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ledger</p>
                  <p className="font-semibold tabular-nums">{money(r.ledger_amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Delta</p>
                  <p className={`font-semibold tabular-nums ${delta === 0 ? "" : "text-destructive"}`}>
                    {money(delta)}
                  </p>
                </div>
              </div>
              {Array.isArray(r.entries) && r.entries.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {r.entries.length} ledger entr{r.entries.length === 1 ? "y" : "ies"} linked
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AdminTreasuryIntegrity;
