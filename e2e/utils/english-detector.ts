/**
 * Configurable English-text detector for i18n=bn coverage tests.
 *
 * Goals:
 *  - Catch real English UI copy ("Confirm", "Continue", "Loading...").
 *  - Ignore brand/proper-noun tokens (Amazon, bKash, Visa…).
 *  - Ignore numeric / structured tokens that look like letters but aren't
 *    user-facing copy (UUIDs, JWTs, hex, ISO dates, phone numbers, URLs,
 *    emails, currency codes glued to digits, wallet IDs, etc.).
 *
 * All knobs are overridable via env so CI can extend the allow-list
 * without editing source:
 *   I18N_BN_WHITELIST            comma-sep extra whole-word allow-list
 *   I18N_BN_IGNORE_PATTERNS      comma-sep extra regex sources (flags: gi)
 *                                "name=source" or just "source"
 *   I18N_BN_WORD_PATTERN         regex source for what counts as a "word"
 *                                (default: [A-Za-z][A-Za-z'&]{2,})
 *   I18N_BN_MIN_WORD_LEN         min length for a token to be flagged (default 3)
 *   I18N_BN_DEBUG                "1" to print per-text trace + summary
 */

export interface NamedPattern {
  name: string;
  re: RegExp;
}

export interface DetectorConfig {
  /** Whole-word allow-list, compared lowercased. */
  whitelist: Set<string>;
  /** Named regexes whose matches are stripped from input before scanning. */
  ignorePatterns: NamedPattern[];
  /** What counts as an English-looking word. Must be /g. */
  wordPattern: RegExp;
  /** Minimum length to be considered (after stripping). */
  minWordLen: number;
  /** When true, callers should record/print debug traces. */
  debug: boolean;
}

export interface InspectResult {
  text: string;
  /** Pattern name → matched substrings that were stripped. */
  ignored: Record<string, string[]>;
  /** Whitelisted whole-word tokens that were dropped. */
  whitelisted: string[];
  /** Tokens that triggered failure (real English copy). */
  offenders: string[];
  /** Residue after stripping, useful for eyeballing what survived. */
  residue: string;
}

const DEFAULT_WHITELIST = [
  // Currency / units / abbreviations
  "tk", "bdt", "usd", "eur", "gbp", "sar", "aed", "inr",
  "kg", "g", "mg", "ml", "l", "cm", "mm", "km", "pcs",
  "qr", "id", "pin", "otp", "kyc", "sms", "api", "url",
  "pdf", "png", "jpg", "svg", "csv", "json",
  "ok", "vat", "gst", "sku", "gps", "nid", "ai", "ui", "ux", "qa",
  "ios", "app", "pwa", "cod", "eta", "faq", "tnc",
  // Gift-card / merchant brands (Latin-only by design)
  "amazon", "netflix", "spotify", "google", "play", "apple", "itunes",
  "uber", "eats", "starbucks", "nike", "adidas", "zara", "h&m", "ikea",
  "pathao", "foodpanda", "daraz", "chaldal", "shohoz",
  "bkash", "nagad", "rocket", "upay", "tap",
  "visa", "mastercard", "amex", "paypal", "stripe",
  // Donation / cause partners
  "unicef", "unhcr", "brac", "asha", "as-sunnah", "quantum",
  // Islamic terms transliterated (acceptable Romanized form)
  "qard", "hasan", "hasana", "hasanah", "zakat", "sadaqah", "sadaqa",
  "dps", "halal", "haram", "sharia", "shariah", "riba", "waqf",
  "iftar", "ramadan", "eid",
  // App / platform
  "easypay", "lovable",
];

/**
 * Regex patterns whose matches we delete from candidate text *before*
 * the word scan. Order matters — longest-match patterns first.
 *
 * Everything uses the `gi` flag implicitly via build helper.
 */
