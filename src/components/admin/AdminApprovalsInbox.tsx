import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bell, Check, X, ShieldAlert, Loader2, RefreshCw, Lock, Info, CheckCheck, Circle, CircleDot, WifiOff, Search, Siren, ArrowRightLeft, Filter, AlarmClock, RotateCcw, Clock, PlusCircle, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, differenceInMilliseconds } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { REGISTERED_PERMISSIONS, HIGH_RISK_PERMISSIONS, getHighRiskReasons } from "@/lib/permissionsRegistry";
import PermissionRequestTimeline from "./PermissionRequestTimeline";

interface Req {
  id: string; role: string; permission: string; allowed: boolean;
  reason: string | null; requested_by: string; created_at: string;
  expires_at: string | null; status: string;
  requester_name?: string; requester_phone?: string;
}

const RESYNC_MS = 30_000;
const ESCALATE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // <24h to expiry = urgent
const readKey = (uid: string | undefined) => `perm_inbox_read:${uid ?? "anon"}`;
const selKey = (uid: string | undefined) => `perm_inbox_sel:${uid ?? "anon"}`;
const escalatedKey = (uid: string | undefined) => `perm_inbox_esc:${uid ?? "anon"}`;

type ExpiryWindow = "all" | "24h" | "3d" | "7d";
type SortKey = "newest" | "oldest" | "expiring" | "requester";

