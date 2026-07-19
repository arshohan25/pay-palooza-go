/**
 * Runtime schema assertions for KYC analytics events.
 *
 * Every payload pushed to `window.dataLayer` by `trackKycEvent` is validated
 * against the schema for its event name. Violations are:
 *   - recorded on `window.__kycAnalyticsSchemaErrors` (test-observable, capped),
 *   - logged via `console.error` in DEV, and
 *   - thrown as `KycAnalyticsSchemaError` when
 *     `window.__kycAnalyticsStrict === true` (used by e2e tests).
 *
 * Validation never throws in normal user sessions — production analytics is
 * always fire-and-forget.
 */
import type { KycAnalyticsEvent, KycAnalyticsPayload, OcrConfidenceLevel } from "./kycAnalytics";

const LEVELS: readonly OcrConfidenceLevel[] = ["high", "medium", "low", "none", "unknown"];
const RUN_END_STATUSES = ["success", "empty", "error"] as const;
const SHEET_EVENT_TYPES = ["INSERT", "UPDATE", "DELETE"] as const;
const SHEET_SOURCES = ["fetch", "realtime", "focus", "manual"] as const;
const SIDES = ["front", "back"] as const;
const CONFIDENCE_FIELDS = ["bn_name", "father", "mother"] as const;

export interface KycAnalyticsSchemaViolation {
  event: KycAnalyticsEvent;
  reasons: string[];
  payload: KycAnalyticsPayload;
  ts: number;
}

export class KycAnalyticsSchemaError extends Error {
  readonly violation: KycAnalyticsSchemaViolation;
  constructor(violation: KycAnalyticsSchemaViolation) {
    super(`[kyc-analytics schema] ${violation.event}: ${violation.reasons.join("; ")}`);
    this.name = "KycAnalyticsSchemaError";
    this.violation = violation;
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function checkSide(p: KycAnalyticsPayload, reasons: string[]) {
  if (p.side == null) reasons.push("side is required");
  else if (!SIDES.includes(p.side as (typeof SIDES)[number]))
    reasons.push(`side must be one of ${SIDES.join("|")}`);
}

function checkConfidencesMap(v: unknown, reasons: string[]) {
  if (v == null || typeof v !== "object") {
    reasons.push("confidences must be an object");
    return;
  }
  const map = v as Record<string, unknown>;
  for (const f of CONFIDENCE_FIELDS) {
    if (!(f in map)) {
      reasons.push(`confidences.${f} is required`);
      continue;
    }
    if (!LEVELS.includes(map[f] as OcrConfidenceLevel)) {
      reasons.push(`confidences.${f} must be one of ${LEVELS.join("|")} (got ${String(map[f])})`);
    }
  }
}

export function validateKycAnalytics(
  event: KycAnalyticsEvent,
  payload: KycAnalyticsPayload,
): string[] {
  const reasons: string[] = [];

  switch (event) {
    case "kyc_ocr_rescan_confirmed":
      checkSide(payload, reasons);
      if (payload.reset !== true) reasons.push("reset must be literal true");
      break;
    case "kyc_ocr_rescan_cancelled":
      checkSide(payload, reasons);
      break;
    case "kyc_ocr_run_start":
      checkSide(payload, reasons);
      break;
    case "kyc_ocr_run_end": {
      checkSide(payload, reasons);
      if (!RUN_END_STATUSES.includes(payload.status as (typeof RUN_END_STATUSES)[number]))
        reasons.push(`status must be one of ${RUN_END_STATUSES.join("|")}`);
      if (!isFiniteNumber(payload.duration_ms) || (payload.duration_ms as number) < 0)
        reasons.push("duration_ms must be a finite number >= 0");
      if (payload.status === "success") checkConfidencesMap(payload.confidences, reasons);
      break;
    }
    case "kyc_ocr_confidence": {
      checkSide(payload, reasons);
      if (payload.field == null || typeof payload.field !== "string" || !payload.field)
        reasons.push("field is required");
      if (!LEVELS.includes(payload.level as OcrConfidenceLevel))
        reasons.push(`level must be one of ${LEVELS.join("|")}`);
      if (payload.sampled_count != null) {
        if (!isFiniteNumber(payload.sampled_count) || (payload.sampled_count as number) < 1)
          reasons.push("sampled_count, when present, must be a finite number >= 1");
      }
      break;
    }
    case "kyc_sheet_loading":
    case "kyc_sheet_empty":
      if (payload.source && !SHEET_SOURCES.includes(payload.source as (typeof SHEET_SOURCES)[number]))
        reasons.push(`source must be one of ${SHEET_SOURCES.join("|")}`);
      break;
    case "kyc_sheet_populated":
      if (!isFiniteNumber(payload.total) || (payload.total as number) < 0)
        reasons.push("total must be a finite number >= 0");
      for (const k of ["verified", "pending", "rejected"] as const) {
        if (payload[k] != null && (!isFiniteNumber(payload[k]) || (payload[k] as number) < 0))
          reasons.push(`${k} must be a finite number >= 0 when present`);
      }
      break;
    case "kyc_sheet_error":
      if (!payload.error || typeof payload.error !== "string")
        reasons.push("error must be a non-empty string");
      break;
    case "kyc_sheet_long_reason":
      if (!isFiniteNumber(payload.reason_length) || (payload.reason_length as number) <= 0)
        reasons.push("reason_length must be a finite number > 0");
      break;
    case "kyc_sheet_realtime":
      if (!SHEET_EVENT_TYPES.includes(payload.event_type as (typeof SHEET_EVENT_TYPES)[number]))
        reasons.push(`event_type must be one of ${SHEET_EVENT_TYPES.join("|")}`);
      break;
    default:
      reasons.push(`unknown event: ${event}`);
  }

  return reasons;
}

const MAX_RECORDED_VIOLATIONS = 100;

interface SchemaWindow {
  __kycAnalyticsSchemaErrors?: KycAnalyticsSchemaViolation[];
  __kycAnalyticsStrict?: boolean;
}

export function assertKycAnalyticsSchema(
  event: KycAnalyticsEvent,
  payload: KycAnalyticsPayload,
): void {
  const reasons = validateKycAnalytics(event, payload);
  if (reasons.length === 0) return;

  const violation: KycAnalyticsSchemaViolation = {
    event,
    reasons,
    payload,
    ts: Date.now(),
  };

  if (typeof window !== "undefined") {
    const w = window as unknown as SchemaWindow;
    const arr = (w.__kycAnalyticsSchemaErrors ??= []);
    if (arr.length < MAX_RECORDED_VIOLATIONS) arr.push(violation);

    // eslint-disable-next-line no-console
    console.error("[kyc-analytics schema violation]", event, reasons, payload);

    if (w.__kycAnalyticsStrict === true) {
      throw new KycAnalyticsSchemaError(violation);
    }
  }
}
