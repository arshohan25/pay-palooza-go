import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Crown, Building2, MapPin, Users, ArrowRightLeft, RefreshCw, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { formatDistanceToNow, format, subDays, startOfDay, endOfDay } from "date-fns";

interface Distributor { id: string; user_id: string; business_name: string; status: string; territory: string[] | null; parent_id: string | null; }
interface Agent { id: string; distributor_id: string | null; status: string; business_name: string | null; }
interface AuditRow { id: string; action: string; entity_type: string; entity_id: string | null; details: any; created_at: string; actor_id: string | null; }

const TRANSFER_ACTIONS = [
  "distributor_sd_linked",
  "distributor_sd_unlinked",
  "distributor_sd_transferred",
  "distributor_bulk_transferred",
  "distributor_bulk_transfer_undo",
  "agent_transferred",
  "agent_assigned",
  "agent_unassigned",
  "territory_transferred",
];

const ACTION_LABEL: Record<string, string> = {
  distributor_sd_linked: "Linked distributor",
  distributor_sd_unlinked: "Unlinked distributor",
  distributor_sd_transferred: "Distributor → new SD",
  distributor_bulk_transferred: "Bulk transfer",
  distributor_bulk_transfer_undo: "Undid bulk transfer",
  agent_transferred: "Agent → new distributor",
  agent_assigned: "Agent assigned",
  agent_unassigned: "Agent unassigned",
  territory_transferred: "Territory moved",
};

type Drill = "agents" | "territories" | "transfers" | null;

