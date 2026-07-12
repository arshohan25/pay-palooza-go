import { useCallback, useEffect, useState } from "react";

/**
 * Persisted OTP lockout state. Survives page refreshes and stays scoped per
 * (phone, purpose) so a user can't bypass rate limiting by reloading.
 *
 * Storage shape:
 *   otp_lockout:<key> => JSON<{ until: number; message?: string }>
 */

const STORAGE_PREFIX = "otp_lockout:";

export type OtpLockout = {
  isLocked: boolean;
  remainingSec: number;
  remainingMin: number;
  mmss: string;
  message: string;
  lock: (minutes: number, message?: string) => void;
  clear: () => void;
};

const readStored = (key: string): { until: number; message?: string } | null => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.until !== "number") return null;
    if (parsed.until <= Date.now()) {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export function useOtpLockout(key: string | null | undefined): OtpLockout {
  const [until, setUntil] = useState<number>(0);
  const [message, setMessage] = useState<string>("");
  const [now, setNow] = useState<number>(() => Date.now());

  // Hydrate from storage whenever the key changes
  useEffect(() => {
    if (!key) { setUntil(0); setMessage(""); return; }
    const stored = readStored(key);
    if (stored) {
      setUntil(stored.until);
      setMessage(stored.message ?? "");
    } else {
      setUntil(0);
      setMessage("");
    }
  }, [key]);

  // 1s tick while locked
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) {
        if (key) localStorage.removeItem(STORAGE_PREFIX + key);
        setUntil(0);
        setMessage("");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until, key]);

  // Sync across tabs
  useEffect(() => {
    if (!key) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_PREFIX + key) return;
      const stored = readStored(key);
      setUntil(stored?.until ?? 0);
      setMessage(stored?.message ?? "");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const remainingSec = until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
  const remainingMin = Math.ceil(remainingSec / 60);
  const isLocked = remainingSec > 0;
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const mmss = `${mm}:${ss.toString().padStart(2, "0")}`;

  const lock = useCallback(
    (minutes: number, msg?: string) => {
      if (!key) return;
      const mins = Math.max(1, Number(minutes) || 15);
      const nextUntil = Date.now() + mins * 60 * 1000;
      const nextMsg =
        msg || `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
      try {
        localStorage.setItem(
          STORAGE_PREFIX + key,
          JSON.stringify({ until: nextUntil, message: nextMsg }),
        );
      } catch {
        /* storage disabled — degrade to in-memory */
      }
      setUntil(nextUntil);
      setMessage(nextMsg);
    },
    [key],
  );

  const clear = useCallback(() => {
    if (key) {
      try { localStorage.removeItem(STORAGE_PREFIX + key); } catch { /* noop */ }
    }
    setUntil(0);
    setMessage("");
  }, [key]);

  return { isLocked, remainingSec, remainingMin, mmss, message, lock, clear };
}

/**
 * Parse a supabase.functions.invoke result and detect lockout responses.
 * Returns `{ minutes, message }` when the server responded with locked=true
 * (typically HTTP 429), or null otherwise.
 */
export async function parseLockout(
  data: any,
  invokeErr: any,
): Promise<{ minutes: number; message: string } | null> {
  let payload: any = data;
  if (invokeErr) {
    const ctx: any = (invokeErr as any)?.context;
    if (ctx && typeof ctx.json === "function") {
      try { payload = await ctx.json(); } catch { /* ignore */ }
    }
  }
  if (payload?.locked) {
    return {
      minutes: Number(payload.retry_after_minutes) || 15,
      message: payload.error || "Too many failed attempts. Please try again later.",
    };
  }
  return null;
}
