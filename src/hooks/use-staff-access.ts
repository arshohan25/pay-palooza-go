import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StaffAccess {
  merchantId: string;
  merchantName: string;
  staffRole: string;
}

export function useStaffAccess() {
  const [access, setAccess] = useState<StaffAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setAccess(null);
        setLoading(false);
        return;
      }

      const { data } = await supabase.rpc("get_staff_merchant_access", {
        p_user_id: session.user.id,
      });

      if (data && Array.isArray(data) && data.length > 0) {
        const row = data[0];
        setAccess({
          merchantId: row.merchant_id,
          merchantName: row.business_name,
          staffRole: row.staff_role,
        });
      } else {
        setAccess(null);
      }
      setLoading(false);
    };

    fetch();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetch();
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    merchantId: access?.merchantId ?? null,
    merchantName: access?.merchantName ?? null,
    staffRole: access?.staffRole ?? null,
    isStaff: !!access,
    loading,
  };
}
