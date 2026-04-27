import { supabase } from "@/integrations/supabase/client";

export interface MerchantApiAccessPrefillContext {
  merchantId?: string | null;
  /** Optional override — usually we just resolve from the merchant row. */
  businessName?: string | null;
}

/**
 * Builds the chat draft used when a merchant submits a (new) API access request.
 *
 * Pulls all known company + contact details so the merchant can submit in one tap:
 *   • Merchant ID, business name, category
 *   • Trade license, KYC status, settlement bank
 *   • Owner full name, email, phone
 *
 * Fields with no data are omitted so the message stays clean. The "Purpose"
 * line is left as a placeholder for the merchant to fill in.
 */
export async function buildMerchantApiAccessPrefill(
  userId: string,
  ctx: MerchantApiAccessPrefillContext = {},
): Promise<string> {
  const lines: string[] = [
    "Hi EasyPay team, I'd like to request API access for my merchant account.",
    "",
    "── Merchant details ──",
  ];

  // 1) Merchant record (preferred lookup by id, fallback by user_id).
  let merchant: any = null;
  try {
    if (ctx.merchantId) {
      const { data } = await (supabase as any)
        .from("merchants")
        .select(
          "id, business_name, category, trade_license, business_kyc_status, bank_name, bank_account_holder, settlement_frequency, status",
        )
        .eq("id", ctx.merchantId)
        .maybeSingle();
      merchant = data;
    }
    if (!merchant) {
      const { data } = await (supabase as any)
        .from("merchants")
        .select(
          "id, business_name, category, trade_license, business_kyc_status, bank_name, bank_account_holder, settlement_frequency, status",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      merchant = data;
    }
  } catch {
    /* network / RLS — fall through with whatever we have */
  }

  const merchantId = merchant?.id ?? ctx.merchantId ?? null;
  const businessName = merchant?.business_name ?? ctx.businessName ?? null;

  if (merchantId) lines.push(`• Merchant ID: ${merchantId}`);
  if (businessName) lines.push(`• Business name: ${businessName}`);
  if (merchant?.category) lines.push(`• Category: ${merchant.category}`);
  if (merchant?.trade_license) lines.push(`• Trade license: ${merchant.trade_license}`);
  if (merchant?.business_kyc_status)
    lines.push(`• Business KYC: ${merchant.business_kyc_status}`);
  if (merchant?.status) lines.push(`• Account status: ${merchant.status}`);
  if (merchant?.bank_name)
    lines.push(
      `• Settlement bank: ${merchant.bank_name}${
        merchant.bank_account_holder ? ` (${merchant.bank_account_holder})` : ""
      }${merchant.settlement_frequency ? ` · ${merchant.settlement_frequency}` : ""}`,
    );

  // 2) Owner profile (name, email, phone).
  try {
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("name, email, phone")
      .eq("user_id", userId)
      .maybeSingle();
    if (profile) {
      lines.push("", "── Contact ──");
      if (profile.name) lines.push(`• Owner: ${profile.name}`);
      if (profile.email) lines.push(`• Email: ${profile.email}`);
      if (profile.phone) lines.push(`• Phone: ${profile.phone}`);
    }
  } catch {
    /* ignore */
  }

  lines.push(
    "",
    "── Purpose ──",
    "[briefly describe how you'll use the API — webhooks, checkout, payouts, etc.]",
  );

  return lines.join("\n");
}
