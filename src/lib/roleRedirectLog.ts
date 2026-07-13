import { supabase } from "@/integrations/supabase/client";
import type { AppRoleKey } from "@/lib/appRole";

export type RedirectReason =
  | "no_bound_role_standalone"
  | "out_of_scope"
  | "role_mismatch"
  | "unauthenticated";

interface LogArgs {
  attemptedAppRole: AppRoleKey;
  path: string;
  reason: RedirectReason;
  isAuthenticated: boolean;
  userId?: string | null;
  userRoles: string[];
}

// Prevent duplicate rows for the same (role, path, reason) within a session
// — the enforcer effect fires on every render.
const recent = new Set<string>();

/**
 * Best-effort logger for unauthorized role-app redirect attempts.
 * Also mirrors to the console so devs see it without opening the DB.
 */
export function logRoleRedirect(args: LogArgs) {
  const key = `${args.attemptedAppRole}|${args.path}|${args.reason}|${args.userId ?? ""}`;
  if (recent.has(key)) return;
  recent.add(key);

  // Cap in-memory dedupe set.
  if (recent.size > 200) recent.clear();

  const payload = {
    user_id: args.userId ?? null,
    attempted_app_role: args.attemptedAppRole,
    user_roles: args.userRoles,
    path: args.path,
    reason: args.reason,
    is_authenticated: args.isAuthenticated,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };

  // eslint-disable-next-line no-console
  console.warn("[role-redirect]", payload);

  // Fire and forget — a logging failure must never block navigation.
  void supabase
    .from("role_redirect_logs")
    .insert(payload)
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.debug("[role-redirect] insert failed:", error.message);
      }
    });
}
