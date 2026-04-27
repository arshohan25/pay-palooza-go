import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PHONE_REGEX = /^01[3-9]\d{8}$/;
const PIN_REGEX = /^\d{4}$/;
const PRIMARY_DOMAIN = "easypay.app";
const FALLBACK_DOMAINS = ["example.com", "easypay.local"];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/\D/g, "").replace(/^88/, "");
  return PHONE_REGEX.test(cleaned) ? cleaned : null;
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed" });
  }

  // Service-role admin client (bypasses RLS for attempts table + role checks)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, message: "Invalid JSON body" });
  }

  const phone = normalizePhone(body?.phone);
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!phone) {
    return json(400, {
      ok: false,
      message: "Enter a valid 11-digit Bangladeshi mobile number.",
    });
  }
  if (!PIN_REGEX.test(pin)) {
    return json(400, { ok: false, message: "Enter your 4-digit PIN." });
  }

  const ip = getClientIp(req);

  // 1. Check lockout BEFORE attempting auth
  const { data: lockData, error: lockErr } = await admin.rpc(
    "check_merchant_login_lockout",
    { p_phone: phone },
  );
  if (lockErr) {
    console.error("lockout check failed", lockErr);
    return json(500, { ok: false, message: "Login service unavailable" });
  }

  const lock = lockData as {
    locked: boolean;
    attempts_remaining: number;
    retry_after_seconds: number;
  };

  if (lock?.locked) {
    const minutes = Math.ceil(lock.retry_after_seconds / 60);
    return new Response(
      JSON.stringify({
        ok: false,
        locked: true,
        attempts_remaining: 0,
        retry_after_seconds: lock.retry_after_seconds,
        message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(lock.retry_after_seconds),
        },
      },
    );
  }

  // 2. Attempt sign-in with phone-as-email (primary + legacy fallbacks).
  // Use a separate anon-key client so we don't pollute the admin client's auth state.
  const password = `${pin}EP`;
  const candidateEmails = [
    `${phone}@${PRIMARY_DOMAIN}`,
    ...FALLBACK_DOMAINS.map((d) => `${phone}@${d}`),
  ];

  let session: any = null;
  let user: any = null;
  let lastCredentialError: string | null = null;

  for (const email of candidateEmails) {
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (!error && data?.session && data?.user) {
      session = data.session;
      user = data.user;
      break;
    }
    if (error?.message?.includes("Invalid login credentials")) {
      lastCredentialError = error.message;
      continue;
    }
    if (error) {
      // Some other auth error (rate-limited, server error, etc.) — bail.
      console.error("auth error", error);
      return json(500, { ok: false, message: "Login service unavailable" });
    }
  }

  // 3a. Auth failed — record attempt + recompute lockout
  if (!session || !user) {
    await admin
      .from("merchant_login_attempts")
      .insert({ phone, ip, success: false });

    // Opportunistic purge (best-effort, ignore errors)
    admin.rpc("purge_old_merchant_login_attempts").then(() => {});

    const { data: postLock } = await admin.rpc(
      "check_merchant_login_lockout",
      { p_phone: phone },
    );
    const pl = postLock as {
      locked: boolean;
      attempts_remaining: number;
      retry_after_seconds: number;
    } | null;

    if (pl?.locked) {
      const minutes = Math.ceil(pl.retry_after_seconds / 60);
      return new Response(
        JSON.stringify({
          ok: false,
          locked: true,
          attempts_remaining: 0,
          retry_after_seconds: pl.retry_after_seconds,
          message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(pl.retry_after_seconds),
          },
        },
      );
    }

    return json(401, {
      ok: false,
      locked: false,
      attempts_remaining: pl?.attempts_remaining ?? null,
      message: "Wrong phone or PIN",
    });
  }

  // 3b. Auth succeeded — verify merchant role
  const { data: roles, error: roleErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleErr) {
    console.error("role lookup failed", roleErr);
    return json(500, { ok: false, message: "Login service unavailable" });
  }

  const roleNames = (roles ?? []).map((r: any) => r.role);
  const isMerchant = roleNames.includes("merchant") || roleNames.includes("admin");

  if (!isMerchant) {
    // Don't count as a failed attempt — credentials were valid, just wrong portal.
    return json(403, {
      ok: false,
      locked: false,
      message: "This account isn't a merchant account",
    });
  }

  // Success: clear failed attempts, log success
  await admin
    .from("merchant_login_attempts")
    .delete()
    .eq("phone", phone)
    .eq("success", false);

  await admin
    .from("merchant_login_attempts")
    .insert({ phone, ip, success: true });

  return json(200, {
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
    },
    user: { id: user.id },
  });
});