export default function AdminApprovalsInbox() {
  const { user } = useAuth();
  const canManage = usePermission("manage_roles");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [escalatedIds, setEscalatedIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | { approve: boolean; ids: string[] }>(null);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  // Per-item status after runBulk (or during retry). "skipped" is set upfront
  // for the requester's own items; the rest start "pending".
  type BulkStatus = "pending" | "running" | "success" | "failed" | "skipped";
  const [bulkResults, setBulkResults] = useState<Record<string, { status: BulkStatus; error?: string }>>({});
  const [bulkRan, setBulkRan] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [rtHealthy, setRtHealthy] = useState(true);
  const [diffFor, setDiffFor] = useState<Req | null>(null);
  const [diffCurrent, setDiffCurrent] = useState<boolean | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [timelineId, setTimelineId] = useState<string | null>(null);
  const [undoWindows, setUndoWindows] = useState<Record<string, number>>({});
  // recent action tracker for undo: request snapshot + when it happened + window
  const [recent, setRecent] = useState<Array<{ req: Req; approved: boolean; at: number; windowSec: number; note: string }>>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  // Filters + sort
  const [search, setSearch] = useState("");
  const [requesterFilter, setRequesterFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryWindow>("all");
  const [riskOnly, setRiskOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("expiring");

  const rowsRef = useRef<Req[]>([]);
  rowsRef.current = rows;

  const permMeta = useMemo(() => Object.fromEntries(REGISTERED_PERMISSIONS.map((p) => [p.key, p])), []);
  const permGroups = useMemo(() => Array.from(new Set(REGISTERED_PERMISSIONS.map((p) => p.group))), []);

  // Load per-role undo windows once.
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("admin_role_undo_windows").select("role, undo_seconds");
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) m[r.role] = r.undo_seconds;
      setUndoWindows(m);
    })();
  }, []);

  // ---- Persisted state (per-admin localStorage) ---------------------------
  useEffect(() => {
    try {
      const r = localStorage.getItem(readKey(user?.id));
      if (r) setReadIds(new Set(JSON.parse(r)));
      const s = localStorage.getItem(selKey(user?.id));
      if (s) setSelected(new Set(JSON.parse(s)));
      const e = localStorage.getItem(escalatedKey(user?.id));
      if (e) setEscalatedIds(new Set(JSON.parse(e)));
    } catch { /* ignore */ }
  }, [user?.id]);
  const persist = (k: string, set: Set<string>) => {
    try { localStorage.setItem(k, JSON.stringify(Array.from(set))); } catch { /* ignore */ }
  };
  const persistRead = (s: Set<string>) => persist(readKey(user?.id), s);
  const persistSel = (s: Set<string>) => persist(selKey(user?.id), s);
  const persistEsc = (s: Set<string>) => persist(escalatedKey(user?.id), s);

  const markRead = (id: string) => setReadIds((prev) => {
    if (prev.has(id)) return prev;
    const next = new Set(prev); next.add(id); persistRead(next); return next;
  });
  const markUnread = (id: string) => setReadIds((prev) => {
    if (!prev.has(id)) return prev;
    const next = new Set(prev); next.delete(id); persistRead(next); return next;
  });
  const markAllRead = () => {
    const next = new Set(readIds);
    for (const r of rows) next.add(r.id);
    setReadIds(next); persistRead(next);
    toast.success("All requests marked read");
  };

  // ---- Fetch --------------------------------------------------------------
  const fetchPending = useCallback(async (): Promise<Req[]> => {
    await supabase.rpc("expire_stale_permission_requests" as any).then(() => {}, () => {});
    const { data } = await supabase
      .from("permission_change_requests" as any)
      .select("id, role, permission, allowed, reason, requested_by, created_at, expires_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);
    const list = ((data ?? []) as any[]) as Req[];
    const ids = Array.from(new Set(list.map((r) => r.requested_by))).filter(Boolean);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", ids);
      const m = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.user_id, p]));
      for (const r of list) {
        const p = m[r.requested_by];
        r.requester_name = p?.name;
        r.requester_phone = p?.phone;
      }
    }
    return list;
  }, []);

  const pruneStale = useCallback((ids: Set<string>) => {
    setReadIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      if (next.size !== prev.size) persistRead(next);
      return next;
    });
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      if (next.size !== prev.size) persistSel(next);
      return next;
    });
    setEscalatedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      if (next.size !== prev.size) persistEsc(next);
      return next;
    });
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchPending();
    setRows(list);
    pruneStale(new Set(list.map((r) => r.id)));
    setLastSyncAt(new Date());
    setLoading(false);
  }, [fetchPending, pruneStale]);

  useEffect(() => { load(); }, [load]);

  // ---- Reconciliation loop ------------------------------------------------
  const reconcile = useCallback(async () => {
    const server = await fetchPending();
    const local = rowsRef.current;
    const serverIds = new Set(server.map((r) => r.id));
    const localIds = new Set(local.map((r) => r.id));
    let diverged = server.length !== local.length;
    if (!diverged) for (const id of serverIds) if (!localIds.has(id)) { diverged = true; break; }
    if (!diverged) {
      const byId = Object.fromEntries(local.map((r) => [r.id, r]));
      for (const s of server) {
        const l = byId[s.id];
        if (!l || l.allowed !== s.allowed || l.reason !== s.reason || l.expires_at !== s.expires_at) {
          diverged = true; break;
        }
      }
    }
    if (diverged) {
      setRows(server);
      pruneStale(serverIds);
      toast.info("Inbox resynced with server", { description: "Selection preserved for still-pending items." });
    }
    setLastSyncAt(new Date());
  }, [fetchPending, pruneStale]);

  useEffect(() => {
    const t = setInterval(reconcile, RESYNC_MS);
    const onVis = () => { if (document.visibilityState === "visible") reconcile(); };
    const onFocus = () => reconcile();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [reconcile]);

  // ---- Realtime -----------------------------------------------------------
  useEffect(() => {
    const ch = supabase.channel("perm-inbox-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "permission_change_requests" },
        (payload: any) => {
          const r = payload.new as Req;
          if (r.status !== "pending") return;
          setRows((prev) => (prev.some((x) => x.id === r.id) ? prev : [r, ...prev]));
          if (r.requested_by !== user?.id) {
            toast.info("New permission request awaiting review", { description: `${r.allowed ? "Grant" : "Revoke"} ${r.permission} · ${r.role}` });
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "permission_change_requests" },
        (payload: any) => {
          const r = payload.new as Req;
          setRows((prev) => r.status === "pending"
            ? prev.map((x) => x.id === r.id ? { ...x, ...r } : x)
            : prev.filter((x) => x.id !== r.id));
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "permission_change_requests" },
        (payload: any) => setRows((prev) => prev.filter((x) => x.id !== (payload.old as any).id)))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") { setRtHealthy(true); reconcile(); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setRtHealthy(false);
      });
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, reconcile]);

  // ---- Result notification helper (best-effort) ---------------------------
  const notifyRequesterOfResult = async (r: Req, approve: boolean, note: string) => {
    try {
      await (supabase as any).from("notifications").insert({
        user_id: r.requested_by,
        title: approve ? "Permission request approved" : "Permission request rejected",
        body: `${r.allowed ? "Grant" : "Revoke"} ${r.permission} for ${r.role.replace(/_/g, " ")}${note ? ` — "${note}"` : ""}`,
        category: "system",
        metadata: { kind: "permission_request_result", request_id: r.id, approved: approve },
        read: false,
      });
    } catch { /* non-blocking */ }
  };

  // ---- Actions -------------------------------------------------------------
  const act = async (r: Req, approve: boolean) => {
    if (!canManage) { toast.error("Missing 'manage_roles' permission"); return; }
    if (approve && r.requested_by === user?.id) {
      toast.error("A different admin must approve — you can't self-approve");
      return;
    }
    setBusyId(r.id);
    const fn = approve ? "approve_permission_change" : "reject_permission_change";
    const note = notes[r.id] || "";
    const { error } = await supabase.rpc(fn as any, { _request_id: r.id, _note: note || null });
    setBusyId(null);
    if (error) { toast.error(error.message); reconcile(); return; }
    toast.success(approve ? "Approved" : "Rejected");
    notifyRequesterOfResult(r, approve, note);
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    markRead(r.id);
    const windowSec = undoWindows[r.role] ?? 900;
    setRecent((prev) => [{ req: r, approved: approve, at: Date.now(), windowSec, note }, ...prev].slice(0, 5));
  };

  const undo = async (item: { req: Req; approved: boolean; note: string }) => {
    const { error } = await supabase.rpc("undo_permission_change" as any, { _request_id: item.req.id, _note: null });
    if (error) { toast.error(error.message); return; }
    toast.success("Action undone — request returned to pending");
    setRecent((prev) => prev.filter((x) => x.req.id !== item.req.id));
    // Re-insert the request into pending list optimistically.
    setRows((prev) => prev.some((x) => x.id === item.req.id) ? prev : [{ ...item.req, status: "pending" }, ...prev]);
    reconcile();
  };


  // ---- Diff modal ----------------------------------------------------------
  const openDiff = async (r: Req) => {
    setDiffFor(r);
    setDiffCurrent(null);
    setDiffLoading(true);
    const { data } = await (supabase as any)
      .from("admin_role_permissions")
      .select("allowed")
      .eq("role", r.role)
      .eq("permission", r.permission)
      .maybeSingle();
    setDiffCurrent(data ? Boolean(data.allowed) : false);
    setDiffLoading(false);
  };

  // ---- Escalation ---------------------------------------------------------
  const escalate = async (r: Req) => {
    try {
      const { data: admins } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const ids = Array.from(new Set(((admins ?? []) as any[]).map((a) => a.user_id))).filter((id) => id && id !== user?.id);
      if (ids.length === 0) {
        toast.info("No backup admins to alert");
        return;
      }
      const rows = ids.map((uid) => ({
        user_id: uid,
        title: "⚠️ Permission request expiring soon",
        body: `${r.allowed ? "Grant" : "Revoke"} ${r.permission} for ${r.role.replace(/_/g, " ")} — expires ${r.expires_at ? formatDistanceToNow(new Date(r.expires_at), { addSuffix: true }) : "soon"}`,
        category: "system",
        metadata: { kind: "permission_request_escalation", request_id: r.id },
        read: false,
      }));
      const { error } = await (supabase as any).from("notifications").insert(rows);
      if (error) throw error;
      const next = new Set(escalatedIds); next.add(r.id); setEscalatedIds(next); persistEsc(next);
      toast.success(`Alerted ${ids.length} backup admin${ids.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Escalation failed");
    }
  };

  // ---- Bulk selection ------------------------------------------------------
  const toggleSel = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    persistSel(next);
    return next;
  });
  const clearSelection = () => { setSelected(new Set()); persistSel(new Set()); };

  const selectableForApprove = useMemo(
    () => rows.filter((r) => r.requested_by !== user?.id).map((r) => r.id),
    [rows, user?.id],
  );

  const [bulkCurrent, setBulkCurrent] = useState<Record<string, boolean>>({});
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);

  const openBulk = async (approve: boolean) => {
    const ids = Array.from(selected);
    if (ids.length === 0) { toast.error("Select at least one request"); return; }
    const filtered = approve ? ids.filter((id) => {
      const r = rows.find((x) => x.id === id);
      return r && r.requested_by !== user?.id;
    }) : ids;
    const skipped = ids.length - filtered.length;
    if (approve && skipped > 0) {
      toast.warning(`${skipped} own request(s) will be skipped — a different admin must approve those.`);
    }
    if (filtered.length === 0) { toast.error("Nothing to approve — you can't self-approve your own requests."); return; }
    setBulkNote("");
    setBulk({ approve, ids: filtered });
    // Fetch current permission values for a real diff preview.
    setBulkPreviewLoading(true);
    setBulkCurrent({});
    const selectedRows = filtered.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Req[];
    const pairs = Array.from(new Set(selectedRows.map((r) => `${r.role}|${r.permission}`)));
    const results = await Promise.all(pairs.map(async (key) => {
      const [role, permission] = key.split("|");
      const { data } = await (supabase as any).from("admin_role_permissions")
        .select("allowed").eq("role", role).eq("permission", permission).maybeSingle();
      return [key, data ? Boolean(data.allowed) : false] as const;
    }));
    setBulkCurrent(Object.fromEntries(results));
    setBulkPreviewLoading(false);
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    const fn = bulk.approve ? "approve_permission_change" : "reject_permission_change";
    let ok = 0, fail = 0;
    const failures: string[] = [];
    for (const id of bulk.ids) {
      const r = rows.find((x) => x.id === id);
      const { error } = await supabase.rpc(fn as any, { _request_id: id, _note: bulkNote || null });
      if (error) { fail++; failures.push(`${id.slice(0, 6)}: ${error.message}`); }
      else { ok++; markRead(id); if (r) notifyRequesterOfResult(r, bulk.approve, bulkNote); }
    }
    setBulkBusy(false);
    setBulk(null);
    clearSelection();
    reconcile();
    if (fail === 0) toast.success(`${bulk.approve ? "Approved" : "Rejected"} ${ok} request${ok === 1 ? "" : "s"}`);
    else toast.warning(`${ok} succeeded, ${fail} failed`, { description: failures.slice(0, 3).join(" · ") });
  };

  // ---- Filter + sort -------------------------------------------------------
  const uniqueRequesters = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.requested_by, r.requester_name || r.requester_phone || r.requested_by.slice(0, 8));
    return Array.from(map.entries());
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const winMs = expiryFilter === "24h" ? 24*3600e3 : expiryFilter === "3d" ? 3*24*3600e3 : expiryFilter === "7d" ? 7*24*3600e3 : Infinity;
    let list = rows.filter((r) => {
      if (requesterFilter !== "all" && r.requested_by !== requesterFilter) return false;
      if (groupFilter !== "all" && permMeta[r.permission]?.group !== groupFilter) return false;
      if (riskOnly && !HIGH_RISK_PERMISSIONS.has(r.permission)) return false;
      if (winMs !== Infinity) {
        if (!r.expires_at) return false;
        if (new Date(r.expires_at).getTime() - now > winMs) return false;
      }
      if (q) {
        const hay = `${r.requester_name ?? ""} ${r.requester_phone ?? ""} ${r.permission} ${r.role} ${r.reason ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      switch (sortBy) {
        case "newest": return +new Date(b.created_at) - +new Date(a.created_at);
        case "oldest": return +new Date(a.created_at) - +new Date(b.created_at);
        case "expiring": {
          const ax = a.expires_at ? +new Date(a.expires_at) : Infinity;
          const bx = b.expires_at ? +new Date(b.expires_at) : Infinity;
          return ax - bx;
        }
        case "requester": return (a.requester_name ?? a.requested_by).localeCompare(b.requester_name ?? b.requested_by);
      }
    });
    return list;
  }, [rows, search, requesterFilter, groupFilter, riskOnly, expiryFilter, sortBy, permMeta]);

  const clearFilters = () => { setSearch(""); setRequesterFilter("all"); setGroupFilter("all"); setExpiryFilter("all"); setRiskOnly(false); };
  const filtersActive = search || requesterFilter !== "all" || groupFilter !== "all" || expiryFilter !== "all" || riskOnly;

  const unreadCount = rows.filter((r) => !readIds.has(r.id)).length;
  const urgentCount = rows.filter((r) => r.expires_at && differenceInMilliseconds(new Date(r.expires_at), new Date()) < ESCALATE_THRESHOLD_MS).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center relative">
            <Bell className="w-5 h-5 text-primary" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-medium text-foreground">Approvals inbox</p>
            <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
              {rows.length} pending · {unreadCount} unread
              {urgentCount > 0 && <span className="flex items-center gap-1 text-red-600"><AlarmClock className="w-3 h-3" /> {urgentCount} urgent</span>}
              {lastSyncAt && <span title={lastSyncAt.toLocaleString()}>· synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}</span>}
              {!rtHealthy && <span className="flex items-center gap-1 text-amber-600"><WifiOff className="w-3 h-3" /> reconnecting</span>}
            </p>
          </div>
          {canManage === false && (<Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Read-only</Badge>)}
          <Button size="sm" variant="ghost" onClick={markAllRead} disabled={unreadCount === 0} className="gap-1">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </Button>
          <Button size="icon" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      {/* Undo banner — one per recent action, disappears when the window elapses */}
      {recent.length > 0 && (
        <div className="space-y-2">
          {recent.map((item) => {
            const remaining = Math.max(0, item.windowSec * 1000 - (Date.now() - item.at));
            if (remaining <= 0) return null;
            const secs = Math.ceil(remaining / 1000);
            return (
              <div key={item.req.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.06]">
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-xs flex-1 min-w-[200px]">
                  <p className="font-medium">
                    {item.approved ? "Approved" : "Rejected"} <code className="text-[11px]">{item.req.permission}</code> for{" "}
                    <span className="capitalize">{item.req.role.replace(/_/g, " ")}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Reversible for {secs}s (role window: {item.windowSec}s){tick /* re-render */}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => undo(item)} className="gap-1 border-amber-500/60 text-amber-700 hover:bg-amber-500/10">
                  <RotateCcw className="w-3 h-3" /> Undo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRecent((prev) => prev.filter((x) => x.req.id !== item.req.id))}>Dismiss</Button>
              </div>
            );
          })}
        </div>
      )}



      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="relative min-w-[180px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 h-9" placeholder="Search requester, permission, reason" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={requesterFilter} onValueChange={setRequesterFilter}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Requester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All requesters</SelectItem>
              {uniqueRequesters.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {permGroups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={expiryFilter} onValueChange={(v) => setExpiryFilter(v as ExpiryWindow)}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Expiry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any expiry</SelectItem>
              <SelectItem value="24h">Expires &lt; 24h</SelectItem>
              <SelectItem value="3d">Expires &lt; 3d</SelectItem>
              <SelectItem value="7d">Expires &lt; 7d</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expiring">Expiring soonest</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="requester">By requester</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant={riskOnly ? "default" : "outline"} onClick={() => setRiskOnly((v) => !v)} className="gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> High-risk
          </Button>
          {filtersActive && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear</Button>}
        </CardContent>
      </Card>

      {/* Bulk toolbar */}
      {rows.length > 0 && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <Checkbox
              checked={selected.size > 0 && visible.every((r) => selected.has(r.id))}
              onCheckedChange={(v) => {
                if (v) {
                  const next = new Set(selected); for (const r of visible) next.add(r.id);
                  setSelected(next); persistSel(next);
                } else clearSelection();
              }}
            />
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected (persisted)` : "Select all visible"}
            </span>
            <div className="flex-1" />
            {selected.size > 0 && <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>}
            <Button size="sm" variant="outline" disabled={!canManage || selected.size === 0} onClick={() => openBulk(false)} className="gap-1">
              <X className="w-3 h-3" /> Bulk reject
            </Button>
            <Button size="sm" disabled={!canManage || selected.size === 0 || !Array.from(selected).some((id) => selectableForApprove.includes(id))}
              onClick={() => openBulk(true)} className="gap-1"
              title="Own requests are skipped — a second admin must approve those.">
              <Check className="w-3 h-3" /> Bulk approve
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Awaiting your review ({visible.length}{visible.length !== rows.length ? ` of ${rows.length}` : ""})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              <Check className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
              {rows.length === 0 ? "Inbox zero — no permission requests need your attention." : "No requests match your filters."}
            </div>
          ) : (
            <ScrollArea className="max-h-[640px]">
              <div className="divide-y divide-border">
                {visible.map((r) => {
                  const isOwn = r.requested_by === user?.id;
                  const meta = permMeta[r.permission];
                  const risky = HIGH_RISK_PERMISSIONS.has(r.permission);
                  const unread = !readIds.has(r.id);
                  const isSelected = selected.has(r.id);
                  const msToExpiry = r.expires_at ? differenceInMilliseconds(new Date(r.expires_at), new Date()) : Infinity;
                  const urgent = msToExpiry < ESCALATE_THRESHOLD_MS;
                  const alreadyEscalated = escalatedIds.has(r.id);
                  return (
                    <div key={r.id}
                      className={`p-4 space-y-2 transition-colors ${urgent ? "border-l-4 border-red-500 bg-red-500/[0.04]" : ""} ${unread ? "bg-primary/[0.03]" : ""} ${isSelected ? "bg-primary/[0.06]" : ""}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSel(r.id)} className="mt-1" />
                        <button onClick={() => (unread ? markRead(r.id) : markUnread(r.id))}
                          title={unread ? "Mark read" : "Mark unread"} className="mt-1 text-primary hover:text-primary/70 shrink-0">
                          {unread ? <CircleDot className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${risky ? "bg-amber-500/15" : "bg-primary/10"}`}>
                          <ShieldAlert className={`w-4 h-4 ${risky ? "text-amber-600" : "text-primary"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            {unread && <Badge className="mr-1 bg-primary text-primary-foreground text-[9px]">new</Badge>}
                            {urgent && <Badge className="mr-1 bg-red-500 text-white text-[9px] gap-0.5"><AlarmClock className="w-2.5 h-2.5" />urgent</Badge>}
                            <Badge variant="outline" className="text-[10px] mr-1">{r.allowed ? "grant" : "revoke"}</Badge>
                            <code className="text-xs">{r.permission}</code>
                            <span className="text-muted-foreground"> for </span>
                            <span className="font-medium capitalize">{r.role.replace(/_/g, " ")}</span>
                            {risky && <Badge className="ml-2 bg-amber-500/15 text-amber-700 text-[10px]">high-risk</Badge>}
                          </p>
                          {meta && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-start gap-1">
                              <Info className="w-3 h-3 mt-0.5 shrink-0" />
                              <span><strong>{meta.label}</strong> — {meta.description} <em className="opacity-70">({meta.group})</em></span>
                            </p>
                          )}
                          {r.reason && <p className="text-[11px] italic text-muted-foreground mt-1">"{r.reason}"</p>}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Requested by {r.requester_name || r.requester_phone || r.requested_by.slice(0, 8)}
                            {isOwn && <Badge variant="secondary" className="ml-1 text-[9px]">you</Badge>}
                            {" · "}
                            <span title={format(new Date(r.created_at), "PPpp")}>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                            {r.expires_at && <> · <span className={urgent ? "text-red-600 font-medium" : ""}>expires {formatDistanceToNow(new Date(r.expires_at), { addSuffix: true })}</span></>}
                          </p>
                        </div>
                      </div>
                      <div className="pl-16 space-y-2">
                        <Textarea rows={2} placeholder="Optional review note…"
                          value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                          className="text-xs" />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setTimelineId(r.id)} className="gap-1">
                            <Clock className="w-3 h-3" /> Timeline
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openDiff(r)} className="gap-1">
                            <ArrowRightLeft className="w-3 h-3" /> Preview diff
                          </Button>
                          {urgent && (
                            <Button size="sm" variant="outline" onClick={() => escalate(r)} disabled={alreadyEscalated}
                              className="gap-1 border-red-500/40 text-red-600 hover:bg-red-500/10">
                              <Siren className="w-3 h-3" /> {alreadyEscalated ? "Escalated" : "Alert backup admins"}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => act(r, false)} disabled={!canManage || busyId === r.id} className="gap-1">
                            <X className="w-3 h-3" /> Reject
                          </Button>
                          <Button size="sm" onClick={() => act(r, true)} disabled={!canManage || isOwn || busyId === r.id}
                            title={isOwn ? "You cannot self-approve" : "Approve"} className="gap-1">
                            {busyId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Diff modal */}
      <Dialog open={!!diffFor} onOpenChange={(o) => !o && setDiffFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Permission change preview</DialogTitle>
            <DialogDescription>
              {diffFor && <>Reviewing <code className="text-xs">{diffFor.permission}</code> for <span className="capitalize">{diffFor.role.replace(/_/g, " ")}</span></>}
            </DialogDescription>
          </DialogHeader>
          {diffLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : diffFor && (() => {
            const isNoop = diffCurrent === diffFor.allowed;
            const isAdd = !isNoop && diffFor.allowed === true;
            const isRemove = !isNoop && diffFor.allowed === false;
            const risky = HIGH_RISK_PERMISSIONS.has(diffFor.permission);
            const reasons = risky ? getHighRiskReasons(diffFor.permission) : [];
            return (
              <div className="space-y-3">
                {permMeta[diffFor.permission] && (
                  <div className="p-3 rounded-lg bg-muted/40 text-xs">
                    <p className="font-medium text-foreground">{permMeta[diffFor.permission].label}</p>
                    <p className="text-muted-foreground mt-1">{permMeta[diffFor.permission].description}</p>
                    <p className="text-muted-foreground mt-1">Group: <strong>{permMeta[diffFor.permission].group}</strong></p>
                  </div>
                )}

                {/* Clear change-type banner */}
                <div className={`p-3 rounded-lg border flex items-start gap-2 text-xs ${
                  isNoop ? "border-amber-500/40 bg-amber-500/5 text-amber-700" :
                  isAdd ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700" :
                  "border-red-500/40 bg-red-500/5 text-red-700"
                }`}>
                  {isNoop ? <Info className="w-4 h-4 mt-0.5 shrink-0" /> :
                   isAdd ? <PlusCircle className="w-4 h-4 mt-0.5 shrink-0" /> :
                   <MinusCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div>
                    <p className="font-semibold">
                      {isNoop ? "No change — request is a no-op" :
                       isAdd ? "ADD permission" : "REMOVE permission"}
                    </p>
                    <p className="opacity-90 mt-0.5">
                      {isNoop ? "The permission is already in the requested state." :
                       isAdd ? `Approving grants "${permMeta[diffFor.permission]?.label ?? diffFor.permission}" to the ${diffFor.role} role.` :
                       `Approving revokes "${permMeta[diffFor.permission]?.label ?? diffFor.permission}" from the ${diffFor.role} role.`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Current</p>
                    <Badge className={diffCurrent ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15 text-slate-700"}>
                      {diffCurrent ? "Allowed" : "Denied"}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg border border-primary/40 bg-primary/5">
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">If approved</p>
                    <Badge className={diffFor.allowed ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700"}>
                      {diffFor.allowed ? "Allowed" : "Denied"}
                    </Badge>
                  </div>
                </div>

                {risky && (
                  <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
                    <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> High-risk permission — why it's flagged
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px] text-amber-800">
                      {reasons.map((r, i) => <li key={i} className="flex items-start gap-1"><span className="opacity-60">•</span><span>{r}</span></li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDiffFor(null)}>Close</Button>
            {diffFor && (
              <>
                <Button variant="outline" onClick={() => { const r = diffFor; setDiffFor(null); act(r, false); }} disabled={!canManage}>Reject</Button>
                <Button onClick={() => { const r = diffFor; setDiffFor(null); act(r, true); }} disabled={!canManage || diffFor.requested_by === user?.id}>Approve</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk confirm — with per-request diff + high-risk summary */}
      <AlertDialog open={!!bulk} onOpenChange={(o) => !o && setBulk(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulk?.approve ? "Approve" : "Reject"} {bulk?.ids.length} request{bulk?.ids.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Review each change below. Every request is applied individually, audit-logged with your identity, and the requester is notified.
              {bulk && (() => {
                const items = bulk.ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Req[];
                const risky = items.filter((r) => HIGH_RISK_PERMISSIONS.has(r.permission)).length;
                const noops = items.filter((r) => bulkCurrent[`${r.role}|${r.permission}`] === r.allowed).length;
                return (
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px]">{items.length} total</Badge>
                    {risky > 0 && <Badge className="text-[10px] bg-amber-500/15 text-amber-700"><ShieldAlert className="w-3 h-3 mr-1" />{risky} high-risk</Badge>}
                    {noops > 0 && <Badge className="text-[10px] bg-slate-500/15 text-slate-700">{noops} no-op</Badge>}
                  </span>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ScrollArea className="max-h-[280px] pr-3 border border-border/60 rounded-lg">
            {bulkPreviewLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="divide-y divide-border/50">
                {bulk?.ids.map((id) => {
                  const r = rows.find((x) => x.id === id);
                  if (!r) return null;
                  const curr = bulkCurrent[`${r.role}|${r.permission}`];
                  const isNoop = curr === r.allowed;
                  const isAdd = !isNoop && r.allowed === true;
                  const risky = HIGH_RISK_PERMISSIONS.has(r.permission);
                  const meta = permMeta[r.permission];
                  return (
                    <div key={id} className="p-2.5 flex items-start gap-2 text-xs">
                      <div className="shrink-0 mt-0.5">
                        {isNoop ? <Info className="w-3.5 h-3.5 text-amber-600" /> :
                         isAdd  ? <PlusCircle className="w-3.5 h-3.5 text-emerald-600" /> :
                                  <MinusCircle className="w-3.5 h-3.5 text-red-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate">
                          <span className={`font-semibold ${isNoop ? "text-amber-700" : isAdd ? "text-emerald-700" : "text-red-700"}`}>
                            {isNoop ? "NO-OP" : isAdd ? "ADD" : "REMOVE"}
                          </span>
                          <span className="mx-1.5 text-muted-foreground">·</span>
                          <code className="text-[11px]">{r.permission}</code>
                          <span className="text-muted-foreground"> → </span>
                          <span className="capitalize">{r.role.replace(/_/g, " ")}</span>
                          {risky && <Badge className="ml-1.5 text-[9px] bg-amber-500/15 text-amber-700 gap-0.5"><ShieldAlert className="w-2.5 h-2.5" />high-risk</Badge>}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground mt-0.5">
                          {curr === undefined ? "Loading current…" : (
                            <>Current: <strong>{curr ? "Allowed" : "Denied"}</strong>
                              <span className="mx-1">→</span>
                              After: <strong>{r.allowed ? "Allowed" : "Denied"}</strong>
                            </>
                          )}
                          {meta && <span className="ml-2 opacity-70">{meta.label}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <Textarea rows={2} placeholder="Review note applied to all selected requests (optional)"
            value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} className="mt-2" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runBulk(); }} disabled={bulkBusy || bulkPreviewLoading}
              className={bulk?.approve ? "" : "bg-destructive text-destructive-foreground"}>
              {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : bulk?.approve ? `Approve all ${bulk?.ids.length}` : `Reject all ${bulk?.ids.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <PermissionRequestTimeline requestId={timelineId} onOpenChange={(o) => !o && setTimelineId(null)} />
    </div>
  );
}
