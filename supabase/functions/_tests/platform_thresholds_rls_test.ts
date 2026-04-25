// Verifies non-admin users are blocked from reading or modifying
// platform_thresholds at the database/API layer (RLS enforcement).
// Uses a pre-seeded confirmed non-admin user (see migration that creates
// `rls-test-nonadmin@easypay.app`).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const TEST_EMAIL = "rls-test-nonadmin@easypay.app";
const TEST_PASSWORD = "RlsTestPass!2026";

assert(SUPABASE_URL, "SUPABASE_URL missing");
assert(SUPABASE_ANON_KEY, "SUPABASE anon/publishable key missing");

// --- Helpers ---------------------------------------------------------------

async function signInNonAdmin() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Test fixture sign-in failed: ${error.message}`);
  assert(data.session, "expected a session");
  return { client, accessToken: data.session.access_token, userId: data.session.user.id };
}

async function rawFetch(path: string, init: RequestInit, token?: string) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  return { status: res.status, body: text };
}

// --- Tests -----------------------------------------------------------------

Deno.test("anonymous request to thresholds REST endpoint returns no rows", async () => {
  const { status, body } = await rawFetch(
    "/rest/v1/platform_thresholds?select=*",
    { method: "GET" },
  );
  assertEquals(status, 200);
  assertEquals(JSON.parse(body).length, 0, "anon must see zero rows");
});

Deno.test("anonymous INSERT into thresholds is rejected", async () => {
  const { status, body } = await rawFetch(
    "/rest/v1/platform_thresholds",
    {
      method: "POST",
      body: JSON.stringify({ key: `anon-${crypto.randomUUID().slice(0, 6)}`, value: 1, label: "x" }),
    },
  );
  // PostgREST returns 401/403 for RLS-blocked anon writes
  assert(status === 401 || status === 403 || status === 400,
    `expected 4xx, got ${status} ${body}`);
});

Deno.test("non-admin SELECT on platform_thresholds returns no rows (RLS)", async () => {
  const { client } = await signInNonAdmin();
  const { data, error } = await client
    .from("platform_thresholds" as any)
    .select("*");

  assertEquals(error, null, `unexpected error: ${error?.message}`);
  assertEquals((data ?? []).length, 0, "non-admin must not see any threshold rows");
});

Deno.test("non-admin UPDATE on platform_thresholds is silently blocked", async () => {
  const { client } = await signInNonAdmin();
  const { data, error } = await client
    .from("platform_thresholds" as any)
    .update({ value: 9999 })
    .eq("key", "merchant_low_stock_units")
    .select();

  assertEquals(error, null);
  assertEquals((data ?? []).length, 0, "non-admin update must affect zero rows");
});

Deno.test("non-admin INSERT on platform_thresholds is rejected", async () => {
  const { client } = await signInNonAdmin();
  const { error } = await client.from("platform_thresholds" as any).insert({
    key: `evil-${crypto.randomUUID().slice(0, 8)}`,
    value: 1,
    label: "evil",
  });
  assert(error, "expected RLS error on non-admin INSERT");
  assert(
    error!.code === "42501" || /row-level security|permission/i.test(error!.message),
    `unexpected error: ${error!.code} ${error!.message}`,
  );
});

Deno.test("non-admin DELETE on platform_thresholds is silently blocked", async () => {
  const { client } = await signInNonAdmin();
  const { data, error } = await client
    .from("platform_thresholds" as any)
    .delete()
    .eq("key", "merchant_low_stock_units")
    .select();

  assertEquals(error, null);
  assertEquals((data ?? []).length, 0, "non-admin delete must affect zero rows");
});

// Verify the protective edge function (push-notification log writes happen
// via service role; prove it's reachable but non-admin can't list logs either).
Deno.test("non-admin cannot read push_delivery_logs (RLS)", async () => {
  const { client } = await signInNonAdmin();
  const { data, error } = await client
    .from("push_delivery_logs" as any)
    .select("*");
  assertEquals(error, null);
  assertEquals((data ?? []).length, 0, "non-admin must not read push logs");
});
