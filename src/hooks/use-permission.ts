import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Live check for a permission via DB `has_permission(uid, key)`.
 * Returns `undefined` while loading, then `true|false`.
 */
export function usePermission(permission: string) {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setAllowed(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc("has_permission" as any, {
        _user_id: user.id,
        _permission: permission,
      });
      if (!cancelled) setAllowed(!!data && !error);
    })();
    return () => { cancelled = true; };
  }, [user?.id, permission]);

  return allowed;
}

export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission" as any, { _user_id: userId, _permission: permission });
  return !!data;
}
