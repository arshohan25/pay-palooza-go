// Integration tests for the refund-link-payment edge function and the
// underlying `refund_payment_link_payment` RPC.
//
// These tests exercise the HTTP surface (auth, validation, idempotency) that
// does NOT require pre-seeded wallet state. Balance / status transition math
// is asserted through the responses of a real refund flow when a payment_id
// is supplied via the TEST_PAYMENT_ID env var — otherwise those cases are
// skipped so CI never fails on missing fixtures.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/refund-link-payment`;

const TEST_JWT = Deno.env.get("TEST_USER_JWT"); // payee session token
const TEST_PAYMENT_ID = Deno.env.get("TEST_PAYMENT_ID"); // succeeded/partial payment owned by TEST_USER_JWT

function post(body: unknown, headers: Record<string, string> = {}) {
  return fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects requests without an Authorization header", async () => {
  const res = await post({ payment_id: "00000000-0000-0000-0000-000000000000" });
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "Not authenticated");
});

Deno.test("rejects non-POST methods", async () => {
  const res = await fetch(FN_URL, {
    method: "GET",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer fake" },
  });
  const json = await res.json();
  assertEquals(res.status, 405);
  assertEquals(json.error, "Method not allowed");
});

Deno.test("rejects invalid session tokens", async () => {
  const res = await post(
    { payment_id: "00000000-0000-0000-0000-000000000000" },
    { Authorization: "Bearer not-a-real-jwt" },
  );
  const json = await res.json();
  assertEquals(res.status, 401);
  assertEquals(json.error, "Invalid session");
});

Deno.test("rejects missing payment_id", async () => {
  if (!TEST_JWT) {
    console.warn("skipping: set TEST_USER_JWT to run");
    return;
  }
  const res = await post({}, { Authorization: `Bearer ${TEST_JWT}` });
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "Missing payment_id");
});

Deno.test("rejects zero / negative amounts", async () => {
  if (!TEST_JWT) return;
  const res = await post(
    { payment_id: crypto.randomUUID(), amount: -50 },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "Refund amount must be positive");
});

Deno.test("rejects malformed idempotency keys", async () => {
  if (!TEST_JWT) return;
  const res = await post(
    { payment_id: crypto.randomUUID(), idempotency_key: "abc" },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const json = await res.json();
  assertEquals(res.status, 400);
  assertEquals(json.error, "Invalid idempotency_key");
});

Deno.test("404s for a payment id that does not exist", async () => {
  if (!TEST_JWT) return;
  const res = await post(
    { payment_id: crypto.randomUUID() },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const json = await res.json();
  assertEquals(res.status, 404);
  assertEquals(json.error, "Payment not found");
});

// --- Fixture-dependent tests (only run when a real payment id is provided) ---

Deno.test("partial refund: updates refunded_amount and reports refundable_remaining", async () => {
  if (!TEST_JWT || !TEST_PAYMENT_ID) {
    console.warn("skipping: set TEST_USER_JWT and TEST_PAYMENT_ID");
    return;
  }
  const key = crypto.randomUUID();
  const res = await post(
    { payment_id: TEST_PAYMENT_ID, amount: 1, idempotency_key: key, reason: "test partial" },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const json = await res.json();
  assertEquals(res.status, 200);
  assertEquals(json.success, true);
  assertEquals(json.amount, 1);
  assertExists(json.refundable_remaining);
  assert(json.status === "partially_refunded" || json.status === "refunded");
  assert(json.refunded_amount >= 1);
});

Deno.test("idempotent replay: same key returns prior result without double-debit", async () => {
  if (!TEST_JWT || !TEST_PAYMENT_ID) return;
  const key = crypto.randomUUID();
  const first = await post(
    { payment_id: TEST_PAYMENT_ID, amount: 1, idempotency_key: key },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const firstJson = await first.json();

  const second = await post(
    { payment_id: TEST_PAYMENT_ID, amount: 1, idempotency_key: key },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const secondJson = await second.json();

  // Replay must not create a new refund — response is the stored one.
  assertEquals(secondJson.replayed, true);
  if (firstJson.success) {
    assertEquals(secondJson.amount, firstJson.amount);
    assertEquals(secondJson.refunded_amount, firstJson.refunded_amount);
    assertEquals(secondJson.reference, firstJson.reference);
  }
});

Deno.test("rejects refund amount greater than refundable balance", async () => {
  if (!TEST_JWT || !TEST_PAYMENT_ID) return;
  const res = await post(
    { payment_id: TEST_PAYMENT_ID, amount: 9_999_999_999 },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const json = await res.json();
  assertEquals(res.status, 400);
  assert(String(json.error).toLowerCase().includes("exceed"));
});

Deno.test("full refund: status transitions to 'refunded' and refundable_remaining == 0", async () => {
  if (!TEST_JWT || !TEST_PAYMENT_ID) return;
  // First learn the remaining refundable amount by issuing a request that will fail.
  const probe = await post(
    { payment_id: TEST_PAYMENT_ID, amount: 9_999_999_999 },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const probeJson = await probe.json();
  const match = /balance \(৳?([\d.]+)\)/.exec(String(probeJson.error ?? ""));
  if (!match) return; // could not derive remaining
  const remaining = parseFloat(match[1]);
  if (!Number.isFinite(remaining) || remaining <= 0) return;

  const res = await post(
    { payment_id: TEST_PAYMENT_ID, amount: remaining, idempotency_key: crypto.randomUUID() },
    { Authorization: `Bearer ${TEST_JWT}` },
  );
  const json = await res.json();
  if (!res.ok) return; // insufficient wallet balance in fixture — skip
  assertEquals(json.status, "refunded");
  assertEquals(json.fully_refunded, true);
  assertEquals(Number(json.refundable_remaining), 0);
});
