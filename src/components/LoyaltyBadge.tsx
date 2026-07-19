import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { trackLoyalty, trackTierView } from "@/lib/loyaltyAnalytics";

/** True on devices whose primary input cannot hover (phones/tablets). */
function useIsTouchDevice() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return touch;
}

interface LoyaltyBadgeProps {
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
  /** Pass a specific tier to render (skips fetching current user tier) */
  tier?: LoyaltyTier;
  /** Called when the user wants to open the full perks sheet. */
  onClick?: () => void;
  /** Disable tooltip (e.g., when placed inside another tooltip/popover) */
  disableTooltip?: boolean;
  /** Analytics surface label (e.g. 'profile_card', 'loyalty_progress'). */
  surface?: string;
}

const METRIC_KEYS: Array<[keyof LoyaltyTier, keyof any]> = [
  ["min_volume_30d", "volume_30d"],
  ["min_lifetime_txn_count", "lifetime_txn_count"],
  ["min_wallet_balance", "wallet_balance"],
  ["min_addmoney_lifetime", "addmoney_lifetime"],
  ["min_savings_balance", "savings_balance"],
];

/**
 * Displays the user's current EasyPay Club tier as a gradient badge.
 * - Desktop: hover shows tooltip, click opens perks sheet.
 * - Mobile: tap toggles a controlled tooltip; tap outside or re-tap closes.
 *   A "View perks" action inside the tooltip opens the full perks sheet.
 */
