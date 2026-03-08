import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Wifi, Activity, MessageCircle, Clock, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TeamMemberMetric {
  user_id: string;
  display_name: string;
  department: string;
  is_available: boolean;
  last_active_at: string | null;
  actions_today: number;
  actions_week: number;
  open_tickets: number;
}

interface ActivityEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  actor_name?: string;
}

const DEPARTMENTS = ["all", "general", "support", "compliance", "finance", "operations", "engineering"];

export default function TeamActivityDashboard() {
  const [metrics, setMetrics] = useState<TeamMemberMetric[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([]);
  const [loginHistory, setLoginHistory] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState("all");

  const loadMetrics = useCallback(async () => {
    setLoading(true);

    // Get all team members
    const { data: members } = await supabase.from("team_members").select("*").order("display_name");
    if (!members || members.length === 0) { setMetrics([]); setLoading(false); return; }

    const userIds = members.map(m => m.user_id);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

    // Fetch audit logs for today + week counts
    const [todayRes, weekRes, ticketsRes, feedRes, loginsRes] = await Promise.all([
      supabase.from("audit_logs").select("actor_id").in("actor_id", userIds).gte("created_at", todayStart.toISOString()),
      supabase.from("audit_logs").select("actor_id").in("actor_id", userIds).gte("created_at", weekStart.toISOString()),
      supabase.from("support_conversations").select("assigned_agent_id").eq("status", "open").not("assigned_agent_id", "is", null),
      supabase.from("audit_logs").select("id, actor_id, action, entity_type, created_at").in("actor_id", userIds).order("created_at", { ascending: false }).limit(50),
      supabase.from("audit_logs").select("id, actor_id, action, entity_type, created_at").in("actor_id", userIds).eq("action", "admin_login").order("created_at", { ascending: false }).limit(50),
    ]);

    // Count actions per user
    const todayCounts: Record<string, number> = {};
    const weekCounts: Record<string, number> = {};
    const ticketCounts: Record<string, number> = {};

    (todayRes.data ?? []).forEach(r => { todayCounts[r.actor_id] = (todayCounts[r.actor_id] || 0) + 1; });
    (weekRes.data ?? []).forEach(r => { weekCounts[r.actor_id] = (weekCounts[r.actor_id] || 0) + 1; });
    (ticketsRes.data ?? []).forEach((r: any) => {
      if (r.assigned_agent_id) ticketCounts[r.assigned_agent_id] = (ticketCounts[r.assigned_agent_id] || 0) + 1;
    });

    const nameMap: Record<string, string> = {};
    members.forEach(m => { nameMap[m.user_id] = m.display_name; });

    setMetrics(members.map(m => ({
      user_id: m.user_id,
      display_name: m.display_name,
      department: m.department || "general",
      is_available: m.is_available ?? false,
      last_active_at: m.last_active_at,
      actions_today: todayCounts[m.user_id] || 0,
      actions_week: weekCounts[m.user_id] || 0,
      open_tickets: ticketCounts[m.user_id] || 0,
    })));

    setActivityFeed((feedRes.data ?? []).map(e => ({ ...e, actor_name: nameMap[e.actor_id] || e.actor_id.slice(0, 8) })));
    setLoginHistory((loginsRes.data ?? []).map(e => ({ ...e, actor_name: nameMap[e.actor_id] || e.actor_id.slice(0, 8) })));
    setLoading(false);
  }, []);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  // Realtime refresh
  useEffect(() => {
    const ch = supabase.channel("team-dash-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => loadMetrics())
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => loadMetrics())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadMetrics]);

  const filtered = metrics.filter(m => deptFilter === "all" || m.department === deptFilter);
  const onlineCount = metrics.filter(m => m.is_available).length;
  const totalActionsToday = metrics.reduce((s, m) => s + m.actions_today, 0);
  const totalOpenTickets = metrics.reduce((s, m) => s + m.open_tickets, 0);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Total Team</p><p className="text-xl font-bold text-foreground">{metrics.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Wifi className="w-5 h-5 text-emerald-500" /></div>
          <div><p className="text-xs text-muted-foreground">Online Now</p><p className="text-xl font-bold text-emerald-600">{onlineCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-500" /></div>
          <div><p className="text-xs text-muted-foreground">Actions Today</p><p className="text-xl font-bold text-foreground">{totalActionsToday}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-xs text-muted-foreground">Open Tickets</p><p className="text-xl font-bold text-foreground">{totalOpenTickets}</p></div>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d === "all" ? "All Departments" : d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Performance Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Team Performance</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[350px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Today</TableHead>
                  <TableHead className="text-center">Week</TableHead>
                  <TableHead className="text-center">Tickets</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No team members</TableCell></TableRow>
                ) : filtered.map(m => (
                  <TableRow key={m.user_id}>
                    <TableCell className="font-medium text-foreground">{m.display_name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{m.department}</Badge></TableCell>
                    <TableCell className="text-center">
                      <div className={`w-2.5 h-2.5 rounded-full mx-auto ${m.is_available ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    </TableCell>
                    <TableCell className="text-center font-mono text-sm">{m.actions_today}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{m.actions_week}</TableCell>
                    <TableCell className="text-center">
                      {m.open_tickets > 0 ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{m.open_tickets}</Badge> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.last_active_at ? formatDistanceToNow(new Date(m.last_active_at), { addSuffix: true }) : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Activity Feed + Login History side by side */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Recent Activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[300px]">
              <div className="divide-y divide-border/50">
                {activityFeed.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No recent activity</p>
                ) : activityFeed.slice(0, 25).map(e => (
                  <div key={e.id} className="px-4 py-2.5 flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity className="w-3 h-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground"><span className="font-medium">{e.actor_name}</span>{" "}<span className="text-muted-foreground">{e.action.replace(/_/g, " ")}</span></p>
                      <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Login History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[300px]">
              <div className="divide-y divide-border/50">
                {loginHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">No login history recorded</p>
                ) : loginHistory.slice(0, 25).map(e => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Clock className="w-3 h-3 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{e.actor_name}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
