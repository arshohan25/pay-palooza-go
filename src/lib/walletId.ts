/**
 * Shared deterministic wallet-ID generator + validators.
 *
 * Formats (13 chars, uppercase, alphabetic):
 *   Personal user :  EZP-XXXX-XXXX   (both blocks hashed from phone)
 *   Agent         :  EZP-AGDH-XXXX   (fixed marker + hashed suffix)
 *   Merchant      :  EZP-MRCD-XXXX   (fixed marker + hashed suffix)
 */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type WalletRole = "user" | "agent" | "merchant";

const ROLE_MARKER: Record<Exclude<WalletRole, "user">, string> = {
  agent: "AGDH",
  merchant: "MRCD",
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

/**
 * Deterministic wallet-ID generator.
 * Default role = "user" for backward compatibility.
 */
export const generateWalletId = (seed: string, role: WalletRole = "user"): string => {
  const suffix = hashBlock(seed + "salt");
  if (role === "agent") return `EZP-${ROLE_MARKER.agent}-${suffix}`;
  if (role === "merchant") return `EZP-${ROLE_MARKER.merchant}-${suffix}`;
  return `EZP-${hashBlock(seed)}-${suffix}`;
};

// ─── Validators ─────────────────────────────────────────────────────────────
export const WALLET_ID_RE = /^EZP-[A-Z]{4}-[A-Z]{4}$/;
export const AGENT_WALLET_RE = /^EZP-AGDH-[A-Z]{4}$/;
export const MERCHANT_WALLET_RE = /^EZP-MRCD-[A-Z]{4}$/;
/** Personal user: any 4-letter middle block that is NOT a reserved role marker. */
export const USER_WALLET_RE = /^EZP-(?!AGDH|MRCD)[A-Z]{4}-[A-Z]{4}$/;

export const normalizeWalletId = (raw: string): string =>
  (raw || "").trim().toUpperCase();

export const detectWalletRole = (id: string): WalletRole | null => {
  const v = normalizeWalletId(id);
  if (!WALLET_ID_RE.test(v)) return null;
  if (AGENT_WALLET_RE.test(v)) return "agent";
  if (MERCHANT_WALLET_RE.test(v)) return "merchant";
  return "user";
};

export interface WalletValidation {
  ok: boolean;
  role?: WalletRole;
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
  if (!WALLET_ID_RE.test(normalized)) return { ok: false, reason: "bad_format" };
  const role = detectWalletRole(normalized)!;
  if (expectedRole && role !== expectedRole) {
    return { ok: false, role, normalized, reason: "role_mismatch" };
  }
  return { ok: true, role, normalized };
};

/**
 * Verify a displayed/cached wallet ID matches the ID that would be
 * regenerated for (seed, role) — protects against stale or tampered caches.
 */
export const verifyCachedWalletId = (
  cachedId: string | null | undefined,
  seed: string,
  role: WalletRole = "user",
): boolean => {
  if (!cachedId || !seed) return false;
  return normalizeWalletId(cachedId) === normalizeWalletId(generateWalletId(seed, role));
};
