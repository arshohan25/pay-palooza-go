/**
 * Lightweight KYC/OCR analytics.
 *
 * Fire-and-forget event tracker for monitoring OCR quality and rescan behavior
 * over time. Events are:
 *  - kyc_ocr_rescan_confirmed
 *  - kyc_ocr_rescan_cancelled
 *  - kyc_ocr_run_start
 *  - kyc_ocr_run_end       (status: success | empty | error, duration_ms, confidences)
 *  - kyc_ocr_confidence    (per-field level snapshot — throttled/sampled)
 *
 * Delivery targets (best-effort, never throws):
 *  1. window.dataLayer (GTM) if present
 *  2. Supabase `activity_events` table via RPC `log_activity_event` if available
 *  3. console.debug fallback in dev
 *
 * High-frequency guardrails
 * -------------------------
 * `kyc_ocr_confidence` is the only high-cardinality event: it can fire on every
 * keystroke across three fields. To keep analytics cheap we apply:
 *
 *   1. De-duplication — if `{side, field, level}` matches the last emitted
 *      value for that key, drop it entirely. Level transitions are what
 *      matter for quality monitoring.
 *   2. Min interval throttle — at most one event per (side, field) per
 *      `CONFIDENCE_MIN_INTERVAL_MS`, regardless of level changes.
 *   3. Sampling — when both filters pass, only emit a fraction
 *      (`CONFIDENCE_SAMPLE_RATE`) of events. Sampled-out events are still
 *      counted so we can surface a periodic `sampled_count` on the next
 *      emitted event for observability.
 *
 * `flushKycAnalytics()` clears the throttle/sample state (useful in tests).
 */
import { supabase } from "@/integrations/supabase/client";

export type OcrConfidenceLevel = "high" | "medium" | "low" | "none" | "unknown";

export type KycAnalyticsEvent =
  | "kyc_ocr_rescan_confirmed"
  | "kyc_ocr_rescan_cancelled"
  | "kyc_ocr_run_start"
  | "kyc_ocr_run_end"
  | "kyc_ocr_confidence";

export interface KycAnalyticsPayload {
  side?: "front" | "back";
  reset?: boolean;
  status?: "success" | "empty" | "error";
  duration_ms?: number;
  error?: string;
  field?: "bn_name" | "father" | "mother" | string;
  level?: OcrConfidenceLevel;
  confidences?: Partial<Record<"bn_name" | "father" | "mother", OcrConfidenceLevel>>;
  sampled_count?: number;
  [key: string]: unknown;
}

const isBrowser = typeof window !== "undefined";

/** Min gap between two emitted confidence events for the same (side, field). */
const CONFIDENCE_MIN_INTERVAL_MS = 1500;
/** Fraction of eligible confidence events actually emitted (0..1). */
const CONFIDENCE_SAMPLE_RATE = 0.25;

interface ConfidenceState {
  lastLevel: OcrConfidenceLevel | null;
  lastEmittedAt: number;
  suppressed: number;
}
const confidenceState = new Map<string, ConfidenceState>();

function pushToDataLayer(event: KycAnalyticsEvent, payload: KycAnalyticsPayload) {
  if (!isBrowser) return;
  try {
    const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...payload, ts: Date.now() });
  } catch {
    /* noop */
  }
}

async function pushToBackend(event: KycAnalyticsEvent, payload: KycAnalyticsPayload) {
  try {
    await (supabase as any).rpc?.("log_activity_event", {
      p_event: event,
      p_payload: payload,
    });
  } catch {
    /* noop */
  }
}

function shouldEmitConfidence(payload: KycAnalyticsPayload): {
  emit: boolean;
  suppressed: number;
} {
  const key = `${payload.side ?? "?"}::${payload.field ?? "?"}`;
  const level = (payload.level ?? "unknown") as OcrConfidenceLevel;
  const now = Date.now();
  const state =
    confidenceState.get(key) ??
    ({ lastLevel: null, lastEmittedAt: 0, suppressed: 0 } as ConfidenceState);

  // 1. Dedup — same level as last emit: drop, but don't count as "suppressed noise".
  if (state.lastLevel === level) {
    confidenceState.set(key, state);
    return { emit: false, suppressed: state.suppressed };
  }

  // 2. Throttle — within min interval since last emit.
  if (now - state.lastEmittedAt < CONFIDENCE_MIN_INTERVAL_MS) {
    state.suppressed += 1;
    confidenceState.set(key, state);
    return { emit: false, suppressed: state.suppressed };
  }

  // 3. Sample.
  if (Math.random() > CONFIDENCE_SAMPLE_RATE) {
    state.suppressed += 1;
    confidenceState.set(key, state);
    return { emit: false, suppressed: state.suppressed };
  }

  const suppressed = state.suppressed;
  confidenceState.set(key, {
    lastLevel: level,
    lastEmittedAt: now,
    suppressed: 0,
  });
  return { emit: true, suppressed };
}

export function trackKycEvent(event: KycAnalyticsEvent, payload: KycAnalyticsPayload = {}) {
  let finalPayload = payload;

  if (event === "kyc_ocr_confidence") {
    const { emit, suppressed } = shouldEmitConfidence(payload);
    if (!emit) return;
    if (suppressed > 0) finalPayload = { ...payload, sampled_count: suppressed };
  }

  pushToDataLayer(event, finalPayload);
  void pushToBackend(event, finalPayload);
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[kyc-analytics]", event, finalPayload);
  }
}

/** Reset throttle/sample state. Intended for tests and rescan boundaries. */
export function flushKycAnalytics() {
  confidenceState.clear();
}
