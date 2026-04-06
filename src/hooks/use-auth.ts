import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let _cachedSession: Session | null = null;
let _sessionResolved = false;

let authState: AuthState = {
  session: _cachedSession,
  user: _cachedSession?.user ?? null,
  loading: !_sessionResolved,
};

let authInitialized = false;
let authInitPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emitAuthState() {
  listeners.forEach((listener) => listener());
}

function setAuthState(session: Session | null, loading: boolean) {
  _cachedSession = session;
  _sessionResolved = !loading;
  authState = {
    session,
    user: session?.user ?? null,
    loading,
  };
  emitAuthState();
}

function initAuthStore() {
  if (authInitialized) return authInitPromise ?? Promise.resolve();
  authInitialized = true;

  supabase.auth.onAuthStateChange((_event, newSession) => {
    setAuthState(newSession, false);
  });

  authInitPromise = supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      setAuthState(session, false);
    })
    .catch(() => {
      setAuthState(null, false);
    })
    .finally(() => {
      authInitPromise = null;
    });

  return authInitPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return authState;
}

export async function getCachedSession(): Promise<Session | null> {
  if (_sessionResolved) return _cachedSession;
  await initAuthStore();
  return _cachedSession;
}

export function getCachedUser(): User | null {
  return _cachedSession?.user ?? null;
}

export async function signOut() {
  localStorage.removeItem("mfs_user_name");
  localStorage.removeItem("mfs_registered_phone");
  localStorage.removeItem("mfs_display_photo");
  localStorage.removeItem("mfs_cached_user_id");
  localStorage.removeItem("mfs_has_authenticated");
  localStorage.removeItem("splashDone");
  await supabase.auth.signOut();
  setAuthState(null, false);
}

export function useAuth() {
  useEffect(() => {
    void initAuthStore();
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    session: state.session,
    user: state.user,
    loading: state.loading,
    isAuthenticated: !!state.session,
    signOut,
  };
}
