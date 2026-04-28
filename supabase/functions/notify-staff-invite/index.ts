// Sends invite notifications (push + SMS + email) to a merchant_staff member.
// Used both on initial add and on "Resend Invite". Enforces a 2-hour cooldown
// per channel to prevent spam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
const APP_URL = "https://pay-palooza-go.lovable.app";
const MANAGER_LOGIN_URL = `${APP_URL}/merchant-manager-login`;

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function bdPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("88")) return "+" + digits;
  if (digits.startsWith("01")) return "+88" + digits;
  return digits.startsWith("+") ? digits : "+" + digits;
}

async function logDispatch(staff_id: string, merchant_id: string, channel: string, status: string, detail?: string) {
  try {
    await sb.from("merchant_staff_invite_dispatch").insert({ staff_id, merchant_id, channel, status, detail: detail?.slice(0, 500) });
  } catch (_) { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: caller must be the merchant owner of this staff row
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { staff_id, force } = await req.json();
    if (!staff_id) {
      return new Response(JSON.stringify({ error: "staff_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load staff + merchant + verify ownership
    const { data: staff } = await sb
      .from("merchant_staff")
      .select("id, merchant_id, name, phone, role, user_id")
      .eq("id", staff_id)
      .maybeSingle();
    if (!staff) {
      return new Response(JSON.stringify({ error: "Staff not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: merchant } = await sb
      .from("merchants")
      .select("id, business_name, user_id")
      .eq("id", staff.merchant_id)
      .maybeSingle();
    if (!merchant || merchant.user_id !== caller.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cooldown check (skip if force=true is NOT supported here — cooldown is always enforced for cost control)
    if (!force) {
      const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
      const { data: recent } = await sb
        .from("merchant_staff_invite_dispatch")
        .select("sent_at")
        .eq("staff_id", staff_id)
        .eq("status", "sent")
        .gte("sent_at", cutoff)
        .order("sent_at", { ascending: false })
        .limit(1);
      if (recent && recent.length > 0) {
        const nextAt = new Date(new Date(recent[0].sent_at).getTime() + COOLDOWN_MS);
        const minutesLeft = Math.max(1, Math.ceil((nextAt.getTime() - Date.now()) / 60000));
        return new Response(JSON.stringify({
          ok: false,
          cooldown: true,
          message: `Please wait ~${minutesLeft} more minute${minutesLeft === 1 ? "" : "s"} before resending.`,
          next_available_at: nextAt.toISOString(),
        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const business = merchant.business_name?.trim() || "an EasyPay store";
    const role = staff.role || "Staff";
    const title = `You're invited as ${role} at ${business}`;
    const body = `Open EasyPay → Merchant Manager Login and sign in with your own phone & PIN.`;
    const smsBody = `EasyPay: You've been added as ${role} at ${business}. Sign in with your own phone & PIN at ${MANAGER_LOGIN_URL} . New here? Sign up first at ${APP_URL}`;

    const results: Record<string, any> = {};

    // 1. PUSH (only if linked to a real user with subscriptions)
    if (staff.user_id) {
      try {
        const { data: pushRes, error: pushErr } = await sb.functions.invoke("send-push-notification", {
          body: {
            user_ids: [staff.user_id],
            title,
            body,
            url: "/merchant-manager-login",
            category: "merchant_ops",
            data: { type: "staff_invite", merchant_id: merchant.id, role },
          },
        });
        if (pushErr) {
          results.push = { status: "failed", error: pushErr.message };
          await logDispatch(staff_id, merchant.id, "push", "failed", pushErr.message);
        } else {
          const sent = pushRes?.sent ?? 0;
          results.push = pushRes;
          await logDispatch(staff_id, merchant.id, "push", sent > 0 ? "sent" : "skipped", JSON.stringify(pushRes));
        }
        // Also drop an in-app notification for inbox
        await sb.from("notifications").insert({
          user_id: staff.user_id, title, body, category: "merchant_ops",
          metadata: { kind: "staff_invite", merchant_id: merchant.id, role },
        });
      } catch (e: any) {
        results.push = { status: "failed", error: String(e?.message ?? e) };
        await logDispatch(staff_id, merchant.id, "push", "failed", String(e?.message ?? e));
      }
    } else {
      results.push = { skipped: "staff not yet on EasyPay" };
      await logDispatch(staff_id, merchant.id, "push", "skipped", "no user_id");
    }

    // 2. SMS via Twilio (works whether or not they're on EasyPay yet)
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
    const phone = bdPhone(staff.phone || "");

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      results.sms = { skipped: "twilio not configured" };
      await logDispatch(staff_id, merchant.id, "sms", "skipped", "twilio not configured");
    } else if (!phone) {
      results.sms = { skipped: "no phone" };
      await logDispatch(staff_id, merchant.id, "sms", "skipped", "no phone");
    } else {
      try {
        const form = new URLSearchParams();
        form.append("To", phone);
        form.append("From", TWILIO_FROM);
        form.append("Body", smsBody);
        const r = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          },
        );
        const json = await r.json();
        if (r.ok) {
          results.sms = { status: "sent", sid: json.sid };
          await logDispatch(staff_id, merchant.id, "sms", "sent", json.sid);
        } else {
          results.sms = { status: "failed", error: json.message ?? "twilio error" };
          await logDispatch(staff_id, merchant.id, "sms", "failed", JSON.stringify(json).slice(0, 400));
        }
      } catch (e: any) {
        results.sms = { status: "failed", error: String(e?.message ?? e) };
        await logDispatch(staff_id, merchant.id, "sms", "failed", String(e?.message ?? e));
      }
    }

    // 3. EMAIL — only if the linked user has a real email (not the synthetic xxx@easypay.app)
    let realEmail: string | null = null;
    if (staff.user_id) {
      try {
        const { data: u } = await sb.auth.admin.getUserById(staff.user_id);
        const e = u?.user?.email ?? null;
        if (e && !e.endsWith("@easypay.app")) realEmail = e;
      } catch (_) { /* ignore */ }
    }
    if (!realEmail) {
      results.email = { skipped: "no real email on file" };
      await logDispatch(staff_id, merchant.id, "email", "skipped", "no real email");
    } else {
      try {
        const { error } = await sb.functions.invoke("send-transactional-email", {
          body: {
            templateName: "staff-invite",
            recipientEmail: realEmail,
            idempotencyKey: `staff-invite-${staff.id}-${Date.now()}`,
            templateData: { name: staff.name, role, business, loginUrl: MANAGER_LOGIN_URL },
          },
        });
        if (error) {
          results.email = { status: "failed", error: error.message };
          await logDispatch(staff_id, merchant.id, "email", "failed", error.message);
        } else {
          results.email = { status: "sent" };
          await logDispatch(staff_id, merchant.id, "email", "sent");
        }
      } catch (e: any) {
        // send-transactional-email may not be deployed yet — that's fine
        results.email = { skipped: "email infra not configured" };
        await logDispatch(staff_id, merchant.id, "email", "skipped", "infra not configured");
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
