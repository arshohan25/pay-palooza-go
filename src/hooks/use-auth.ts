import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

let _cachedSession: Session | null = null;
let _sessionResolved = false;

export function getCachedUser(): User | null {
  return _cachedSession?.user ?? null;
}

export async function getCachedSession(): Promise<Session | null> {
  if (_sessionResolved) return _cachedSession;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  _cachedSession = session;
  _sessionResolved = true;
  return session;
}

export async function signOut() {
  localStorage.removeItem("mfs_user_name");
  localStorage.removeItem("mfs_registered_phone");
  localStorage.removeItem("mfs_display_photo");
  localStorage.removeItem("mfs_cached_user_id");
  localStorage.removeItem("mfs_has_authenticated");
  localStorage.removeItem("splashDone");

  await supabase.auth.signOut();
  _cachedSession = null;
  _sessionResolved = true;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => {
        if (!mounted) return;
        _cachedSession = restoredSession;
        _sessionResolved = true;
        setSession(restoredSession);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        _cachedSession = null;
        _sessionResolved = true;
        setSession(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      _cachedSession = nextSession;
      _sessionResolved = true;

      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setSession(null);
    setLoading(false);
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    isAuthenticated: !!session,
    signOut: handleSignOut,
  };
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
