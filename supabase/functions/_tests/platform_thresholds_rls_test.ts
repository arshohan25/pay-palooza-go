// Verifies non-admin users are blocked from reading or modifying
// platform_thresholds at the database/API layer (RLS enforcement).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

assert(SUPABASE_URL, "VITE_SUPABASE_URL missing");
assert(SUPABASE_ANON_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY missing");

// --- Helpers ---------------------------------------------------------------

async function signInTempUser() {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const stamp = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `test-nonadmin-${stamp}@easypay.app`;
  const password = `Test!${crypto.randomUUID()}`;

  const { data: signUp, error: signUpErr } = await anon.auth.signUp({
    email,
    password,
  });
  if (signUpErr) throw signUpErr;

  // If email confirmation is required we still get a JWT for sign-in via password
  let session = signUp.session;
  if (!session) {
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
  }
  assert(session, "Could not establish a non-admin session");
  return { client: anon, userId: session.user.id, accessToken: session.access_token };
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

Deno.test("non-admin SELECT on platform_thresholds returns no rows (RLS)", async () => {
  const { client } = await signInTempUser();
  const { data, error } = await client
    .from("platform_thresholds" as any)
    .select("*");

  // RLS-blocked SELECT returns empty list, not an error
  assertEquals(error, null, `unexpected error: ${error?.message}`);
  assertEquals(
    (data ?? []).length,
    0,
    "non-admin must not see any threshold rows",
  );
});

Deno.test("non-admin UPDATE on platform_thresholds is silently blocked", async () => {
  const { client } = await signInTempUser();
  const { data, error } = await client
    .from("platform_thresholds" as any)
    .update({ value: 9999 })
    .eq("key", "merchant_low_stock_units")
    .select();

  assertEquals(error, null);
  assertEquals(
    (data ?? []).length,
    0,
    "non-admin update must affect zero rows",
  );
});

Deno.test("non-admin INSERT on platform_thresholds is rejected", async () => {
  const { client } = await signInTempUser();
  const { error } = await client.from("platform_thresholds" as any).insert({
    key: `evil-${crypto.randomUUID().slice(0, 8)}`,
    value: 1,
    label: "evil",
  });
  assert(error, "expected RLS error on non-admin INSERT");
  // Postgres RLS violation surfaces as code 42501
  assert(
    error!.code === "42501" ||
      /row-level security|permission/i.test(error!.message),
    `unexpected error: ${error!.code} ${error!.message}`,
  );
});

Deno.test("non-admin DELETE on platform_thresholds is silently blocked", async () => {
  const { client } = await signInTempUser();
  const { data, error } = await client
    .from("platform_thresholds" as any)
    .delete()
    .eq("key", "merchant_low_stock_units")
    .select();

  assertEquals(error, null);
  assertEquals(
    (data ?? []).length,
    0,
    "non-admin delete must affect zero rows",
  );
});

Deno.test("anonymous request to thresholds REST endpoint returns no rows", async () => {
  // Direct PostgREST call without a user JWT (apikey only)
  const { status, body } = await rawFetch(
    "/rest/v1/platform_thresholds?select=*",
    { method: "GET" },
  );
  // PostgREST returns 200 + [] when RLS filters everything out
  assertEquals(status, 200);
  assertEquals(JSON.parse(body).length, 0);
});

Deno.test("admin baseline still reads thresholds (sanity via RLS proof)", async () => {
  // Confirms the table is non-empty in general so the empty result above
  // really is RLS doing its job (not just an empty table).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    console.warn("[skip] SUPABASE_SERVICE_ROLE_KEY not set — cannot prove rows exist");
    return;
  }
  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.from("platform_thresholds" as any).select("key");
  assertEquals(error, null);
  assert((data ?? []).length > 0, "expected seeded threshold rows to exist");
});
