import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const TEMP_PIN_COOLDOWN_SECONDS = 60;

export type TempPinKind = "agent" | "merchant";

const CONFIG: Record<TempPinKind, {
  functionName: string;
  statusRpc: string;
  statusArg: string;
  bodyIdKey: string;
  storagePrefix: string;
  channelPrefix: string;
  label: string;
}> = {
  agent: {
    functionName: "issue-agent-temp-pin",
    statusRpc: "agent_temp_pin_status",
    statusArg: "_agent_user_id",
    bodyIdKey: "agent_user_id",
    storagePrefix: "agent_temp_pin_resend_until",
    channelPrefix: "temp-pin-resend-agent",
    label: "agent",
  },
  merchant: {
    functionName: "issue-merchant-temp-pin",
    statusRpc: "merchant_temp_pin_status",
    statusArg: "_merchant_user_id",
    bodyIdKey: "merchant_user_id",
    storagePrefix: "merchant_temp_pin_resend_until",
    channelPrefix: "temp-pin-resend-merchant",
    label: "merchant",
  },
};

interface Props {
  kind: TempPinKind;
  userId: string;
  phone: string | null | undefined;
  name?: string | null;
}

/**
 * Panel: shows temp-PIN status + a Resend button with:
 *  - Server-derived + localStorage-backed cooldown that survives reloads.
 *  - BroadcastChannel + storage-event sync so all open tabs share the same
 *    disabled state for the same user.
 *  - Per-click idempotency key so retries/double-fires never issue a second PIN.
 */
