import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

// ── Module-level session cache ──
let _cachedSession: Session | null = null;
let _sessionResolved = false;

/**
 * Returns the cached session if available,
 * otherwise fetches from Supabase and caches it.
 */
export async function getCachedSession(): Promise<Session | null> {
  if (_sessionResolved) return _cachedSession;
  const { data: { session } } = await supabase.auth.getSession();
  _cachedSession = session;
  _sessionResolved = true;
  return _cachedSession;
}

/** Synchronous access — may be null if auth hasn't resolved yet */
export function getCachedUser(): User | null {
  return _cachedSession?.user ?? null;
}

/**
 * React hook that provides reactive auth state from Supabase.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        _cachedSession = newSession;
        _sessionResolved = true;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      _cachedSession = existingSession;
      _sessionResolved = true;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem("mfs_user_name");
    localStorage.removeItem("mfs_registered_phone");
    localStorage.removeItem("mfs_display_photo");
    localStorage.removeItem("mfs_cached_user_id");
    localStorage.removeItem("mfs_has_authenticated");
    localStorage.removeItem("splashDone");
    await supabase.auth.signOut();
    _cachedSession = null;
    _sessionResolved = true;
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
