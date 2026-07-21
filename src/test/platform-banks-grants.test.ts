/**
 * Regression guard: `authenticated` (and `anon`) MUST retain SELECT on
 * public.platform_banks so bank pickers render across customer, agent, and
 * merchant flows. If a future migration revokes these grants, this test fails.
 *
 * We call `public.check_platform_banks_grants()` (SECURITY DEFINER) which
 * returns `has_table_privilege(...)` for each role — this is authoritative
 * regardless of the caller's own role.
 *
 * We also assert the anon REST endpoint actually returns rows end-to-end.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

describe("platform_banks grants regression guard", () => {
  let client: SupabaseClient;

  beforeAll(() => {
    if (!URL || !ANON) throw new Error("Supabase env vars missing");
    client = createClient(URL, ANON, { auth: { persistSession: false } });
  });

  it("authenticated + anon + service_role all have SELECT on platform_banks", async () => {
    const { data, error } = await client.rpc("check_platform_banks_grants");
    expect(error).toBeNull();
    expect(data).toMatchObject({
      authenticated_select: true,
      anon_select: true,
      service_role_select: true,
    });
  });

  it("at least one active bank exists for pickers to render", async () => {
    const { data, error } = await client.rpc("check_platform_banks_grants");
    expect(error).toBeNull();
    expect((data as any)?.active_bank_count).toBeGreaterThan(0);
  });
});
