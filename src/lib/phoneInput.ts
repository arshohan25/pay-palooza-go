/**
 * Centralized helpers for Bangladeshi mobile-number inputs.
 *
 * Rules applied everywhere in the app:
 *   1. Strip anything that isn't a digit.
 *   2. If the user pastes an international-format number (+880… or 880…),
 *      drop the country code and rebuild the local number starting with `0`.
 *      Examples:
 *        "+8801712345678" -> "01712345678"
 *        "8801712345678"  -> "01712345678"
 *        "+880 1712 345 678" -> "01712345678"
 *   3. Clamp to at most 11 characters (BD MSISDN length).
 *
 * Use `normalizeBDPhoneInput` from every phone input `onChange` handler so
 * users cannot type or paste more than 11 digits, and the +880 prefix is
 * silently normalized to the local `0…` form.
 */
export function normalizeBDPhoneInput(raw: string): string {
  if (!raw) return "";
  // Strip everything except digits (also removes "+", spaces, dashes, etc.)
  let digits = raw.replace(/\D/g, "");
  // Handle "880…" / "+880…" — drop the country code and prepend 0.
  if (digits.startsWith("880")) {
    digits = "0" + digits.slice(3);
  }
  return digits.slice(0, 11);
}

/** True when the value is a fully-typed BD mobile number. */
export function isValidBDPhone(value: string): boolean {
  const n = normalizeBDPhoneInput(value);
  return n.length === 11 && n.startsWith("01");
}
