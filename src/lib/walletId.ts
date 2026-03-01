/**
 * Shared deterministic wallet-ID generator.
 * Format: MFS-ABCD-EFGH  (alphabetic only)
 */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const hashBlock = (seed: string): string => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Array.from({ length: 4 }, (_, i) =>
    CHARS[Math.abs((h >> (i * 5)) % 26)]
  ).join("");
};

export const generateWalletId = (seed: string): string =>
  `EZP-${hashBlock(seed)}-${hashBlock(seed + "salt")}`;
