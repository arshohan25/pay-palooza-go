import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Listens for new support messages from users and fires browser notifications + toasts.
 * Should be mounted once at the admin layout level (AdminDashboard).
 */
export function useSupportNotifications(activeTab: string) {
  const { user } = useAuth();
  const permissionRef = useRef<NotificationPermission>("default");

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

  const notify = useCallback(
    (title: string, body: string) => {
      // In-app toast always
      toast.info(title, { description: body, duration: 5000 });

      // Browser notification if permission granted and tab not focused or not on support
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
          // Notification API may not be available in all contexts
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
          // Only notify for user messages (not admin's own)
          if (msg.sender_role !== "user") return;
          if (msg.sender_id === user.id) return;

          // Try to get user name
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, notify]);
}