export function TempPinResendPanel({ kind, userId, phone, name }: Props) {
  const cfg = CONFIG[kind];
  const storageKey = useMemo(() => `${cfg.storagePrefix}:${userId}`, [cfg.storagePrefix, userId]);
  const channelName = useMemo(() => `${cfg.channelPrefix}:${userId}`, [cfg.channelPrefix, userId]);

  const [status, setStatus] = useState<{ state: string; expires_at: string | null; issued_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const idempotencyRef = useRef<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const cooldown = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // ── Cross-tab wiring ──
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        ch = new BroadcastChannel(channelName);
        ch.onmessage = (ev) => {
          const msg = ev?.data as { type?: string; until?: number } | undefined;
          if (msg?.type === "cooldown" && typeof msg.until === "number") {
            setCooldownUntil((prev) => Math.max(prev, msg.until!));
          } else if (msg?.type === "status-refresh") {
            void loadStatus(false);
          }
        };
        channelRef.current = ch;
      } catch { /* ignore */ }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const raw = e.newValue;
      if (!raw) { setCooldownUntil(0); return; }
      const until = Number(raw) || 0;
      if (until > Date.now()) setCooldownUntil((prev) => Math.max(prev, until));
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      try { ch?.close(); } catch { /* ignore */ }
      channelRef.current = null;
    };
  }, [channelName, storageKey]);

  const bumpCooldown = (seconds: number) => {
    const until = Date.now() + Math.max(0, seconds) * 1000;
    setCooldownUntil(until);
    try { localStorage.setItem(storageKey, String(until)); } catch { /* ignore */ }
    try { channelRef.current?.postMessage({ type: "cooldown", until }); } catch { /* ignore */ }
  };

  const loadStatus = async (setLoadingFlag = true) => {
    if (setLoadingFlag) setLoading(true);
    const { data } = await (supabase as any).rpc(cfg.statusRpc, { [cfg.statusArg]: userId });
    const row = Array.isArray(data) ? data[0] : data;
    const next = row ?? { state: "none", expires_at: null, issued_at: null };
    setStatus(next);
    if (setLoadingFlag) setLoading(false);

    let serverUntil = 0;
    if (next.issued_at) {
      const issued = new Date(next.issued_at).getTime();
      if (!Number.isNaN(issued)) serverUntil = issued + TEMP_PIN_COOLDOWN_SECONDS * 1000;
    }
    let storedUntil = 0;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) storedUntil = Number(raw) || 0;
    } catch { /* ignore */ }
    const until = Math.max(serverUntil, storedUntil);
    if (until > Date.now()) setCooldownUntil((prev) => Math.max(prev, until));
    else if (storedUntil && storedUntil <= Date.now()) {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  };

  useEffect(() => { void loadStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  useEffect(() => {
    if (cooldownUntil <= now) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil, now]);

  useEffect(() => {
    if (cooldownUntil && cooldownUntil <= now) {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }, [cooldownUntil, now, storageKey]);

  const resend = async () => {
    if (!phone) { toast.error(`${cfg.label} has no phone on file`); return; }
    if (sending) return;
    setSending(true);

    // Reuse an existing idempotency key so retries and network re-sends coalesce.
    if (!idempotencyRef.current) {
      idempotencyRef.current = (crypto as any)?.randomUUID?.() ?? `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const idempotencyKey = idempotencyRef.current!;

    try {
      const body: Record<string, unknown> = {
        [cfg.bodyIdKey]: userId,
        phone,
        name: name ?? undefined,
        purpose: "resend",
        idempotency_key: idempotencyKey,
      };
      const { data, error } = await supabase.functions.invoke(cfg.functionName, { body });
      if (error) {
        const ctx: any = (error as any)?.context;
        let payload: any = null;
        if (ctx && typeof ctx.json === "function") {
          try { payload = await ctx.json(); } catch { /* ignore */ }
        }
        if (payload?.throttled) {
          const wait = payload.retry_after_seconds ?? TEMP_PIN_COOLDOWN_SECONDS;
          bumpCooldown(wait);
          toast.error(payload.error || `Please wait ${wait}s before resending.`);
        } else {
          toast.error(payload?.error || error.message || "Failed to resend PIN");
        }
        return;
      }
      const p = data as { sms_status?: string; pin_fallback?: string; expires_at?: string; replayed?: boolean } | null;
      if (p?.replayed) {
        toast.info("Duplicate request ignored — the last PIN is still active.");
      } else if (p?.sms_status === "sent") {
        toast.success(`New PIN sent by SMS to +88 ${phone}`);
      } else if (p?.pin_fallback) {
        toast.warning(`SMS failed — share this PIN manually: ${p.pin_fallback}`, { duration: 15000 });
      } else {
        toast.warning("PIN issued but SMS status unknown — check delivery logs");
      }
      // Successful (or replayed) → new idempotency key for the next click.
      idempotencyRef.current = null;
      bumpCooldown(TEMP_PIN_COOLDOWN_SECONDS);
      try { channelRef.current?.postMessage({ type: "status-refresh" }); } catch { /* ignore */ }
      void loadStatus(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to resend PIN");
    } finally {
      setSending(false);
    }
  };

  const badge = (() => {
    if (!status || status.state === "none") return { label: "No temp PIN on file", cls: "bg-muted text-muted-foreground" };
    if (status.state === "active") return { label: "Temp PIN active", cls: "bg-amber-500/15 text-amber-700 border-amber-500/20" };
    if (status.state === "expired") return { label: "Temp PIN expired", cls: "bg-rose-500/15 text-rose-700 border-rose-500/20" };
    return { label: "PIN changed by user", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/20" };
  })();

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Temporary PIN</p>
        </div>
        <Badge variant="outline" className={`text-[10px] ${badge.cls}`}>{badge.label}</Badge>
      </div>
      {loading ? (
        <p className="text-[11px] text-muted-foreground">Loading…</p>
      ) : (
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {status?.issued_at && <p>Issued: {new Date(status.issued_at).toLocaleString()}</p>}
          {status?.expires_at && <p>Expires: {new Date(status.expires_at).toLocaleString()}</p>}
        </div>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="w-full h-8 gap-2"
        disabled={sending || cooldown > 0 || !phone}
        onClick={resend}
        aria-live="polite"
      >
        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {sending
          ? "Sending…"
          : cooldown > 0
            ? `Resend available in ${cooldown}s`
            : "Resend temp PIN by SMS"}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Cooldown: {TEMP_PIN_COOLDOWN_SECONDS}s per {cfg.label}. Max 5 issues per hour. The previous PIN is invalidated immediately.
      </p>
    </div>
  );
}
