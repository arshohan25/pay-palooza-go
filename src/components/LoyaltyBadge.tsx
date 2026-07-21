import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Icons from "lucide-react";
import { useLoyaltyTiers, useMyLoyalty, type LoyaltyTier } from "@/hooks/use-loyalty";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { trackLoyalty, trackTierView } from "@/lib/loyaltyAnalytics";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
    size === "sm" ? "h-6 pl-1 pr-2 text-[10px] gap-1" :
    size === "lg" ? "h-9 pl-1.5 pr-3.5 text-sm gap-1.5" :
    "h-7 pl-1 pr-2.5 text-xs gap-1.5";
  const iconWrap = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-7 h-7" : "w-6 h-6";
  const iconSize = size === "sm" ? 11 : size === "lg" ? 15 : 13;

  const from = tier.gradient_from ?? tier.badge_color;
  const to = tier.gradient_to ?? tier.badge_color;
  const bg = `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
  const glow = `0 6px 20px -6px ${from}88, 0 2px 6px -2px ${to}66, inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12)`;

  const pctLabel = progress == null ? null : `${Math.round(progress)}%`;
  const isTopTier = !nextTier;
  const ariaLabel = nextTier && pctLabel
    ? t("lbTierAria", { tier: tier.name, pct: String(Math.round(progress ?? 0)), next: nextTier.name })
    : t("lbTopTierAria", { tier: tier.name });

  const handleBadgeClick = () => {
    if (isTouch) {
      handleOpenChange(!open);
      return;
    }
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
        "group relative inline-flex items-center rounded-full font-semibold text-white",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        "active:scale-[0.96] transition-all duration-200 cursor-pointer hover:brightness-110 hover:-translate-y-[1px]",
        "border border-white/30 backdrop-blur-sm overflow-hidden",
        dims,
        className
      )}
      style={{ background: bg, boxShadow: glow }}
    >
      {/* Sheen sweep */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
          animation: "loyalty-sheen 2.8s ease-in-out infinite",
        }}
      />
      {/* Icon medallion */}
      <span
        className={cn(
          "relative shrink-0 inline-flex items-center justify-center rounded-full",
          "bg-white/25 backdrop-blur ring-1 ring-white/40 shadow-inner",
          iconWrap
        )}
      >
        <Icon size={iconSize} className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" aria-hidden="true" />
      </span>
      {showName && (
        <span className="relative truncate tracking-wide drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
          {tier.name}
        </span>
      )}
      {isTopTier && (
        <Icons.Sparkles
          size={size === "sm" ? 9 : 11}
          className="relative -ml-0.5 text-white/95 animate-pulse"
          aria-hidden="true"
        />
      )}
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
            {t("lbTowardNext", { pct: pctLabel ?? "0%", next: nextTier.name })}
          </p>
          <div
            className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress ?? 0)}
            aria-label={t("lbProgressAria", { next: nextTier.name })}
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
        <div className="rounded-lg bg-gradient-to-br from-amber-500/10 via-fuchsia-500/10 to-primary/10 border border-amber-500/20 p-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Icons.Crown size={11} className="text-amber-500" aria-hidden="true" />
            <span className="text-[11px] font-bold text-foreground">{t("lbCongrats")}</span>
          </div>
          <p className="text-[10.5px] text-muted-foreground leading-snug">
            {t("lbTopReached")}
          </p>
        </div>
      )}
      {isTouch && onClick && (
        <button
          type="button"
          onClick={openPerks}
          className="mt-2 w-full h-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold active:scale-95 transition-transform"
        >
          {t("lbViewPerks")}
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
