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
