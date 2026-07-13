import { parseQrData } from "@/lib/qrParser";
import { WALLET_ID_RE, AGENT_WALLET_RE } from "@/lib/walletId";

export interface CashOutQrPayloadResult {
  value: string;
  candidates?: string[];
  error?: string;
  name?: string;
}

const normalizeAgentIdentifier = (value: string) => {
  const trimmed = (value || "").trim();
  return AGENT_WALLET_RE.test(trimmed.toUpperCase()) ? trimmed.toUpperCase() : trimmed;
};

/**
 * Pure parser for the Cash Out "scan / paste an agent QR" input.
 *
 * Extracted from CashOutFlow so it can be unit tested in isolation. Accepts a
 * translator callback so error messages match the surrounding UI locale.
 *
 * Behaviour:
 *  - Delegates first to the shared parseQrData router.
 *  - Recognises legacy JSON and URL agent-QR encodings.
 *  - Falls back to a regex sweep so truncated / partially typed JSON payloads
 *    still surface a usable agent wallet id or 11-digit BD phone.
 */
export function parseCashOutQrPayload(
  raw: string,
  t: (key: string) => string,
): CashOutQrPayloadResult {
  const s = (raw || "").trim();
  if (!s) return { value: s };

  const parsed = parseQrData(s);
  if (parsed.flow === "cashout") {
    const candidates = (parsed.candidates?.length ? parsed.candidates : [parsed.identifier]).map(
      normalizeAgentIdentifier,
    );
    return { value: candidates[0] || "", candidates, name: parsed.name };
  }
  if (parsed.flow === "send" || parsed.flow === "payment" || parsed.flow === "dynamic_payment") {
    return { value: parsed.identifier || s, error: t("coQrNotAgent"), name: parsed.name };
  }

  // Legacy JSON extraction (agent QR payloads that predate parseQrData)
  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s);
      const val =
        obj.WALLETID || obj.walletId || obj.walletID ||
        obj.AGENTID || obj.agentId || obj.agent_id ||
        obj.PHONE || obj.phone || obj.identifier || "";
      if (val) {
        const v = String(val).trim();
        const phone = String(obj.phone || obj.PHONE || obj.agentPhone || obj.agent_phone || "").trim();
        if (AGENT_WALLET_RE.test(v.toUpperCase())) {
          return {
            value: phone || v.toUpperCase(),
            candidates: [phone, v.toUpperCase()].filter(Boolean),
            name: obj.name || obj.businessName || undefined,
          };
        }
        if (WALLET_ID_RE.test(v)) return { value: v, error: t("coQrNotAgent") };
        return { value: v, name: obj.name || obj.businessName || undefined };
      }
    } catch {}
  }

  // Legacy URL extraction
  try {
    const u = new URL(s);
    const val =
      u.searchParams.get("walletId") ||
      u.searchParams.get("WALLETID") ||
      u.searchParams.get("agentId") ||
      u.searchParams.get("phone");
    if (val) {
      const v = val.trim();
      if (WALLET_ID_RE.test(v) && !AGENT_WALLET_RE.test(v.toUpperCase())) {
        return { value: v, error: t("coQrNotAgent") };
      }
      return { value: normalizeAgentIdentifier(v) };
    }
  } catch {}

  // Last-resort regex extraction — handles truncated / partially-typed JSON
  // payloads (e.g. `{"app":"EasyPay","type":"agent","wallet` ) where JSON.parse
  // fails but the raw text still contains a recognisable agent wallet id or
  // Bangladeshi phone number.
  if (s.length > 6) {
    const wm = s.toUpperCase().match(/EZP-AGN[A-Z]{2}-[A-Z]{4}/);
    if (wm) return { value: wm[0] };
    const pm = s.match(/01[3-9]\d{8}/);
    if (pm) return { value: pm[0] };
  }
  return { value: s };
}
