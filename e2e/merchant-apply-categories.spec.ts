import { test, expect, request } from "@playwright/test";

/**
 * Verifies the RLS fix for public.merchant_categories:
 * anon role must be able to SELECT active categories so the merchant apply
 * form's category dropdown can populate for signed-out / new applicants.
 *
 * We hit the same PostgREST endpoint the app uses via the anon key. If RLS
 * regresses (or the GRANT is dropped) this returns 401/permission-denied
 * and the test fails — which mirrors the empty dropdown users would see.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://lmgsxyzytssddijjxbzc.supabase.co";
const ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3N4eXp5dHNzZGRpamp4YnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTk2MTIsImV4cCI6MjA4NzA5NTYxMn0.E-IM5AMLYeN2DE64NoduoQXVG8DL57T43vjpZ21Ft74";

test.describe("Merchant apply — category dropdown data source", () => {
  test("anon can list active merchant_categories via PostgREST", async () => {
    const ctx = await request.newContext({
      extraHTTPHeaders: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    const res = await ctx.get(
      `${SUPABASE_URL}/rest/v1/merchant_categories?select=name,label,is_active,sort_order&is_active=eq.true&order=sort_order.asc`,
    );
    expect(res.status(), await res.text()).toBe(200);
    const rows = (await res.json()) as Array<{ name: string; label: string; is_active: boolean }>;

    // Should have a healthy roster of categories after the seed.
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(rows.every((r) => r.is_active)).toBe(true);

    // Every row must have a non-empty label so the dropdown never shows blanks.
    expect(rows.every((r) => typeof r.label === "string" && r.label.trim().length > 0)).toBe(true);

    // A couple of well-known categories should be present.
    const names = new Set(rows.map((r) => r.name));
    expect(names.has("retail")).toBe(true);
  });

  test("categories dropdown renders options on the apply form", async ({ page }) => {
    // The /merchant/apply route redirects unauthenticated users to
    // /merchant-login?apply=1, so we open the flow via the merchant login
    // route which mounts <MerchantApplicationFlow open />. This exercises
    // the exact hook path (useMerchantCategories -> supabase.from(...)).
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/merchant-login?apply=1", { waitUntil: "domcontentloaded" });

    // Open the category combobox — the trigger sits under the "Category" label.
    const categoryTrigger = page.getByRole("combobox").first();
    await expect(categoryTrigger).toBeVisible({ timeout: 10_000 });
    await categoryTrigger.click();

    // At least a few options + the "Other" fallback must be rendered.
    const options = page.getByRole("option");
    await expect.poll(async () => options.count(), { timeout: 8_000 }).toBeGreaterThanOrEqual(5);

    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
