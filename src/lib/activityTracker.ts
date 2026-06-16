// User activity tracker — sends taps, screen views, QR events, transactions
// to public.user_activity_logs via the log_user_activity RPC.
//
// Privacy: never include PIN, OTP, password, full card number in metadata.

import { supabase } from "@/integrations/supabase/client";

type EventType = "tap" | "screen_view" | "qr" | "transaction" | "auth" | "custom";

interface QueuedEvent {
  session_id: string;
  event_type: EventType;
  event_name: string;
  route?: string;
  target?: string;
  metadata?: Record<string, unknown>;
  device_fingerprint?: string;
  created_at: string;
}

const SENSITIVE_KEYS = ["pin", "otp", "password", "cvv", "secret", "token", "access_token"];

function redact(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      out[k] = "[redacted]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function genSessionId() {
  try {
    const existing = sessionStorage.getItem("activity_session_id");
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem("activity_session_id", id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

function getDeviceFp(): string | undefined {
  try {
    return localStorage.getItem("device_fingerprint") || undefined;
  } catch {
    return undefined;
  }
}

class ActivityTracker {
  private queue: QueuedEvent[] = [];
  private flushTimer: number | null = null;
  private sessionId = genSessionId();
  private currentRoute = typeof window !== "undefined" ? window.location.pathname : "/";
  private lastTapPerTarget = new Map<string, number>();
  private enabled = false;

  enable() {
    if (this.enabled || typeof window === "undefined") return;
    this.enabled = true;

    // Global tap listener
    window.addEventListener("pointerdown", this.onPointerDown, { capture: true, passive: true });
    // Flush before unload
    window.addEventListener("beforeunload", () => this.flush(true));
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.flush(true);
    });
  }

  setRoute(route: string) {
    if (route === this.currentRoute) return;
    this.currentRoute = route;
    this.track({
      event_type: "screen_view",
      event_name: "route_change",
      route,
    });
  }

  track(opts: {
    event_type: EventType;
    event_name: string;
    route?: string;
    target?: string;
    metadata?: Record<string, unknown>;
  }) {
    this.queue.push({
      session_id: this.sessionId,
      event_type: opts.event_type,
      event_name: opts.event_name,
      route: opts.route ?? this.currentRoute,
      target: opts.target,
      metadata: redact(opts.metadata),
      device_fingerprint: getDeviceFp(),
      created_at: new Date().toISOString(),
    });
    this.scheduleFlush();
  }

  // Convenience helpers
  qr(name: "qr_opened" | "qr_shared" | "qr_scanned" | "qr_generated", metadata?: Record<string, unknown>) {
    this.track({ event_type: "qr", event_name: name, metadata });
  }
  transaction(name: string, metadata?: Record<string, unknown>) {
    this.track({ event_type: "transaction", event_name: name, metadata });
  }
  auth(name: "login" | "logout" | "pin_success" | "pin_failed" | "otp_verified", metadata?: Record<string, unknown>) {
    this.track({ event_type: "auth", event_name: name, metadata });
  }

  private onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const el = target.closest<HTMLElement>(
      "[data-track], button, a, [role='button'], [role='tab'], [role='menuitem']"
    );
    if (!el) return;

    // Skip if explicitly disabled
    if (el.closest("[data-track='off']")) return;

    const label =
      el.getAttribute("data-track") ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.textContent?.trim().slice(0, 80) ||
      el.tagName.toLowerCase();

    if (!label || label === "off") return;

    // Rate limit per-target: max 1 per 500ms
    const key = `${this.currentRoute}::${label}`;
    const now = Date.now();
    const last = this.lastTapPerTarget.get(key) || 0;
    if (now - last < 500) return;
    this.lastTapPerTarget.set(key, now);

    this.track({
      event_type: "tap",
      event_name: "tap",
      target: label,
    });
  };

  private scheduleFlush() {
    if (this.queue.length >= 20) {
      this.flush();
      return;
    }
    if (this.flushTimer !== null) return;
    this.flushTimer = window.setTimeout(() => this.flush(), 3000);
  }

  private async flush(_sync = false) {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // only log authenticated activity
      await supabase.rpc("log_user_activity" as any, { _events: batch as any });
    } catch {
      // swallow — never break the app for telemetry
    }
  }
}

export const activityTracker = new ActivityTracker();
