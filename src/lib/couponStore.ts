/**
 * Pending coupon store – used to pass a coupon from CouponsPage into a transaction flow.
 * The flow reads it, shows the discount, and clears it after use or dismissal.
 */

export interface PendingCoupon {
  id: string;
  code: string;
  discount_type: "percentage" | "flat";
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number | null;
  applicable_flow: string;
}

const KEY = "mfs_pending_coupon";

export function setPendingCoupon(coupon: PendingCoupon) {
  sessionStorage.setItem(KEY, JSON.stringify(coupon));
}

export function getPendingCoupon(forFlow?: string): PendingCoupon | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const coupon: PendingCoupon = JSON.parse(raw);
    if (forFlow && coupon.applicable_flow !== forFlow && coupon.applicable_flow !== "all") return null;
    return coupon;
  } catch {
    return null;
  }
}

export function clearPendingCoupon() {
  sessionStorage.removeItem(KEY);
}

/**
 * Record a coupon redemption server-side. Safe to call without a txn id.
 * Idempotent per (coupon, user, txn_id).
 */
export async function recordCouponRedemption(params: {
  code: string;
  flow: string;
  txnId?: string | null;
  discount: number;
}) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.rpc("record_coupon_redemption", {
      p_code: params.code,
      p_flow: params.flow,
      p_txn_id: params.txnId ?? null,
      p_discount: params.discount,
    });
  } catch (e) {
    console.warn("[coupon] failed to record redemption", e);
  }
}

/**
 * Calculate the discount amount for a given transaction amount.
 */
export function calcCouponDiscount(coupon: PendingCoupon, txnAmount: number): number {
  if (coupon.min_order_amount && txnAmount < coupon.min_order_amount) return 0;
  let discount = 0;
  if (coupon.discount_type === "percentage") {
    discount = (txnAmount * coupon.discount_value) / 100;
    if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
  } else {
    discount = coupon.discount_value;
  }
  return Math.min(discount, txnAmount); // can't discount more than txn amount
}
