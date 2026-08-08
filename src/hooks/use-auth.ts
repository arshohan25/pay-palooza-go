import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { isSessionInvalid, purgeStoredAuthSession } from "@/lib/authSessionRecovery";

let _cachedSession: Session | null = null;
let _sessionResolved = false;

// --------------------------------------------------------------------------
// Auth diagnostics — module-level state so the admin panel and the error
// overlay share the same signal without prop-drilling.
// --------------------------------------------------------------------------
export type AuthErrorInfo = {
  message: string;
  code?: string | number;
  at: number; // epoch ms
  source: "getSession" | "getUser" | "onAuthStateChange" | "failsafe" | "refresh";
};

export type AuthDiagnostics = {
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  lastError: AuthErrorInfo | null;
  lastValidatedAt: number | null;
  lastValidationOk: boolean | null;
  tokenExpiresAt: number | null; // epoch seconds
  userId: string | null;
  refreshAttempts: number;
};

let _diagnostics: AuthDiagnostics = {
  status: "loading",
  lastError: null,
  lastValidatedAt: null,
  lastValidationOk: null,
  tokenExpiresAt: null,
  userId: null,
  refreshAttempts: 0,
};

const _diagListeners = new Set<(d: AuthDiagnostics) => void>();
function _emit() {
  const snap = { ..._diagnostics };
  _diagListeners.forEach((l) => {
    try { l(snap); } catch { /* noop */ }
  });
}
function _patch(patch: Partial<AuthDiagnostics>) {
  _diagnostics = { ..._diagnostics, ...patch };
  _emit();
}

export function getAuthDiagnostics(): AuthDiagnostics {
  return { ..._diagnostics };
}

export function subscribeAuthDiagnostics(l: (d: AuthDiagnostics) => void) {
  _diagListeners.add(l);
  l({ ..._diagnostics });
  return () => { _diagListeners.delete(l); };
}

// --------------------------------------------------------------------------
// Auth error surface (shown to users when validation fails).
// --------------------------------------------------------------------------
let _authError: AuthErrorInfo | null = null;
const _errListeners = new Set<(e: AuthErrorInfo | null) => void>();
function _setAuthError(err: AuthErrorInfo | null) {
  _authError = err;
  _errListeners.forEach((l) => { try { l(err); } catch { /* noop */ } });
  _patch({ lastError: err, status: err ? "error" : _diagnostics.status });
}
export function getAuthError() { return _authError; }
export function subscribeAuthError(l: (e: AuthErrorInfo | null) => void) {
  _errListeners.add(l);
  l(_authError);
  return () => { _errListeners.delete(l); };
}
export function clearAuthError() { _setAuthError(null); }

// --------------------------------------------------------------------------
// Automatic 401/403 recovery for supabase-js fetch calls.
// Wraps fetch once; on a 401/403 from Supabase, attempts a single
// refreshSession() and retries the original request.
// --------------------------------------------------------------------------
let _fetchPatched = false;
let _refreshInFlight: Promise<boolean> | null = null;

function _isSessionMissing(msg?: string | null) {
  const m = (msg || "").toLowerCase();
  return m.includes("auth session missing") || m.includes("session not found") || m.includes("refresh token not found");
}

