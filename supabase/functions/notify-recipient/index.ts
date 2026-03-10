import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      user_id,
      amount,
      sender_name,
      sender_phone,
      reference,
      type,
      txn_id,
      balance_after,
      created_at,
    } = await req.json();

    if (!user_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up recipient phone from profiles
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone, name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!profile?.phone) {
      return new Response(
        JSON.stringify({ error: "Recipient phone not found", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send SMS via Twilio
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      console.log("Twilio not configured, skipping SMS");
      return new Response(
        JSON.stringify({ success: true, sms: "skipped", reason: "Twilio not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format BD phone: add +88 if needed
    let phone = profile.phone;
    if (phone.startsWith("01")) phone = "+88" + phone;
    else if (!phone.startsWith("+")) phone = "+" + phone;

    const formattedAmount = Number(amount).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const senderInfo = sender_name || sender_phone || "Unknown";
    const balanceStr = balance_after
      ? ` Balance: ৳${Number(balance_after).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      : "";
    const refStr = reference ? ` Ref: ${reference}.` : "";
    const txnIdStr = txn_id ? ` TxnID: ${txn_id}.` : "";
    const dateStr = created_at
      ? ` ${new Date(created_at).toLocaleString("en-BD", { dateStyle: "short", timeStyle: "short" })}`
      : "";

    // Build type-appropriate SMS body
    let smsBody: string;
    switch (type) {
      case "send":
        smsBody = `EasyPay: You sent ৳${formattedAmount} to ${senderInfo}.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "receive":
        smsBody = `EasyPay: You have received ৳${formattedAmount} from ${senderInfo}.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "cashout":
        smsBody = `EasyPay: Cash out of ৳${formattedAmount} completed.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "cashin":
        smsBody = `EasyPay: Cash in of ৳${formattedAmount} received from ${senderInfo}.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "payment":
        smsBody = `EasyPay: Payment of ৳${formattedAmount} to ${senderInfo}.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "recharge":
        smsBody = `EasyPay: Recharge of ৳${formattedAmount} completed.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "paybill":
        smsBody = `EasyPay: Bill payment of ৳${formattedAmount} completed.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "banktransfer":
        smsBody = `EasyPay: Bank transfer of ৳${formattedAmount} completed.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "addmoney":
        smsBody = `EasyPay: ৳${formattedAmount} added to your wallet.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      case "chargeback":
        smsBody = `EasyPay: ৳${formattedAmount} deducted (chargeback).${balanceStr}${txnIdStr}${refStr}${dateStr}`;
        break;
      default:
        smsBody = `EasyPay: Transaction of ৳${formattedAmount} processed.${balanceStr}${txnIdStr}${refStr}${dateStr}`;
    }

    const formData = new URLSearchParams();
    formData.append("To", phone);
    formData.append("From", TWILIO_FROM);
    formData.append("Body", smsBody);

    const smsRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    const smsData = await smsRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        sms: smsRes.ok ? "sent" : "failed",
        sid: smsData.sid || null,
        error: smsRes.ok ? null : smsData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("notify-recipient error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