export default function AdminSuperDistributorOverview() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [sdUserIds, setSdUserIds] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recent, setRecent] = useState<AuditRow[]>([]);
  const [distNameMap, setDistNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Date range (defaults last 30d)
  const [from, setFrom] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const [drill, setDrill] = useState<Drill>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const fromIso = startOfDay(new Date(from)).toISOString();
    const toIso = endOfDay(new Date(to)).toISOString();
    const [{ data: dists }, { data: sdRoles }, { data: ag }, { data: audits }] = await Promise.all([
      supabase.from("distributors").select("id, user_id, business_name, status, territory, parent_id").limit(1000),
      supabase.from("user_roles").select("user_id").eq("role", "super_distributor" as any),
      supabase.from("agents").select("id, distributor_id, status, business_name").limit(2000),
      supabase.from("audit_logs")
        .select("id, action, entity_type, entity_id, details, created_at, actor_id")
        .in("action", TRANSFER_ACTIONS as any)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const list = (dists as Distributor[]) ?? [];
    setDistributors(list);
    setDistNameMap(Object.fromEntries(list.map((d) => [d.id, d.business_name])));
    setSdUserIds(new Set(((sdRoles ?? []) as any[]).map((r) => r.user_id)));
    setAgents((ag as Agent[]) ?? []);
    setRecent((audits as AuditRow[]) ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const supers = useMemo(() => distributors.filter((d) => sdUserIds.has(d.user_id)), [distributors, sdUserIds]);
  const childrenOf = useCallback(
    (sdId: string) => distributors.filter((d) => d.parent_id === sdId && !sdUserIds.has(d.user_id)),
    [distributors, sdUserIds],
  );

  const linkedAgentRows = useMemo(() => {
    const sdIdSet = new Set(supers.map((s) => s.id));
    const parentBy: Record<string, string> = {};
    for (const d of distributors) if (d.parent_id && sdIdSet.has(d.parent_id)) parentBy[d.id] = d.parent_id;
    return agents
      .filter((a) => a.distributor_id && parentBy[a.distributor_id])
      .map((a) => ({
        ...a,
        distributor: distNameMap[a.distributor_id!] ?? a.distributor_id!.slice(0, 8),
        sd: distNameMap[parentBy[a.distributor_id!]] ?? "—",
      }));
  }, [supers, distributors, agents, distNameMap]);

  const territoryRows = useMemo(() => {
    const map: Record<string, { code: string; distributor: string; sd: string }> = {};
    for (const sd of supers) {
      for (const t of sd.territory ?? []) map[`${sd.id}:${t}`] = { code: t, distributor: sd.business_name, sd: sd.business_name };
      for (const child of childrenOf(sd.id)) {
        for (const t of child.territory ?? []) map[`${child.id}:${t}`] = { code: t, distributor: child.business_name, sd: sd.business_name };
      }
    }
    return Object.values(map);
  }, [supers, childrenOf]);

  const perSdRows = useMemo(() => supers.map((sd) => {
    const kids = childrenOf(sd.id);
    const kidIds = new Set(kids.map((k) => k.id));
    const la = agents.filter((a) => a.distributor_id && kidIds.has(a.distributor_id));
    const terrs = new Set<string>();
    for (const k of kids) for (const t of (k.territory ?? [])) terrs.add(t);
    for (const t of (sd.territory ?? [])) terrs.add(t);
    return {
      sd,
      distributors: kids.length,
      agents: la.length,
      activeAgents: la.filter((a) => a.status === "active").length,
      territories: terrs.size,
    };
  }).sort((a, b) => b.agents - a.agents), [supers, childrenOf, agents]);

  const totals = useMemo(() => ({
    distributors: perSdRows.reduce((s, r) => s + r.distributors, 0),
    agents: linkedAgentRows.length,
    activeAgents: linkedAgentRows.filter((a) => a.status === "active").length,
    territories: territoryRows.length,
    transfers: recent.length,
  }), [perSdRows, linkedAgentRows, territoryRows, recent]);

  const setPreset = (days: number) => {
    setFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setTo(format(new Date(), "yyyy-MM-dd"));
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const KpiCard = ({ icon, tint, label, value, sub, onClick }: any) => (
    <button type="button" onClick={onClick} className="text-left group">
      <Card className="hover:border-primary/40 hover:shadow-md transition-all">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tint}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}{sub && <span className="text-xs text-emerald-500 font-normal ml-1">{sub}</span>}</p>
          </div>
          {onClick && <span className="text-[10px] text-muted-foreground group-hover:text-primary">View →</span>}
        </CardContent>
      </Card>
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Date range */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <CalendarIcon className="w-4 h-4 text-muted-foreground mt-2" />
          <div>
            <label className="text-[11px] text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="flex gap-1">
            {[7, 30, 90].map((d) => (
              <Button key={d} size="sm" variant="outline" className="h-9 text-xs" onClick={() => setPreset(d)}>Last {d}d</Button>
            ))}
          </div>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      {/* KPI grid — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Crown className="w-5 h-5 text-primary" />} tint="bg-primary/10" label="Super Distributors" value={supers.length} />
        <KpiCard icon={<Building2 className="w-5 h-5 text-emerald-500" />} tint="bg-emerald-500/10" label="Distributors" value={totals.distributors} />
        <KpiCard icon={<Users className="w-5 h-5 text-amber-500" />} tint="bg-amber-500/10" label="Linked Agents" value={totals.agents} sub={`(${totals.activeAgents} active)`} onClick={() => setDrill("agents")} />
        <KpiCard icon={<MapPin className="w-5 h-5 text-sky-500" />} tint="bg-sky-500/10" label="Active Territories" value={totals.territories} onClick={() => setDrill("territories")} />
        <KpiCard icon={<ArrowRightLeft className="w-5 h-5 text-fuchsia-500" />} tint="bg-fuchsia-500/10" label="Transfers" value={totals.transfers} onClick={() => setDrill("transfers")} />
      </div>

      {/* Per-SD breakdown */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Super Distributor breakdown</CardTitle></CardHeader>
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
                {perSdRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No super distributors yet</TableCell></TableRow>
                ) : perSdRows.map((r) => (
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

      {/* Drill-down dialog */}
      <Dialog open={drill !== null} onOpenChange={(o) => { if (!o) setDrill(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>
              {drill === "agents" && `Linked Agents (${linkedAgentRows.length})`}
              {drill === "territories" && `Active Territories (${territoryRows.length})`}
              {drill === "transfers" && `Recent transfers (${recent.length})`}
            </DialogTitle>
            <DialogDescription>
              {from} → {to}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] px-6 pb-6">
            {drill === "agents" && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Agent</TableHead><TableHead>Distributor</TableHead>
                  <TableHead>Super Distributor</TableHead><TableHead className="text-center">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {linkedAgentRows.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No linked agents</TableCell></TableRow>
                  ) : linkedAgentRows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.business_name || a.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{a.distributor}</TableCell>
                      <TableCell className="text-xs">{a.sd}</TableCell>
                      <TableCell className="text-center"><Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {drill === "territories" && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Territory</TableHead><TableHead>Distributor</TableHead><TableHead>Super Distributor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {territoryRows.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No territories</TableCell></TableRow>
                  ) : territoryRows.map((t, i) => (
                    <TableRow key={`${t.code}-${i}`}>
                      <TableCell><Badge variant="outline" className="font-mono">{t.code}</Badge></TableCell>
                      <TableCell className="text-xs">{t.distributor}</TableCell>
                      <TableCell className="text-xs">{t.sd}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {drill === "transfers" && (
              recent.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-6">No transfers in this window</p>
              ) : (
                <div className="divide-y divide-border">
                  {recent.map((r) => {
                    const fromId = r.details?.from as string | undefined;
                    const toId = r.details?.to as string | undefined;
                    const f = fromId ? (distNameMap[fromId] ?? fromId.slice(0, 8)) : "Unassigned";
                    const t = toId ? (distNameMap[toId] ?? toId.slice(0, 8)) : "Unassigned";
                    return (
                      <div key={r.id} className="flex items-center gap-3 py-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {ACTION_LABEL[r.action] || r.action}
                            {r.details?.code && <span className="ml-1 text-xs font-mono text-muted-foreground">[{r.details.code}]</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            <span>{f}</span><ArrowRightLeft className="inline w-3 h-3 mx-1.5 opacity-60" /><span>{t}</span>
                          </p>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
