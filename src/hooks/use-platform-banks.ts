import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformBank {
  id: string;
  name: string;
  short_code: string;
  is_active: boolean;
  sort_order: number;
  logo_url: string | null;
  is_default?: boolean;
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

  useEffect(() => {
    fetchBanks();

    // Realtime: refetch when admins add/remove/reorder/toggle/mark-default a
    // platform bank so every transfer UI stays in sync without a refresh.
    const channel = supabase
      .channel(`platform-banks-${includeInactive ? "all" : "active"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_banks" },
        () => {
          fetchBanks();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  return { banks, loading, refetch: fetchBanks };
}
