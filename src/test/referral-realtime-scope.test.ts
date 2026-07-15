// Guard tests: ensure the referral realtime channel is subscribed on a
// strictly per-user topic, and that the shared unscoped 'referral-updates'
// topic is not present in the current realtime.messages SELECT policy.
//
// These are static-source assertions on purpose — Realtime authorization
// happens inside the WAL2JSON worker and cannot be observed from client
// tests without service_role. Locking down the source of the topic name
// and the current policy migration keeps every role (admin, agent,
// distributor, merchant, etc.) restricted to their own user_id scope.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();
const HOOK_PATH = join(REPO_ROOT, "src/hooks/use-referrals.ts");
const MIGRATIONS_DIR = join(REPO_ROOT, "supabase/migrations");

function latestScopedRealtimeSubscribeMigration(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames are lexicographically time-ordered
  let latest: { file: string; body: string } | null = null;
  for (const f of files) {
    const body = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    if (/CREATE POLICY\s+"scoped_realtime_subscribe"/i.test(body)) {
      latest = { file: f, body };
    }
  }
  if (!latest) throw new Error("no scoped_realtime_subscribe migration found");
  return latest.body;
}

describe("referral realtime channel is per-user scoped", () => {
  const hook = readFileSync(HOOK_PATH, "utf8");

  it("subscribes on a topic that embeds the caller user_id", () => {
    // Must use template-literal per-user topic, not the bare shared topic.
    expect(hook).toMatch(/\.channel\(\s*`referral-updates-\$\{user\.id\}`\s*\)/);
  });

  it("does NOT subscribe to the unscoped 'referral-updates' topic", () => {
    // Any of the string forms would revive the shared topic.
    expect(hook).not.toMatch(/\.channel\(\s*["']referral-updates["']\s*\)/);
  });

  it("filters postgres_changes payloads by referrer_id=auth.uid()", () => {
    // Defense in depth: even though RLS on referrals/referral_rewards
    // scopes rows per user, the realtime subscription must also filter
    // to avoid delivering other users' change events over shared workers.
    const referralsFilter =
      /table:\s*["']referrals["'][^}]*filter:\s*`referrer_id=eq\.\$\{user\.id\}`/s;
    const rewardsFilter =
      /table:\s*["']referral_rewards["'][^}]*filter:\s*`referrer_id=eq\.\$\{user\.id\}`/s;
    expect(hook).toMatch(referralsFilter);
    expect(hook).toMatch(rewardsFilter);
  });
});

describe("realtime.messages SELECT policy excludes shared referral topic", () => {
  const policyBody = latestScopedRealtimeSubscribeMigration();

  it("does not list 'referral-updates' in the static topic allow-list", () => {
    // The bare topic must not appear in the currently authoritative policy.
    // Comments in the migration are allowed to mention the name.
    const codeOnly = policyBody
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(codeOnly).not.toMatch(/['"]referral-updates['"]/);
  });

  it("still authorizes the per-user pattern via '%'||auth.uid()||'%'", () => {
    // The pattern that gates per-user topics such as `referral-updates-<uid>`.
    expect(policyBody).toMatch(
      /realtime\.topic\(\)\s*LIKE\s*\(\s*'%'\s*\|\|\s*auth\.uid\(\)::text\s*\|\|\s*'%'\s*\)/,
    );
  });
});
