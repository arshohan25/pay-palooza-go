import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { isSessionInvalid, purgeStoredAuthSession } from "@/lib/authSessionRecovery";

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

  if (isSessionInvalid(session)) {
    purgeStoredAuthSession();
    _cachedSession = null;
    _sessionResolved = true;
    return null;
  }

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

  await Promise.race([
    supabase.auth.signOut().catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 1200)),
  ]);
  purgeStoredAuthSession();
  _cachedSession = null;
  _sessionResolved = true;
}

async function purgeInvalidSession() {
  // Clear browser auth storage first. signOut can hang/throw for bad JWTs,
  // so storage cleanup must not depend on the backend accepting the token.
  purgeStoredAuthSession();
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
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
