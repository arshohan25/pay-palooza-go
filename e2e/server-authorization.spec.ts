import { test, expect } from "@playwright/test";

/**
 * Server-side authorization checks. Even if a curious user guesses backend
 * URLs, the API must reject writes and admin-only reads from anonymous or
 * unauthorized callers. These tests hit the live PostgREST + Edge Function
 * layer directly with only the public anon key.
 */

const SUPABASE_URL = "https://lmgsxyzytssddijjxbzc.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3N4eXp5dHNzZGRpamp4YnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MTIsImV4cCI6MjA4NzA5NTYxMn0.E-IM5AMLYeN2DE64NoduoQXVG8DL57T43vjpZ21Ft74";

const restHeaders = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
};

const restUrl = (path: string) => `${SUPABASE_URL}/rest/v1/${path}`;
const fnUrl = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;

/**
 * Under RLS, anon SELECT on a table with no anon policy returns 200 with an
 * empty array (never row contents). Anon INSERT/UPDATE without a matching
 * policy is rejected with a 401/403 or PostgREST RLS error code.
 */

test.describe("Postgres REST — anonymous callers cannot read admin-only data", () => {
  const adminOnlyTables = [
    "admin_role_permissions",
    "role_redirect_logs",
    "audit_logs",
    "user_roles",
    "distributors",
  ];

  for (const table of adminOnlyTables) {
    test(`anon SELECT on ${table} never leaks rows`, async ({ request }) => {
      const res = await request.get(restUrl(`${table}?select=*&limit=1`), {
        headers: restHeaders,
      });
      // Either RLS blocks with 401/403 or returns an empty array.
      if (res.ok()) {
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body.length, `${table} leaked rows to anon`).toBe(0);
      } else {
        expect([401, 403, 404]).toContain(res.status());
      }
    });
  }
});

test.describe("Postgres REST — anonymous writes to protected tables are rejected", () => {
  const writeAttempts: { table: string; body: Record<string, unknown> }[] = [
    {
      table: "distributors",
      body: {
        role: "distributor",
        business_name: "hax",
        phone: "01700000000",
      },
    },
    {
      table: "user_roles",
      body: { user_id: "00000000-0000-0000-0000-000000000000", role: "admin" },
    },
    {
      table: "admin_role_permissions",
      body: { role: "admin", permission: "*" },
    },
    {
      table: "audit_logs",
      body: { action: "spoof", details: {} },
    },
  ];

  for (const attempt of writeAttempts) {
    test(`anon INSERT into ${attempt.table} is rejected`, async ({ request }) => {
      const res = await request.post(restUrl(attempt.table), {
        headers: restHeaders,
        data: JSON.stringify(attempt.body),
      });
      expect(
        res.ok(),
        `anon INSERT to ${attempt.table} unexpectedly accepted (status ${res.status()})`,
      ).toBe(false);
      expect([400, 401, 403, 404, 409, 422, 500]).toContain(res.status());
    });
  }
});

test.describe("Edge Functions — JWT-protected endpoints reject anon", () => {
  // These functions all require an authenticated Supabase JWT via
  // verify_jwt=true (default). Calling them with only the anon key must fail.
  const protectedFunctions = [
    "create-agent-or-distributor",
    "admin-metrics-snapshot",
    "admin-reset-team-password",
    "create-team-member",
    "issue-agent-temp-pin",
    "issue-merchant-temp-pin",
  ];

  for (const fn of protectedFunctions) {
    test(`${fn}: no JWT → 401`, async ({ request }) => {
      // No apikey and no Authorization header at all.
      const res = await request.post(fnUrl(fn), {
        headers: { "Content-Type": "application/json" },
        data: "{}",
      });
      expect([401, 403]).toContain(res.status());
    });

    test(`${fn}: anon apikey only → still rejected (not admin)`, async ({ request }) => {
      const res = await request.post(fnUrl(fn), {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        data: "{}",
      });
      // Either the function itself refuses (400/401/403) or PostgREST-level
      // JWT check trips. We just require it is NOT a success (2xx) — no admin
      // side-effects on an anonymous caller.
      expect(res.status(), `${fn} accepted an anon caller`).toBeGreaterThanOrEqual(400);
    });
  }
});
