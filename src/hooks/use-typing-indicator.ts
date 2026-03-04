import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingPresence {
  userId: string;
  userName: string;
  isTyping: boolean;
}

export function useTypingIndicator(
  conversationId: string | null,
  userId: string | null,
  userName: string
) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<TypingPresence>();
        const names: string[] = [];
        for (const [key, presences] of Object.entries(state)) {
          if (key === userId) continue;
          for (const p of presences) {
            if (p.isTyping) names.push(p.userName || "Someone");
          }
        }
        setTypingUsers(names);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, userName, isTyping: false });
        }
      });

    channelRef.current = channel;

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId, userId, userName]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !userId) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      channelRef.current.track({ userId, userName, isTyping });

      if (isTyping) {
        timeoutRef.current = setTimeout(() => {
          channelRef.current?.track({ userId, userName, isTyping: false });
        }, 3000);
      }
    },
    [userId, userName]
  );

  return { typingUsers, setTyping };
}
