import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DbNotification = Tables<"notifications">;

/**
 * Shared singleton store so every component using `useNotifications()`
 * (header bell, NotificationCenter sheet, etc.) sees the same state.
 * Without this, each consumer kept its own `useState` array — marking
 * notifications as read inside the sheet would not update the bell badge
 * until a refresh.
 */
type State = {
  notifications: DbNotification[];
  loading: boolean;
  userId: string | null;
};

let state: State = { notifications: [], loading: true, userId: null };
const listeners = new Set<() => void>();
let channel: ReturnType<typeof supabase.channel> | null = null;
let initPromise: Promise<void> | null = null;

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function patchOne(id: string, patch: Partial<DbNotification>) {
  setState({
    notifications: state.notifications.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  });
}

function upsertOne(n: DbNotification) {
  if (state.userId && n.user_id !== state.userId) return;
  const exists = state.notifications.some((x) => x.id === n.id);
  setState({
    notifications: exists
      ? state.notifications.map((x) => (x.id === n.id ? n : x))
      : [n, ...state.notifications],
  });
}

function removeOne(id: string) {
  setState({ notifications: state.notifications.filter((x) => x.id !== id) });
}

async function initOnce() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState({ loading: false, userId: null });
      return;
    }
    setState({ userId: user.id });

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setState({ notifications: data ?? [], loading: false });

    if (channel) supabase.removeChannel(channel);
    channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => upsertOne(payload.new as DbNotification),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => upsertOne(payload.new as DbNotification),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => removeOne((payload.old as { id: string }).id),
      )
      .subscribe();
  })();
  return initPromise;
}

// React to auth changes — reset store and re-init for the new user.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user?.id !== state.userId) {
    if (channel) { supabase.removeChannel(channel); channel = null; }
    initPromise = null;
    setState({ notifications: [], loading: true, userId: null });
    initOnce();
  }
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  initOnce();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

export function useNotifications() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const markRead = useCallback(async (id: string) => {
    // Optimistic local update — every consumer re-renders instantly
    patchOne(id, { read: true });
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
    if (error) patchOne(id, { read: false });
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadIds = state.notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setState({
      notifications: state.notifications.map((x) => ({ ...x, read: true })),
    });
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);
    if (error) {
      // Revert
      setState({
        notifications: state.notifications.map((x) =>
          unreadIds.includes(x.id) ? { ...x, read: false } : x,
        ),
      });
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    const previous = state.notifications;
    removeOne(id);
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) setState({ notifications: previous });
  }, []);

  const clearAll = useCallback(async () => {
    const previous = state.notifications;
    const ids = previous.map((n) => n.id);
    if (ids.length === 0) return;
    setState({ notifications: [] });
    const { error } = await supabase.from("notifications").delete().in("id", ids);
    if (error) setState({ notifications: previous });
  }, []);

  const unreadCount = snap.notifications.filter((n) => !n.read).length;

  return {
    notifications: snap.notifications,
    loading: snap.loading,
    unreadCount,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
  };
}
