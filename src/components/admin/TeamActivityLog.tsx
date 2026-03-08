import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogIn, KeyRound, Shield, Settings, RefreshCw, Calendar } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface TeamMemberOption {
  user_id: string;
  display_name: string;
}

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
}

const TEAM_ACTIONS = [
  "admin_login",
  "password_change",
  "team_password_changed",
  "team_permissions_updated",
  "team_member_created",
  "team_member_removed",
  "team_member_update",
  "team_availability_toggle",
];

function getActionMeta(action: string) {
  switch (action) {
    case "admin_login":
      return { icon: LogIn, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "Logged in" };
    case "password_change":
    case "team_password_changed":
      return { icon: KeyRound, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Changed password" };
    case "team_permissions_updated":
      return { icon: Shield, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Permissions updated" };
    case "team_member_created":
      return { icon: Settings, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30", label: "Member created" };
    case "team_member_removed":
      return { icon: Settings, color: "text-red-600 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30", label: "Member removed" };
    default:
      return { icon: Settings, color: "text-muted-foreground", bg: "bg-muted", label: action.replace(/_/g, " ") };
  }
}

function humanizeDetails(action: string, details: any): string {
  if (!details) return "";
  switch (action) {
    case "team_permissions_updated":
      return details.display_name ? `for ${details.display_name}` : "";
    case "team_member_created":
      return details.display_name ? `${details.display_name} (${details.role || ""})` : "";
    case "team_member_removed":
      return details.display_name ? `${details.display_name}` : "";
    case "admin_login":
      return details.username ? `as ${details.username}` : "";
    default:
      return "";
  }
}

export default function TeamActivityLog() {
  const [members, setMembers] = useState<TeamMemberOption[]>([]);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Resolve actor names
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const loadMembers = useCallback(async () => {
    const { data } = await supabase.from("team_members").select("user_id, display_name").order("display_name");
    setMembers(data ?? []);
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("audit_logs")
      .select("*")
      .in("action", TEAM_ACTIONS)
      .order("created_at", { ascending: false })
      .limit(200);

    if (selectedMember !== "all") {
      query = query.eq("actor_id", selectedMember);
    }
    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }

    const { data } = await query;
    const entries = (data ?? []) as AuditEntry[];
    setLogs(entries);

    // Resolve names for actors
    const actorIds = [...new Set(entries.map(e => e.actor_id))];
    if (actorIds.length > 0) {
      const { data: tmData } = await supabase.from("team_members").select("user_id, display_name").in("user_id", actorIds);
      const map: Record<string, string> = {};
      (tmData ?? []).forEach(t => { map[t.user_id] = t.display_name; });
      setNameMap(map);
    }

    setLoading(false);
  }, [selectedMember, dateFrom, dateTo]);

  useEffect(() => { loadMembers(); }, [loadMembers]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("team-activity-log-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, (payload) => {
        const entry = payload.new as AuditEntry;
        if (TEAM_ACTIONS.includes(entry.action)) {
          setLogs(prev => [entry, ...prev].slice(0, 200));
          // Resolve name if missing
          if (!nameMap[entry.actor_id]) {
            supabase.from("team_members").select("user_id, display_name").eq("user_id", entry.actor_id).maybeSingle()
              .then(({ data }) => {
                if (data) setNameMap(prev => ({ ...prev, [data.user_id]: data.display_name }));
              });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [nameMap]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <Select value={selectedMember} onValueChange={setSelectedMember}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Members" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            {members.map(m => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 items-center">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
        </div>
        <Button size="sm" variant="outline" onClick={loadLogs}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No activity found for the selected filters</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />

            {logs.map((entry, idx) => {
              const meta = getActionMeta(entry.action);
              const Icon = meta.icon;
              const actorName = nameMap[entry.actor_id] || "Unknown";
              const extra = humanizeDetails(entry.action, entry.details);

              return (
                <div key={entry.id} className="relative pb-6 last:pb-0">
                  {/* Dot */}
                  <div className={`absolute -left-4.5 w-7 h-7 rounded-full flex items-center justify-center ${meta.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  </div>

                  <div className="ml-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{actorName}</span>
                      <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                      {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        {format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
