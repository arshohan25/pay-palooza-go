import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_TIMEOUT_MINUTES = 30;
const CHECK_INTERVAL_MS = 30_000; // 30s
const WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 min before logout
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 min

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "scroll", "click"] as const;

/**
 * Auto-logout hook for team members after configurable inactivity.
 * Only activates when user has `is_team_member` in auth metadata.
 */
export function useSessionTimeout() {
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);
  const timeoutMinutesRef = useRef(DEFAULT_TIMEOUT_MINUTES);
  const lastDbUpdateRef = useRef(0);
  const isTeamMemberRef = useRef(false);

  // Load config
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      // Check if team member
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.user_metadata?.is_team_member) return;
      if (cancelled) return;
      isTeamMemberRef.current = true;

      // Load timeout setting
      const { data } = await supabase
        .from("global_feature_toggles")
        .select("description")
        .eq("feature_key", "team_session_timeout_minutes")
        .maybeSingle();

      if (!cancelled && data?.description) {
        const mins = parseFloat(data.description);
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

  // Activity listeners
  useEffect(() => {
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetActivity));
    };
  }, [resetActivity]);

  // Periodic check
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isTeamMemberRef.current) return;

      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const timeoutMs = timeoutMinutesRef.current * 60 * 1000;
      const remaining = timeoutMs - elapsed;

      // Auto logout
      if (remaining <= 0) {
        clearInterval(interval);
        await supabase.auth.signOut();
        toast.error("Session expired due to inactivity");
        navigate("/team-login", { replace: true });
        return;
      }

      // Warning toast
      if (remaining <= WARNING_BEFORE_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        const mins = Math.ceil(remaining / 60_000);
        toast.warning(`Session expiring in ${mins} minute${mins > 1 ? "s" : ""}. Move your mouse to stay logged in.`, { duration: 10000 });
      }

      // Periodic last_active_at update
      if (now - lastDbUpdateRef.current > ACTIVITY_UPDATE_INTERVAL_MS) {
        lastDbUpdateRef.current = now;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("team_members")
            .update({ last_active_at: new Date().toISOString() } as any)
            .eq("user_id", user.id);
        }
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [navigate]);
}