export default function LoyaltyBadge({
  size = "md",
  showName = true,
  className,
  tier: tierProp,
  onClick,
  disableTooltip,
  surface = "unknown",
}: LoyaltyBadgeProps) {
  const { data: tiers } = useLoyaltyTiers();
  const { data: loyalty } = useMyLoyalty();
  const isTouch = useIsTouchDevice();

  const sortedTiers = useMemo(
    () => (tiers ?? []).filter((t) => t.is_active).slice().sort((a, b) => a.rank - b.rank),
    [tiers]
  );

  const tier = useMemo(() => {
    if (tierProp) return tierProp;
    if (!sortedTiers.length) return null;
    const overrideId = (loyalty as any)?.override_tier_id;
    const currentId = loyalty?.current_tier_id;
    const byId = (id?: string | null) => (id ? sortedTiers.find((t) => t.id === id) : null);
    return byId(overrideId) ?? byId(currentId) ?? sortedTiers[0];
  }, [tierProp, loyalty, sortedTiers]);

  const nextTier = useMemo(() => {
    if (!tier) return null;
    return sortedTiers.find((t) => t.rank > tier.rank) ?? null;
  }, [tier, sortedTiers]);

  const progress = useMemo(() => {
    if (!nextTier || !loyalty) return null;
    const parts = METRIC_KEYS.map(([tKey, lKey]) => {
      const target = Number((nextTier as any)[tKey] ?? 0);
      if (target <= 0) return null;
      const current = Number((loyalty as any)[lKey as any] ?? 0);
      return Math.min(100, (current / target) * 100);
    }).filter((v): v is number => v !== null);
    if (!parts.length) return 100;
    return parts.reduce((s, v) => s + v, 0) / parts.length;
  }, [nextTier, loyalty]);

  // Impression tracking — fires once per (surface, tier) per session.
  useEffect(() => {
    if (tier?.name) trackTierView(tier.name, surface);
  }, [tier?.name, surface]);

  // Controlled tooltip state (needed for mobile tap-toggle).
  const [open, setOpen] = useState(false);
  const openedAtRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const emitOpen = useCallback(() => {
    openedAtRef.current = Date.now();
    trackLoyalty("loyalty_badge_tooltip_open", {
      tier: tier?.name ?? null,
      next_tier: nextTier?.name ?? null,
      progress_pct: progress == null ? null : Math.round(progress),
      surface,
    });
  }, [tier?.name, nextTier?.name, progress, surface]);

  const emitClose = useCallback(() => {
    const started = openedAtRef.current;
    openedAtRef.current = null;
    trackLoyalty("loyalty_badge_tooltip_close", {
      tier: tier?.name ?? null,
      surface,
      duration_ms: started ? Date.now() - started : 0,
    });
  }, [tier?.name, surface]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) emitOpen();
      else emitClose();
    },
    [emitOpen, emitClose]
  );

  // Mobile: close on outside tap.
  useEffect(() => {
    if (!open || !isTouch) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (rootRef.current?.contains(t)) return;
      // Close if user tapped outside the badge/tooltip.
      // Tooltip content is in a portal, so also allow taps inside it.
      const inTooltip = (t as HTMLElement).closest?.("[data-loyalty-tooltip]");
      if (inTooltip) return;
      handleOpenChange(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open, isTouch, handleOpenChange]);

  const openPerks = useCallback(() => {
    if (!onClick) return;
    trackLoyalty("loyalty_perks_sheet_open", {
      tier: tier?.name ?? null,
      from: open ? "tooltip" : "badge",
      surface,
    });
    handleOpenChange(false);
    onClick();
  }, [onClick, tier?.name, open, surface, handleOpenChange]);

  if (!tier) return null;

  const Icon = (Icons as any)[tier.badge_icon] ?? Icons.Award;
  const dims =
    size === "sm" ? "h-6 px-2 text-[10px] gap-1" :
    size === "lg" ? "h-9 px-3.5 text-sm gap-1.5" :
    "h-7 px-2.5 text-xs gap-1";
  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

  const bg = tier.gradient_from && tier.gradient_to
    ? `linear-gradient(135deg, ${tier.gradient_from}, ${tier.gradient_to})`
    : tier.badge_color;

  const pctLabel = progress == null ? null : `${Math.round(progress)}%`;
  const ariaLabel = nextTier && pctLabel
    ? `EasyPay Club tier: ${tier.name}. ${pctLabel} progress toward ${nextTier.name}.`
    : `EasyPay Club tier: ${tier.name}. Top tier reached.`;

  const handleBadgeClick = () => {
    if (isTouch) {
      // Mobile: tap toggles tooltip. Perks sheet opens via the tooltip button.
      handleOpenChange(!open);
      return;
    }
    // Desktop: click goes straight to perks sheet.
    openPerks();
  };

  const badge = (
    <button
      type="button"
      onClick={handleBadgeClick}
      aria-label={ariaLabel}
      aria-expanded={isTouch ? open : undefined}
      aria-haspopup={onClick ? "dialog" : undefined}
      title={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full font-semibold text-white shadow-sm border border-white/25",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "active:scale-95 transition-transform cursor-pointer hover:brightness-110",
        dims,
        className
      )}
      style={{ background: bg }}
    >
      <Icon size={iconSize} className="shrink-0" aria-hidden="true" />
      {showName && <span className="truncate">{tier.name}</span>}
    </button>
  );

  if (disableTooltip) return <div ref={rootRef} className="inline-flex">{badge}</div>;

  const tooltipBody = (
    <>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={12} aria-hidden="true" style={{ color: tier.gradient_from ?? tier.badge_color }} />
        <span className="text-xs font-bold">{tier.name}</span>
      </div>
      {nextTier ? (
        <>
          <p className="text-[11px] text-muted-foreground mb-1.5">
            {pctLabel} toward <span className="font-semibold text-foreground">{nextTier.name}</span>
          </p>
          <div
            className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress ?? 0)}
            aria-label={`Progress toward ${nextTier.name}`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress ?? 0}%`,
                background: nextTier.gradient_from && nextTier.gradient_to
                  ? `linear-gradient(90deg, ${nextTier.gradient_from}, ${nextTier.gradient_to})`
                  : nextTier.badge_color,
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">Top tier reached — enjoy every perk.</p>
      )}
      {isTouch && onClick && (
        <button
          type="button"
          onClick={openPerks}
          className="mt-2 w-full h-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold active:scale-95 transition-transform"
        >
          View perks
        </button>
      )}
    </>
  );

  return (
    <div ref={rootRef} className="inline-flex">
      <TooltipProvider delayDuration={isTouch ? 999999 : 200} disableHoverableContent={false}>
        <Tooltip
          open={open}
          onOpenChange={(next) => {
            // On touch, ignore Radix's focus/hover-driven open events — the
            // badge's onClick is the single source of truth so a tap reliably
            // toggles and never fights with focus events.
            if (isTouch && next && !open) return;
            handleOpenChange(next);
          }}
        >
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={12}
            data-loyalty-tooltip
            onPointerDownOutside={(e) => {
              // Radix already handles close, but we also want to consume the tap
              // so a second tap on the badge doesn't reopen it inadvertently.
              e.preventDefault();
              handleOpenChange(false);
            }}
            className="px-3 py-2 max-w-[220px] z-50"
          >
            {tooltipBody}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
