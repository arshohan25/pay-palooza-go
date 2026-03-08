import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Radio } from "lucide-react";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  actor_name?: string;
  actor_phone?: string;
}

const ACTION_LABELS: Record<string, string> = {
  limit_updated: "Global Limit Updated",
  limit_override_created: "Override Created",
  limit_override_removed: "Override Removed",
  bulk_limit_override: "Bulk Override Applied",
  bulk_limit_reset: "Bulk Overrides Reset",
};

const ACTION_COLORS: Record<string, string> = {
  limit_updated: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  limit_override_created: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  limit_override_removed: "bg-red-500/10 text-red-700 dark:text-red-400",
  bulk_limit_override: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bulk_limit_reset: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

const LIMIT_ACTIONS = Object.keys(ACTION_LABELS);

const TXN_LABELS: Record<string, string> = {
  send: "Send Money", cashin: "Cash In", cashout: "Cash Out", addmoney: "Add Money",
  payment: "Payment", recharge: "Recharge", paybill: "Pay Bill", banktransfer: "Bank Transfer",
};

// Profile cache shared across fetches
const profileCache = new Map<string, { name?: string; phone?: string }>();

async function resolveProfiles(ids: string[]) {
  const missing = ids.filter(id => !profileCache.has(id));
  if (missing.length > 0) {
    const { data } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", missing);
    (data ?? []).forEach(p => profileCache.set(p.user_id, { name: p.name ?? undefined, phone: p.phone ?? undefined }));
  }
}

export default function LimitAuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLive, setIsLive] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const formatDetails = useCallback((entry: AuditEntry) => {
    const d = entry.details;
    if (!d) return "—";
    const parts: string[] = [];
    if (d.txn_type) parts.push(TXN_LABELS[d.txn_type] || d.txn_type);
    if (d.period) parts.push(d.period);
    if (d.target_role) parts.push(`Role: ${d.target_role}`);
    if (d.affected) parts.push(`${d.affected} affected`);
    if (d.old_max_amount !== undefined && d.new_max_amount !== undefined) {
      parts.push(`Amount: ৳${Number(d.old_max_amount).toLocaleString()} → ৳${Number(d.new_max_amount).toLocaleString()}`);
    } else if (d.max_amount) {
      parts.push(`Max: ৳${Number(d.max_amount).toLocaleString()}`);
    }
    if (d.old_max_count !== undefined && d.new_max_count !== undefined) {
      parts.push(`Count: ${d.old_max_count} → ${d.new_max_count}`);
    } else if (d.max_count) {
      parts.push(`Count: ${d.max_count}`);
    }
    if (d.target_name) parts.push(`User: ${d.target_name}`);
    else if (d.target_phone) parts.push(`User: ${d.target_phone}`);
    if (d.reason) parts.push(`Reason: ${d.reason}`);
    return parts.join(" · ") || "—";
  }, []);

  const enrichEntries = useCallback(async (logs: AuditEntry[]) => {
    const actorIds = [...new Set(logs.map(l => l.actor_id))];
    await resolveProfiles(actorIds);
    return logs.map(l => {
      const p = profileCache.get(l.actor_id);
      return p ? { ...l, actor_name: p.name, actor_phone: p.phone } : l;
    });
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .in("action", LIMIT_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(100);

    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      query = query.lt("created_at", end.toISOString());
    }

    const { data } = await query;
    const enriched = await enrichEntries((data ?? []) as AuditEntry[]);
    setEntries(enriched);
    setLoading(false);
  }, [actionFilter, dateFrom, dateTo, enrichEntries]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Realtime subscription
  useEffect(() => {
    if (!isLive) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      return;
    }

    const channel = supabase
      .channel("limit-audit-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        async (payload) => {
          const newRow = payload.new as AuditEntry;
          if (!LIMIT_ACTIONS.includes(newRow.action)) return;
          if (actionFilter !== "all" && newRow.action !== actionFilter) return;

          const [enriched] = await enrichEntries([newRow]);
          setEntries(prev => [enriched, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [isLive, actionFilter, enrichEntries]);

  const exportCsv = useCallback(() => {
    if (entries.length === 0) { toast.error("No entries to export"); return; }

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["Date/Time", "Admin Name", "Admin Phone", "Action", "Details"];
    const rows = entries.map(e => [
      new Date(e.created_at).toISOString(),
      e.actor_name || "",
      e.actor_phone || "",
      ACTION_LABELS[e.action] || e.action,
      formatDetails(e),
    ]);

    const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `limit-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${entries.length} entries`);
  }, [entries, formatDetails]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters & actions */}
      <div className="flex gap-2 flex-wrap items-center">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {LIMIT_ACTIONS.map(a => <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
        <div className="ml-auto flex gap-2 items-center">
          <Button variant={isLive ? "default" : "outline"} size="sm" onClick={() => setIsLive(l => !l)}>
            <Radio className={`w-3.5 h-3.5 mr-1 ${isLive ? "text-red-400 animate-pulse" : ""}`} />
            {isLive ? "Live" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5 mr-1" />CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Date/Time</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Admin</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Action</th>
              <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id} className="border-t border-border/50 hover:bg-muted/20">
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium">
                  {entry.actor_name || entry.actor_phone || entry.actor_id.slice(0, 8)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className={`text-xs ${ACTION_COLORS[entry.action] || ""}`}>
                    {ACTION_LABELS[entry.action] || entry.action}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                  {formatDetails(entry)}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No limit audit entries found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
