import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CalendarIcon, RefreshCw, Eye, Users, ArrowLeftRight, Landmark, Gift, HelpCircle, Shield, FileText } from "lucide-react";
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

const CATEGORY_MAP: Record<string, { label: string; actions: string[] }> = {
  profile_views: { label: "Profile Views", actions: ["view_user_profile", "view_all_profiles"] },
  chargebacks: { label: "Chargebacks", actions: ["chargeback", "chargeback_reversal"] },
  treasury: { label: "Treasury", actions: ["treasury_disburse"] },
  referrals: { label: "Referrals", actions: ["referral_milestone_pay", "referral_milestone_reset", "referral_reset_all"] },
};

const ALL_KNOWN_ACTIONS = Object.values(CATEGORY_MAP).flatMap(c => c.actions);

const ACTION_META: Record<string, { label: string; icon: React.ReactNode }> = {
  view_user_profile: { label: "View Profile", icon: <Eye className="w-3 h-3" /> },
  view_all_profiles: { label: "View User List", icon: <Users className="w-3 h-3" /> },
  chargeback: { label: "Chargeback", icon: <ArrowLeftRight className="w-3 h-3" /> },
  chargeback_reversal: { label: "Chargeback Reversal", icon: <ArrowLeftRight className="w-3 h-3" /> },
  treasury_disburse: { label: "Treasury Disburse", icon: <Landmark className="w-3 h-3" /> },
  referral_milestone_pay: { label: "Referral Pay", icon: <Gift className="w-3 h-3" /> },
  referral_milestone_reset: { label: "Referral Reset", icon: <Gift className="w-3 h-3" /> },
  referral_reset_all: { label: "Referral Reset All", icon: <Gift className="w-3 h-3" /> },
};

function formatAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function AdminAuditLogViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminProfiles, setAdminProfiles] = useState<Record<string, AdminProfile>>({});
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);
    const currentOffset = reset ? 0 : offset;

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    // Category filter
    if (categoryFilter && categoryFilter !== "all") {
      if (categoryFilter === "other") {
        query = query.not("action", "in", `(${ALL_KNOWN_ACTIONS.join(",")})`);
      } else {
        const cat = CATEGORY_MAP[categoryFilter];
        if (cat) query = query.in("action", cat.actions);
      }
    }

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
  }, [offset, dateFrom, dateTo, adminFilter, categoryFilter, logs, adminProfiles]);

  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, adminFilter, categoryFilter]);

  const distinctAdmins = [...new Set(logs.map(l => l.actor_id))];

  const getAdminLabel = (actorId: string) => {
    const p = adminProfiles[actorId];
    if (p?.name) return p.name;
    if (p?.phone) return p.phone;
    return actorId.slice(0, 8) + "…";
  };

  const renderActionBadge = (action: string) => {
    const meta = ACTION_META[action];
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        {meta ? <>{meta.icon} {meta.label}</> : <><Shield className="w-3 h-3" /> {formatAction(action)}</>}
      </Badge>
    );
  };

  const renderTarget = (log: AuditLogEntry) => {
    if (log.action === "view_user_profile") {
      return (
        <span>{log.details?.viewed_user_name || "—"} <span className="text-muted-foreground text-xs">({log.details?.viewed_user_phone || "—"})</span></span>
      );
    }
    if (log.action === "view_all_profiles") {
      return <span className="text-muted-foreground text-xs">{log.details?.count ?? "—"} users loaded</span>;
    }
    if (log.entity_type && log.entity_id) {
      return <span className="text-xs">{log.entity_type}: {log.entity_id.slice(0, 8)}…</span>;
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  };

  const renderDetails = (log: AuditLogEntry) => {
    if (!log.details) return "—";
    try {
      const str = JSON.stringify(log.details);
      return str.length > 60 ? str.slice(0, 60) + "…" : str;
    } catch {
      return "—";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="w-5 h-5" /> Audit Log
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => fetchLogs(true)} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start text-left font-normal text-xs", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start text-left font-normal text-xs", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                  {dateTo ? format(dateTo, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CATEGORY_MAP).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Admin</label>
            <Select value={adminFilter} onValueChange={setAdminFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
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

          {(dateFrom || dateTo || adminFilter !== "all" || categoryFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setAdminFilter("all"); setCategoryFilter("all"); }} className="col-span-2 sm:col-span-1">
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
                  <TableCell colSpan={5} className="p-0">
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                        <FileText className="w-7 h-7 text-muted-foreground" />
                      </motion.div>
                      <p className="text-sm font-semibold text-foreground">No audit log entries found</p>
                      <p className="text-xs text-muted-foreground mt-1">Audit logs will appear here</p>
                    </motion.div>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">{getAdminLabel(log.actor_id)}</TableCell>
                    <TableCell>{renderActionBadge(log.action)}</TableCell>
                    <TableCell className="text-sm">{renderTarget(log)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {renderDetails(log)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
