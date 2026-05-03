import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const POLL_MS = 30_000;
const REFRESH_LEAD_S = 60;

/**
 * Watches the Supabase session while the user is on a `/merchant*` route
 * (excluding `/merchant-login`) and redirects to the login page when the
 * session expires or the refresh token is no longer valid.
 *
 * Two trigger paths:
 *  1. Reactive — `onAuthStateChange` fires with no session (SIGNED_OUT or
 *     a failed TOKEN_REFRESHED).
 *  2. Proactive — every 30s we check `expires_at` and, if within 60s of
 *     expiry, attempt `refreshSession()`. A failure forces redirect.
 */
export function useMerchantSessionWatchdog() {
  const navigate = useNavigate();
  const location = useLocation();
  const firedRef = useRef(false);
  const pathRef = useRef(location.pathname + location.search);

  useEffect(() => {
    pathRef.current = location.pathname + location.search;
  }, [location.pathname, location.search]);

  const onMerchantRoute =
    location.pathname.startsWith("/merchant") &&
    location.pathname !== "/merchant-login" &&
    location.pathname !== "/merchant-manager-login";

  useEffect(() => {
    if (!onMerchantRoute) {
      firedRef.current = false;
      return;
    }

    const triggerExpiry = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      const redirectTarget = pathRef.current.startsWith("/merchant")
        ? pathRef.current
        : "/merchant";
      let isStaff = false;
      try { isStaff = localStorage.getItem("mfs_is_merchant_staff") === "1"; } catch {}
      // Keep the staff flag so the login pages can route the user to the manager portal.
      const loginPath = isStaff ? "/merchant-manager-login" : "/merchant-login";
      toast.error("Your session has expired. Please sign in again.");
      navigate(
        `${loginPath}?redirect=${encodeURIComponent(redirectTarget)}`,
        { replace: true }
      );
    };

    // 1. Reactive listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        triggerExpiry();
        return;
      }
      if (event === "TOKEN_REFRESHED" && !session) {
        triggerExpiry();
      }
    });

    // 2. Proactive poll
    const tick = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          triggerExpiry();
          return;
        }
        const expiresAt = session.expires_at ?? 0;
        const nowS = Math.floor(Date.now() / 1000);
        if (expiresAt - nowS <= REFRESH_LEAD_S) {
          const { error } = await supabase.auth.refreshSession();
          if (error) triggerExpiry();
        }
      } catch {
        triggerExpiry();
      }
    };

    // Run immediately so a stale tab is checked on mount
    void tick();
    const intervalId = window.setInterval(tick, POLL_MS);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [onMerchantRoute, navigate]);
}
