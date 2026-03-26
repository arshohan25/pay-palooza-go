import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMerchantApplyAccess() {
  const [canApply, setCanApply] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setCanApply(false); setLoading(false); return; }

      const { data, error } = await supabase.rpc("check_merchant_apply_access", {
        p_user_id: session.user.id,
      });

      if (error || !data) {
        setCanApply(false);
      } else {
        setCanApply((data as any).can_apply === true);
      }
      setLoading(false);
    };

    check();
  }, []);

  return { canApply, loading };
}