async function _refreshSessionOnce(): Promise<boolean> {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    _diagnostics.refreshAttempts += 1;
    _emit();
    try {
      // No stored session at all → the user is simply signed out. Don't attempt
      // a refresh (it 400s with "Auth session missing!") and don't raise an
      // auth error overlay for anonymous visitors.
      const { data: existing } = await supabase.auth.getSession();
      if (!existing.session) {
        _cachedSession = null;
        _sessionResolved = true;
        _patch({ status: "unauthenticated", userId: null, lastValidatedAt: Date.now(), lastValidationOk: null });
        return false;
      }

      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        if (_isSessionMissing(error?.message)) {
          _cachedSession = null;
          _sessionResolved = true;
          _patch({ status: "unauthenticated", userId: null, lastValidatedAt: Date.now(), lastValidationOk: null });
          return false;
        }
        _setAuthError({
          message: error?.message || "Session expired. Please sign in again.",
          code: (error as any)?.status,
          at: Date.now(),
          source: "refresh",
        });
        return false;
      }
      _cachedSession = data.session;
      _sessionResolved = true;
      _patch({
        status: "authenticated",
        userId: data.session.user.id,
        tokenExpiresAt: data.session.expires_at ?? null,
        lastValidatedAt: Date.now(),
        lastValidationOk: true,
      });
      return true;
    } catch (e: any) {
      if (_isSessionMissing(e?.message)) {
        _cachedSession = null;
        _sessionResolved = true;
        _patch({ status: "unauthenticated", userId: null, lastValidatedAt: Date.now(), lastValidationOk: null });
        return false;
      }
      _setAuthError({
        message: e?.message || "Failed to refresh session.",
        at: Date.now(),
        source: "refresh",
      });
      return false;
    } finally {
      setTimeout(() => { _refreshInFlight = null; }, 250);
    }
  })();
  return _refreshInFlight;
}


function _patchFetchForAuthRecovery() {
  if (_fetchPatched || typeof window === "undefined") return;
  _fetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    const isSupabaseCall = !!supabaseUrl && url.startsWith(supabaseUrl);
    // Don't retry auth endpoints themselves (avoid loops).
    const isAuthEndpoint = isSupabaseCall && url.includes("/auth/v1/");
    // Edge Functions use 401/403 for business logic (e.g. "not a merchant account").
    // Don't silently refresh + replay those — let the caller handle the response.
    const isEdgeFunction = isSupabaseCall && url.includes("/functions/v1/");

    const response = await originalFetch(input as any, init);

    if (!isSupabaseCall || isAuthEndpoint || isEdgeFunction) return response;
    if (response.status !== 401 && response.status !== 403) return response;

    // Try one silent refresh; if it succeeds, replay the request with the
    // new access token.
    const refreshed = await _refreshSessionOnce();
    if (!refreshed) return response;

    const token = _cachedSession?.access_token;
    if (!token) return response;

    // Rebuild the request with the fresh Authorization header.
    let retryInit: RequestInit;
    let retryInput: RequestInfo | URL;
    if (input instanceof Request) {
      const headers = new Headers(input.headers);
      headers.set("Authorization", `Bearer ${token}`);
      retryInput = new Request(input, { headers });
      retryInit = init ?? {};
    } else {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      headers.set("Authorization", `Bearer ${token}`);
      retryInit = { ...(init ?? {}), headers };
      retryInput = input;
    }
    try {
      return await originalFetch(retryInput as any, retryInit);
    } catch {
      return response;
    }
  };
}

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
  _patch({ status: "unauthenticated", userId: null, tokenExpiresAt: null });
}

