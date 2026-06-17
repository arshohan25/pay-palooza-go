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
const DEFAULT_IGNORE_SOURCES: Array<[name: string, src: string]> = [
  ["url", String.raw`https?:\/\/\S+`],
  ["email", String.raw`\b[\w.+-]+@[\w-]+\.[\w.-]+\b`],
  ["jwt", String.raw`\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b`],
  ["uuid", String.raw`\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`],
  ["hex-blob", String.raw`\b[0-9a-f]{16,}\b`],
  ["iso-date", String.raw`\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?Z?)?\b`],
  ["clock-time", String.raw`\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b`],
  ["phone", String.raw`\+?\d[\d\s().-]{6,}\d`],
  ["number-grouped", String.raw`-?\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?%?`],
  ["number-plain", String.raw`-?\d+(?:\.\d+)?%?`],
  ["currency-amount", String.raw`\b(?:tk|bdt|usd|eur|gbp|sar|aed|inr)\s?-?\d[\d,.]*`],
  ["hash-id", String.raw`#[A-Za-z0-9_-]{3,}`],
  ["code-id", String.raw`\b[A-Z]{2,5}[-_]?\d[A-Za-z0-9-]*\b`],
  ["version", String.raw`\bv?\d+\.\d+(?:\.\d+)?\b`],
  ["path", String.raw`\/[\w./-]+`],
  ["filename", String.raw`\b\w+\.(?:png|jpg|jpeg|webp|svg|pdf|csv|json|mp4)\b`],
  ["lone-letter", String.raw`(?<![A-Za-z])[A-Za-z](?![A-Za-z])`],
];

function envList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseNamedSource(entry: string, idx: number): NamedPattern {
  const eq = entry.indexOf("=");
  if (eq > 0) {
    return { name: entry.slice(0, eq), re: new RegExp(entry.slice(eq + 1), "gi") };
  }
  return { name: `custom-${idx}`, re: new RegExp(entry, "gi") };
}

export function buildDetector(overrides: Partial<DetectorConfig> = {}): DetectorConfig {
  const whitelist = new Set<string>(
    [...DEFAULT_WHITELIST, ...envList("I18N_BN_WHITELIST")].map((s) => s.toLowerCase()),
  );
  for (const w of overrides.whitelist ?? []) whitelist.add(w.toLowerCase());

  const ignorePatterns: NamedPattern[] = [
    ...DEFAULT_IGNORE_SOURCES.map(([n, src]) => ({ name: n, re: new RegExp(src, "gi") })),
    ...envList("I18N_BN_IGNORE_PATTERNS").map(parseNamedSource),
    ...(overrides.ignorePatterns ?? []),
  ];

  const wordSrc = process.env.I18N_BN_WORD_PATTERN ?? String.raw`[A-Za-z][A-Za-z'&]{2,}`;
  const wordPattern = overrides.wordPattern ?? new RegExp(wordSrc, "g");

  const minWordLen = overrides.minWordLen
    ?? Number(process.env.I18N_BN_MIN_WORD_LEN ?? 3);

  const debug = overrides.debug ?? process.env.I18N_BN_DEBUG === "1";

  return { whitelist, ignorePatterns, wordPattern, minWordLen, debug };
}

/** Strip ignore-patterns then whitelisted words. Returns the residue. */
export function sanitize(text: string, cfg: DetectorConfig): string {
  let out = text;
  for (const { re } of cfg.ignorePatterns) {
    out = out.replace(new RegExp(re.source, re.flags), " ");
  }
  const wordRe = new RegExp(cfg.wordPattern.source, cfg.wordPattern.flags);
  out = out.replace(wordRe, (w) => (cfg.whitelist.has(w.toLowerCase()) ? " " : w));
  return out;
}

/**
 * Full trace: which patterns stripped what, which whitelist tokens were
 * dropped, and which words remained as offenders. Use for triage.
 */
