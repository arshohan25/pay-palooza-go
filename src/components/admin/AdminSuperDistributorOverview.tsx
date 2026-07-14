import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Crown, Building2, MapPin, Users, ArrowRightLeft, RefreshCw, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Distributor { id: string; user_id: string; business_name: string; status: string; territory: string[] | null; parent_id: string | null; }
interface Agent { id: string; distributor_id: string | null; status: string; }
interface AuditRow { id: string; action: string; entity_type: string; entity_id: string; details: any; created_at: string; actor_id: string | null; }

const TRANSFER_ACTIONS = [
  "distributor_sd_linked",
  "distributor_sd_unlinked",
  "distributor_sd_transferred",
  "distributor_bulk_transferred",
  "distributor_bulk_transfer_undo",
  "agent_transferred",
  "territory_transferred",
];

const ACTION_LABEL: Record<string, string> = {
  distributor_sd_linked: "Linked distributor",
  distributor_sd_unlinked: "Unlinked distributor",
  distributor_sd_transferred: "Distributor → new SD",
  distributor_bulk_transferred: "Bulk transfer",
  distributor_bulk_transfer_undo: "Undid bulk transfer",
  agent_transferred: "Agent → new distributor",
  territory_transferred: "Territory moved",
};

/**
 * Read-only overview dashboard for super distributors.
 * Aggregates: SD count, linked distributors, agents under each SD's tree,
 * active territories, and the most recent transfer / link events.
 */
export default function AdminSuperDistributorOverview() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [sdUserIds, setSdUserIds] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recent, setRecent] = useState<AuditRow[]>([]);
  const [distNameMap, setDistNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: dists }, { data: sdRoles }, { data: ag }, { data: audits }] = await Promise.all([
      supabase.from("distributors").select("id, user_id, business_name, status, territory, parent_id").limit(1000),
      supabase.from("user_roles").select("user_id").eq("role", "super_distributor" as any),
      supabase.from("agents").select("id, distributor_id, status").limit(2000),
      supabase.from("audit_logs")
        .select("id, action, entity_type, entity_id, details, created_at, actor_id")
        .in("action", TRANSFER_ACTIONS as any)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    const list = (dists as Distributor[]) ?? [];
    setDistributors(list);
    setDistNameMap(Object.fromEntries(list.map((d) => [d.id, d.business_name])));
    setSdUserIds(new Set(((sdRoles ?? []) as any[]).map((r) => r.user_id)));
    setAgents((ag as Agent[]) ?? []);
    setRecent((audits as AuditRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("admin-sd-overview-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "distributors" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "agents" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const supers = useMemo(() => distributors.filter((d) => sdUserIds.has(d.user_id)), [distributors, sdUserIds]);

  const childrenOf = useCallback(
    (sdId: string) => distributors.filter((d) => d.parent_id === sdId && !sdUserIds.has(d.user_id)),
    [distributors, sdUserIds],
  );

  const rows = useMemo(() => supers.map((sd) => {
    const kids = childrenOf(sd.id);
    const kidIds = new Set(kids.map((k) => k.id));
    const linkedAgents = agents.filter((a) => a.distributor_id && kidIds.has(a.distributor_id));
    const territories = new Set<string>();
    for (const k of kids) for (const t of (k.territory ?? [])) territories.add(t);
    for (const t of (sd.territory ?? [])) territories.add(t);
    return {
      sd,
      distributors: kids.length,
      agents: linkedAgents.length,
      activeAgents: linkedAgents.filter((a) => a.status === "active").length,
      territories: territories.size,
    };
  }).sort((a, b) => b.agents - a.agents), [supers, childrenOf, agents]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    distributors: acc.distributors + r.distributors,
    agents: acc.agents + r.agents,
    activeAgents: acc.activeAgents + r.activeAgents,
    territories: acc.territories + r.territories,
  }), { distributors: 0, agents: 0, activeAgents: 0, territories: 0 }), [rows]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Crown className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Super Distributors</p><p className="text-xl font-bold text-foreground">{supers.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-emerald-500" /></div>
          <div><p className="text-xs text-muted-foreground">Distributors</p><p className="text-xl font-bold text-foreground">{totals.distributors}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-xs text-muted-foreground">Linked Agents</p><p className="text-xl font-bold text-foreground">{totals.agents}<span className="text-xs text-emerald-500 font-normal ml-1">({totals.activeAgents} active)</span></p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center"><MapPin className="w-5 h-5 text-sky-500" /></div>
          <div><p className="text-xs text-muted-foreground">Active Territories</p><p className="text-xl font-bold text-foreground">{totals.territories}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 flex items-center justify-center"><ArrowRightLeft className="w-5 h-5 text-fuchsia-500" /></div>
          <div><p className="text-xs text-muted-foreground">Recent Transfers (30d)</p><p className="text-xl font-bold text-foreground">{recent.length}</p></div>
        </CardContent></Card>
      </div>

      {/* Per-SD breakdown */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Super Distributor breakdown</CardTitle>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[380px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Super Distributor</TableHead>
                  <TableHead className="text-center">Distributors</TableHead>
                  <TableHead className="text-center">Agents</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-center">Territories</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No super distributors yet</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.sd.id}>
                    <TableCell className="font-medium text-foreground">{r.sd.business_name}</TableCell>
                    <TableCell className="text-center font-mono">{r.distributors}</TableCell>
                    <TableCell className="text-center font-mono">{r.agents}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-600">{r.activeAgents}</TableCell>
                    <TableCell className="text-center font-mono">{r.territories}</TableCell>
                    <TableCell className="text-center"><Badge variant={r.sd.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">{r.sd.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent transfers */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Recent transfers &amp; links</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[420px]">
            {recent.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">No recent activity</p>
            ) : (
              <div className="divide-y divide-border">
                {recent.map((r) => {
                  const fromId = r.details?.from as string | undefined;
                  const toId = r.details?.to as string | undefined;
                  const from = fromId ? (distNameMap[fromId] ?? fromId.slice(0, 8)) : "Unassigned";
                  const to = toId ? (distNameMap[toId] ?? toId.slice(0, 8)) : "Unassigned";
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {ACTION_LABEL[r.action] || r.action}
                          {r.details?.code && <span className="ml-1 text-xs font-mono text-muted-foreground">[{r.details.code}]</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          <span>{from}</span>
                          <ArrowRightLeft className="inline w-3 h-3 mx-1.5 opacity-60" />
                          <span>{to}</span>
                          {typeof r.details?.agents === "number" && (
                            <span className="ml-2">· {r.details.agents} agents, {r.details.territories ?? 0} territories</span>
                          )}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
