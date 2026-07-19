/**
 * Pick the first non-empty, human-usable string from a list of candidate OCR
 * values. Handles strings, numbers/bigints, and nested objects such as
 * `{ value: "..." }` or a date shaped as `{ day, month, year }`.
 *
 * Returns "" when none of the candidates yield a usable value.
 */
export const pickFirstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed && trimmed.toLowerCase() !== "null" && trimmed.toLowerCase() !== "n/a") {
        return trimmed;
      }
      continue;
    }

    if (typeof value === "number" || typeof value === "bigint") {
      const s = String(value).trim();
      if (s) return s;
      continue;
    }

    if (typeof value === "object") {
      const anyVal = value as Record<string, unknown>;
      if (typeof anyVal.value === "string" && anyVal.value.trim()) return anyVal.value.trim();
      if (typeof anyVal.value === "number") return String(anyVal.value);
      if (anyVal.day && anyVal.month && anyVal.year) {
        return `${String(anyVal.day).padStart(2, "0")}/${String(anyVal.month).padStart(2, "0")}/${anyVal.year}`;
      }
    }
  }
  return "";
};
