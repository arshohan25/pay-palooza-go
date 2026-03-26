import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

/**
 * React hook that provides reactive auth state from Supabase.
 * Replaces the old sessionStorage-based auth check.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const latestSessionRef = useRef<Session | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    const applyAuthState = (nextSession: Session | null) => {
      latestSessionRef.current = nextSession;
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        applyAuthState(newSession);
        if (isMounted && latestSessionRef.current !== undefined) {
          setLoading(false);
        }
      }
    );

    // Then check existing session, but never let a stale null overwrite a live session
    void (async () => {
      try {
        const [{ data: { session: existingSession } }, { data: { user: existingUser } }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);

        const resolvedSession = existingSession ?? null;
        const shouldApplyBootstrapSession =
          latestSessionRef.current === undefined ||
          (latestSessionRef.current === null && resolvedSession !== null);

        if (shouldApplyBootstrapSession) {
          applyAuthState(resolvedSession);
        } else if (isMounted && latestSessionRef.current) {
          setUser(existingUser ?? latestSessionRef.current.user ?? null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