const DEFAULT_IGNORE_SOURCES: string[] = [
  // URLs & emails
  String.raw`https?:\/\/\S+`,
  String.raw`\b[\w.+-]+@[\w-]+\.[\w.-]+\b`,
  // JWT-ish: three base64 segments joined by dots
  String.raw`\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b`,
  // UUID v1-v5
  String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`,
  // Long hex blobs (tx hashes, signatures, fingerprints)
  String.raw`\b[0-9a-f]{16,}\b`,
  // ISO-ish dates & times: 2026-06-17, 14:35:09, 14:35
  String.raw`\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?Z?)?\b`,
  String.raw`\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b`,
  // Phone-ish: +8801XXXXXXXXX, 01XXXXXXXXX, sequences of 7+ digits
  String.raw`\+?\d[\d\s().-]{6,}\d`,
  // Numbers with thousands separators / decimals / percentages
  String.raw`-?\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?%?`,
  String.raw`-?\d+(?:\.\d+)?%?`,
  // Currency-attached: USD123, BDT 1,200, Tk500, 50৳
  String.raw`\b(?:tk|bdt|usd|eur|gbp|sar|aed|inr)\s?-?\d[\d,.]*`,
  // Wallet / order / txn IDs: TXN-12345, ORD_98, #A1B2C3, EP-2024-001
  String.raw`#[A-Za-z0-9_-]{3,}`,
  String.raw`\b[A-Z]{2,5}[-_]?\d[A-Za-z0-9-]*\b`,
  // Version strings: v1.2.3, 1.2.3
  String.raw`\bv?\d+\.\d+(?:\.\d+)?\b`,
  // File paths & extensions
  String.raw`\/[\w./-]+`,
  String.raw`\b\w+\.(?:png|jpg|jpeg|webp|svg|pdf|csv|json|mp4)\b`,
  // Single Latin letter (likely list bullet / units like "g")
  String.raw`(?<![A-Za-z])[A-Za-z](?![A-Za-z])`,
];

function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function buildDetector(overrides: Partial<DetectorConfig> = {}): DetectorConfig {
  const whitelist = new Set<string>(
    [...DEFAULT_WHITELIST, ...envList("I18N_BN_WHITELIST")].map((s) => s.toLowerCase()),
  );
  for (const w of overrides.whitelist ?? []) whitelist.add(w.toLowerCase());

  const ignoreSources = [
    ...DEFAULT_IGNORE_SOURCES,
    ...envList("I18N_BN_IGNORE_PATTERNS"),
  ];
  const ignorePatterns = [
    ...ignoreSources.map((src) => new RegExp(src, "gi")),
    ...(overrides.ignorePatterns ?? []),
  ];

  const wordSrc = process.env.I18N_BN_WORD_PATTERN ?? String.raw`[A-Za-z][A-Za-z'&]{2,}`;
  const wordPattern = overrides.wordPattern ?? new RegExp(wordSrc, "g");

  const minWordLen = overrides.minWordLen
    ?? Number(process.env.I18N_BN_MIN_WORD_LEN ?? 3);

  return { whitelist, ignorePatterns, wordPattern, minWordLen };
}

/** Strip ignore-patterns then whitelisted words. Returns the residue. */
export function sanitize(text: string, cfg: DetectorConfig): string {
  let out = text;
  for (const re of cfg.ignorePatterns) {
    out = out.replace(re, " ");
  }
  // Rebuild regex copy to reset lastIndex safely.
  const wordRe = new RegExp(cfg.wordPattern.source, cfg.wordPattern.flags);
  out = out.replace(wordRe, (w) => (cfg.whitelist.has(w.toLowerCase()) ? " " : w));
  return out;
}

/** Return the list of English-looking offender tokens in `text`. */
export function findEnglish(text: string, cfg: DetectorConfig): string[] {
  const residue = sanitize(text, cfg);
  const wordRe = new RegExp(cfg.wordPattern.source, cfg.wordPattern.flags);
  const matches = residue.match(wordRe) ?? [];
  return matches.filter(
    (m) => m.length >= cfg.minWordLen && !cfg.whitelist.has(m.toLowerCase()),
  );
}
