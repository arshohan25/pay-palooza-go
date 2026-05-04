// Verifies the merchant-forgot-pin reuse-vs-rate-limit contract.
//
// Two behaviors are guarded:
//   1. Un-verified callers (no/invalid OTP ticket) hit the 3-per-hour rate limit
//      once 3 open requests already exist for the phone in the last hour.
//   2. The "reuse latest open request" SQL the verified path depends on
//      actually returns the most recent non-resolved row for a phone — so
//      verified callers will reuse instead of inserting + tripping the limit.
//
// We can't mint a real OTP ticket from this test (OTP_TICKET_SECRET /
// SUPABASE_SERVICE_ROLE_KEY are not exposed locally), so the verified path
// is asserted at the data layer using the same query the edge function runs.
// The edge function itself is exercised over HTTP for the rate-limit path.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL =
  Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
// Optional: when present, the test can seed rows directly. When absent, seed-
// dependent tests are skipped cleanly so the suite still passes in CI without
// service-role access.
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

assert(SUPABASE_URL, "SUPABASE_URL missing");
assert(SUPABASE_ANON_KEY, "SUPABASE anon/publishable key missing");

const FN_URL = `${SUPABASE_URL}/functions/v1/merchant-forgot-pin`;

// Generate a fresh, valid-format BD phone per test run so we don't collide
// with real or prior-test data. Format: 01[3-9]XXXXXXXX (11 digits).
function freshPhone(): string {
  const second = 3 + Math.floor(Math.random() * 7); // 3-9
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += Math.floor(Math.random() * 10);
  return `01${second}${suffix}`;
}

async function callForgotPin(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch { /* leave as text */ }
  return { status: res.status, json, text };
}

// --- Test 1: contract sanity — invalid phone is rejected up front ---------

Deno.test("merchant-forgot-pin rejects invalid phone with 400", async () => {
  const { status, json } = await callForgotPin({ phone: "123" });
  assertEquals(status, 400, `expected 400, got ${status}`);
  assertEquals(json?.ok, false);
});

// --- Test 2: un-verified caller hits 429 after 3 open requests in 1 hour --

Deno.test({
  name:
    "un-verified caller is rate-limited (429) once 3 open requests exist within the hour",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const phone = freshPhone();

    try {
      // Seed exactly 3 open requests within the last hour for this phone.
      const seed = Array.from({ length: 3 }).map(() => ({
        phone,
        source: "merchant-login",
        note: "test-seed",
      }));
      const { error: seedErr } = await admin
        .from("merchant_pin_reset_requests")
        .insert(seed);
      assertEquals(seedErr, null, `seed insert failed: ${seedErr?.message}`);

      // Un-verified call (no otp_ticket) must now be rate-limited.
      const { status, json } = await callForgotPin({ phone });
      assertEquals(status, 429, `expected 429, got ${status} ${JSON.stringify(json)}`);
      assertEquals(json?.ok, false);
      assert(
        typeof json?.message === "string" && json.message.length > 0,
        "expected a non-empty rate-limit message",
      );
    } finally {
      await admin
        .from("merchant_pin_reset_requests")
        .delete()
        .eq("phone", phone);
    }
  },
});

// --- Test 3: reuse-lookup query returns the latest open request -----------
// This mirrors the exact query the verified path runs:
//   .from("merchant_pin_reset_requests")
//   .select("id")
//   .eq("phone", phone)
//   .neq("status", "resolved")
//   .order("created_at", { ascending: false })
//   .limit(1)
//   .maybeSingle()
//
// If this returns the newest open row, the edge function will reuse it and
// short-circuit before hitting the 3-per-hour rate-limit branch — which is
// exactly the regression we want to lock in.

Deno.test({
  name:
    "verified-path reuse query returns the most recent non-resolved request",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const phone = freshPhone();

    try {
      // Insert: oldest=resolved, middle=open, newest=open. Verified caller
      // must reuse the newest open row.
      const { data: oldest } = await admin
        .from("merchant_pin_reset_requests")
        .insert({ phone, source: "merchant-login", status: "resolved" })
        .select("id")
        .single();
      // Force ordering by spacing inserts.
      await new Promise((r) => setTimeout(r, 50));
      const { data: middle } = await admin
        .from("merchant_pin_reset_requests")
        .insert({ phone, source: "merchant-login" })
        .select("id")
        .single();
      await new Promise((r) => setTimeout(r, 50));
      const { data: newest } = await admin
        .from("merchant_pin_reset_requests")
        .insert({ phone, source: "merchant-login" })
        .select("id")
        .single();

      assert(oldest?.id && middle?.id && newest?.id, "seed inserts failed");

      const { data: picked, error } = await admin
        .from("merchant_pin_reset_requests")
        .select("id")
        .eq("phone", phone)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      assertEquals(error, null, `reuse query errored: ${error?.message}`);
      assertEquals(
        picked?.id,
        newest!.id,
        "reuse query must return the newest non-resolved row, not the resolved one or an older open row",
      );

      // Also: when ALL rows are resolved, the reuse query returns null —
      // the function would then fall through to insert (and rate-limit may apply).
      await admin
        .from("merchant_pin_reset_requests")
        .update({ status: "resolved" })
        .eq("phone", phone);

      const { data: pickedAfter } = await admin
        .from("merchant_pin_reset_requests")
        .select("id")
        .eq("phone", phone)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      assertEquals(
        pickedAfter,
        null,
        "with no open rows, reuse query must return null so a fresh insert can happen",
      );
    } finally {
      await admin
        .from("merchant_pin_reset_requests")
        .delete()
        .eq("phone", phone);
    }
  },
});

// --- Test 4: invalid OTP ticket falls back to un-verified path -------------
// Without the real signing secret we can't forge a valid ticket, but we CAN
// confirm that a syntactically-shaped-but-invalid ticket does NOT bypass
// rate-limiting — i.e. the verifier rejects it and we land in the un-verified
// branch. Combined with Test 2, this guards the security contract:
// "only valid tickets bypass the rate limit."

Deno.test({
  name: "invalid OTP ticket does not bypass the rate limit",
  ignore: !SERVICE_ROLE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const phone = freshPhone();

    try {
      const seed = Array.from({ length: 3 }).map(() => ({
        phone,
        source: "merchant-login",
        note: "test-seed-invalid-ticket",
      }));
      await admin.from("merchant_pin_reset_requests").insert(seed);

      // Forged ticket: well-formed "<b64>.<sig>" but signature won't match.
      const forged =
        btoa(JSON.stringify({
          phone,
          purpose: "merchant_pin_reset",
          exp: Math.floor(Date.now() / 1000) + 600,
          jti: "forged",
          portal: "merchant_pin_reset",
        }))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") +
        ".not-a-real-signature";

      const { status, json } = await callForgotPin({
        phone,
        otp_ticket: forged,
      });
      assertEquals(
        status,
        429,
        `forged ticket must NOT bypass rate limit; got ${status} ${JSON.stringify(json)}`,
      );
    } finally {
      await admin
        .from("merchant_pin_reset_requests")
        .delete()
        .eq("phone", phone);
    }
  },
});
