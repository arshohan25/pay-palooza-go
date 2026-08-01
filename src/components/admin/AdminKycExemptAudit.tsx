import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  user_id: string;
  changed_by: string | null;
  previous_value: boolean | null;
  new_value: boolean;
  reason: string | null;
  created_at: string;
}

/**
 * Compliance trail for KYC exemptions — who waived KYC for whom, when and why.
 */
const AdminKycExemptAudit = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kyc_exempt_audit")
      .select("id, user_id, changed_by, previous_value, new_value, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) toast.error(error.message);
    const list = (data as Row[]) ?? [];
    setRows(list);

    const ids = Array.from(new Set(list.flatMap((r) => [r.user_id, r.changed_by].filter(Boolean) as string[])));
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", ids);
      setNames(
        Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, `${p.name || "Unnamed"} · ${p.phone || ""}`])),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (names[r.user_id] || "").toLowerCase().includes(q) ||
        (names[r.changed_by || ""] || "").toLowerCase().includes(q) ||
        (r.reason || "").toLowerCase().includes(q),
    );
  }, [rows, names, search]);

  const exportCsv = () => {
    const header = ["Date", "User", "Changed by", "From", "To", "Reason"];
    const body = filtered.map((r) => [
      r.created_at,
      names[r.user_id] || r.user_id,
      r.changed_by ? names[r.changed_by] || r.changed_by : "system",
      String(r.previous_value ?? false),
      String(r.new_value),
      r.reason || "",
    ]);
    const csv = [header, ...body].map((line) => line.map((v) => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kyc-exemptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const granted = rows.filter((r) => r.new_value).length;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="w-4 h-4 text-primary" /> KYC Exemption Audit
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {rows.length} changes logged · {granted} exemptions granted · {rows.length - granted} revoked
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, admin or reason"
              className="pl-9"
            />
          </div>
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
          <p className="py-8 text-center text-sm text-muted-foreground">No KYC exemption changes recorded.</p>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  r.new_value
                    ? "text-[10px] border-amber-500/30 text-amber-600"
                    : "text-[10px] border-emerald-500/30 text-emerald-600"
                }
              >
                {r.new_value ? "Exemption granted" : "Exemption revoked"}
              </Badge>
              <p className="text-sm font-medium">{names[r.user_id] || r.user_id}</p>
              <span className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              By {r.changed_by ? names[r.changed_by] || r.changed_by : "system"}
            </p>
            {r.reason && <p className="mt-1 text-xs">Reason: {r.reason}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AdminKycExemptAudit;
