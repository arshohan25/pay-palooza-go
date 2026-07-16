import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a Bangladesh district name (as picked in the unified 4-level
 * Division→District→Upazila→Union picker) to its 2-letter wallet route code
 * (RR), which the wallet-ID generator embeds in agent/merchant wallet IDs.
 *
 * Falls back to `null` when the district is unknown so callers can either
 * default (e.g. "DH") or block submission.
 */
type Row = { code: string; district: string; division: string };

let cache: Row[] | null = null;
let inflight: Promise<Row[]> | null = null;

async function loadAll(): Promise<Row[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await (supabase as any)
      .from("wallet_route_codes")
      .select("code, district, division")
      .eq("is_active", true);
    cache = (data as Row[]) ?? [];
    return cache;
  })();
  return inflight;
}

/** Case-insensitive district name → 2-letter code lookup. */
export async function districtToRouteCode(
  district: string | null | undefined,
): Promise<string | null> {
  if (!district) return null;
  const rows = await loadAll();
  const needle = district.trim().toLowerCase();
  const match = rows.find((r) => r.district.toLowerCase() === needle);
  return match?.code ?? null;
}

/** Synchronous variant that uses the already-primed cache; returns null on miss. */
export function districtToRouteCodeSync(
  district: string | null | undefined,
): string | null {
  if (!district || !cache) return null;
  const needle = district.trim().toLowerCase();
  const match = cache.find((r) => r.district.toLowerCase() === needle);
  return match?.code ?? null;
}

/** Test-only: prime the module cache without hitting the network. */
export function __primeDistrictRouteCache(rows: Row[]) {
  cache = rows;
}
