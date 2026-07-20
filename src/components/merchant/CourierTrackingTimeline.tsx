import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { Truck, MapPin, Clock, CheckCircle2, PackageCheck, Loader2, Radio } from "lucide-react";

interface TrackingEvent {
  id: string;
  status: string;
  status_label?: string | null;
  location?: string | null;
  note?: string | null;
  eta?: string | null;
  scanned_at: string;
  courier_provider: string;
}

interface Props {
  orderId: string;
  courierProvider?: string | null;
  trackingNumber?: string | null;
  bookingRef?: string | null;
  eta?: string | null;
}

const STATUS_ICON: Record<string, JSX.Element> = {
  booked: <PackageCheck size={12} className="text-white" />,
  picked_up: <Truck size={12} className="text-white" />,
  in_transit: <Truck size={12} className="text-white" />,
  out_for_delivery: <Radio size={12} className="text-white" />,
  delivered: <CheckCircle2 size={12} className="text-white" />,
};

const STATUS_COLOR: Record<string, string> = {
  booked: "#64748B",
  picked_up: "#0EA564",
  in_transit: "#0288D1",
  out_for_delivery: "#F59E0B",
  delivered: "#10B981",
  failed: "#EF4444",
  returned: "#EF4444",
};

export default function CourierTrackingTimeline({ orderId, courierProvider, trackingNumber, bookingRef, eta }: Props) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("courier_tracking_events")
        .select("id,status,status_label,location,note,eta,scanned_at,courier_provider")
        .eq("order_id", orderId)
        .order("scanned_at", { ascending: false })
        .limit(20);
      if (mounted) {
        setEvents(data ?? []);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`courier-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "courier_tracking_events", filter: `order_id=eq.${orderId}` },
        (payload) => {
          setEvents((prev) => [payload.new as TrackingEvent, ...prev]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (!trackingNumber) return null;

  const latest = events[0];
  const latestColor = latest ? STATUS_COLOR[latest.status] || "#64748B" : "#64748B";

  return (
    <div className="rounded-2xl border border-border/60 bg-background overflow-hidden">
      {/* Header strip */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: `${latestColor}12` }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: latestColor }}>
            <Truck size={13} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-bold text-foreground truncate">
              {courierProvider} · <span className="font-mono">{trackingNumber}</span>
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {latest ? (latest.status_label || latest.status.replace(/_/g, " ")) : "Awaiting first scan"}
              {latest && <> · {formatDistanceToNow(new Date(latest.scanned_at), { addSuffix: true })}</>}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[9.5px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
        </span>
      </div>

      {/* ETA & ref row */}
      {(eta || bookingRef) && (
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-3 text-[10.5px] text-muted-foreground flex-wrap">
          {eta && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> ETA <span className="font-semibold text-foreground">{format(new Date(eta), "dd MMM, h:mm a")}</span>
            </span>
          )}
          {bookingRef && (
            <span className="inline-flex items-center gap-1">
              Ref <span className="font-mono font-semibold text-foreground">{bookingRef}</span>
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-3 text-muted-foreground">
            <Loader2 size={13} className="animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-2">No scans yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {events.map((ev, i) => {
              const color = STATUS_COLOR[ev.status] || "#64748B";
              return (
                <li key={ev.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: color }}>
                      {STATUS_ICON[ev.status] || <Radio size={10} className="text-white" />}
                    </div>
                    {i < events.length - 1 && <div className="flex-1 w-px bg-border mt-1" />}
                  </div>
                  <div className="flex-1 pb-1 min-w-0">
                    <p className="text-[11.5px] font-semibold text-foreground capitalize">
                      {ev.status_label || ev.status.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(ev.scanned_at), "dd MMM yyyy · h:mm a")}
                      {ev.location && <> · <MapPin size={9} className="inline -mt-0.5" /> {ev.location}</>}
                    </p>
                    {ev.note && <p className="text-[10.5px] text-muted-foreground mt-0.5">{ev.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
