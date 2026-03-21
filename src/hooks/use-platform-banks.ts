import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformBank {
  id: string;
  name: string;
  short_code: string;
  is_active: boolean;
  sort_order: number;
}

export function usePlatformBanks(includeInactive = false) {
  const [banks, setBanks] = useState<PlatformBank[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBanks = async () => {
    setLoading(true);
    let query = supabase.from("platform_banks").select("*").order("sort_order");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    const { data } = await query;
    setBanks((data as PlatformBank[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchBanks(); }, [includeInactive]);

  return { banks, loading, refetch: fetchBanks };
}
