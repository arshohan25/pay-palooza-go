import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * NPSB (National Payment Switch Bangladesh) Integration
 *
 * Supported actions:
 *  - fund_transfer   → IFT / EFT transfer via NPSB
 *  - balance_inquiry → Check account balance
 *  - txn_status      → Query transaction status
 *  - test_connection  → Verify NPSB API connectivity
 *
 * Required secrets (to be configured once you have NPSB credentials):
 *  - NPSB_API_BASE_URL
 *  - NPSB_API_KEY
 *  - NPSB_API_SECRET
 *  - NPSB_MERCHANT_ID   (your institution's NPSB participant ID)
 *  - NPSB_SIGNING_KEY   (for request signing / HMAC)
 */

interface NpsbRequest {
  action: "fund_transfer" | "balance_inquiry" | "txn_status" | "test_connection";
  // fund_transfer params
  sender_account?: string;
  receiver_account?: string;
  receiver_bank_code?: string;
  amount?: number;
  currency?: string;
  narration?: string;
  // txn_status params
  reference_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: NpsbRequest = await req.json();
    const { action } = body;

    // Check for NPSB credentials
    const NPSB_API_BASE_URL = Deno.env.get("NPSB_API_BASE_URL");
    const NPSB_API_KEY = Deno.env.get("NPSB_API_KEY");
    const NPSB_API_SECRET = Deno.env.get("NPSB_API_SECRET");
    const NPSB_MERCHANT_ID = Deno.env.get("NPSB_MERCHANT_ID");

    const isConfigured = !!(NPSB_API_BASE_URL && NPSB_API_KEY && NPSB_API_SECRET && NPSB_MERCHANT_ID);

    // ── TEST CONNECTION ──
    if (action === "test_connection") {
      if (!isConfigured) {
        return new Response(
          JSON.stringify({
            success: false,
            configured: false,
            error: "NPSB credentials not configured. Required: NPSB_API_BASE_URL, NPSB_API_KEY, NPSB_API_SECRET, NPSB_MERCHANT_ID",
            required_secrets: ["NPSB_API_BASE_URL", "NPSB_API_KEY", "NPSB_API_SECRET", "NPSB_MERCHANT_ID", "NPSB_SIGNING_KEY"],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Placeholder: In production, ping NPSB health-check endpoint
      // const res = await fetch(`${NPSB_API_BASE_URL}/health`, { headers: { ... } });
      return new Response(
        JSON.stringify({
          success: true,
          configured: true,
          message: "NPSB credentials are configured. Ready for integration testing.",
          participant_id: NPSB_MERCHANT_ID,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── FUND TRANSFER (IFT/EFT) ──
    if (action === "fund_transfer") {
      if (!isConfigured) {
        return new Response(
          JSON.stringify({ error: "NPSB not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { sender_account, receiver_account, receiver_bank_code, amount, currency, narration } = body;

      if (!sender_account || !receiver_account || !receiver_bank_code || !amount) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: sender_account, receiver_account, receiver_bank_code, amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (amount <= 0 || amount > 5000000) {
        return new Response(
          JSON.stringify({ error: "Amount must be between 1 and 5,000,000 BDT" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate unique reference
      const referenceId = `NPSB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      /*
       * ──────────────────────────────────────────────────
       * PLACEHOLDER: Replace with actual NPSB API call
       * ──────────────────────────────────────────────────
       *
       * const npsbPayload = {
       *   participantId: NPSB_MERCHANT_ID,
       *   senderAccount: sender_account,
       *   receiverAccount: receiver_account,
       *   receiverBankCode: receiver_bank_code,
       *   amount: amount,
       *   currency: currency || "BDT",
       *   narration: narration || "Fund Transfer via EasyPay",
       *   referenceId: referenceId,
       *   timestamp: new Date().toISOString(),
       * };
       *
       * const signature = await hmacSign(JSON.stringify(npsbPayload), NPSB_SIGNING_KEY);
       *
       * const npsbRes = await fetch(`${NPSB_API_BASE_URL}/api/v1/fund-transfer`, {
       *   method: "POST",
       *   headers: {
       *     "Content-Type": "application/json",
       *     "X-API-Key": NPSB_API_KEY,
       *     "X-API-Secret": NPSB_API_SECRET,
       *     "X-Signature": signature,
       *   },
       *   body: JSON.stringify(npsbPayload),
       * });
       *
       * const npsbResult = await npsbRes.json();
       */

      // Audit log the attempt
      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "npsb_fund_transfer_attempt",
        entity_type: "npsb",
        entity_id: referenceId,
        details: {
          sender_account,
          receiver_bank_code,
          amount,
          currency: currency || "BDT",
          status: "placeholder_pending",
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          placeholder: true,
          message: "NPSB fund transfer endpoint ready. Connect real NPSB API to process transfers.",
          reference_id: referenceId,
          transfer: {
            sender_account,
            receiver_account: receiver_account.slice(0, 4) + "****",
            receiver_bank_code,
            amount,
            currency: currency || "BDT",
            narration: narration || "Fund Transfer via EasyPay",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── BALANCE INQUIRY ──
    if (action === "balance_inquiry") {
      if (!isConfigured) {
        return new Response(
          JSON.stringify({ error: "NPSB not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /*
       * PLACEHOLDER: Replace with actual NPSB balance inquiry API call
       */

      return new Response(
        JSON.stringify({
          success: true,
          placeholder: true,
          message: "NPSB balance inquiry endpoint ready. Connect real NPSB API.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TRANSACTION STATUS ──
    if (action === "txn_status") {
      const { reference_id } = body;
      if (!reference_id) {
        return new Response(
          JSON.stringify({ error: "reference_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!isConfigured) {
        return new Response(
          JSON.stringify({ error: "NPSB not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /*
       * PLACEHOLDER: Replace with actual NPSB transaction status query
       */

      return new Response(
        JSON.stringify({
          success: true,
          placeholder: true,
          message: "NPSB transaction status endpoint ready. Connect real NPSB API.",
          reference_id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Supported: fund_transfer, balance_inquiry, txn_status, test_connection" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("NPSB transfer error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
