import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/use-user-roles";

export function useMerchantApplyAccess() {
  const { roles, loading: rolesLoading } = useUserRoles();
  const [canApply, setCanApply] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (rolesLoading) return;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setCanApply(false); setLoading(false); return; }

      // Already a merchant
      if (roles.includes("merchant")) { setCanApply(false); setLoading(false); return; }

      const { data: config } = await (supabase as any)
        .from("merchant_apply_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (!config) { setCanApply(true); setLoading(false); return; }

      const userId = session.user.id;

      // Blocked users always blocked
      if ((config.blocked_user_ids || []).includes(userId)) {
        setCanApply(false);
        setLoading(false);
        return;
      }

      if (config.mode === "all") {
        setCanApply(true);
      } else if (config.mode === "none") {
        setCanApply(false);
      } else if (config.mode === "targeted") {
        // Whitelisted users always pass
        if ((config.allowed_user_ids || []).includes(userId)) {
          setCanApply(true);
          setLoading(false);
          return;
        }

        let passes = false;
        const hasRoleFilter = (config.allowed_roles || []).length > 0;
        const hasAreaFilter = (config.allowed_areas || []).length > 0;

        // If no filters set, nobody passes (must configure at least one)
        if (!hasRoleFilter && !hasAreaFilter) {
          setCanApply(false);
          setLoading(false);
          return;
        }

        // Role check — users with no explicit roles are treated as "customer"
        if (hasRoleFilter) {
          const effectiveRoles = roles.length > 0 ? roles : ["customer"];
          const allowedRoles = config.allowed_roles as string[];
          const roleMatch = effectiveRoles.some((r: string) =>
            allowedRoles.includes(r) || (r === "customer" && allowedRoles.includes("user"))
          );
          if (roleMatch) passes = true;
        }

        // Area check - check agent territory_code
        if (hasAreaFilter && !passes) {
          const { data: agent } = await supabase.from("agents").select("territory_code").eq("user_id", userId).maybeSingle();
          if (agent?.territory_code && (config.allowed_areas as string[]).includes(agent.territory_code)) {
            passes = true;
          }
          // Also check distributor territory
          if (!passes) {
            const { data: dist } = await supabase.from("distributors").select("territory").eq("user_id", userId).maybeSingle();
            if (dist?.territory && (dist.territory as string[]).some((t: string) => (config.allowed_areas as string[]).includes(t))) {
              passes = true;
            }
          }
        }

        setCanApply(passes);
      }

      setLoading(false);
    };

    check();
  }, [roles, rolesLoading]);

  return { canApply, loading };
}
