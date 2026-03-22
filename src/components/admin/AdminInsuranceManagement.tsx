import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Shield, Search, RefreshCw, AlertTriangle } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  claimed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUSES = ["all", "active", "expired", "cancelled", "claimed"] as const;

export default function AdminInsuranceManagement() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("insurance_policies")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setPolicies(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = policies.filter(p => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.plan_name?.toLowerCase().includes(search.toLowerCase()) && !p.user_id?.includes(search)) return false;
    return true;
  });

  const stats = {
    total: policies.length,
    active: policies.filter(p => p.status === "active").length,
    expired: policies.filter(p => p.status === "expired").length,
    totalPremiums: policies.reduce((s, p) => s + Number(p.premium), 0),
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  const cancelPolicy = async (id: string) => {
    const { error } = await supabase.from("insurance_policies").update({ status: "cancelled" as any }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Policy cancelled");
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Policies", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Expired", value: stats.expired },
          { label: "Premiums Collected", value: `৳${stats.totalPremiums.toLocaleString()}` },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by plan name or user ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {STATUSES.map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize h-8 text-xs">
            {s}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={fetch}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Insurance Policies</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Premium</TableHead>
                  <TableHead className="text-xs">Coverage</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Expires</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No policies found</TableCell></TableRow>
                ) : filtered.map(p => (
                  <TableRow key={p.id} className={isExpiringSoon(p.expires_at) ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
                    <TableCell className="text-xs font-mono">{p.user_id?.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs font-semibold">{p.plan_name}</TableCell>
                    <TableCell className="text-xs capitalize">{p.plan_type}</TableCell>
                    <TableCell className="text-xs">৳{Number(p.premium).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">৳{Number(p.coverage_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{p.duration_months}mo</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[p.status] ?? ""}`}>{p.status}</Badge>
                        {isExpiringSoon(p.expires_at) && <AlertTriangle className="w-3 h-3 text-yellow-600" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {p.status === "active" && (
                        <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => cancelPolicy(p.id)}>
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
