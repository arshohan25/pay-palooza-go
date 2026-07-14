import type { Session } from "@supabase/supabase-js";

const AUTH_TOKEN_KEY_PREFIX = "sb-";
const AUTH_TOKEN_KEY_SUFFIX = "-auth-token";
const SESSION_UI_KEYS = ["mfs_has_authenticated", "splashDone"];

function isAuthTokenKey(key: string) {
  return key.startsWith(AUTH_TOKEN_KEY_PREFIX) && key.endsWith(AUTH_TOKEN_KEY_SUFFIX);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isSessionInvalid(session: Pick<Session, "access_token"> | null | undefined): boolean {
  if (!session) return false;
  const token = session.access_token;
  if (!token || typeof token !== "string") return true;

  const payload = decodeJwtPayload(token);
  return !payload?.sub;
}

function removeAuthStorage(storage: Storage | undefined) {
  if (!storage) return;

  try {
    Object.keys(storage).forEach((key) => {
      if (isAuthTokenKey(key)) storage.removeItem(key);
    });
    SESSION_UI_KEYS.forEach((key) => storage.removeItem(key));
  } catch {
    // Ignore blocked storage.
  }
}

export function purgeStoredAuthSession() {
  removeAuthStorage(typeof localStorage !== "undefined" ? localStorage : undefined);
  removeAuthStorage(typeof sessionStorage !== "undefined" ? sessionStorage : undefined);
}

function readStoredSession(raw: string | null): Pick<Session, "access_token"> | null | undefined {
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.currentSession ?? parsed?.session ?? parsed;
  } catch {
    return null;
  }
}

export function purgeInvalidStoredAuthSession() {
  try {
    const hasInvalidToken = Object.keys(localStorage).some((key) => {
      if (!isAuthTokenKey(key)) return false;
      return isSessionInvalid(readStoredSession(localStorage.getItem(key)));
    });

    if (hasInvalidToken) {
      purgeStoredAuthSession();
      return true;
    }
  } catch {
    // If storage inspection itself fails, don't block app boot.
  }

  return false;
}