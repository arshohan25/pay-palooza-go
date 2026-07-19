/**
 * OCR confidence helpers.
 *
 * Two responsibilities:
 *
 * 1. `pickFirstWithConfidence` — like `pickFirstString`, but also returns an
 *    explicit `confidence` score (0..1) when the OCR payload provides one
 *    (either as a nested `{ value, confidence }` object or as a sibling
 *    `<key>_confidence` field). Returns `null` when no explicit signal exists.
 *
 * 2. `computeFieldConfidence` — heuristic scorer used when the OCR provider
 *    does not attach an explicit confidence. Each field kind has a small,
 *    deterministic rubric so the UI can render a High / Medium / Low badge
 *    that reviewers can act on before submitting.
 *
 * The two are combined in `resolveConfidence`, which prefers an explicit
 * score and falls back to the heuristic.
 */

import { pickFirstString } from "@/lib/ocrPickFirst";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface PickedField {
  value: string;
  /** Explicit provider-supplied confidence in [0, 1], or null when absent. */
  confidence: number | null;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const readNumericConfidence = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return clamp01(v > 1 ? v / 100 : v);
  if (typeof v === "string") {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return clamp01(parsed > 1 ? parsed / 100 : parsed);
  }
  return null;
};

/**
 * Walk a list of candidate OCR values and return the first usable string,
 * paired with a provider-supplied confidence when available.
 *
 * Supports:
 *   - plain strings / numbers  → { value, confidence: null }
 *   - `{ value, confidence }`  → confidence extracted from the object
 *   - `{ day, month, year }`   → DOB assembled, confidence: null
 *
 * When you also want to consider sibling `<key>_confidence` fields, pass the
 * parent OCR object + key list to `pickFirstWithSiblingConfidence` instead.
 */
export const pickFirstWithConfidence = (...candidates: unknown[]): PickedField => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;

    if (typeof candidate === "object" && !Array.isArray(candidate)) {
      const obj = candidate as Record<string, unknown>;
      const nested = pickFirstString(obj);
      if (nested) {
        const conf =
          readNumericConfidence(obj.confidence) ??
          readNumericConfidence(obj.score) ??
          readNumericConfidence(obj.probability);
        return { value: nested, confidence: conf };
      }
      continue;
    }

    const single = pickFirstString(candidate);
    if (single) return { value: single, confidence: null };
  }
  return { value: "", confidence: null };
};

/**
 * Same as `pickFirstWithConfidence`, but also checks sibling `<key>_confidence`
 * entries on `root` (e.g. `father_name_confidence`) for the given key list.
 */
export const pickFirstWithSiblingConfidence = (
  root: Record<string, unknown> | null | undefined,
  keys: string[],
): PickedField => {
  const values = keys.map((k) => root?.[k]);
  const picked = pickFirstWithConfidence(...values);
  if (picked.confidence !== null || !root) return picked;

  for (const k of keys) {
    const sibling =
      readNumericConfidence(root[`${k}_confidence`]) ??
      readNumericConfidence(root[`${k}_score`]);
    if (sibling !== null && picked.value) {
      return { value: picked.value, confidence: sibling };
    }
  }
  return picked;
};

const hasBanglaScript = (s: string) => /[\u0980-\u09FF]/.test(s);
const hasLatinScript = (s: string) => /[A-Za-z]/.test(s);
const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Heuristic confidence for a specific field kind. Deterministic and
 * side-effect free so it's safe to call during render.
 */
export const computeFieldConfidence = (
  kind: "name_en" | "name_bn" | "father" | "mother" | "nid" | "dob",
  value: string,
): ConfidenceLevel => {
  const v = (value ?? "").trim();
  if (!v) return "none";

  switch (kind) {
    case "name_bn": {
      if (!hasBanglaScript(v)) return "low";
      if (hasLatinScript(v)) return "medium"; // mixed script → likely OCR bleed
      if (v.length >= 4 && wordCount(v) >= 2) return "high";
      if (v.length >= 3) return "medium";
      return "low";
    }
    case "father":
    case "mother":
    case "name_en": {
      if (/\d/.test(v)) return "low";
      const words = wordCount(v);
      if (v.length >= 5 && words >= 2) return "high";
      if (v.length >= 3 && words >= 1) return "medium";
      return "low";
    }
    case "nid": {
      const digits = v.replace(/\D/g, "");
      if ([10, 13, 17].includes(digits.length)) return "high";
      if (digits.length >= 9) return "medium";
      return "low";
    }
    case "dob": {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return "high";
      if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(v)) return "medium";
      return "low";
    }
  }
};

/** Combine an explicit provider score with the heuristic fallback. */
export const resolveConfidence = (
  kind: Parameters<typeof computeFieldConfidence>[0],
  picked: PickedField,
): ConfidenceLevel => {
  if (!picked.value) return "none";
  if (picked.confidence !== null) {
    if (picked.confidence >= 0.85) return "high";
    if (picked.confidence >= 0.6) return "medium";
    return "low";
  }
  return computeFieldConfidence(kind, picked.value);
};
