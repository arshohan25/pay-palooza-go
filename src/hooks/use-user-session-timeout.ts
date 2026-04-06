import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_TIMEOUT_MINUTES = 30;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "scroll", "click"] as const;

const ROLE_CONFIG_KEYS: Record<string, string> = {
  user: "user_timeout_minutes",
  agent: "agent_timeout_minutes",
  distributor: "distributor_timeout_minutes",
  super_distributor: "super_distributor_timeout_minutes",
  merchant: "merchant_timeout_minutes",
};

/** Compute check interval: at least 1s, at most 30s, ~1/6 of timeout */
function getCheckInterval(timeoutMs: number) {
  return Math.max(1000, Math.min(30_000, Math.floor(timeoutMs / 6)));
}

/** Compute warning lead time: 2 min or half the timeout, whichever is smaller */
function getWarningBefore(timeoutMs: number) {
  return Math.min(2 * 60 * 1000, timeoutMs * 0.5);
}

export function useUserSessionTimeout(role: string = "user") {
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);
  const isActiveUserRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startChecker = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const timeoutMs = timeoutMinutesRef.current * 60 * 1000;
    const checkMs = getCheckInterval(timeoutMs);
    const warningMs = getWarningBefore(timeoutMs);

    intervalRef.current = setInterval(async () => {
      if (!isActiveUserRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        await supabase.auth.signOut();
        toast.error("Session expired due to inactivity");
        navigate("/", { replace: true });
        return;
      }

      if (remaining <= warningMs && !warningShownRef.current) {
        warningShownRef.current = true;
        const secs = Math.ceil(remaining / 1000);
        const label = secs >= 60
          ? `${Math.ceil(secs / 60)} minute${Math.ceil(secs / 60) > 1 ? "s" : ""}`
          : `${secs} second${secs > 1 ? "s" : ""}`;
        toast.warning(
          `Session expiring in ${label}. Move your mouse to stay logged in.`,
          { duration: Math.min(remaining, 10000) }
        );
      }
    }, checkMs);
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata?.is_team_member) return;
      if (cancelled) return;
      isActiveUserRef.current = true;

      const configKey = ROLE_CONFIG_KEYS[role] || "user_timeout_minutes";

      const { data } = await supabase
        .from("global_feature_toggles")
        .select("description")
        .eq("feature_key", configKey)
        .maybeSingle();

      if (!cancelled && data?.description) {
        const mins = parseFloat(data.description);
        if (mins > 0) timeoutMinutesRef.current = mins;
      }

      startChecker();
    };

    loadConfig();
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [role, startChecker]);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
  }, []);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetActivity));
    };
  }, [resetActivity]);
}
