// Guard test: ensure no database RPC (SECURITY DEFINER function) exposes
// an UPDATE path on public.chat_conversations that bypasses the
// admin_id-gated RLS policy verified in
// supabase/functions/_tests/chat_conversations_group_admin_rls_test.ts.
//
// Approach: statically scan every migration for functions that touch
// chat_conversations with an UPDATE. Any such function must be listed in
// KNOWN_CHAT_UPDATE_RPCS *and* enforce admin_id = auth.uid() for group
// rows. If a future migration adds a matching function without an
// admin-id check, this test fails so a matching authz test is required.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const HOOK_DIR = join(process.cwd(), "src/hooks");

// Currently none — chat_conversations updates flow only through PostgREST
// (REST PATCH / supabase-js .update), directly gated by the RLS policy.
const KNOWN_CHAT_UPDATE_RPCS: string[] = [];

type FnHit = { name: string; body: string; file: string };

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

function collectFunctionsTouchingChatConversations(): FnHit[] {
  const hits: FnHit[] = [];
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const fnRe =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS[\s\S]*?\$\$([\s\S]*?)\$\$/gi;

  for (const f of files) {
    const raw = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    const code = stripSqlComments(raw);
    let m: RegExpExecArray | null;
    fnRe.lastIndex = 0;
    while ((m = fnRe.exec(code)) !== null) {
      const [, name, , body] = m;
      // Look for an UPDATE of chat_conversations inside the function body.
      const touchesUpdate =
        /UPDATE\s+(?:public\.)?chat_conversations\b/i.test(body);
      if (touchesUpdate) hits.push({ name, body, file: f });
    }
  }
  return hits;
}

describe("RPC surface on chat_conversations updates", () => {
  const hits = collectFunctionsTouchingChatConversations();

  it("no unlisted database function performs UPDATE on chat_conversations", () => {
    const unlisted = hits
      .map((h) => h.name)
      .filter((n) => !KNOWN_CHAT_UPDATE_RPCS.includes(n));
    expect(unlisted).toEqual([]);
  });

  it("every listed RPC enforces admin_id = auth.uid() for group rows", () => {
    for (const h of hits) {
      if (!KNOWN_CHAT_UPDATE_RPCS.includes(h.name)) continue;
      const checksAdmin =
        /admin_id\s*=\s*auth\.uid\(\)/i.test(h.body) ||
        /is_group_admin\s*\(/i.test(h.body);
      expect(
        checksAdmin,
        `RPC "${h.name}" in ${h.file} updates chat_conversations without ` +
          `an admin_id = auth.uid() guard`,
      ).toBe(true);
    }
  });
});

describe("client code does not call an update RPC for chat_conversations", () => {
  it("no supabase.rpc(...) call in src/hooks targets a chat-update function", () => {
    const files = readdirSync(HOOK_DIR).filter((f) => f.endsWith(".ts"));
    const offenders: string[] = [];
    const rpcRe = /\.rpc\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g;
    for (const f of files) {
      const src = readFileSync(join(HOOK_DIR, f), "utf8");
      let m: RegExpExecArray | null;
      rpcRe.lastIndex = 0;
      while ((m = rpcRe.exec(src)) !== null) {
        const name = m[1];
        if (
          /(update|rename|edit|modify|set).*(chat|conversation|group)/i.test(name) ||
          /(chat|conversation|group).*(update|rename|edit|modify|set)/i.test(name)
        ) {
          if (!KNOWN_CHAT_UPDATE_RPCS.includes(name)) {
            offenders.push(`${f}: ${name}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
