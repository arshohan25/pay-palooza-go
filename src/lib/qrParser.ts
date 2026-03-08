/**
 * Universal QR code parser — extracts structured data from any scanned QR string
 * and determines the correct transaction flow to route to.
 */

export type QrFlow = "send" | "payment" | "unknown";

export interface QrParseResult {
  flow: QrFlow;
  identifier: string;
  name?: string;
}

const PHONE_RE = /^(?:\+?880|0)?1[3-9]\d{8}$/;
const WALLET_RE = /^EZP-[A-Z]{4}-[A-Z]{4}$/i;
const MRC_RE = /^MRC-?/i;

/**
 * Synchronously parse a raw QR string and return routing + extracted identifier.
 * Does NOT call any RPC — the caller should fall back to resolve_transfer_recipient
 * if `flow === "unknown"`.
 */
export function parseQrData(raw: string): QrParseResult {
  const trimmed = raw.trim();

  // 1️⃣ Try JSON parse
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === "object") {
      // Merchant QR (JSON)
      if (obj.merchantId || obj.merchant_id) {
        return {
          flow: "payment",
          identifier: obj.merchantId || obj.merchant_id,
          name: obj.name || obj.businessName || undefined,
        };
      }
      // User / Wallet QR (JSON)
      if (obj.walletId || obj.wallet_id) {
        return {
          flow: "send",
          identifier: obj.walletId || obj.wallet_id,
          name: obj.name || undefined,
        };
      }
      if (obj.phone) {
        return {
          flow: "send",
          identifier: obj.phone,
          name: obj.name || undefined,
        };
      }
    }
  } catch {
    // Not JSON — continue
  }

  // 2️⃣ MRC prefix → payment
  if (MRC_RE.test(trimmed)) {
    return { flow: "payment", identifier: trimmed };
  }

  // 3️⃣ Wallet ID pattern
  if (WALLET_RE.test(trimmed)) {
    return { flow: "send", identifier: trimmed };
  }

  // 4️⃣ Phone number pattern
  const digitsOnly = trimmed.replace(/[^0-9+]/g, "");
  if (PHONE_RE.test(digitsOnly)) {
    // Normalise to 11-digit BD format
    const normalised = digitsOnly.replace(/^\+?880/, "0");
    return { flow: "send", identifier: normalised };
  }

  // 5️⃣ URL with query params
  try {
    const url = new URL(trimmed);
    const pay = url.searchParams.get("pay") || url.searchParams.get("merchant");
    if (pay && MRC_RE.test(pay)) {
      return { flow: "payment", identifier: pay };
    }
    const to = url.searchParams.get("to") || url.searchParams.get("phone") || url.searchParams.get("wallet");
    if (to) {
      if (WALLET_RE.test(to)) return { flow: "send", identifier: to };
      if (PHONE_RE.test(to.replace(/[^0-9+]/g, ""))) {
        return { flow: "send", identifier: to.replace(/^\+?880/, "0") };
      }
    }
  } catch {
    // Not a URL — continue
  }

  // 6️⃣ Unknown — caller should try RPC fallback
  return { flow: "unknown", identifier: trimmed };
}
