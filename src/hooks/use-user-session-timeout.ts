import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_TIMEOUT_MINUTES = 30;
const CHECK_INTERVAL_MS = 30_000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "scroll", "click"] as const;

/**
 * Auto-logout hook for regular users (non-team-members) after configurable inactivity.
 * Skips activation when user has `is_team_member` in auth metadata (handled by useSessionTimeout).
 */
export function useUserSessionTimeout() {
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);
  const isActiveUserRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // Skip if not authenticated or if team member (team members use useSessionTimeout)
      if (!user || user.user_metadata?.is_team_member) return;
      if (cancelled) return;
      isActiveUserRef.current = true;

      const { data } = await supabase
        .from("global_feature_toggles")
        .select("description")
        .eq("feature_key", "user_session_timeout_minutes")
        .maybeSingle();

      if (!cancelled && data?.description) {
        const mins = parseInt(data.description, 10);
        if (mins > 0) timeoutMinutesRef.current = mins;
      }
    };

    loadConfig();
    return () => { cancelled = true; };
  }, []);

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
