import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeStatus = "connected" | "connecting" | "disconnected";

export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(() => {
    const channel = supabase.channel("admin-heartbeat");

    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") setStatus("connected");
      else if (s === "CLOSED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("disconnected");
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return status;
}
