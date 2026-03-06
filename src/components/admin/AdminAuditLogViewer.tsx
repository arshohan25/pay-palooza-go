import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, RefreshCw, Eye, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
}

interface AdminProfile {
  user_id: string;
  name: string | null;
  phone: string;
}

const PAGE_SIZE = 50;

export default function AdminAuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminProfiles, setAdminProfiles] = useState<Record<string, AdminProfile>>({});
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    let query = supabase
      .from("audit_logs")
      .select("*")
      .in("action", ["view_user_profile", "view_all_profiles"])
      .order("created_at", { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (dateFrom) {
      query = query.gte("created_at", dateFrom.toISOString());
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.lte("created_at", endOfDay.toISOString());
    }
    if (adminFilter && adminFilter !== "all") {
      query = query.eq("actor_id", adminFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch audit logs:", error);
      setLoading(false);
      return;
    }

    const entries = (data ?? []) as AuditLogEntry[];
    const newLogs = reset ? entries : [...logs, ...entries];
    setLogs(newLogs);
    setHasMore(entries.length === PAGE_SIZE);
    if (reset) setOffset(PAGE_SIZE);
    else setOffset(currentOffset + PAGE_SIZE);

    // Resolve admin profiles for any new actor_ids
    const actorIds = [...new Set(newLogs.map(l => l.actor_id))];
    const missing = actorIds.filter(id => !adminProfiles[id]);
    if (missing.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", missing);
      if (profiles) {
        const map = { ...adminProfiles };
        profiles.forEach(p => { map[p.user_id] = p; });
        setAdminProfiles(map);
      }
    }

    setLoading(false);
  }, [offset, dateFrom, dateTo, adminFilter, logs, adminProfiles]);

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, adminFilter]);

  const distinctAdmins = [...new Set(logs.map(l => l.actor_id))];

  const getAdminLabel = (actorId: string) => {
    const p = adminProfiles[actorId];
    if (p?.name) return p.name;
    if (p?.phone) return p.phone;
    return actorId.slice(0, 8) + "…";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5" /> Audit Log — Profile Views
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Date From */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  {dateTo ? format(dateTo, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Admin Filter */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Admin</label>
            <Select value={adminFilter} onValueChange={setAdminFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="All admins" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All admins</SelectItem>
                {distinctAdmins.map(id => (
                  <SelectItem key={id} value={id}>{getAdminLabel(id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters */}
          {(dateFrom || dateTo || adminFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setAdminFilter("all"); }}>
              Clear
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Date / Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No audit log entries found
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getAdminLabel(log.actor_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs gap-1">
                        {log.action === "view_user_profile" ? (
                          <><Eye className="w-3 h-3" /> View Profile</>
                        ) : (
                          <><Users className="w-3 h-3" /> View User List</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.action === "view_user_profile" ? (
                        <span>{log.details?.viewed_user_name || "—"} <span className="text-muted-foreground text-xs">({log.details?.viewed_user_phone || "—"})</span></span>
                      ) : (
                        <span className="text-muted-foreground text-xs">{log.details?.count ?? "—"} users loaded</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.entity_id?.slice(0, 8)}…
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Load More */}
        {hasMore && logs.length > 0 && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => fetchLogs(false)} disabled={loading}>
              {loading ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}

        {loading && logs.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
