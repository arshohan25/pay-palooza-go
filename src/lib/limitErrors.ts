/**
 * Translates the structured `LIMIT_EXCEEDED|...` exception raised by the
 * `enforce_txn_limit` database guard into a friendly, localized message.
 *
 * Raised format: LIMIT_EXCEEDED|<period>|<kind>|<limit>|<used>|<remaining>|<tier>
 */
export interface ParsedLimitError {
  period: "daily" | "monthly";
  kind: "amount" | "count";
  limit: number;
  used: number;
  remaining: number;
  tierCode: string | null;
}

export function parseLimitError(message?: string | null): ParsedLimitError | null {
  if (!message || !message.includes("LIMIT_EXCEEDED|")) return null;
  const raw = message.slice(message.indexOf("LIMIT_EXCEEDED|"));
  const parts = raw.split("|");
  if (parts.length < 6) return null;
  const period = parts[1] === "monthly" ? "monthly" : "daily";
  const kind = parts[2] === "count" ? "count" : "amount";
  return {
    period,
    kind,
    limit: Number(parts[3]) || 0,
    used: Number(parts[4]) || 0,
    remaining: Number(parts[5]) || 0,
    tierCode: (parts[6] || "").trim() || null,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/**
 * Builds the user-facing sentence. `t` is the i18n translator; falls back to
 * plain English when the keys are unavailable.
 */
export function limitErrorMessage(
  parsed: ParsedLimitError,
  t?: (k: any) => string,
): string {
  const tr = (k: string, fallback: string) => {
    const v = t?.(k);
    return v && v !== k ? v : fallback;
  };

  if (parsed.kind === "count") {
    return tr("lpLimitExceededCount", "You reached your {period} transaction count limit ({limit}).")
      .replace("{period}", parsed.period)
      .replace("{limit}", fmt(parsed.limit));
  }

  const key = parsed.period === "monthly" ? "lpLimitExceededMonthly" : "lpLimitExceededDaily";
  const fallback =
    parsed.period === "monthly"
      ? "Monthly Send Money limit reached. ৳{remaining} left of ৳{limit} this month."
      : "Daily Send Money limit reached. ৳{remaining} left of ৳{limit} today.";
  return tr(key, fallback)
    .replace("{remaining}", fmt(parsed.remaining))
    .replace("{limit}", fmt(parsed.limit));
}

/** Convenience: returns a friendly message when the error is a limit error, else null. */
export function friendlyLimitError(err: any, t?: (k: any) => string): string | null {
  const parsed = parseLimitError(err?.message ?? err?.hint ?? null);
  return parsed ? limitErrorMessage(parsed, t) : null;
}
