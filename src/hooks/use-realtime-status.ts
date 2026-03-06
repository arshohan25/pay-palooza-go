import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeStatus = "connected" | "connecting" | "disconnected";

export interface RealtimeStatusInfo {
  status: RealtimeStatus;
  lastConnectedAt: Date | null;
  reconnectAttempt: number;
}

const MAX_BACKOFF = 30000;

export function useRealtimeStatus(): RealtimeStatusInfo {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const setupChannel = useCallback(() => {
    // Remove old channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel("admin-heartbeat");
    channelRef.current = channel;

    channel.subscribe((s) => {
      if (s === "SUBSCRIBED") {
        setStatus("connected");
        setLastConnectedAt(new Date());
        attemptRef.current = 0;
        setReconnectAttempt(0);
        clearTimer();
      } else if (s === "CLOSED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
        setStatus("disconnected");
        // Schedule reconnect with exponential backoff
        const delay = Math.min(Math.pow(2, attemptRef.current) * 1000, MAX_BACKOFF);
        clearTimer();
        timeoutRef.current = setTimeout(() => {
          attemptRef.current += 1;
          setReconnectAttempt(attemptRef.current);
          setStatus("connecting");
          setupChannel();
        }, delay);
      }
    });
  }, [clearTimer]);

  useEffect(() => {
    setupChannel();
    return () => {
      clearTimer();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [setupChannel, clearTimer]);

  return { status, lastConnectedAt, reconnectAttempt };
}