async function purgeInvalidSession() {
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

/** Retry entry point for the user-facing auth-error overlay. */
export async function retryAuth(): Promise<boolean> {
  clearAuthError();
  _patch({ status: "loading" });
  const ok = await _refreshSessionOnce();
  if (ok) return true;
  // Refresh failed — hard reload so login screens can render cleanly.
  try { window.location.reload(); } catch { /* noop */ }
  return false;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthErrorState] = useState<AuthErrorInfo | null>(_authError);

  useEffect(() => {
    _patchFetchForAuthRecovery();
    const unsub = subscribeAuthError((e) => setAuthErrorState(e));
    return unsub;
  }, []);

  useEffect(() => {
    let mounted = true;

    const failsafe = setTimeout(() => {
      if (!mounted) return;
      if (_sessionResolved) return;
      void purgeInvalidSession();
      _cachedSession = null;
      _sessionResolved = true;
      _setAuthError({
        message: "Auth check timed out. Please retry.",
        at: Date.now(),
        source: "failsafe",
      });
      _patch({ status: "unauthenticated", userId: null, tokenExpiresAt: null });
      setSession(null);
      setLoading(false);
    }, 4000);

    const validateAndSet = async (candidate: Session | null) => {
      if (!mounted) return;
      if (!candidate) {
        _cachedSession = null;
        _sessionResolved = true;
        _patch({ status: "unauthenticated", userId: null, tokenExpiresAt: null });
        setSession(null);
        setLoading(false);
        return;
      }
      if (isSessionInvalid(candidate)) {
        await purgeInvalidSession();
        _cachedSession = null;
        _sessionResolved = true;
        _setAuthError({
          message: "Your session is no longer valid.",
          code: "invalid_jwt",
          at: Date.now(),
          source: "getSession",
        });
        _patch({ status: "unauthenticated", userId: null, tokenExpiresAt: null });
        if (!mounted) return;
        setSession(null);
        setLoading(false);
        return;
      }

      try {
        const result = await Promise.race([
          supabase.auth.getUser(candidate.access_token),
          new Promise<{ data: { user: null }; error: { status?: number; message: string } }>((resolve) =>
            setTimeout(() => resolve({ data: { user: null }, error: { message: "getUser timeout" } }), 2500),
          ),
        ]);
        const err = (result as any)?.error;
        const rejected =
          !!err && (err.status === 401 || err.status === 403 || /jwt|sub claim|invalid/i.test(err.message || ""));
        if (rejected) {
          // Try one refresh before purging.
          const refreshed = await _refreshSessionOnce();
          if (refreshed && _cachedSession) {
            if (!mounted) return;
            _patch({
              status: "authenticated",
              userId: _cachedSession.user.id,
              tokenExpiresAt: _cachedSession.expires_at ?? null,
              lastValidatedAt: Date.now(),
              lastValidationOk: true,
            });
            setSession(_cachedSession);
            setLoading(false);
            return;
          }
          await purgeInvalidSession();
          _cachedSession = null;
          _sessionResolved = true;
          _setAuthError({
            message: err.message || "Session was rejected by the server.",
            code: err.status,
            at: Date.now(),
            source: "getUser",
          });
          _patch({
            status: "error",
            userId: null,
            tokenExpiresAt: null,
            lastValidatedAt: Date.now(),
            lastValidationOk: false,
          });
          if (!mounted) return;
          setSession(null);
          setLoading(false);
          return;
        }
        _patch({ lastValidatedAt: Date.now(), lastValidationOk: true });
      } catch {
        // Network hiccup — keep the session; realtime queries will re-auth.
      }

      _cachedSession = candidate;
      _sessionResolved = true;
      _patch({
        status: "authenticated",
        userId: candidate.user.id,
        tokenExpiresAt: candidate.expires_at ?? null,
      });
      if (!mounted) return;
      setSession(candidate);
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session: restoredSession } }) => validateAndSet(restoredSession))
      .catch(async (e) => {
        await purgeInvalidSession();
        if (!mounted) return;
        _cachedSession = null;
        _sessionResolved = true;
        _setAuthError({
          message: e?.message || "Failed to read session.",
          at: Date.now(),
          source: "getSession",
        });
        _patch({ status: "unauthenticated", userId: null, tokenExpiresAt: null });
        setSession(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (isSessionInvalid(nextSession)) {
        void purgeInvalidSession();
        _cachedSession = null;
        _sessionResolved = true;
        _patch({ status: "unauthenticated", userId: null, tokenExpiresAt: null });
        if (!mounted) return;
        setSession(null);
        setLoading(false);
        return;
      }
      _cachedSession = nextSession;
      _sessionResolved = true;
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        clearAuthError();
      }
      _patch({
        status: nextSession ? "authenticated" : "unauthenticated",
        userId: nextSession?.user.id ?? null,
        tokenExpiresAt: nextSession?.expires_at ?? null,
      });

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
    authError,
    retryAuth,
    signOut: handleSignOut,
  };
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}
