import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PHONE_REGEX = /^01[3-9]\d{8}$/;

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
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

function maskPhone(phone: string): string {
  // 11-digit BD: 019•••••••954 → first 3 + 6 dots + last 3 (matches frontend mask)
  if (phone.length !== 11) return phone;
  return `${phone.slice(0, 3)}••••••${phone.slice(8)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  let body: any;
  try { body = await req.json(); } catch {
    return json(400, { ok: false, message: "Invalid request" });
  }

  const phone = normalizePhone(body?.phone);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

  if (!phone) {
    return json(400, { ok: false, message: "Enter a valid 11-digit Bangladeshi mobile number." });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  // Rate-limit: max 3 open requests for this phone in the last hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("merchant_pin_reset_requests")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= 3) {
    return json(429, {
      ok: false,
      message: "We've already received your request. Our support team will reach out shortly.",
    });
  }

  const { error: insertErr } = await admin
    .from("merchant_pin_reset_requests")
    .insert({
      phone,
      note: note || null,
      source: body?.source === "merchant-manager-login" ? "merchant-manager-login" : "merchant-login",
      ip,
      user_agent: userAgent,
    });

  if (insertErr) {
    console.error("merchant-forgot-pin insert failed", insertErr);
    return json(500, { ok: false, message: "Couldn't submit request. Please try again." });
  }

  return json(200, {
    ok: true,
    masked_phone: maskPhone(phone),
    message: `Request received. Our team will contact you on +880 ${maskPhone(phone)} shortly.`,
  });
});