export function inspect(text: string, cfg: DetectorConfig): InspectResult {
  const ignored: Record<string, string[]> = {};
  let residue = text;
  for (const { name, re } of cfg.ignorePatterns) {
    const localRe = new RegExp(re.source, re.flags);
    const hits = residue.match(localRe);
    if (hits && hits.length) ignored[name] = hits;
    residue = residue.replace(new RegExp(re.source, re.flags), " ");
  }
  const whitelisted: string[] = [];
  const wordRe1 = new RegExp(cfg.wordPattern.source, cfg.wordPattern.flags);
  residue = residue.replace(wordRe1, (w) => {
    if (cfg.whitelist.has(w.toLowerCase())) {
      whitelisted.push(w);
      return " ";
    }
    return w;
  });
  const wordRe2 = new RegExp(cfg.wordPattern.source, cfg.wordPattern.flags);
  const offenders = (residue.match(wordRe2) ?? []).filter(
    (m) => m.length >= cfg.minWordLen && !cfg.whitelist.has(m.toLowerCase()),
  );
  return { text, ignored, whitelisted, offenders, residue: residue.trim() };
}

/** Return the list of English-looking offender tokens in `text`. */
export function findEnglish(text: string, cfg: DetectorConfig): string[] {
  return inspect(text, cfg).offenders;
}

/**
 * Accumulates inspect() traces across many texts and emits a concise
 * triage summary. Designed for Playwright test runs.
 */
export class DebugReport {
  private cfg: DetectorConfig;
  private results: Array<{ ctx: string; result: InspectResult }> = [];
  private patternHits = new Map<string, number>();
  private whitelistHits = new Map<string, number>();
  private offenderHits = new Map<string, number>();

  constructor(cfg: DetectorConfig) {
    this.cfg = cfg;
  }

  record(ctx: string, text: string): InspectResult {
    const result = inspect(text, this.cfg);
    this.results.push({ ctx, result });
    for (const [name, hits] of Object.entries(result.ignored)) {
      this.patternHits.set(name, (this.patternHits.get(name) ?? 0) + hits.length);
    }
    for (const w of result.whitelisted) {
      const k = w.toLowerCase();
      this.whitelistHits.set(k, (this.whitelistHits.get(k) ?? 0) + 1);
    }
    for (const w of result.offenders) {
      this.offenderHits.set(w, (this.offenderHits.get(w) ?? 0) + 1);
    }
    return result;
  }

  hasOffenders(): boolean {
    return this.offenderHits.size > 0;
  }

  /** Returns a multi-line human-readable summary. */
  format(label = "i18n-bn detector"): string {
    const lines: string[] = [];
    lines.push(`\n━━━ ${label} debug report ━━━`);
    lines.push(`samples scanned: ${this.results.length}`);

    const byCount = <T,>(m: Map<T, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]);

    lines.push(`\nignore-patterns matched (${this.patternHits.size}):`);
    for (const [name, n] of byCount(this.patternHits)) {
      lines.push(`  ${n.toString().padStart(4)}  ${name}`);
    }

    lines.push(`\nwhitelist tokens dropped (${this.whitelistHits.size}):`);
    for (const [tok, n] of byCount(this.whitelistHits).slice(0, 25)) {
      lines.push(`  ${n.toString().padStart(4)}  ${tok}`);
    }

    lines.push(`\noffenders / missing translations (${this.offenderHits.size}):`);
    for (const [tok, n] of byCount(this.offenderHits)) {
      lines.push(`  ${n.toString().padStart(4)}  ${tok}`);
    }

    const failing = this.results.filter((r) => r.result.offenders.length);
    if (failing.length) {
      lines.push(`\nfailing samples (${failing.length}):`);
      for (const { ctx, result } of failing.slice(0, 40)) {
        lines.push(
          `  [${ctx}] "${result.text.slice(0, 80)}" → ${result.offenders.join(", ")}`,
        );
      }
      if (failing.length > 40) {
        lines.push(`  …and ${failing.length - 40} more`);
      }
    }

    lines.push(`━━━ end report ━━━\n`);
    return lines.join("\n");
  }

  print(label?: string): void {
    // eslint-disable-next-line no-console
    console.log(this.format(label));
  }
}
