import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks online/offline presence for all users via a global Supabase Presence channel.
 * Handles page visibility (auto-offline when tab hidden).
 */
export function useOnlinePresence(userId: string | null) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>(Object.keys(state));
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, online_at: new Date().toISOString() });
        }
      });

    channelRef.current = channel;

    // Handle page visibility
    const handleVisibility = async () => {
      if (!channelRef.current) return;
      if (document.hidden) {
        await channelRef.current.untrack();
      } else {
        await channelRef.current.track({ userId, online_at: new Date().toISOString() });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  const isOnline = useCallback(
    (uid: string) => onlineUsers.has(uid),
    [onlineUsers]
  );

  return { isOnline, onlineUsers };
}
