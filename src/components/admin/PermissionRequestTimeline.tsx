import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Clock, Check, X, Bell, Send, RotateCcw, AlertTriangle, ArrowRight, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { REGISTERED_PERMISSIONS } from "@/lib/permissionsRegistry";

interface Props {
  requestId: string | null;
  onOpenChange: (open: boolean) => void;
}

interface TimelineItem {
  at: string;
  kind: "created" | "notified" | "escalated" | "approved" | "rejected" | "undone" | "expired" | "result";
  who?: string;
  detail?: string;
  meta?: any;
}

const KIND_ICON: Record<TimelineItem["kind"], any> = {
  created: Clock,
  notified: Bell,
  escalated: AlertTriangle,
  approved: Check,
  rejected: X,
  undone: RotateCcw,
  expired: Clock,
  result: Send,
};

const KIND_TONE: Record<TimelineItem["kind"], string> = {
  created: "text-primary bg-primary/10",
  notified: "text-slate-600 bg-slate-500/10",
  escalated: "text-red-600 bg-red-500/10",
  approved: "text-emerald-600 bg-emerald-500/10",
  rejected: "text-red-600 bg-red-500/10",
  undone: "text-amber-600 bg-amber-500/10",
  expired: "text-muted-foreground bg-muted",
  result: "text-slate-600 bg-slate-500/10",
};

export default function PermissionRequestTimeline({ requestId, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [request, setRequest] = useState<any>(null);

  useEffect(() => {
    if (!requestId) { setItems([]); setRequest(null); return; }
    (async () => {
      setLoading(true);
      const [{ data: req }, { data: audits }, { data: notifs }] = await Promise.all([
        (supabase as any).from("permission_change_requests")
          .select("*").eq("id", requestId).maybeSingle(),
        (supabase as any).from("audit_logs")
          .select("id, actor_id, action, details, created_at")
          .or(`details->>request_id.eq.${requestId},details->>approved_request.eq.${requestId}`)
          .order("created_at", { ascending: true }),
        (supabase as any).from("notifications")
          .select("id, user_id, title, category, metadata, created_at, read")
          .eq("metadata->>request_id", requestId)
          .order("created_at", { ascending: true }),
      ]);

      setRequest(req);
      const userIds = new Set<string>();
      if (req?.requested_by) userIds.add(req.requested_by);
      if (req?.reviewed_by) userIds.add(req.reviewed_by);
      if (req?.undone_by) userIds.add(req.undone_by);
      for (const a of audits ?? []) if (a.actor_id) userIds.add(a.actor_id);
      for (const n of notifs ?? []) if (n.user_id) userIds.add(n.user_id);

      let profileMap: Record<string, string> = {};
      if (userIds.size > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("user_id, name, phone").in("user_id", Array.from(userIds));
        profileMap = Object.fromEntries(((profs ?? []) as any[]).map((p) =>
          [p.user_id, p.name || p.phone || p.user_id.slice(0, 8)]));
      }
      const who = (id?: string | null) => id ? (profileMap[id] ?? id.slice(0, 8)) : "unknown";

      const events: TimelineItem[] = [];
      if (req) {
        events.push({
          at: req.created_at,
          kind: "created",
          who: who(req.requested_by),
          detail: `Requested to ${req.allowed ? "grant" : "revoke"} ${req.permission} for ${String(req.role).replace(/_/g, " ")}`,
          meta: { reason: req.reason },
        });
      }
      for (const n of notifs ?? []) {
        const kind = n.metadata?.kind;
        events.push({
          at: n.created_at,
          kind: kind === "permission_request_escalation" ? "escalated"
              : kind === "permission_request_result" ? "result"
              : "notified",
          who: who(n.user_id),
          detail: n.title || "Notification sent",
          meta: { read: n.read, category: n.category },
        });
      }
      for (const a of audits ?? []) {
        const action = a.action as string;
        const kind: TimelineItem["kind"] =
          action.includes("undone") ? "undone" :
          action.includes("rejected") ? "rejected" :
          action.includes("granted") || action.includes("revoked") ? "approved" :
          "notified";
        events.push({
          at: a.created_at,
          kind,
          who: who(a.actor_id),
          detail: action.replace(/_/g, " "),
          meta: a.details,
        });
      }
      if (req?.status === "expired") {
        events.push({ at: req.expires_at ?? req.updated_at, kind: "expired", detail: "Request expired without review" });
      }
      events.sort((a, b) => +new Date(a.at) - +new Date(b.at));
      setItems(events);
      setLoading(false);
    })();
  }, [requestId]);

  const meta = request ? REGISTERED_PERMISSIONS.find((p) => p.key === request.permission) : null;

  return (
    <Dialog open={!!requestId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4" /> Request activity timeline</DialogTitle>
          <DialogDescription>
            {request ? (
              <span>
                <code className="text-xs">{request.permission}</code> · <span className="capitalize">{String(request.role).replace(/_/g, " ")}</span> ·{" "}
                <Badge variant="outline" className="text-[10px]">{request.status}</Badge>
              </span>
            ) : "Loading request…"}
          </DialogDescription>
        </DialogHeader>

        {request && (
          <div className="rounded-lg border border-border p-3 text-xs bg-muted/30">
            <p className="flex items-center gap-2 mb-1 text-[11px] uppercase text-muted-foreground">
              <ArrowRight className="w-3 h-3" /> Diff summary
            </p>
            <div className="flex items-center gap-2">
              <Badge className={request.snapshot_before_allowed ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15 text-slate-700"}>
                Before: {request.snapshot_before_allowed ? "Allowed" : "Denied"}
              </Badge>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <Badge className={request.allowed ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700"}>
                Requested: {request.allowed ? "Allowed" : "Denied"}
              </Badge>
              {meta && <span className="text-muted-foreground ml-2">{meta.label}</span>}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ScrollArea className="max-h-[420px] pr-3">
            <ol className="relative border-l border-border/60 ml-3 space-y-4 py-2">
              {items.map((ev, i) => {
                const Icon = KIND_ICON[ev.kind];
                return (
                  <li key={i} className="ml-4">
                    <span className={`absolute -left-3 w-6 h-6 rounded-full flex items-center justify-center ${KIND_TONE[ev.kind]}`}>
                      <Icon className="w-3 h-3" />
                    </span>
                    <p className="text-xs font-medium capitalize">{ev.detail || ev.kind}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3" /> {ev.who ?? "system"}
                      <span>·</span>
                      <span title={format(new Date(ev.at), "PPpp")}>{formatDistanceToNow(new Date(ev.at), { addSuffix: true })}</span>
                    </p>
                    {ev.meta?.reason && <p className="text-[11px] italic text-muted-foreground mt-1">"{ev.meta.reason}"</p>}
                    {ev.meta?.note && <p className="text-[11px] italic text-muted-foreground mt-1">Note: "{ev.meta.note}"</p>}
                  </li>
                );
              })}
              {items.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground text-center py-6">No events recorded yet.</p>
              )}
            </ol>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
