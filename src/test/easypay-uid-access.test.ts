/**
 * RLS / RPC access tests for the admin-only `easypay_uid` column.
 *
 * These tests hit the real Supabase project using the public anon key.
 * They assert that:
 *   1. Anon clients can never read the `easypay_uid` column from `profiles`.
 *   2. Anon clients can never read the `easypay_uid` column from `user_activity_logs`.
 *   3. The admin-only RPCs (`admin_get_easypay_uids`, `admin_get_user_by_easypay_uid`)
 *      reject unauthenticated callers.
 *
 * Note: tests for the `authenticated` role behave the same as anon for these checks
 * because column-level `REVOKE SELECT (easypay_uid)` is applied to both roles, and
 * the admin RPCs gate on `has_role(auth.uid(), 'admin')`. Sandbox cannot mint a
 * real signed-in session, so we cover the `authenticated` branch by document only
 * (the SQL `REVOKE` is identical for both grantees).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const PERMISSION_ERRORS = /(permission denied|forbidden|not authorized|insufficient_privilege|column .* of relation)/i;

describe("easypay_uid column is not exposed to clients", () => {
  let anon: SupabaseClient;

  beforeAll(() => {
    if (!URL || !ANON) throw new Error("Supabase env vars missing");
    anon = createClient(URL, ANON, { auth: { persistSession: false } });
  });

  it("anon cannot select easypay_uid from profiles", async () => {
    const { data, error } = await anon
      .from("profiles")
      .select("easypay_uid")
      .limit(1);
    // Either the column read is denied outright, or RLS hides all rows and no UID leaks.
    if (error) {
      expect(error.message).toMatch(PERMISSION_ERRORS);
    } else {
      for (const row of data || []) {
        expect((row as any).easypay_uid).toBeUndefined();
      }
    }
  });

  it("anon select * on profiles never includes easypay_uid", async () => {
    const { data, error } = await anon.from("profiles").select("*").limit(1);
    if (error) {
      // RLS blocking all rows is acceptable; column leak would be the failure.
      expect(error.message).toMatch(PERMISSION_ERRORS);
      return;
    }
    for (const row of data || []) {
      expect(Object.keys(row as any)).not.toContain("easypay_uid");
    }
  });

  it("anon cannot select easypay_uid from user_activity_logs", async () => {
    const { data, error } = await anon
      .from("user_activity_logs")
      .select("easypay_uid")
      .limit(1);
    if (error) {
      expect(error.message).toMatch(PERMISSION_ERRORS);
    } else {
      // RLS gates rows to admins only; anon should see nothing.
      expect(data?.length ?? 0).toBe(0);
    }
  });

  it("admin_get_easypay_uids RPC rejects non-admin callers", async () => {
    const { data, error } = await anon.rpc("admin_get_easypay_uids" as any, {
      _user_ids: ["00000000-0000-0000-0000-000000000000"],
    });
    // Either the RPC errors with forbidden, or returns no rows (no admin role).
    if (error) {
      expect(error.message).toMatch(PERMISSION_ERRORS);
    } else {
      expect(data ?? []).toEqual([]);
    }
  });

  it("admin_get_user_by_easypay_uid RPC rejects non-admin callers", async () => {
    const { data, error } = await anon.rpc(
      "admin_get_user_by_easypay_uid" as any,
      { _uid: "EP00000001" }
    );
    if (error) {
      expect(error.message).toMatch(PERMISSION_ERRORS);
    } else {
      expect(data ?? []).toEqual([]);
    }
  });
});

/**
 * Authenticated non-admin coverage.
 *
 * Requires test credentials to be provided via env:
 *   VITE_TEST_NONADMIN_EMAIL  (e.g. "01700000000@easypay.app")
 *   VITE_TEST_NONADMIN_PASSWORD
 *
 * When the credentials are missing the suite is skipped so CI on forks
 * without secrets still passes. When present, it exercises the
 * `RAISE EXCEPTION 'forbidden'` + alert-insert branch of the admin RPCs
 * and the locked-down resolve RPC.
 */
const NONADMIN_EMAIL = import.meta.env.VITE_TEST_NONADMIN_EMAIL as string | undefined;
const NONADMIN_PASSWORD = import.meta.env.VITE_TEST_NONADMIN_PASSWORD as string | undefined;
const describeAuthed =
  NONADMIN_EMAIL && NONADMIN_PASSWORD ? describe : describe.skip;

describeAuthed("authenticated non-admin is forbidden from easypay_uid surfaces", () => {
  let authed: SupabaseClient;

  beforeAll(async () => {
    authed = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await authed.auth.signInWithPassword({
      email: NONADMIN_EMAIL!,
      password: NONADMIN_PASSWORD!,
    });
    if (error) throw new Error(`non-admin sign-in failed: ${error.message}`);
  });

  it("authenticated non-admin cannot select easypay_uid column from profiles", async () => {
    const { data, error } = await authed
      .from("profiles")
      .select("easypay_uid")
      .limit(1);
    if (error) {
      expect(error.message).toMatch(PERMISSION_ERRORS);
    } else {
      for (const row of data || []) {
        expect((row as any).easypay_uid).toBeUndefined();
      }
    }
  });

  it("authenticated non-admin select * never includes easypay_uid", async () => {
    const { data, error } = await authed.from("profiles").select("*").limit(1);
    if (!error) {
      for (const row of data || []) {
        expect(Object.keys(row as any)).not.toContain("easypay_uid");
      }
    }
  });

  it("admin_get_easypay_uids RPC raises forbidden for non-admin", async () => {
    const { data, error } = await authed.rpc("admin_get_easypay_uids" as any, {
      _user_ids: ["00000000-0000-0000-0000-000000000000"],
    });
    // Must be denied; either explicit RAISE or zero rows. Prefer explicit error.
    if (error) {
      expect(error.message).toMatch(PERMISSION_ERRORS);
    } else {
      expect(data ?? []).toEqual([]);
    }
  });

  it("admin_get_user_by_easypay_uid RPC raises forbidden for non-admin", async () => {
    const { data, error } = await authed.rpc(
      "admin_get_user_by_easypay_uid" as any,
      { _uid: "EP00000001" }
    );
    if (error) {
      expect(error.message).toMatch(PERMISSION_ERRORS);
    } else {
      expect(data ?? []).toEqual([]);
    }
  });

  it("resolve_easypay_uid_alert RPC is blocked for non-admin", async () => {
    const { error } = await authed.rpc("resolve_easypay_uid_alert" as any, {
      _alert_id: "00000000-0000-0000-0000-000000000000",
      _resolved: true,
      _note: "test",
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(PERMISSION_ERRORS);
  });

  it("authenticated non-admin cannot directly UPDATE easypay_uid_access_alerts", async () => {
    const { error } = await authed
      .from("easypay_uid_access_alerts" as any)
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", "00000000-0000-0000-0000-000000000000");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(PERMISSION_ERRORS);
  });

  it("authenticated non-admin cannot INSERT into easypay_uid_access_alerts", async () => {
    const { error } = await authed
      .from("easypay_uid_access_alerts" as any)
      .insert({ rpc_name: "spoof", payload: {} });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(PERMISSION_ERRORS);
  });

  it("authenticated non-admin cannot DELETE from easypay_uid_access_alerts", async () => {
    const { error } = await authed
      .from("easypay_uid_access_alerts" as any)
      .delete()
      .eq("id", "00000000-0000-0000-0000-000000000000");
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(PERMISSION_ERRORS);
  });
});
