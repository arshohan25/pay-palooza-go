// Verifies that only the designated group admin can update a group
// chat_conversations row, even when the caller is a participant. Direct
// (non-group) conversations remain updatable by any participant.
//
// Uses the pre-seeded confirmed non-admin user
// (`rls-test-nonadmin@easypay.app`) created by the RLS test fixture.
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

const TEST_EMAIL = "rls-test-nonadmin@easypay.app";
const TEST_PASSWORD = "RlsTestPass!2026";

assert(SUPABASE_URL, "SUPABASE_URL missing");
assert(SUPABASE_ANON_KEY, "SUPABASE anon/publishable key missing");

async function signIn() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  assert(data.session, "expected session");
  return { client, userId: data.session.user.id };
}

async function insertConversation(
  client: any,
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await client
    .from("chat_conversations" as any)
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`insert failed: ${error.message}`);
  return (data as { id: string }).id;
}

async function addParticipant(
  client: any,
  conversationId: string,
  userId: string,
) {
  const { error } = await client
    .from("chat_participants" as any)
    .insert({ conversation_id: conversationId, user_id: userId });
  if (error) throw new Error(`participant insert failed: ${error.message}`);
}

async function cleanup(
  client: any,
  conversationId: string,
) {
  await client
    .from("chat_participants" as any)
    .delete()
    .eq("conversation_id", conversationId);
  await client
    .from("chat_conversations" as any)
    .delete()
    .eq("id", conversationId);
}

Deno.test(
  "group conversation UPDATE by non-admin participant affects zero rows",
  async () => {
    const { client, userId } = await signIn();
    const otherAdmin = crypto.randomUUID(); // simulated group admin
    const convoId = await insertConversation(client, {
      type: "group",
      name: "rls-test-original",
      admin_id: otherAdmin,
    });
    try {
      await addParticipant(client, convoId, userId);

      const { data, error } = await client
        .from("chat_conversations" as any)
        .update({ name: "rls-test-hijacked" })
        .eq("id", convoId)
        .select();

      assertEquals(error, null, `unexpected error: ${error?.message}`);
      assertEquals(
        (data ?? []).length,
        0,
        "non-admin participant must not update a group conversation",
      );

      // Confirm the row was not mutated
      const { data: after } = await client
        .from("chat_conversations" as any)
        .select("name")
        .eq("id", convoId)
        .maybeSingle();
      assertEquals((after as { name: string } | null)?.name, "rls-test-original");
    } finally {
      await cleanup(client, convoId);
    }
  },
);

Deno.test(
  "group conversation UPDATE succeeds when caller IS the admin_id",
  async () => {
    const { client, userId } = await signIn();
    const convoId = await insertConversation(client, {
      type: "group",
      name: "rls-test-own",
      admin_id: userId,
    });
    try {
      await addParticipant(client, convoId, userId);

      const { data, error } = await client
        .from("chat_conversations" as any)
        .update({ name: "rls-test-own-renamed" })
        .eq("id", convoId)
        .select();

      assertEquals(error, null, `unexpected error: ${error?.message}`);
      assertEquals(
        (data ?? []).length,
        1,
        "admin_id caller must be able to update their group conversation",
      );
    } finally {
      await cleanup(client, convoId);
    }
  },
);

Deno.test(
  "direct (non-group) conversation UPDATE remains allowed for participants",
  async () => {
    const { client, userId } = await signIn();
    const convoId = await insertConversation(client, {
      type: "direct",
      name: "rls-test-direct",
      admin_id: null,
    });
    try {
      await addParticipant(client, convoId, userId);

      const { data, error } = await client
        .from("chat_conversations" as any)
        .update({ name: "rls-test-direct-renamed" })
        .eq("id", convoId)
        .select();

      assertEquals(error, null, `unexpected error: ${error?.message}`);
      assertEquals(
        (data ?? []).length,
        1,
        "participant of a direct chat must still be able to update it",
      );
    } finally {
      await cleanup(client, convoId);
    }
  },
);

// ---------------------------------------------------------------------------
// Raw REST (PostgREST PATCH) coverage — bypasses supabase-js in case any
// future client-side wrapper accidentally masks a policy failure.
// ---------------------------------------------------------------------------

async function rawFetch(
  path: string,
  init: RequestInit,
  token: string,
): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(init.headers as Record<string, string> | undefined ?? {}),
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  return { status: res.status, body: await res.text() };
}

async function signInWithSession() {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return {
    client,
    userId: data.session!.user.id,
    accessToken: data.session!.access_token,
  };
}

Deno.test(
  "REST PATCH on group conversation by non-admin participant returns []",
  async () => {
    const { client, userId, accessToken } = await signInWithSession();
    const otherAdmin = crypto.randomUUID();
    const convoId = await insertConversation(client, {
      type: "group",
      name: "rest-rls-original",
      admin_id: otherAdmin,
    });
    try {
      await addParticipant(client, convoId, userId);

      const { status, body } = await rawFetch(
        `/rest/v1/chat_conversations?id=eq.${convoId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "rest-rls-hijacked" }),
        },
        accessToken,
      );

      // PostgREST returns 200 + [] when RLS filters out the row entirely.
      assertEquals(status, 200, `expected 200, got ${status} ${body}`);
      const rows = JSON.parse(body);
      assertEquals(
        Array.isArray(rows) && rows.length,
        0,
        "REST PATCH must affect zero rows for non-admin participant",
      );

      // Confirm the row was not mutated.
      const { data: after } = await client
        .from("chat_conversations" as any)
        .select("name")
        .eq("id", convoId)
        .maybeSingle();
      assertEquals(
        (after as { name: string } | null)?.name,
        "rest-rls-original",
      );
    } finally {
      await cleanup(client, convoId);
    }
  },
);

Deno.test(
  "REST PATCH on group conversation by admin_id returns the updated row",
  async () => {
    const { client, userId, accessToken } = await signInWithSession();
    const convoId = await insertConversation(client, {
      type: "group",
      name: "rest-rls-own",
      admin_id: userId,
    });
    try {
      await addParticipant(client, convoId, userId);

      const { status, body } = await rawFetch(
        `/rest/v1/chat_conversations?id=eq.${convoId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "rest-rls-own-renamed" }),
        },
        accessToken,
      );

      assertEquals(status, 200, `expected 200, got ${status} ${body}`);
      const rows = JSON.parse(body);
      assertEquals(rows.length, 1, "admin_id caller must update exactly 1 row");
      assertEquals(rows[0].name, "rest-rls-own-renamed");
    } finally {
      await cleanup(client, convoId);
    }
  },
);

// RPC-surface guard lives in src/test/chat-conversations-update-rpc-guard.test.ts
// (static scan of migrations + hooks). PostgREST's OpenAPI root requires
// service_role, so RPC enumeration is done from source at CI time instead
// of via a network round-trip here.

