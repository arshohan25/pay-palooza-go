import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

// ── Module-level session cache ──
// Eliminates redundant supabase.auth.getSession() calls across hooks
let _cachedSession: Session | null = null;
let _sessionResolved = false;
const _sessionWaiters: Array<(s: Session | null) => void> = [];

// Hydrate cache from auth listener (runs once at import time)
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedSession = session;
  if (!_sessionResolved) {
    _sessionResolved = true;
    _sessionWaiters.forEach(fn => fn(session));
    _sessionWaiters.length = 0;
  }
});

/**
 * Returns the cached session synchronously if available,
 * otherwise waits for the first auth state change.
 * Use this in hooks/stores instead of supabase.auth.getSession().
 */
export async function getCachedSession(): Promise<Session | null> {
  if (_sessionResolved) return _cachedSession;
  // First call before listener fires — get from Supabase and cache
  const { data: { session } } = await supabase.auth.getSession();
  if (!_sessionResolved) {
    _cachedSession = session;
    _sessionResolved = true;
    _sessionWaiters.forEach(fn => fn(session));
    _sessionWaiters.length = 0;
  }
  return _cachedSession;
}

/** Synchronous access — may be null if auth hasn't resolved yet */
export function getCachedUser(): User | null {
  return _cachedSession?.user ?? null;
}

/**
 * React hook that provides reactive auth state from Supabase.
 * Replaces the old sessionStorage-based auth check.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(_cachedSession);
  const [user, setUser] = useState<User | null>(_cachedSession?.user ?? null);
  const [loading, setLoading] = useState(!_sessionResolved);

  useEffect(() => {
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    // Clear identity-related localStorage to prevent stale data
    localStorage.removeItem("mfs_user_name");
    localStorage.removeItem("mfs_registered_phone");
    localStorage.removeItem("mfs_display_photo");
    localStorage.removeItem("mfs_cached_user_id");
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  return {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    signOut,
  };
}
