import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, X, ShieldAlert, Loader2, RefreshCw, Lock, Info } from "lucide-react";
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

/**
 * Compact "notification center" for permission approval requests.
 * Shows every pending request with full permission context + inline
 * approve / reject actions and a review note.
 */
export default function AdminApprovalsInbox() {
  const { user } = useAuth();
  const canManage = usePermission("manage_roles");
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const permMeta = useMemo(() => Object.fromEntries(REGISTERED_PERMISSIONS.map((p) => [p.key, p])), []);

  const load = useCallback(async () => {
    setLoading(true);
    await supabase.rpc("expire_stale_permission_requests" as any).then(() => {}, () => {});
    const { data } = await supabase
      .from("permission_change_requests" as any)
      .select("id, role, permission, allowed, reason, requested_by, created_at, expires_at, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);
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
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time: apply INSERT/UPDATE/DELETE optimistically without a full reload.
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

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
    if (error) { toast.error(error.message); return; }
    toast.success(approve ? "Approved" : "Rejected");
    setRows((prev) => prev.filter((x) => x.id !== r.id));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center relative">
            <Bell className="w-5 h-5 text-primary" />
            {rows.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-medium">
                {rows.length}
              </span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Approvals inbox</p>
            <p className="text-xs text-muted-foreground">All pending permission requests, with full context and inline actions. Updates in real time.</p>
          </div>
          {canManage === false && (<Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Read-only</Badge>)}
          <Button size="icon" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

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
                  return (
                    <div key={r.id} className="p-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${risky ? "bg-amber-500/15" : "bg-primary/10"}`}>
                          <ShieldAlert className={`w-4 h-4 ${risky ? "text-amber-600" : "text-primary"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
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
                      <div className="pl-11 space-y-2">
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
    </div>
  );
}
