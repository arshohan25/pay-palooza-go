import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  RotateCcw,
  AlertCircle,
  CircleDot,
  Loader2,
  Hash,
} from "lucide-react";

interface Event {
  id: string;
  event_type: string;
  status: string | null;
  provider_ref: string | null;
  note: string | null;
  meta: any;
  created_at: string;
}

const STYLE: Record<string, { icon: JSX.Element; ring: string; label: string }> = {
  created:              { icon: <CircleDot size={12} />,      ring: "bg-slate-500/15 text-slate-500",     label: "Created" },
  status_change:        { icon: <Clock size={12} />,          ring: "bg-blue-500/15 text-blue-500",       label: "Status change" },
  settlement_created:   { icon: <Send size={12} />,           ring: "bg-amber-500/15 text-amber-600",     label: "Settlement opened" },
  provider_queued:      { icon: <Clock size={12} />,          ring: "bg-amber-500/15 text-amber-600",     label: "Queued for provider" },
  provider_submitted:   { icon: <Send size={12} />,           ring: "bg-blue-500/15 text-blue-500",       label: "Sent to provider" },
  provider_paid:        { icon: <CheckCircle2 size={12} />,   ring: "bg-emerald-500/15 text-emerald-600", label: "Provider paid" },
  provider_failed:      { icon: <XCircle size={12} />,        ring: "bg-red-500/15 text-red-500",         label: "Provider failed" },
  settlement_update:    { icon: <Clock size={12} />,          ring: "bg-blue-500/15 text-blue-500",       label: "Settlement update" },
  settlement_refunded:  { icon: <RotateCcw size={12} />,      ring: "bg-fuchsia-500/15 text-fuchsia-500", label: "Settlement refunded" },
  refunded:             { icon: <RotateCcw size={12} />,      ring: "bg-fuchsia-500/15 text-fuchsia-500", label: "Refunded" },
  reversed:             { icon: <RotateCcw size={12} />,      ring: "bg-fuchsia-500/15 text-fuchsia-500", label: "Reversed" },
};

function styleFor(evt: string) {
  return STYLE[evt] ?? { icon: <AlertCircle size={12} />, ring: "bg-slate-500/15 text-slate-500", label: evt };
}

export default function TransactionStatusTimeline({
  transactionId,
  compact,
}: { transactionId: string; compact?: boolean }) {
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("transaction_events")
        .select("id,event_type,status,provider_ref,note,meta,created_at")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true });
      if (!cancelled) setEvents(data ?? []);
    })();
    const ch = supabase
      .channel(`txn-events-${transactionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "transaction_events", filter: `transaction_id=eq.${transactionId}` },
        (payload) => setEvents((prev) => [...(prev ?? []), payload.new as Event]))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [transactionId]);

  if (events === null) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
      </div>
    );
  }
  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">No timeline events yet.</p>;
  }

  return (
    <div className={`rounded-2xl border border-border/50 bg-card/40 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status timeline</p>
        <span className="text-[10px] text-muted-foreground">{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>
      <ol className="relative space-y-3 pl-4 border-l border-border/40">
        {events.map((e) => {
          const s = styleFor(e.event_type);
          return (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[21px] flex h-4 w-4 items-center justify-center rounded-full ${s.ring}`}>
                {s.icon}
              </span>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {format(new Date(e.created_at), "MMM d, HH:mm:ss")}
                </p>
              </div>
              {e.note && <p className="text-[11px] text-muted-foreground mt-0.5">{e.note}</p>}
              {e.provider_ref && (
                <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                  <Hash size={9} /> {e.provider_ref}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
