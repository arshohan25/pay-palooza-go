// Verifies that admin-gated Edge Functions consistently reject anonymous and
// non-admin callers with 401/403. Also acts as a guard test: if any Edge
// Function ever begins reading or writing `platform_thresholds`, it must be
// added to the explicit admin-authz coverage list below.
//
// Uses the pre-seeded confirmed non-admin user
// (`rls-test-nonadmin@easypay.app`) created by the RLS test fixture migration.
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

// Admin-only Edge Functions whose behavior governs platform configuration
// (thresholds, gateway config, API status). All must reject non-admins
// with the same 401/403 contract.
const ADMIN_GATED_FUNCTIONS: Array<{
  name: string;
  method: "GET" | "POST";
  body?: unknown;
}> = [
  { name: "check-api-status", method: "GET" },
  { name: "manage-gateway-config", method: "POST", body: { action: "list" } },
];

async function signInNonAdmin(): Promise<string> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Test fixture sign-in failed: ${error.message}`);
  assert(data.session, "expected a session");
  return data.session.access_token;
}

async function callFn(
  fn: { name: string; method: "GET" | "POST"; body?: unknown },
  token?: string,
) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn.name}`, {
    method: fn.method,
    headers,
    body: fn.method === "POST" ? JSON.stringify(fn.body ?? {}) : undefined,
  });
  const body = await res.text();
  return { status: res.status, body };
}

// --- Tests ---------------------------------------------------------------

for (const fn of ADMIN_GATED_FUNCTIONS) {
  Deno.test(`anonymous call to ${fn.name} is rejected (401)`, async () => {
    const { status, body } = await callFn(fn);
    assert(
      status === 401 || status === 403,
      `expected 401/403, got ${status} ${body}`,
    );
  });

  Deno.test(`non-admin call to ${fn.name} is rejected (403)`, async () => {
    const token = await signInNonAdmin();
    const { status, body } = await callFn(fn, token);
    assertEquals(
      status,
      403,
      `expected 403 Forbidden for non-admin, got ${status} ${body}`,
    );
    assert(
      /forbidden|admin/i.test(body),
      `expected admin-required error message, got ${body}`,
    );
  });
}

// Guard: ensure no Edge Function silently introduces platform_thresholds
// access without being added to the admin-authz coverage above.
Deno.test("no edge function reads/writes platform_thresholds outside coverage", async () => {
  const fnDir = new URL("../", import.meta.url).pathname;
  const offenders: string[] = [];

  for await (const entry of Deno.readDir(fnDir)) {
    if (!entry.isDirectory) continue;
    if (entry.name === "_tests") continue;

    const indexPath = `${fnDir}${entry.name}/index.ts`;
    let source: string;
    try {
      source = await Deno.readTextFile(indexPath);
    } catch {
      continue;
    }

    if (/platform_thresholds|get_threshold\s*\(/.test(source)) {
      const covered = ADMIN_GATED_FUNCTIONS.some((f) => f.name === entry.name);
      if (!covered) offenders.push(entry.name);
    }
  }

  assertEquals(
    offenders,
    [],
    `Edge functions touching platform_thresholds must be added to ADMIN_GATED_FUNCTIONS: ${offenders.join(", ")}`,
  );
});
