import { parseQrData } from "@/lib/qrParser";
import { WALLET_ID_RE, AGENT_WALLET_RE } from "@/lib/walletId";
import { activityTracker } from "@/lib/activityTracker";

export interface CashOutQrPayloadResult {
  value: string;
  candidates?: string[];
  error?: string;
  name?: string;
  /** Stable reason code when parsing failed (empty result or error surfaced). */
  reason?: "empty" | "not_agent" | "unreadable" | "ok";
}

const normalizeAgentIdentifier = (value: string) => {
  const trimmed = (value || "").trim();
  return AGENT_WALLET_RE.test(trimmed.toUpperCase()) ? trimmed.toUpperCase() : trimmed;
};

/**
 * Normalize common paste/scan variants BEFORE routing:
 *  - Bangladeshi phones: strip spaces / hyphens / parens; convert
 *    `+8801XXXXXXXXX`, `8801XXXXXXXXX`, `008801XXXXXXXXX`, `01 7XX XXX XXX`
 *    into canonical `01XXXXXXXXX` (11 digits).
 *  - Agent wallet ids: uppercase, remove internal whitespace, re-insert
 *    missing hyphens when the user pastes a hyphen-stripped id
 *    (e.g. `EZPAGNDHRWGS` → `EZP-AGNDH-RWGS`).
 *  - Leaves URLs / JSON payloads untouched — those are handled downstream.
 */
export function normalizeCashOutInput(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return s;
  // Never touch structured payloads.
  if (s.startsWith("{") || /^https?:\/\//i.test(s)) return s;

  // Phone: strip visual noise (spaces, hyphens, parens, dots).
  const digitsOnly = s.replace(/[\s\-().]/g, "");
  // 00880… → +880…
  const noIddZero = digitsOnly.replace(/^00(?=880)/, "+");
  // +8801XXXXXXXXX / 8801XXXXXXXXX / 01XXXXXXXXX → 01XXXXXXXXX
  const phoneMatch = noIddZero.match(/^(?:\+?8800?|0)?(1[3-9]\d{8})$/);
  if (phoneMatch) return `0${phoneMatch[1]}`;

  // Wallet id: uppercase + strip internal spaces.
  const compact = s.replace(/\s+/g, "").toUpperCase();
  if (AGENT_WALLET_RE.test(compact) || WALLET_ID_RE.test(compact)) return compact;
  // Hyphen-stripped agent id: EZPAGN{RR}{XXXX} → EZP-AGN{RR}-XXXX
  const hyphenless = compact.match(/^EZPAGN([A-Z]{2})([A-Z]{4})$/);
  if (hyphenless) return `EZP-AGN${hyphenless[1]}-${hyphenless[2]}`;
  // Hyphen-stripped generic wallet: EZP{4-5}{4} → EZP-XXXX(X)-XXXX
  const genericHyphenless = compact.match(/^EZP([A-Z]{4,5})([A-Z]{4})$/);
  if (genericHyphenless) return `EZP-${genericHyphenless[1]}-${genericHyphenless[2]}`;

  return s;
}

/** Safe preview for telemetry — strips digits/letters that could be PII. */
function redactPreview(raw: string): string {
  const s = (raw || "").slice(0, 64);
  return s
    .replace(/01[3-9]\d{8}/g, "[PHONE]")
    .replace(/\+?880\s?1[3-9][\d\s-]{7,}/g, "[PHONE]")
    .replace(/EZP-[A-Z]{4,5}-[A-Z]{4}/gi, "[WALLET]")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[EMAIL]");
}

function logQrParseOutcome(
  reason: NonNullable<CashOutQrPayloadResult["reason"]>,
  raw: string,
  extra?: Record<string, unknown>,
) {
  if (reason === "ok") return;
  try {
    activityTracker.qr("qr_scanned", {
      surface: "cashout",
      outcome: "parse_failed",
      reason,
      preview: redactPreview(raw),
      length: raw.length,
      ...extra,
    });
  } catch {
    // telemetry must never break the flow
  }
}

/**
 * Pure parser for the Cash Out "scan / paste an agent QR" input.
 *
 * Behaviour:
 *  - Runs `normalizeCashOutInput` first (phone + wallet-id shape fixes).
 *  - Delegates to the shared parseQrData router.
 *  - Recognises legacy JSON and URL agent-QR encodings.
 *  - Falls back to a regex sweep for truncated / partially typed payloads.
 *  - Never surfaces raw JSON/URL strings as the resolved value — if nothing
 *    identifiable was extracted, returns `reason: "unreadable"` so the caller
 *    can show a user-friendly message instead of sending garbage downstream.
 *  - Emits redacted telemetry for every non-OK outcome via activityTracker.
 */
export function parseCashOutQrPayload(
  raw: string,
  t: (key: string) => string,
): CashOutQrPayloadResult {
  const original = (raw || "").trim();
  if (!original) return { value: "", reason: "empty" };

  const s = normalizeCashOutInput(original);

  const parsed = parseQrData(s);
  if (parsed.flow === "cashout") {
    const candidates = (parsed.candidates?.length ? parsed.candidates : [parsed.identifier]).map(
      normalizeAgentIdentifier,
    );
    return { value: candidates[0] || "", candidates, name: parsed.name, reason: "ok" };
  }
  if (parsed.flow === "send" || parsed.flow === "payment" || parsed.flow === "dynamic_payment") {
    logQrParseOutcome("not_agent", original, { flow: parsed.flow });
    return { value: parsed.identifier || s, error: t("coQrNotAgent"), name: parsed.name, reason: "not_agent" };
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
            reason: "ok",
          };
        }
        if (WALLET_ID_RE.test(v)) {
          logQrParseOutcome("not_agent", original, { source: "json_wallet" });
          return { value: v, error: t("coQrNotAgent"), reason: "not_agent" };
        }
        return { value: v, name: obj.name || obj.businessName || undefined, reason: "ok" };
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
        logQrParseOutcome("not_agent", original, { source: "url_wallet" });
        return { value: v, error: t("coQrNotAgent"), reason: "not_agent" };
      }
      return { value: normalizeAgentIdentifier(v), reason: "ok" };
    }
  } catch {}

  // Last-resort regex extraction — truncated / partially-typed payloads.
  if (s.length > 6) {
    const wm = s.toUpperCase().match(/EZP-AGN[A-Z]{2}-[A-Z]{4}/);
    if (wm) return { value: wm[0], reason: "ok" };
    const pm = s.match(/01[3-9]\d{8}/);
    if (pm) return { value: pm[0], reason: "ok" };
  }

  // Structured-looking input (JSON braces, quotes, URL scheme) that yielded
  // no identifier → do NOT forward the raw payload downstream.
  const looksStructured = /[{}"]/.test(s) || /^[a-z]+:\/\//i.test(s);
  if (looksStructured) {
    logQrParseOutcome("unreadable", original, { source: "structured_no_match" });
    return { value: "", error: t("coQrUnreadable"), reason: "unreadable" };
  }

  // Plain text that didn't match any pattern — let the caller try RPC lookup,
  // but still record it so we can spot common malformed inputs.
  logQrParseOutcome("unreadable", original, { source: "plain_no_match" });
  return { value: s, reason: "unreadable" };
}
