import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { History, Filter, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { REGISTERED_PERMISSIONS, ROLE_KEYS } from "@/lib/permissionsRegistry";

const PERM_ACTIONS = ["permission_granted", "permission_revoked", "role_assigned", "role_revoked", "role_added"];

interface LogRow {
  id: string;
  actor_id: string | null;
  action: string;
  details: any;
  created_at: string;
  actor_name?: string;
  actor_phone?: string;
}

/** Audit trail for role & permission changes with role/permission filters. */
export default function AdminPermissionAuditLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [permFilter, setPermFilter] = useState<string>("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("id, actor_id, action, details, created_at")
      .in("action", PERM_ACTIONS as any)
      .order("created_at", { ascending: false })
      .limit(300);
    const list = ((data ?? []) as any[]) as LogRow[];
    const ids = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", ids);
      const m = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.user_id, p]));
      for (const r of list) {
        const p = r.actor_id ? m[r.actor_id] : null;
        r.actor_name = p?.name || null;
        r.actor_phone = p?.phone || null;
      }
    }
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel("admin-perm-audit-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter && r.details?.role !== roleFilter) return false;
      if (permFilter && r.details?.permission !== permFilter) return false;
      if (qq) {
        const blob = `${r.actor_name ?? ""} ${r.actor_phone ?? ""} ${r.action} ${JSON.stringify(r.details ?? {})}`.toLowerCase();
        if (!blob.includes(qq)) return false;
      }
      return true;
    });
  }, [rows, roleFilter, permFilter, q]);

  const actionColor = (a: string) =>
    a === "permission_granted" || a === "role_assigned" ? "bg-emerald-500/10 text-emerald-600"
    : a === "permission_revoked" || a === "role_revoked" ? "bg-red-500/10 text-red-600"
    : "bg-muted text-muted-foreground";

  const actionLabel = (a: string) => a.replace(/_/g, " ");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><History className="w-5 h-5 text-primary" /></div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Permission &amp; role change log</p>
            <p className="text-xs text-muted-foreground">Every grant, revoke, and role assignment recorded with actor and timestamp.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4" /> Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-40">
            <label className="text-[11px] text-muted-foreground">Role</label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">Any</option>
              {ROLE_KEYS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="min-w-56">
            <label className="text-[11px] text-muted-foreground">Permission</label>
            <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={permFilter} onChange={(e) => setPermFilter(e.target.value)}>
              <option value="">Any</option>
              {REGISTERED_PERMISSIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="min-w-56 flex-1">
            <label className="text-[11px] text-muted-foreground">Search</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Actor, action, details…" className="h-9" />
          </div>
          {(roleFilter || permFilter || q) && (
            <Button variant="ghost" size="sm" onClick={() => { setRoleFilter(""); setPermFilter(""); setQ(""); }}>Clear</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Log ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No matching entries.</p>
          ) : (
            <ScrollArea className="max-h-[560px]">
              <div className="divide-y divide-border">
                {filtered.map((r) => (
                  <div key={r.id} className="p-3 flex items-start gap-3">
                    <Badge className={`${actionColor(r.action)} text-[10px] capitalize shrink-0 mt-0.5`}>{actionLabel(r.action)}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {r.details?.role && <span className="capitalize font-medium">{String(r.details.role).replace(/_/g, " ")}</span>}
                        {r.details?.permission && (<><span className="text-muted-foreground"> · </span><code className="text-xs">{r.details.permission}</code></>)}
                        {r.details?.allowed !== undefined && (
                          <Badge variant="outline" className="ml-2 text-[10px]">{r.details.allowed ? "on" : "off"}</Badge>
                        )}
                        {r.details?.user_id && !r.details?.permission && (
                          <span className="text-xs text-muted-foreground"> for user {String(r.details.user_id).slice(0, 8)}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        By {r.actor_name || r.actor_phone || (r.actor_id ? r.actor_id.slice(0, 8) : "system")}
                        {" · "}
                        <span title={format(new Date(r.created_at), "PPpp")}>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
