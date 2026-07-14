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

/**
 * Detect a corrupted/invalid Supabase session (e.g. JWT missing `sub`
 * claim after signing-key rotation). Such a session can't be used and
 * causes /auth/v1/user to 403 in a loop, wedging the UI. We treat it
 * as "signed out" and purge it from storage.
 */
function isSessionInvalid(session: Session | null): boolean {
  if (!session) return false;
  const token = session.access_token;
  if (!token || typeof token !== "string") return true;
  const parts = token.split(".");
  if (parts.length !== 3) return true;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (!payload?.sub) return true;
  } catch {
    return true;
  }
  return false;
}

async function purgeInvalidSession() {
  try {
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        localStorage.removeItem(k);
      }
    });
  } catch {
    // ignore
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Safety valve: never leave the app stuck in "auth loading" forever.
    const failsafe = setTimeout(() => {
      if (!mounted) return;
      _sessionResolved = true;
      setLoading(false);
    }, 4000);

    supabase.auth
      .getSession()
      .then(async ({ data: { session: restoredSession } }) => {
        if (!mounted) return;
        if (isSessionInvalid(restoredSession)) {
          await purgeInvalidSession();
          _cachedSession = null;
          _sessionResolved = true;
          setSession(null);
          setLoading(false);
          return;
        }
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
      if (isSessionInvalid(nextSession)) {
        void purgeInvalidSession();
        _cachedSession = null;
        _sessionResolved = true;
        if (!mounted) return;
        setSession(null);
        setLoading(false);
        return;
      }
      _cachedSession = nextSession;
      _sessionResolved = true;

      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(failsafe);
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
