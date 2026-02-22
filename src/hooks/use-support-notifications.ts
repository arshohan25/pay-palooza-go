import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Listens for new support messages from users and fires browser notifications + toasts.
 * Also tracks total unread support message count for badge display.
 */
export function useSupportNotifications(activeTab: string) {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create notification sound using Web Audio API (synthesized chime)
  useEffect(() => {
    // Use a data URI for a short notification chime so no external file is needed
    const createNotificationSound = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sampleRate = audioCtx.sampleRate;
        const duration = 0.3;
        const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);

        // Two-tone chime: 880Hz then 1100Hz
        for (let i = 0; i < data.length; i++) {
          const t = i / sampleRate;
          const freq = t < 0.15 ? 880 : 1100;
          const envelope = t < 0.01 ? t / 0.01 : Math.exp(-6 * (t - 0.01));
          data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
        }

        // Convert to WAV blob for reusable Audio element
        const wavBuffer = new ArrayBuffer(44 + data.length * 2);
        const view = new DataView(wavBuffer);
        const writeString = (offset: number, str: string) => {
          for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
        };
        writeString(0, "RIFF");
        view.setUint32(4, 36 + data.length * 2, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, data.length * 2, true);
        for (let i = 0; i < data.length; i++) {
          const s = Math.max(-1, Math.min(1, data[i]));
          view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        const blob = new Blob([wavBuffer], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        audioRef.current = new Audio(url);
        audioRef.current.volume = 0.5;
        audioCtx.close();
      } catch {
        // Web Audio not available
      }
    };
    createNotificationSound();
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      permissionRef.current = Notification.permission;
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => {
          permissionRef.current = p;
        });
      }
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_role", "user")
      .is("read_at", null);
    setUnreadCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  const notify = useCallback(
    (title: string, body: string) => {
      // Play sound alert
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }

      toast.info(title, { description: body, duration: 5000 });

      if (
        "Notification" in window &&
        permissionRef.current === "granted" &&
        (document.hidden || activeTab !== "support")
      ) {
        try {
          const n = new Notification(title, {
            body,
            icon: "/icons/icon-192.png",
            tag: "support-msg-" + Date.now(),
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          // Notification API may not be available
        }
      }
    },
    [activeTab]
  );

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("admin-support-notif")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
        },
        async (payload) => {
          const msg = payload.new as { sender_role: string; content: string; conversation_id: string; sender_id: string };
          if (msg.sender_role !== "user") return;
          if (msg.sender_id === user.id) return;

          // Increment unread count
          setUnreadCount(prev => prev + 1);

          const { data: conv } = await supabase
            .from("support_conversations")
            .select("user_id")
            .eq("id", msg.conversation_id)
            .single();

          let userName = "A user";
          if (conv) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("name, phone")
              .eq("user_id", conv.user_id)
              .single();
            if (profile) {
              userName = profile.name || profile.phone || "A user";
            }
          }

          notify("New Support Message", `${userName}: ${msg.content.slice(0, 80)}`);
        }
      )
      // Also listen for read_at updates to decrement count
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_messages",
        },
        () => {
          // Re-fetch on any update (read receipts)
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, notify, fetchUnreadCount]);

  return { unreadCount };
}
