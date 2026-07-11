/**
 * Shared deterministic wallet-ID generator + validators.
 *
 * Format: EZP-{TYPE}{ROUTE}-{HASH}  (13 chars, uppercase, alphabetic)
 *   Personal user :  EZP-XXXX-XXXX      (both blocks hashed from phone)
 *   Agent         :  EZP-AGN{RR}-XXXX   (AGN + 2-letter route)
 *   Merchant      :  EZP-MRC{RR}-XXXX   (MRC + 2-letter route)
 *
 * Route codes (RR) are 2-letter Bangladesh division / operating-region codes,
 * e.g. DH (Dhaka), KH (Khulna), NR (Narayanganj/…). Any 2 uppercase letters
 * are accepted at validation time; new routes can be added without a schema
 * change. The default route when generating an ID is "DH".
 */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type WalletRole = "user" | "agent" | "merchant";
export type WalletRoute = string; // 2-letter uppercase

const ROLE_TYPE_PREFIX: Record<Exclude<WalletRole, "user">, string> = {
  agent: "AGN",
  merchant: "MRC",
};

const hashBlock = (seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Array.from({ length: 4 }, (_, i) =>
    CHARS[Math.abs((h >> (i * 5)) % 26)]
  ).join("");
};

const normalizeRoute = (route: string | undefined): string => {
  const r = (route || "DH").toUpperCase().replace(/[^A-Z]/g, "");
  return r.length >= 2 ? r.slice(0, 2) : "DH";
};

/**
 * Deterministic wallet-ID generator.
 * Default role = "user" for backward compatibility. `route` is the 2-letter
 * region code (defaults to "DH").
 */
export const generateWalletId = (
  seed: string,
  role: WalletRole = "user",
  route: WalletRoute = "DH",
): string => {
  const suffix = hashBlock(seed + "salt");
  if (role === "agent")    return `EZP-${ROLE_TYPE_PREFIX.agent}${normalizeRoute(route)}-${suffix}`;
  if (role === "merchant") return `EZP-${ROLE_TYPE_PREFIX.merchant}${normalizeRoute(route)}-${suffix}`;
  return `EZP-${hashBlock(seed)}-${suffix}`;
};

// ─── Validators ─────────────────────────────────────────────────────────────
/** Any well-formed EasyPay wallet ID (personal, agent, or merchant). */
export const WALLET_ID_RE = /^EZP-[A-Z]{4,5}-[A-Z]{4}$/;
/** Agent wallet: type=AGN + 2-letter route. */
export const AGENT_WALLET_RE = /^EZP-AGN[A-Z]{2}-[A-Z]{4}$/;
/** Merchant wallet: type=MRC + 2-letter route. */
export const MERCHANT_WALLET_RE = /^EZP-MRC[A-Z]{2}-[A-Z]{4}$/;
/** Personal user wallet: 4-letter middle block that is NOT an agent/merchant type prefix. */
export const USER_WALLET_RE = /^EZP-(?!AGN[A-Z]{2}$)(?!MRC[A-Z]{2}$)[A-Z]{4}-[A-Z]{4}$/;

export const normalizeWalletId = (raw: string): string =>
  (raw || "").trim().toUpperCase();

/** Extract the 2-letter route code from an agent/merchant wallet ID, or null. */
export const extractWalletRoute = (id: string): string | null => {
  const v = normalizeWalletId(id);
  const m = v.match(/^EZP-(?:AGN|MRC)([A-Z]{2})-[A-Z]{4}$/);
  return m ? m[1] : null;
};

export const detectWalletRole = (id: string): WalletRole | null => {
  const v = normalizeWalletId(id);
  if (AGENT_WALLET_RE.test(v)) return "agent";
  if (MERCHANT_WALLET_RE.test(v)) return "merchant";
  if (USER_WALLET_RE.test(v)) return "user";
  return null;
};

export interface WalletValidation {
  ok: boolean;
  role?: WalletRole;
  route?: string | null;
  normalized?: string;
  /** i18n-friendly stable reason code. */
  reason?: "empty" | "bad_format" | "role_mismatch";
}

/**
 * Validate a wallet ID's format and (optionally) that it belongs to the
 * expected role for the current flow.
 *
 *   validateWalletId(id)                 // format-only
 *   validateWalletId(id, "agent")        // must be an agent wallet
 *   validateWalletId(id, "merchant")     // must be a merchant wallet
 *   validateWalletId(id, "user")         // must be a personal user wallet
 */
export const validateWalletId = (
  id: string | null | undefined,
  expectedRole?: WalletRole,
): WalletValidation => {
  if (!id || !id.trim()) return { ok: false, reason: "empty" };
  const normalized = normalizeWalletId(id);
  const role = detectWalletRole(normalized);
  if (!role) return { ok: false, reason: "bad_format", normalized };
  if (expectedRole && role !== expectedRole) {
    return { ok: false, role, normalized, route: extractWalletRoute(normalized), reason: "role_mismatch" };
  }
  return { ok: true, role, normalized, route: extractWalletRoute(normalized) };
};

/**
 * Verify a displayed/cached wallet ID matches the ID that would be
 * regenerated for (seed, role, route) — protects against stale or tampered
 * caches. When `route` is omitted, the route of the cached ID is used so
 * region-only differences don't cause false negatives.
 */
export const verifyCachedWalletId = (
  cachedId: string | null | undefined,
  seed: string,
  role: WalletRole = "user",
  route?: WalletRoute,
): boolean => {
  if (!cachedId || !seed) return false;
  const cached = normalizeWalletId(cachedId);
  const useRoute = route ?? (extractWalletRoute(cached) || "DH");
  return cached === normalizeWalletId(generateWalletId(seed, role, useRoute));
};
