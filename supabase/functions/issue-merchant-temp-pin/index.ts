// Issues a fresh 4-digit temporary PIN for a merchant (create or resend).
// Mirrors issue-agent-temp-pin. See that file for the design rationale.
//
// Secrets used: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//               SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Payload {
  merchant_user_id: string;
  phone: string;
  name?: string;
  purpose?: "create" | "resend";
  idempotency_key?: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPIRY_HOURS = 24;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskPhone(phone: string) {
  if (phone.length !== 11) return phone.replace(/\d(?=\d{2})/g, "•");
  return `${phone.slice(0, 3)}••••••${phone.slice(-2)}`;
}

function pinToPassword(pin: string) {
  return `${pin}EP`; // must match src/lib/auth.ts
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── AuthN ───────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const callerId = userData.user.id;

    // ── AuthZ: admin only ───────────────────────────────────────────
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleErr) {
      console.error("has_role failed", roleErr);
      return json({ error: "Role check failed" }, 500);
    }
    if (!isAdmin) return json({ error: "Admin only" }, 403);

    // ── Parse & validate ────────────────────────────────────────────
    const body = (await req.json()) as Payload;
    const merchantId = body.merchant_user_id;
    const phone = (body.phone || "").replace(/\D/g, "").replace(/^88/, "");
    const purpose = body.purpose === "resend" ? "resend" : "create";
    const name = body.name;
    const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim().slice(0, 80)
      : null;

    if (!merchantId || !/^[0-9a-f-]{36}$/i.test(merchantId)) {
      return json({ error: "Invalid merchant_user_id" }, 400);
    }
    if (!/^01[3-9]\d{8}$/.test(phone)) {
      return json({ error: "Invalid BD phone" }, 400);
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Idempotency replay ──────────────────────────────────────────
    if (idempotencyKey) {
      const { data: existing } = await svc.from("merchant_temp_pin_issues")
        .select("expires_at, created_at")
        .eq("merchant_user_id", merchantId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) {
        return json({
          ok: true,
          replayed: true,
          sms_status: "sent",
          expires_at: existing.expires_at,
        });
      }
    }

    // ── Throttle ────────────────────────────────────────────────────
    const { data: throttleRows, error: throttleErr } = await svc.rpc(
      "check_merchant_pin_reissue_throttle",
      { _merchant_user_id: merchantId },
    );
    if (throttleErr) {
      console.error("throttle rpc failed", throttleErr);
      return json({ error: "Throttle check failed" }, 500);
    }
    const throttle = Array.isArray(throttleRows) ? throttleRows[0] : throttleRows;
    if (throttle && throttle.allowed === false) {
      return json(
        {
          error: throttle.reason === "cooldown"
            ? `Please wait ${throttle.retry_after_seconds}s before requesting another PIN.`
            : "Too many PIN requests for this merchant. Try again later.",
          throttled: true,
          retry_after_seconds: throttle.retry_after_seconds,
          reason: throttle.reason,
        },
        429,
      );
    }

    // ── Generate & apply ────────────────────────────────────────────
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const pinHash = await sha256Hex(`${merchantId}:${pin}`);

    const { error: pwErr } = await svc.auth.admin.updateUserById(merchantId, {
      password: pinToPassword(pin),
    });
    if (pwErr) {
      console.error("password update failed", pwErr);
      return json({ error: `Password update failed: ${pwErr.message}` }, 500);
    }

    await svc.from("merchant_temp_pin_issues")
      .update({ superseded_at: new Date().toISOString() })
      .eq("merchant_user_id", merchantId)
      .is("superseded_at", null)
      .is("used_at", null);

    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    const { error: insErr } = await svc.from("merchant_temp_pin_issues").insert({
      merchant_user_id: merchantId,
      pin_hash: pinHash,
      expires_at: expiresAt,
      issued_by: callerId,
      issued_via: purpose,
      idempotency_key: idempotencyKey,
    });
    if (insErr) {
      console.error("issue insert failed", insErr);
      return json({ error: `Issue insert failed: ${insErr.message}` }, 500);
    }

    // ── SMS ─────────────────────────────────────────────────────────
    const smsUrl = Deno.env.get("SMS_API_URL");
    const smsKey = Deno.env.get("SMS_API_KEY");
    const smsSender = Deno.env.get("SMS_SENDER_ID");

    let smsStatus: "sent" | "failed" = "failed";
    let providerStatusCode: number | null = null;
    let providerResponse = "";
    let errorMessage: string | null = null;

    if (!smsUrl || !smsKey || !smsSender) {
      errorMessage = "SMS gateway not configured";
      console.error(errorMessage);
    } else {
      const to = `88${phone}`;
      const message =
        `${purpose === "resend" ? "Your new" : "Welcome"}${name ? " " + name : ""}! EasyPay merchant temp PIN: ${pin}. ` +
        `Valid for ${EXPIRY_HOURS}h. Change it after first sign-in.`;

      try {
        const res = await fetch(smsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: smsKey,
            senderid: smsSender,
            number: to,
            message,
            type: "text",
          }),
        });
        providerStatusCode = res.status;
        providerResponse = (await res.text()).slice(0, 4000);
        if (res.ok) {
          smsStatus = "sent";
        } else {
          errorMessage = `Provider returned ${res.status}`;
          console.error("SMS provider failed", res.status, providerResponse);
        }
      } catch (e) {
        errorMessage = (e as Error).message ?? "SMS fetch failed";
        console.error("SMS fetch threw", e);
      }
    }

    await svc.from("sms_delivery_logs").insert({
      purpose: "merchant_temp_pin",
      merchant_user_id: merchantId,
      phone_masked: maskPhone(phone),
      status: smsStatus,
      provider_status_code: providerStatusCode,
      provider_response: providerResponse || null,
      error_message: errorMessage,
      issued_by: callerId,
    });

    return json({
      ok: true,
      sms_status: smsStatus,
      expires_at: expiresAt,
      pin_fallback: smsStatus === "failed" ? pin : undefined,
    });
  } catch (err) {
    console.error("issue-merchant-temp-pin error", err);
    return json({ error: (err as Error).message ?? "Unknown error" }, 500);
  }
});
