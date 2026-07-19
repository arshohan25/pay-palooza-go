/**
 * Lightweight EasyPay Club (loyalty) analytics.
 *
 * Fire-and-forget event tracker for measuring engagement with the loyalty
 * badge tooltip and how often users progress from tier progress screens
 * into the perks sheet.
 *
 * Events:
 *  - loyalty_badge_tooltip_open   { tier, next_tier, progress_pct, surface }
 *  - loyalty_badge_tooltip_close  { tier, surface, duration_ms }
 *  - loyalty_tier_view            { tier, surface }               // rendered/impression
 *  - loyalty_perks_sheet_open     { tier, from }                  // 'badge' | 'tooltip' | 'progress_page'
 *
 * Delivery targets (best-effort, never throws):
 *  1. window.dataLayer (GTM) if present
 *  2. console.debug fallback in dev
 */

export type LoyaltyAnalyticsEvent =
  | "loyalty_badge_tooltip_open"
  | "loyalty_badge_tooltip_close"
  | "loyalty_tier_view"
  | "loyalty_perks_sheet_open";

export interface LoyaltyAnalyticsPayload {
  tier?: string | null;
  next_tier?: string | null;
  progress_pct?: number | null;
  surface?: string;
  from?: string;
  duration_ms?: number;
  [key: string]: unknown;
}

function pushDataLayer(event: LoyaltyAnalyticsEvent, payload: LoyaltyAnalyticsPayload) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
    w.dataLayer.push({ event, ...payload, ts: Date.now() });
  } catch {
    /* ignore */
  }
}

export function trackLoyalty(event: LoyaltyAnalyticsEvent, payload: LoyaltyAnalyticsPayload = {}) {
  if (typeof window === "undefined") return;
  pushDataLayer(event, payload);
  if (import.meta?.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[loyaltyAnalytics]", event, payload);
  }
}

/** Impression dedupe: fire a `loyalty_tier_view` at most once per (surface, tier) per session. */
const impressionSeen = new Set<string>();
export function trackTierView(tier: string | null | undefined, surface: string) {
  if (!tier) return;
  const key = `${surface}::${tier}`;
  if (impressionSeen.has(key)) return;
  impressionSeen.add(key);
  trackLoyalty("loyalty_tier_view", { tier, surface });
}

/** Test hook — reset dedupe cache. */
export function __resetLoyaltyAnalyticsForTests() {
  impressionSeen.clear();
}
