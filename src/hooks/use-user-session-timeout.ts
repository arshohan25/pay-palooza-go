import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_TIMEOUT_MINUTES = 30;
const CHECK_INTERVAL_MS = 30_000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "scroll", "click"] as const;

const ROLE_CONFIG_KEYS: Record<string, string> = {
  user: "user_timeout_minutes",
  agent: "agent_timeout_minutes",
  distributor: "distributor_timeout_minutes",
  super_distributor: "super_distributor_timeout_minutes",
  merchant: "merchant_timeout_minutes",
};

/**
 * Auto-logout hook for regular users (non-team-members) after configurable inactivity.
 * Accepts an optional role to read role-specific timeout config.
 */
export function useUserSessionTimeout(role: string = "user") {
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);
  const isActiveUserRef = useRef(false);

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
    };

    loadConfig();
    return () => { cancelled = true; };
  }, [role]);

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

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isActiveUserRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const timeoutMs = timeoutMinutesRef.current * 60 * 1000;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        clearInterval(interval);
        await supabase.auth.signOut();
        toast.error("Session expired due to inactivity");
        navigate("/", { replace: true });
        return;
      }

      if (remaining <= WARNING_BEFORE_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        const mins = Math.ceil(remaining / 60_000);
        toast.warning(
          `Session expiring in ${mins} minute${mins > 1 ? "s" : ""}. Move your mouse to stay logged in.`,
          { duration: 10000 }
        );
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [navigate]);
}
