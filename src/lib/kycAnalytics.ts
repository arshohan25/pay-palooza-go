/**
 * Lightweight KYC/OCR analytics.
 *
 * Fire-and-forget event tracker for monitoring OCR quality and rescan behavior
 * over time. Events are:
 *  - kyc_ocr_rescan_confirmed
 *  - kyc_ocr_rescan_cancelled
 *  - kyc_ocr_run_start
 *  - kyc_ocr_run_end       (status: success | empty | error, duration_ms, confidences)
 *  - kyc_ocr_confidence    (per-field level snapshot)
 *
 * Delivery targets (best-effort, never throws):
 *  1. window.dataLayer (GTM) if present
 *  2. Supabase `activity_events` table via RPC `log_activity_event` if available
 *  3. console.debug fallback in dev
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
  [key: string]: unknown;
}

const isBrowser = typeof window !== "undefined";

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
    // Best-effort; RPC may not exist in every env. Silently ignore failures.
    await (supabase as any).rpc?.("log_activity_event", {
      p_event: event,
      p_payload: payload,
    });
  } catch {
    /* noop */
  }
}

export function trackKycEvent(event: KycAnalyticsEvent, payload: KycAnalyticsPayload = {}) {
  pushToDataLayer(event, payload);
  // Fire and forget
  void pushToBackend(event, payload);
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[kyc-analytics]", event, payload);
  }
}
