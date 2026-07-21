import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  /** Hook `refetch` — should re-pull the platform bank list. */
  refetch: () => Promise<void> | void;
  /** Hook `lastSyncedAt` — epoch ms of the last successful load. */
  lastSyncedAt: number | null;
  /** Hook `liveUpdateKey` — bumps only on genuine realtime refetches. */
  liveUpdateKey: number;
  /** Seconds without a realtime update before the fallback nudges the user. */
  staleAfterMs?: number;
  className?: string;
}

/**
 * Manual "Refresh banks" fallback shown inside every bank picker. Always
 * tappable, but visually escalates to a "Realtime delayed" nudge if no live
 * update has arrived within `staleAfterMs` (default 6s) since the last sync.
 */
export function RefreshBanksButton({
  refetch,
  lastSyncedAt,
  liveUpdateKey,
  staleAfterMs = 6000,
  className = "",
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Reset the "stale" timer whenever a realtime refetch fires.
  useEffect(() => {
    setNow(Date.now());
  }, [liveUpdateKey]);

  const sinceSync = lastSyncedAt ? now - lastSyncedAt : 0;
  const stale = !!lastSyncedAt && sinceSync > staleAfterMs;

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refetch();
      toast.success("Bank list refreshed");
    } catch {
      toast.error("Couldn't refresh bank list");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      data-testid="refresh-banks-button"
      data-stale={stale ? "true" : "false"}
      title={stale ? "Realtime update delayed — tap to refresh" : "Refresh bank list"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
        stale
          ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300"
          : "bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground"
      } disabled:opacity-60 ${className}`}
    >
      <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} />
      <span className="whitespace-nowrap">
        {busy ? "Refreshing…" : stale ? "Refresh banks" : "Refresh"}
      </span>
    </button>
  );
}
