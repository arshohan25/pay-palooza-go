/**
 * Realtime channel manager.
 *
 * Solves two problems:
 *  1. Duplicate subscriptions: React strict mode / rapid remounts / two components
 *     using the same channel name would leak channels. `subscribeRealtime` is
 *     ref-counted per stable key — a second subscriber piggybacks on the same
 *     underlying channel and unmount only tears it down when the last consumer
 *     leaves.
 *  2. Stale subscriptions on user switch / sign-out: an auth-state listener
 *     removes every active channel so we never leak the previous user's realtime
 *     stream (which would otherwise keep pushing rows the new session can't
 *     read).
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Entry = {
  channel: RealtimeChannel;
  refs: number;
};

const registry = new Map<string, Entry>();

export interface RealtimeHandle {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

/**
 * Subscribe with automatic de-duplication.
 *
 * @param key      Stable identity (e.g. `txn-detail:${txId}`). Two callers with
 *                 the same key share one channel.
 * @param builder  Attach `.on(...)` handlers to the passed channel and return
 *                 it (do NOT call `.subscribe()` — the manager does that once).
 */
export function subscribeRealtime(
  key: string,
  builder: (channel: RealtimeChannel) => RealtimeChannel,
): RealtimeHandle {
  const existing = registry.get(key);
  if (existing) {
    existing.refs += 1;
    return {
      channel: existing.channel,
      unsubscribe: () => releaseKey(key),
    };
  }

  const channel = builder(supabase.channel(key));
  channel.subscribe();
  registry.set(key, { channel, refs: 1 });

  return {
    channel,
    unsubscribe: () => releaseKey(key),
  };
}

function releaseKey(key: string) {
  const entry = registry.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    registry.delete(key);
    try {
      supabase.removeChannel(entry.channel);
    } catch {
      /* noop */
    }
  }
}

/** Tear down every tracked channel. Used on sign-out and user switch. */
export function removeAllTrackedChannels() {
  for (const [, entry] of registry) {
    try {
      supabase.removeChannel(entry.channel);
    } catch {
      /* noop */
    }
  }
  registry.clear();
  // Belt & suspenders: purge anything untracked too (legacy call sites).
  try {
    void supabase.removeAllChannels();
  } catch {
    /* noop */
  }
}

// -----------------------------------------------------------------------------
// Global auth-state guard — installs exactly once per tab.
// -----------------------------------------------------------------------------
let installed = false;
let currentUserId: string | null = null;

export function installRealtimeAuthGuard() {
  if (installed) return;
  installed = true;

  void supabase.auth.getUser().then(({ data }) => {
    currentUserId = data.user?.id ?? null;
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const nextUid = session?.user?.id ?? null;
    const userChanged = nextUid !== currentUserId;

    if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && userChanged) || userChanged) {
      removeAllTrackedChannels();
    }
    currentUserId = nextUid;
  });
}
