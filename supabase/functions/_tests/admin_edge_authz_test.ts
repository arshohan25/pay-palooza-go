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

function assertStandardErrorBody(body: string, expectedCode: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`response body is not JSON: ${body}`);
  }
  const err = (parsed as { error?: { code?: string; message?: string } }).error;
  assert(
    err && typeof err === "object",
    `expected { error: { code, message } }, got ${body}`,
  );
  assertEquals(err!.code, expectedCode, `unexpected error.code in ${body}`);
  assert(
    typeof err!.message === "string" && err!.message.length > 0,
    `expected non-empty error.message, got ${body}`,
  );
}

for (const fn of ADMIN_GATED_FUNCTIONS) {
  Deno.test(`anonymous call to ${fn.name} returns 401 with standardized body`, async () => {
    const { status, body } = await callFn(fn);
    assertEquals(status, 401, `expected 401, got ${status} ${body}`);
    assertStandardErrorBody(body, "UNAUTHORIZED");
  });

  Deno.test(`non-admin call to ${fn.name} returns 403 with standardized body`, async () => {
    const token = await signInNonAdmin();
    const { status, body } = await callFn(fn, token);
    assertEquals(
      status,
      403,
      `expected 403 Forbidden for non-admin, got ${status} ${body}`,
    );
    assertStandardErrorBody(body, "FORBIDDEN_ADMIN_REQUIRED");
  });
}

// Guard: ensure no Edge Function silently introduces threshold-related
// access (direct table I/O, indirect helpers, or audit/log writes into
// threshold tables) without being added to the admin-authz coverage above.
//
// Threshold surface area covered:
//   - Tables: platform_thresholds, transaction_limits,
//     user_limit_overrides, transfer_rate_limits
//   - Helper RPC: get_threshold(...)  (also matches supabase.rpc("get_threshold", ...))
//   - Any write path (insert/update/upsert/delete) into the tables above,
//     including audit/log inserts that target a threshold table by name.
const THRESHOLD_TABLES = [
  "platform_thresholds",
  "transaction_limits",
  "user_limit_overrides",
  "transfer_rate_limits",
] as const;

// Edge functions that legitimately reference a threshold table only to
// cascade-delete a single user's own rows during account deletion / purge.
// These are NOT admin-config flows and intentionally do not return 401/403,
// so they must be explicitly allowlisted (not added to ADMIN_GATED_FUNCTIONS).
// Each entry must justify why the access is safe.
const USER_SCOPED_CASCADE_ALLOWLIST: Record<string, string> = {
  "delete-user":
    "Deletes the requesting user's own rows in transfer_rate_limits as part of GDPR-style account deletion.",
  "auto-purge-deactivated":
    "Service-role scheduled job that purges rate-limit rows for already-deactivated users.",
};

type Hit = { kind: string; match: string };

function scanThresholdSurface(source: string): Hit[] {
  const hits: Hit[] = [];

  // 1. Direct table name references (SQL-style or string literal in .from()).
  for (const table of THRESHOLD_TABLES) {
    const tableRe = new RegExp(`\\b${table}\\b`);
    if (tableRe.test(source)) hits.push({ kind: "table-ref", match: table });

    // 2. Write paths: .from("<table>")...(insert|update|upsert|delete)
    //    Catches log/audit writes into threshold tables specifically.
    const writeRe = new RegExp(
      `\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)[\\s\\S]{0,200}?\\.(insert|update|upsert|delete)\\s*\\(`,
    );
    const writeMatch = source.match(writeRe);
    if (writeMatch) {
      hits.push({ kind: `table-write:${writeMatch[1]}`, match: table });
    }
  }

  // 3. Indirect helper: get_threshold(...) — both SQL call sites and
  //    supabase.rpc("get_threshold", ...) invocations.
  if (/\bget_threshold\s*\(/.test(source)) {
    hits.push({ kind: "helper-call", match: "get_threshold(" });
  }
  if (/\.rpc\(\s*["'`]get_threshold["'`]/.test(source)) {
    hits.push({ kind: "rpc-call", match: 'rpc("get_threshold")' });
  }

  return hits;
}

Deno.test("no edge function touches threshold surface outside admin-authz coverage", async () => {
  const fnDir = new URL("../", import.meta.url).pathname;
  const offenders: Array<{ name: string; hits: Hit[] }> = [];

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

    const hits = scanThresholdSurface(source);
    if (hits.length === 0) continue;

    const covered = ADMIN_GATED_FUNCTIONS.some((f) => f.name === entry.name);
    if (!covered) offenders.push({ name: entry.name, hits });
  }

  if (offenders.length > 0) {
    const detail = offenders
      .map((o) =>
        `  - ${o.name}: ${o.hits.map((h) => `${h.kind}=${h.match}`).join(", ")}`,
      )
      .join("\n");
    throw new Error(
      `Edge functions touching threshold tables/helpers must be added to ` +
        `ADMIN_GATED_FUNCTIONS and verified to enforce 401/403:\n${detail}`,
    );
  }

  assertEquals(offenders.length, 0);
});
