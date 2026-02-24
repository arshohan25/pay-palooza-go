import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  processing: "Processing",
  confirmed: "Confirmed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_EMOJI: Record<string, string> = {
  processing: "⏳",
  confirmed: "✅",
  shipped: "📦",
  out_for_delivery: "🚚",
  delivered: "🎉",
  cancelled: "❌",
};

/** Play a short notification chime via Web Audio API */
function playOrderChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio may be blocked
  }
}

/** Send a browser push notification (requires permission) */
function sendBrowserNotification(orderNum: string, newStatus: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("Order Update", {
      body: `${STATUS_EMOJI[newStatus] ?? "📋"} Order ${orderNum} is now ${STATUS_LABELS[newStatus] ?? newStatus}`,
      icon: "/icons/icon-192.png",
      tag: `order-${orderNum}`,
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

interface OrderUpdate {
  id: string;
  order_num: string;
  status: string;
  user_id: string;
}

type OrderStatusCallback = (update: OrderUpdate) => void;

/**
 * Real-time hook that listens for order status changes for the current user.
 * Shows toast + browser notification + plays chime on status changes.
 * Optionally calls `onStatusChange` callback for UI sync.
 */
export function useOrderNotifications(onStatusChange?: OrderStatusCallback) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    let userId: string | null = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      userId = session.user.id;

      // Request notification permission early
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      const channel = supabase
        .channel("user-order-updates")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            const old = payload.old as any;

            // Only notify on actual status changes
            if (old.status === updated.status) return;

            const newStatus = updated.status as string;
            const orderNum = updated.order_num as string;
            const emoji = STATUS_EMOJI[newStatus] ?? "📋";
            const label = STATUS_LABELS[newStatus] ?? newStatus;

            // Toast notification
            toast(`${emoji} Order ${orderNum}`, {
              description: `Status updated to ${label}`,
              duration: 5000,
            });

            // Sound
            playOrderChime();

            // Browser notification
            sendBrowserNotification(orderNum, newStatus);

            // Haptic feedback
            if (navigator.vibrate) navigator.vibrate([15, 40, 15]);

            // Callback for UI sync
            callbackRef.current?.({
              id: updated.id,
              order_num: orderNum,
              status: newStatus,
              user_id: updated.user_id,
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => { cleanup = fn; });

    return () => { cleanup?.(); };
  }, []);
}
