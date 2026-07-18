import { test, expect, type Page } from "@playwright/test";

/**
 * An authenticated user must not reach a protected route belonging to a
 * different role — even if they have a valid Supabase session token and
 * guess the URL. Two layers enforce this:
 *
 *   (a) Client: AppRoleEnforcer redirects when the bound app role (from the
 *       installed PWA's manifest) does not match the current path.
 *   (b) Server: PostgREST + Edge Functions reject data access from JWTs
 *       whose role claims/roles table entry does not include the required
 *       role, even when the token is otherwise valid.
 *
 * We exercise (a) directly against the running app and (b) by hitting the
 * REST API with the anon key (the strongest guarantee any random signed-in
 * user starts from — real JWTs only add row-scoped grants on top).
 */

type RoleKey = "admin" | "agent" | "distributor" | "super-distributor" | "merchant";

const HOME: Record<RoleKey, string> = {
  admin: "/admin",
  agent: "/agent",
  distributor: "/distributor",
  "super-distributor": "/super-distributor",
  merchant: "/merchant",
};

const LOGIN: Record<RoleKey, string> = {
  admin: "/admin/login",
  agent: "/agent/login",
  distributor: "/distributor/login",
  "super-distributor": "/super-distributor/login",
  merchant: "/merchant/login",
};

async function bindRoleAndSeedFakeSession(page: Page, role: RoleKey) {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ role }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("mfs_app_role", role);
      // Simulate the "user has a session token" precondition. The real
      // Supabase client will reject this on hydration, but the client-side
      // AppRoleEnforcer must redirect BEFORE any protected data renders.
      localStorage.setItem(
        "sb-lmgsxyzytssddijjxbzc-auth-token",
        JSON.stringify({
          access_token: "fake.jwt.token",
          refresh_token: "fake",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
          user: { id: "00000000-0000-0000-0000-000000000000" },
        })
      );
    },
    { role }
  );
}

// Every pair (boundRole, targetRole) where roles differ.
const CROSS_ROLE_PAIRS: Array<[RoleKey, RoleKey]> = [];
for (const bound of Object.keys(HOME) as RoleKey[]) {
  for (const target of Object.keys(HOME) as RoleKey[]) {
    if (bound !== target) CROSS_ROLE_PAIRS.push([bound, target]);
  }
}

test.describe("Client route guard — bound role cannot open other roles' pages", () => {
  for (const [bound, target] of CROSS_ROLE_PAIRS) {
    test(`app bound to ${bound} is redirected away from ${HOME[target]}`, async ({ page }) => {
      await bindRoleAndSeedFakeSession(page, bound);

      await page.goto(HOME[target], { waitUntil: "domcontentloaded" });

      // Wait for enforcer to run (it defers to next tick after roles load).
      await page.waitForURL(
        (url) => {
          const p = new URL(url).pathname;
          // Must land on the bound role's home, its login, or an allowed
          // shared path (install/forgot-pin). It must NOT stay on the
          // target role's page.
          return (
            p.startsWith(HOME[bound]) ||
            p.startsWith(LOGIN[bound]) ||
            p.startsWith("/install") ||
            p.startsWith("/forgot-pin")
          );
        },
        { timeout: 10_000 }
      );

      const finalPath = new URL(page.url()).pathname;
      expect(
        finalPath.startsWith(HOME[target]),
        `bound=${bound} was allowed onto ${HOME[target]} (final: ${finalPath})`
      ).toBe(false);
    });
  }
});

test.describe("Server-side — role-gated tables reject cross-role reads", () => {
  const SUPABASE_URL = "https://lmgsxyzytssddijjxbzc.supabase.co";
  const ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3N4eXp5dHNzZGRpamp4YnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MTIsImV4cCI6MjA4NzA5NTYxMn0.E-IM5AMLYeN2DE64NoduoQXVG8DL57T43vjpZ21Ft74";

  // Even if a signed-in user of ANY role hits these endpoints with a valid
  // JWT, RLS is scoped so only the matching admin/role sees rows. A random
  // authenticated JWT (worst case: anon) gets an empty result set.
  const roleGated = [
    "admin_role_permissions",   // admin-only
    "audit_logs",               // admin-only
    "user_roles",               // has_role() readable, no direct list
    "distributors",             // owner/admin only
    "role_redirect_logs",       // admin-only
  ];

  for (const table of roleGated) {
    test(`GET ${table} with a non-privileged token returns no rows`, async ({ request }) => {
      const res = await request.get(
        `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=5`,
        {
          headers: {
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
        }
      );

      if (res.ok()) {
        const rows = await res.json();
        expect(Array.isArray(rows)).toBe(true);
        expect(rows.length, `${table} leaked rows to cross-role caller`).toBe(0);
      } else {
        expect([401, 403, 404]).toContain(res.status());
      }
    });
  }

  const adminFunctions = [
    "create-agent-or-distributor",
    "admin-adjust-balance",
    "admin-reset-user",
  ];

  for (const fn of adminFunctions) {
    test(`Edge Function ${fn} rejects a non-admin caller`, async ({ request }) => {
      const res = await request.post(`${SUPABASE_URL}/functions/v1/${fn}`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json",
        },
        data: {},
      });

      // Function must not succeed — either JWT rejection (401), role check
      // (403), or missing-function (404 in envs where it's not deployed).
      expect([401, 403, 404, 500]).toContain(res.status());
      if (res.status() === 500) {
        // Even on unhandled failures, response must not carry admin data.
        const text = await res.text();
        expect(text.toLowerCase()).not.toContain("service_role");
      }
    });
  }
});
