import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BankAudience = "customer" | "agent" | "merchant";

export interface PlatformBank {
  id: string;
  name: string;
  short_code: string;
  is_active: boolean;
  sort_order: number;
  logo_url: string | null;
  is_default?: boolean;
  show_for_customer?: boolean;
  show_for_agent?: boolean;
  show_for_merchant?: boolean;
}

/**
 * `liveUpdateKey` increments every time realtime (or the dev-only
 * `__banks:refetch` window event used by the realtime smoke test) triggers
 * a refetch. It does NOT bump on the initial load, so consumers can safely
 * use it to flash a "list updated" indicator only on genuine live changes.
 *
 * `audience` filters to banks the admin has enabled for that picker
 * (customer / agent / merchant). Admin views omit it to see everything.
 */
export function usePlatformBanks(includeInactive = false, audience?: BankAudience) {
  const [banks, setBanks] = useState<PlatformBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdateKey, setLiveUpdateKey] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const isInitial = useRef(true);

  const fetchBanks = async (opts: { live?: boolean } = {}) => {
    setLoading(true);
    let query = supabase.from("platform_banks").select("*").order("sort_order");
    if (!includeInactive) {
      query = query.eq("is_active", true);
    }
    if (audience === "customer") query = query.eq("show_for_customer", true);
    else if (audience === "agent") query = query.eq("show_for_agent", true);
    else if (audience === "merchant") query = query.eq("show_for_merchant", true);
    const { data } = await query;
    setBanks((data as PlatformBank[]) ?? []);
    setLastSyncedAt(Date.now());
    setLoading(false);
    if (opts.live && !isInitial.current) {
      setLiveUpdateKey(k => k + 1);
    }
    isInitial.current = false;
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
          fetchBanks({ live: true });
        },
      )
      .subscribe();

    // Dev/smoke-test hook: dispatch `window.dispatchEvent(new Event('__banks:refetch'))`
    // to simulate a realtime change without touching the database. Used by
    // `e2e/bank-realtime-smoke.spec.ts`.
    const onDevRefetch = () => fetchBanks({ live: true });
    if (typeof window !== "undefined") {
      window.addEventListener("__banks:refetch", onDevRefetch);
    }

    return () => {
      supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("__banks:refetch", onDevRefetch);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive, audience]);

  return { banks, loading, refetch: fetchBanks, liveUpdateKey, lastSyncedAt };
}
