/**
 * Integration test for the verify-otp lockout.
 *
 * Sends 6 failed verifications in a row and asserts that the 6th call returns
 * HTTP 429 with { locked: true, retry_after_minutes }.
 *
 * Uses a random phone per run so parallel test runs don't interfere with each
 * other's rate-limit counters. Loads Supabase URL and anon key from the root
 * .env via Deno dotenv.
 *
 * Run with:
 *   deno test --allow-net --allow-env --allow-read supabase/functions/verify-otp/index.test.ts
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

function randomBdPhone(): string {
  // 01[3-9] followed by 8 digits
  const prefix = "01" + (3 + Math.floor(Math.random() * 7));
  let tail = "";
  for (let i = 0; i < 8; i++) tail += Math.floor(Math.random() * 10);
  return prefix + tail;
}

async function verifyOnce(phone: string, code: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone, code, purpose: "pin_reset" }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

Deno.test(
  "verify-otp: locks with 429 after 5 failed pin_reset attempts",
  async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env",
      );
    }

    const phone = randomBdPhone();

    // Attempts 1..5 should return 200 with verified:false (no lock yet)
    for (let i = 1; i <= 5; i++) {
      const { status, body } = await verifyOnce(phone, "000000");
      assertEquals(status, 200, `attempt #${i} should not lock yet`);
      assertEquals(body.verified, false);
      assert(
        body.locked !== true,
        `attempt #${i} should not report locked yet, got ${JSON.stringify(body)}`,
      );
    }

    // Attempt 6 should be locked out with 429
    const locked = await verifyOnce(phone, "000000");
    assertEquals(locked.status, 429, "6th attempt must return HTTP 429");
    assertEquals(locked.body.verified, false);
    assertEquals(locked.body.locked, true);
    assert(
      typeof locked.body.retry_after_minutes === "number" &&
        locked.body.retry_after_minutes > 0,
      "retry_after_minutes must be a positive number",
    );
    assert(
      typeof locked.body.error === "string" && locked.body.error.length > 0,
      "error message must be present when locked",
    );
  },
);

Deno.test("verify-otp: rejects invalid phone format", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: "abc", code: "123456", purpose: "pin_reset" }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(typeof body.error === "string");
});
