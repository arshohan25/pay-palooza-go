import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@easypay.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Authentication: must be (a) service-role JWT (used by internal trigger/function callers),
  // (b) admin user JWT (can target any users), or (c) a regular user JWT only targeting self.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let isServiceRole = false;
  let callerId: string | null = null;
  let callerIsAdmin = false;

  if (token === serviceKey) {
    isServiceRole = true;
  } else {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: c, error: cErr } = await userClient.auth.getClaims(token);
      if (cErr || !c?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerId = c.claims.sub as string;
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: roleCheck } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle();
      callerIsAdmin = !!roleCheck;
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { user_ids, title, body: msg, url, category } = body || {};
    if (!Array.isArray(user_ids) || user_ids.length === 0 || !title) {
      return new Response(JSON.stringify({ error: "user_ids[] and title required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Non-admin user JWT may only push to themselves
    if (!isServiceRole && !callerIsAdmin) {
      const onlySelf = user_ids.every((id: string) => id === callerId);
      if (!onlySelf) {
        return new Response(JSON.stringify({ error: "Forbidden: can only push to self" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }


    // If a category is provided, filter out users who have disabled push for that category
    let allowedUserIds: string[] = user_ids;
    const skippedByPref: string[] = [];
    if (category && typeof category === "string") {
      const { data: prefs } = await sb
        .from("notification_preferences")
        .select("user_id, push_enabled")
        .in("user_id", user_ids)
        .eq("category", category);
      const disabled = new Set(
        (prefs ?? []).filter((p: any) => p.push_enabled === false).map((p: any) => p.user_id),
      );
      allowedUserIds = user_ids.filter((id: string) => !disabled.has(id));
      for (const id of user_ids) if (disabled.has(id)) skippedByPref.push(id);

      if (skippedByPref.length > 0) {
        await sb.from("push_delivery_logs").insert(
          skippedByPref.map((uid) => ({
            user_id: uid, title, body: msg ?? "", url: url ?? null, category,
            status: "skipped", error_message: "user opted out of category",
          })),
        );
      }

      if (allowedUserIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, failed: 0, total: 0, skipped: user_ids.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("*")
      .in("user_id", allowedUserIds);

    let sent = 0, failed = 0;
    const payload = JSON.stringify({ title, body: msg ?? "", url: url ?? "/" });
    const logs: any[] = [];

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
        logs.push({
          user_id: s.user_id, endpoint: s.endpoint, title, body: msg ?? "",
          url: url ?? null, category: category ?? null, status: "sent", status_code: 201,
        });
      } catch (err: any) {
        failed++;
        const code = err?.statusCode ?? null;
        logs.push({
          user_id: s.user_id, endpoint: s.endpoint, title, body: msg ?? "",
          url: url ?? null, category: category ?? null, status: "failed",
          status_code: code, error_message: String(err?.message ?? err).slice(0, 500),
        });
        if (code === 410 || code === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    if (logs.length > 0) {
      await sb.from("push_delivery_logs").insert(logs);
    }

    return new Response(JSON.stringify({ sent, failed, total: (subs ?? []).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
