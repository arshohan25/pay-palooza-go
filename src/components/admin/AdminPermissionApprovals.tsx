import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw, Check, X, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { usePermission } from "@/hooks/use-permission";
import { useAuth } from "@/hooks/use-auth";
import { REGISTERED_PERMISSIONS, ROLE_KEYS } from "@/lib/permissionsRegistry";

interface Request {
  id: string;
  role: string;
  permission: string;
  allowed: boolean;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  expires_at?: string | null;
  requester_name?: string;
  requester_phone?: string;
}

type Tab = "pending" | "approved" | "rejected" | "expired";

export default function AdminPermissionApprovals() {
  const canManage = usePermission("manage_roles");
  const { user } = useAuth();
  const [rows, setRows] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [permFilter, setPermFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [reviewFor, setReviewFor] = useState<{ req: Request; approve: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Auto-expire stale pending requests before loading.
    await supabase.rpc("expire_stale_permission_requests" as any).then(() => {}, () => {});
    const { data } = await supabase
      .from("permission_change_requests" as any)
      .select("id, role, permission, allowed, reason, status, requested_by, reviewed_by, reviewed_at, review_note, created_at, expires_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = ((data ?? []) as any[]) as Request[];
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
  useEffect(() => {
    const ch = supabase.channel("perm-req-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "permission_change_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { pending: 0, approved: 0, rejected: 0, expired: 0 };
    for (const r of rows) if (r.status in c) c[r.status as Tab]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.status !== tab) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (permFilter !== "all" && r.permission !== permFilter) return false;
      if (q) {
        const hay = `${r.requester_name ?? ""} ${r.requester_phone ?? ""} ${r.requested_by} ${r.reason ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, tab, roleFilter, permFilter, search]);

  const uniqueRoles = useMemo(() => Array.from(new Set([...ROLE_KEYS, ...rows.map((r) => r.role)])), [rows]);

  const openReview = (req: Request, approve: boolean) => {
    if (!canManage) { toast.error("Missing 'manage_roles' permission"); return; }
    if (approve && req.requested_by === user?.id) {
      toast.error("A different admin must approve — you can't self-approve");
      return;
    }
    setNote("");
    setReviewFor({ req, approve });
  };

  const submitReview = async () => {
    if (!reviewFor) return;
    setBusy(true);
    const fn = reviewFor.approve ? "approve_permission_change" : "reject_permission_change";
    const { error } = await supabase.rpc(fn as any, { _request_id: reviewFor.req.id, _note: note || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(reviewFor.approve ? "Change approved and applied" : "Change rejected");
    setReviewFor(null);
    load();
  };

  const StatusBadge = ({ s }: { s: Request["status"] }) => {
    const cls = s === "approved" ? "bg-emerald-500/10 text-emerald-600"
      : s === "rejected" ? "bg-red-500/10 text-red-600"
      : s === "expired" ? "bg-slate-500/10 text-slate-600"
      : s === "cancelled" ? "bg-muted text-muted-foreground"
      : "bg-amber-500/10 text-amber-600";
    return <Badge className={`${cls} text-[10px] capitalize`}>{s}</Badge>;
  };

  const TabBtn = ({ t, label }: { t: Tab; label: string }) => (
    <Button size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="gap-1">
      {label} {counts[t] > 0 && <Badge className="ml-1 bg-background/40 text-current">{counts[t]}</Badge>}
    </Button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-primary" /></div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Permission change approvals</p>
            <p className="text-xs text-muted-foreground">High-risk toggles need a second admin. Requests auto-expire after 7 days.</p>
          </div>
          {canManage === false && (<Badge variant="outline" className="gap-1"><Lock className="w-3 h-3" /> Read-only</Badge>)}
          <Button size="icon" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <TabBtn t="pending" label="Pending" />
        <TabBtn t="approved" label="Approved" />
        <TabBtn t="rejected" label="Rejected" />
        <TabBtn t="expired" label="Expired" />
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-7 h-9" placeholder="Search requester (name, phone) or reason" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {uniqueRoles.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g," ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={permFilter} onValueChange={setPermFilter}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Permission" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All permissions</SelectItem>
              {REGISTERED_PERMISSIONS.map((p) => <SelectItem key={p.key} value={p.key}>{p.key}</SelectItem>)}
            </SelectContent>
          </Select>
          {(roleFilter !== "all" || permFilter !== "all" || search) && (
            <Button size="sm" variant="ghost" onClick={() => { setRoleFilter("all"); setPermFilter("all"); setSearch(""); }}>Clear</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{tab} requests ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Nothing matches your filters.</p>
          ) : (
            <ScrollArea className="max-h-[560px]">
              <div className="divide-y divide-border">
                {filtered.map((r) => {
                  const isOwn = r.requested_by === user?.id;
                  return (
                    <div key={r.id} className="p-3 flex items-start gap-3">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          <span className="font-medium capitalize">{r.role.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground"> · </span>
                          <code className="text-xs">{r.permission}</code>
                          <Badge variant="outline" className="ml-2 text-[10px]">{r.allowed ? "grant" : "revoke"}</Badge>
                          <StatusBadge s={r.status} />
                        </p>
                        {r.reason && <p className="text-[11px] text-muted-foreground mt-1">"{r.reason}"</p>}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Requested by {r.requester_name || r.requester_phone || r.requested_by.slice(0, 8)}
                          {isOwn && <Badge variant="secondary" className="ml-1 text-[9px]">you</Badge>}
                          {" · "}
                          <span title={format(new Date(r.created_at), "PPpp")}>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                          {r.status === "pending" && r.expires_at && (
                            <> · expires {formatDistanceToNow(new Date(r.expires_at), { addSuffix: true })}</>
                          )}
                        </p>
                        {r.reviewed_at && (
                          <p className="text-[11px] text-muted-foreground">
                            Reviewed {formatDistanceToNow(new Date(r.reviewed_at), { addSuffix: true })}
                            {r.review_note && <> — "{r.review_note}"</>}
                          </p>
                        )}
                      </div>
                      {r.status === "pending" && (
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openReview(r, false)} disabled={!canManage}>
                            <X className="w-3 h-3 mr-1" /> Reject
                          </Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => openReview(r, true)} disabled={!canManage || isOwn}
                            title={isOwn ? "Requester cannot self-approve" : "Approve"}>
                            <Check className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewFor} onOpenChange={(o) => !o && setReviewFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{reviewFor?.approve ? "Approve change" : "Reject change"}</DialogTitle>
            <DialogDescription>
              {reviewFor && (
                <>
                  <code className="text-xs">{reviewFor.req.permission}</code> {reviewFor.req.allowed ? "grant" : "revoke"} for{" "}
                  <span className="capitalize">{reviewFor.req.role.replace(/_/g, " ")}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={3} placeholder="Review note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewFor(null)}>Cancel</Button>
            <Button onClick={submitReview} disabled={busy} variant={reviewFor?.approve ? "default" : "destructive"}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : reviewFor?.approve ? "Approve & apply" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
