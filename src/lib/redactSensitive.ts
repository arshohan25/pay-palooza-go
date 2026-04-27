/**
 * Redacts sensitive patterns from text before displaying it in UI.
 * Covers: emails, phone numbers, NID numbers, bank account/card numbers,
 * API keys, passwords, PINs, OTPs, and URLs with credentials.
 */
export function redactSensitive(text: string): string {
  if (!text) return text;

  let redacted = text;

  // Email addresses
  redacted = redacted.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL REDACTED]"
  );

  // Bangladesh phone numbers (+8801XXXXXXXXX or 01XXXXXXXXX)
  redacted = redacted.replace(
    /\+?8801[3-9]\d{8}|01[3-9]\d{8}/g,
    "[PHONE REDACTED]"
  );

  // NID / national ID numbers (10-17 digits, common in Bangladesh)
  redacted = redacted.replace(
    /\b\d{10,17}\b/g,
    "[ID REDACTED]"
  );

  // Bank account / card numbers (4+ groups of 4 digits, or 13-19 digit sequences)
  redacted = redacted.replace(
    /\b(?:\d{4}[-\s]?){3,}\d{1,4}\b|\b\d{13,19}\b/g,
    "[ACCOUNT REDACTED]"
  );

  // API keys / tokens (common patterns: sk-, pk-, Bearer, etc.)
  redacted = redacted.replace(
    /\b(sk-[a-zA-Z0-9_-]{16,}|pk-[a-zA-Z0-9_-]{16,}|Bearer\s+[a-zA-Z0-9_-]{20,}|api[_-]?key[:\s=]+[a-zA-Z0-9_-]{8,})\b/gi,
    "[API KEY REDACTED]"
  );

  // Passwords / PINs / OTPs in text
  redacted = redacted.replace(
    /\b(password|pin|otp|passcode|secret)[:\s=]+\S{3,}\b/gi,
    "[CREDENTIAL REDACTED]"
  );

  // URLs with embedded credentials (user:pass@host)
  redacted = redacted.replace(
    /([a-zA-Z][a-zA-Z0-9+.-]*):\/\/[^\s:@]+:[^\s@]+@/gi,
    "$1://[CREDENTIALS REDACTED]@"
  );

  return redacted;
}
