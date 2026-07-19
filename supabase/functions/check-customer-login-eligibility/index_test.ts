// Tests: server-side login guard rejects elevated-role phones before session creation.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/check-customer-login-eligibility`;

async function call(phone: unknown) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ phone }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// Phone → assigned role map (see admin provisioning).
const CASES: Array<{ phone: string; role: string }> = [
  { phone: "01909709954", role: "admin" },
  { phone: "01969572130", role: "super_distributor" },
  { phone: "01912330858", role: "distributor" },
  { phone: "01833596740", role: "agent" },
  { phone: "01859975119", role: "merchant" },
];

for (const c of CASES) {
  Deno.test(`rejects ${c.role} phone ${c.phone} with 403 + portal hint`, async () => {
    const { status, body } = await call(c.phone);
    assertEquals(status, 403, `expected 403 for ${c.role}, got ${status} ${JSON.stringify(body)}`);
    assertEquals(body.allowed, false);
    assertEquals(body.role, c.role);
    if (typeof body.portal !== "string" || !body.portal.startsWith("/")) {
      throw new Error(`missing portal hint for ${c.role}: ${JSON.stringify(body)}`);
    }
  });
}

Deno.test("allows plain customer phone (no elevated role)", async () => {
  const { status, body } = await call("01680693484");
  assertEquals(status, 200);
  assertEquals(body.allowed, true);
});

Deno.test("allows unknown phone (defers to signIn's own error)", async () => {
  const { status, body } = await call("01700000000");
  assertEquals(status, 200);
  assertEquals(body.allowed, true);
});

Deno.test("rejects malformed phone with 400", async () => {
  const { status, body } = await call("not-a-phone");
  assertEquals(status, 400);
  assertEquals(body.ok, false);
});

Deno.test("normalizes +88 prefix", async () => {
  const { status, body } = await call("+8801859975119");
  assertEquals(status, 403);
  assertEquals(body.role, "merchant");
});
