import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushSubscription() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported = typeof window !== "undefined" &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const checkExistingSubscription = useCallback(async () => {
    if (!supported) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      const has = !!sub;
      setSubscribed(has);
      return has;
    } catch {
      return false;
    }
  }, [supported]);

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
    checkExistingSubscription();
  }, [supported, checkExistingSubscription]);

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!supported) return { ok: false, error: "Notifications not supported on this device" };
    if (!user) return { ok: false, error: "Sign in first" };
    if (!VAPID_PUBLIC_KEY) return { ok: false, error: "Push not configured (missing VITE_VAPID_PUBLIC_KEY)" };

    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return { ok: false, error: "Permission denied" };

      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        try { reg = await navigator.serviceWorker.register("/sw.js"); }
        catch { return { ok: false, error: "No service worker available — install the app first" }; }
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json: any = sub.toJSON();
      const { error } = await (supabase as any).from("push_subscriptions").upsert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
      }, { onConflict: "endpoint" });
      if (error) return { ok: false, error: error.message };
      setSubscribed(true);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Subscribe failed" };
    } finally {
      setBusy(false);
    }
  }, [supported, user]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return false;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch { return false; }
  }, [supported]);

  const sendTest = useCallback(async () => {
    if (!user) return { ok: false, error: "Sign in first" };
    const { data, error } = await (supabase as any).functions.invoke("send-push-notification", {
      body: { user_ids: [user.id], title: "Test push ✅", body: "If you see this, push is wired correctly.", url: "/" },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  }, [user]);

  return {
    supported, permission, subscribed, subscribe, unsubscribe, sendTest, busy,
    configured: !!VAPID_PUBLIC_KEY, checkExistingSubscription,
  };
}
