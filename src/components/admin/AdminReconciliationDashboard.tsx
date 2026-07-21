import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Loader2,
  FileWarning,
  HeartHandshake,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/use-user-roles";

const EXPORT_ROLES = new Set(["admin", "audit", "compliance", "finance"]);

type PaybillRow = {
  transaction_id: string;
  user_id: string;
  amount: number;
  fee: number | null;
  status: string;
  refund_status: string | null;
  reference: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  description: string | null;
  created_at: string;
  settlement_id: string | null;
  settlement_status: string | null;
  provider_ref: string | null;
  flag: string;
};

type DonationRow = {
  transaction_id: string;
  user_id: string;
  amount: number;
  status: string;
  refund_status: string | null;
  reference: string | null;
  recipient_name: string | null;
  description: string | null;
  created_at: string;
};

const FLAG_META: Record<string, { label: string; cls: string }> = {
  missing_settlement: { label: "Missing settlement", cls: "bg-red-500/15 text-red-500" },
  settlement_failed:  { label: "Settlement failed",  cls: "bg-red-500/15 text-red-500" },
  stale_pending:      { label: "Stale pending",      cls: "bg-amber-500/15 text-amber-600" },
  other:              { label: "Other",              cls: "bg-slate-500/15 text-slate-500" },
};

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}
function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function AdminReconciliationDashboard() {
  const [paybills, setPaybills] = useState<PaybillRow[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"paybills" | "donations">("paybills");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p, error: e1 }, { data: d, error: e2 }] = await Promise.all([
      (supabase as any).from("v_orphan_paybills").select("*").order("created_at", { ascending: false }).limit(1000),
      (supabase as any).from("v_orphan_donations").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    if (e1) toast.error(e1.message); if (e2) toast.error(e2.message);
    setPaybills((p as PaybillRow[]) ?? []);
    setDonations((d as DonationRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const paybillsFiltered = useMemo(() => paybills.filter((r) => {
    if (flagFilter !== "all" && r.flag !== flagFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.reference ?? "").toLowerCase().includes(q) ||
             (r.recipient_name ?? "").toLowerCase().includes(q) ||
             (r.recipient_phone ?? "").toLowerCase().includes(q) ||
             (r.description ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [paybills, flagFilter, search]);

  const donationsFiltered = useMemo(() => donations.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.reference ?? "").toLowerCase().includes(q) ||
           (r.recipient_name ?? "").toLowerCase().includes(q) ||
           (r.description ?? "").toLowerCase().includes(q);
  }), [donations, search]);

  const total = paybills.length + donations.length;
  const stats = {
    missing: paybills.filter((p) => p.flag === "missing_settlement").length,
    failed:  paybills.filter((p) => p.flag === "settlement_failed").length,
    stale:   paybills.filter((p) => p.flag === "stale_pending").length,
  };

  const exportCsv = () => {
    const rows = tab === "paybills" ? paybillsFiltered : donationsFiltered;
    if (!rows.length) { toast.info("Nothing to export"); return; }
    const csv = toCsv(rows as any[]);
    downloadCsv(`reconciliation-${tab}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${rows.length} rows`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Reconciliation Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">Flagged paybills & donations without matching settlement/receipt rows.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download size={14} className="mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Total flagged</p>
          <p className="text-xl font-bold">{total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Missing settlement</p>
          <p className="text-xl font-bold text-red-600">{stats.missing}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Provider failed</p>
          <p className="text-xl font-bold text-red-600">{stats.failed}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Stale pending</p>
          <p className="text-xl font-bold text-amber-600">{stats.stale}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          <button onClick={() => setTab("paybills")} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${tab === "paybills" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <Receipt size={12} /> Paybills ({paybills.length})
          </button>
          <button onClick={() => setTab("donations")} className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${tab === "donations" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <HeartHandshake size={12} /> Donations ({donations.length})
          </button>
        </div>
        {tab === "paybills" && (
          <Select value={flagFilter} onValueChange={setFlagFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All flags</SelectItem>
              <SelectItem value="missing_settlement">Missing settlement</SelectItem>
              <SelectItem value="settlement_failed">Settlement failed</SelectItem>
              <SelectItem value="stale_pending">Stale pending</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference / phone / name" className="h-8 text-xs pl-7" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : tab === "paybills" ? (
        paybillsFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No flagged paybills. Everything reconciled ✅</p>
        ) : (
          <div className="space-y-2">
            {paybillsFiltered.map((r) => {
              const meta = FLAG_META[r.flag] ?? FLAG_META.other;
              return (
                <Card key={r.transaction_id}>
                  <CardContent className="p-3 text-xs flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.recipient_name ?? "-"} · ৳{r.amount}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        {r.reference ?? r.transaction_id.slice(0, 8)} · {format(new Date(r.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <Badge className={meta.cls}>{meta.label}</Badge>
                      {r.settlement_status && <Badge variant="outline" className="capitalize">{r.settlement_status}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        donationsFiltered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No flagged donations 🎉</p>
        ) : (
          <div className="space-y-2">
            {donationsFiltered.map((r) => (
              <Card key={r.transaction_id}>
                <CardContent className="p-3 text-xs flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.recipient_name ?? r.description ?? "Donation"} · ৳{r.amount}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {r.reference ?? r.transaction_id.slice(0, 8)} · {format(new Date(r.created_at), "MMM d, HH:mm")}
                    </p>
                  </div>
                  <Badge className="bg-red-500/15 text-red-500 gap-1"><FileWarning size={10} /> Missing record</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
