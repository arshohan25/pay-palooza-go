import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bell, Check, X, ShieldAlert, Loader2, RefreshCw, Lock, Info, CheckCheck, Circle, CircleDot, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";
import { REGISTERED_PERMISSIONS, HIGH_RISK_PERMISSIONS } from "@/lib/permissionsRegistry";

interface Req {
  id: string; role: string; permission: string; allowed: boolean;
  reason: string | null; requested_by: string; created_at: string;
  expires_at: string | null; status: string;
  requester_name?: string; requester_phone?: string;
}

const RESYNC_MS = 30_000;

const readKey = (uid: string | undefined) => `perm_inbox_read:${uid ?? "anon"}`;

/**
 * Notification-center inbox for pending permission approval requests.
 * - Read / unread state persisted per admin in localStorage.
 * - Real-time updates via postgres_changes with periodic reconciliation
 *   against the server so local optimistic state can never drift.
 * - Bulk approve / bulk reject with per-item audit trail via the same
 *   RPCs the single-item flow uses (each call inserts its own audit log
 *   and enforces the self-approval rule server-side).
 */
export default function AdminApprovalsInbox() {
  const { user } = useAuth();
  const canManage = usePermission("manage_roles");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | { approve: boolean; ids: string[] }>(null);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [rtHealthy, setRtHealthy] = useState(true);
  const rowsRef = useRef<Req[]>([]);
  rowsRef.current = rows;

  const permMeta = useMemo(() => Object.fromEntries(REGISTERED_PERMISSIONS.map((p) => [p.key, p])), []);

  // ---- Read/unread state (per-admin localStorage) --------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(readKey(user?.id));
      if (raw) setReadIds(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, [user?.id]);
  const persistRead = (set: Set<string>) => {
    try { localStorage.setItem(readKey(user?.id), JSON.stringify(Array.from(set))); } catch { /* ignore */ }
  };
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

  // ---- Fetch with requester profiles --------------------------------------
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

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchPending();
    setRows(list);
    // Prune read state and selection for rows that no longer exist.
    const ids = new Set(list.map((r) => r.id));
    setReadIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      if (next.size !== prev.size) persistRead(next);
      return next;
    });
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next;
    });
    setLastSyncAt(new Date());
    setLoading(false);
  }, [fetchPending]);

  useEffect(() => { load(); }, [load]);

  // ---- Reconciliation loop: guaranteed convergence with server -------------
  const reconcile = useCallback(async () => {
    const server = await fetchPending();
    const local = rowsRef.current;
    const serverIds = new Set(server.map((r) => r.id));
    const localIds = new Set(local.map((r) => r.id));
    let diverged = server.length !== local.length;
    if (!diverged) {
      for (const id of serverIds) if (!localIds.has(id)) { diverged = true; break; }
    }
    if (!diverged) {
      // Check UPDATEs (allowed/reason/expires_at drift).
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
      toast.info("Inbox resynced with server", { description: "Local changes reconciled." });
    }
    setLastSyncAt(new Date());
  }, [fetchPending]);

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

  // ---- Realtime (optimistic apply, reconcile catches any misses) ----------
  useEffect(() => {
    const ch = supabase.channel("perm-inbox-rt")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "permission_change_requests" },
        (payload: any) => {
          const r = payload.new as Req;
          if (r.status !== "pending") return;
          setRows((prev) => (prev.some((x) => x.id === r.id) ? prev : [r, ...prev]));
          if (r.requested_by !== user?.id) {
            toast.info("New permission request awaiting review", { description: `${r.allowed ? "Grant" : "Revoke"} ${r.permission} · ${r.role}` });
          }
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "permission_change_requests" },
        (payload: any) => {
          const r = payload.new as Req;
          setRows((prev) => r.status === "pending"
            ? prev.map((x) => x.id === r.id ? { ...x, ...r } : x)
            : prev.filter((x) => x.id !== r.id));
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "permission_change_requests" },
        (payload: any) => setRows((prev) => prev.filter((x) => x.id !== (payload.old as any).id)))
      .subscribe((status) => {
        // On subscribe/reconnect, catch up whatever we missed while offline.
        if (status === "SUBSCRIBED") { setRtHealthy(true); reconcile(); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setRtHealthy(false);
      });
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, reconcile]);

  // ---- Actions -------------------------------------------------------------
  const act = async (r: Req, approve: boolean) => {
    if (!canManage) { toast.error("Missing 'manage_roles' permission"); return; }
    if (approve && r.requested_by === user?.id) {
      toast.error("A different admin must approve — you can't self-approve");
      return;
    }
    setBusyId(r.id);
    const fn = approve ? "approve_permission_change" : "reject_permission_change";
    const { error } = await supabase.rpc(fn as any, { _request_id: r.id, _note: notes[r.id] || null });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      // Server rejected our optimistic action; force a resync so UI matches truth.
      reconcile();
      return;
    }
    toast.success(approve ? "Approved" : "Rejected");
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    markRead(r.id);
  };

  // ---- Bulk ----------------------------------------------------------------
  const selectableForApprove = useMemo(
    () => rows.filter((r) => r.requested_by !== user?.id).map((r) => r.id),
    [rows, user?.id],
  );

  const toggleSel = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllVisible = () => setSelected(new Set(rows.map((r) => r.id)));
  const clearSelection = () => setSelected(new Set());

  const openBulk = (approve: boolean) => {
    const ids = Array.from(selected);
    if (ids.length === 0) { toast.error("Select at least one request"); return; }
    // Filter out self-owned for approve (server would reject anyway; block early with a clear message).
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
  };

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    const fn = bulk.approve ? "approve_permission_change" : "reject_permission_change";
    let ok = 0, fail = 0;
    const failures: string[] = [];
    // Sequential so audit log ordering is stable and errors are attributable.
    for (const id of bulk.ids) {
      const { error } = await supabase.rpc(fn as any, { _request_id: id, _note: bulkNote || null });
      if (error) { fail++; failures.push(`${id.slice(0, 6)}: ${error.message}`); }
      else { ok++; markRead(id); }
    }
    setBulkBusy(false);
    setBulk(null);
    clearSelection();
    reconcile();
    if (fail === 0) toast.success(`${bulk.approve ? "Approved" : "Rejected"} ${ok} request${ok === 1 ? "" : "s"}`);
    else toast.warning(`${ok} succeeded, ${fail} failed`, { description: failures.slice(0, 3).join(" · ") });
  };

  const unreadCount = rows.filter((r) => !readIds.has(r.id)).length;

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
            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
              {rows.length} pending · {unreadCount} unread
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

      {/* Bulk toolbar */}
      {rows.length > 0 && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <Checkbox
              checked={selected.size > 0 && selected.size === rows.length}
              onCheckedChange={(v) => v ? selectAllVisible() : clearSelection()}
            />
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </span>
            <div className="flex-1" />
            {selected.size > 0 && (
              <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
            )}
            <Button size="sm" variant="outline" disabled={!canManage || selected.size === 0} onClick={() => openBulk(false)} className="gap-1">
              <X className="w-3 h-3" /> Bulk reject
            </Button>
            <Button
              size="sm"
              disabled={!canManage || selected.size === 0 || !Array.from(selected).some((id) => selectableForApprove.includes(id))}
              onClick={() => openBulk(true)}
              className="gap-1"
              title="Own requests are skipped — a second admin must approve those."
            >
              <Check className="w-3 h-3" /> Bulk approve
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Awaiting your review ({rows.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              <Check className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
              Inbox zero — no permission requests need your attention.
            </div>
          ) : (
            <ScrollArea className="max-h-[640px]">
              <div className="divide-y divide-border">
                {rows.map((r) => {
                  const isOwn = r.requested_by === user?.id;
                  const meta = permMeta[r.permission];
                  const risky = HIGH_RISK_PERMISSIONS.has(r.permission);
                  const unread = !readIds.has(r.id);
                  const isSelected = selected.has(r.id);
                  return (
                    <div key={r.id} className={`p-4 space-y-2 transition-colors ${unread ? "bg-primary/[0.03]" : ""} ${isSelected ? "bg-primary/[0.06]" : ""}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSel(r.id)}
                          className="mt-1"
                        />
                        <button
                          onClick={() => (unread ? markRead(r.id) : markUnread(r.id))}
                          title={unread ? "Mark read" : "Mark unread"}
                          className="mt-1 text-primary hover:text-primary/70 shrink-0"
                        >
                          {unread ? <CircleDot className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${risky ? "bg-amber-500/15" : "bg-primary/10"}`}>
                          <ShieldAlert className={`w-4 h-4 ${risky ? "text-amber-600" : "text-primary"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            {unread && <Badge className="mr-1 bg-primary text-primary-foreground text-[9px]">new</Badge>}
                            <Badge variant="outline" className="text-[10px] mr-1">{r.allowed ? "grant" : "revoke"}</Badge>
                            <code className="text-xs">{r.permission}</code>
                            <span className="text-muted-foreground"> for </span>
                            <span className="font-medium capitalize">{r.role.replace(/_/g, " ")}</span>
                            {risky && <Badge className="ml-2 bg-amber-500/15 text-amber-700 text-[10px]">high-risk</Badge>}
                          </p>
                          {meta && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-start gap-1">
                              <Info className="w-3 h-3 mt-0.5 shrink-0" />
                              <span><strong>{meta.label}</strong> — {meta.description}</span>
                            </p>
                          )}
                          {r.reason && <p className="text-[11px] italic text-muted-foreground mt-1">"{r.reason}"</p>}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Requested by {r.requester_name || r.requester_phone || r.requested_by.slice(0, 8)}
                            {isOwn && <Badge variant="secondary" className="ml-1 text-[9px]">you</Badge>}
                            {" · "}
                            <span title={format(new Date(r.created_at), "PPpp")}>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                            {r.expires_at && <> · expires {formatDistanceToNow(new Date(r.expires_at), { addSuffix: true })}</>}
                          </p>
                        </div>
                      </div>
                      <div className="pl-16 space-y-2">
                        <Textarea
                          rows={2} placeholder="Optional review note…"
                          value={notes[r.id] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                          className="text-xs"
                        />
                        <div className="flex justify-end gap-2">
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

      {/* Bulk confirm */}
      <AlertDialog open={!!bulk} onOpenChange={(o) => !o && setBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulk?.approve ? "Approve" : "Reject"} {bulk?.ids.length} request{bulk?.ids.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulk?.approve
                ? "Each request will be applied individually and audit-logged with your review note."
                : "Each request will be rejected individually and audit-logged with your review note."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            rows={3}
            placeholder="Review note applied to all selected requests (optional)"
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runBulk(); }}
              disabled={bulkBusy}
              className={bulk?.approve ? "" : "bg-destructive text-destructive-foreground"}
            >
              {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : bulk?.approve ? "Approve all" : "Reject all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
