import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Lock, ChevronUp, Sparkles, GripVertical, RotateCcw } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SendMoneyIcon,
  CashOutIcon,
  PaymentIcon,
  BankTransferIcon,
  RechargeIcon,
  PayBillIcon,
  ShopIcon,
  MoreIcon,
  ReferIcon,
  
  CouponsIcon,
  DonationsIcon,
  LoanIcon,
  InsuranceIcon,
  GiftCardsIcon,
} from "./QuickActionIcons";
import { useI18n } from "@/lib/i18n";
import { haptics } from "@/lib/haptics";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import { useGlobalToggles } from "@/hooks/use-global-toggles";
import { useQuickActionOrder } from "@/hooks/use-quick-action-order";
import { useCustomization } from "@/hooks/use-customization";

const FEATURE_MAP: Record<string, string> = {
  send: "send_money",
  cashout: "cash_out",
  payment: "payment",
  recharge: "mobile_recharge",
  bill: "pay_bill",
  shop: "shop",
  bank: "bank_transfer",
  refer: "refer",
  savings: "savings",
  coupons: "coupons",
  donations: "donations",
  loan: "loan",
  insurance: "insurance",
  giftcards: "gift_cards",
  feature_slot_1: "feature_slot_1",
  feature_slot_2: "feature_slot_2",
  feature_slot_3: "feature_slot_3",
  feature_slot_4: "feature_slot_4",
  feature_slot_5: "feature_slot_5",
};

interface ActionDef {
  Icon: React.FC<{ isHovered?: boolean }>;
  labelKey: "sendMoney" | "cashOut" | "payment" | "bankTransfer" | "recharge" | "payBill" | "shop" | "more";
  id: string;
  desc: string;
  bgStyle: string;
  ringStyle: string;
  rippleColor: string;
}

const allActionDefs: ActionDef[] = [
  { Icon: SendMoneyIcon, labelKey: "sendMoney", id: "send", desc: "Send money to anyone instantly", bgStyle: "rgba(233,30,140,0.12)", ringStyle: "1px solid rgba(233,30,140,0.25)", rippleColor: "rgba(233,30,140,0.35)" },
  { Icon: CashOutIcon, labelKey: "cashOut", id: "cashout", desc: "Withdraw cash from your wallet", bgStyle: "rgba(67,160,71,0.12)", ringStyle: "1px solid rgba(67,160,71,0.25)", rippleColor: "rgba(67,160,71,0.35)" },
  { Icon: PaymentIcon, labelKey: "payment", id: "payment", desc: "Pay merchants & stores", bgStyle: "rgba(156,39,176,0.12)", ringStyle: "1px solid rgba(156,39,176,0.25)", rippleColor: "rgba(156,39,176,0.35)" },
  { Icon: BankTransferIcon, labelKey: "bankTransfer", id: "bank", desc: "Transfer to bank accounts", bgStyle: "rgba(33,150,243,0.12)", ringStyle: "1px solid rgba(33,150,243,0.25)", rippleColor: "rgba(33,150,243,0.35)" },
  { Icon: RechargeIcon, labelKey: "recharge", id: "recharge", desc: "Top up mobile balance", bgStyle: "rgba(0,188,212,0.12)", ringStyle: "1px solid rgba(0,188,212,0.25)", rippleColor: "rgba(0,188,212,0.35)" },
  { Icon: PayBillIcon, labelKey: "payBill", id: "bill", desc: "Pay utility & other bills", bgStyle: "rgba(255,193,7,0.12)", ringStyle: "1px solid rgba(255,193,7,0.25)", rippleColor: "rgba(255,193,7,0.45)" },
  { Icon: ShopIcon, labelKey: "shop", id: "shop", desc: "Browse & buy from shops", bgStyle: "rgba(255,112,67,0.12)", ringStyle: "1px solid rgba(255,112,67,0.25)", rippleColor: "rgba(255,112,67,0.35)" },
  { Icon: MoreIcon, labelKey: "more", id: "more", desc: "Explore more services", bgStyle: "rgba(120,120,140,0.10)", ringStyle: "1px solid rgba(120,120,140,0.20)", rippleColor: "rgba(120,120,140,0.30)" },
];

const FIXED_IDS = new Set(["send", "cashout", "payment"]);


const moreServices = [
  { id: "refer", Icon: ReferIcon, label: "Refer & Earn", desc: "Invite friends & earn", gradient: "from-orange-500 to-red-500", featureKey: "refer" },
  
  
  { id: "coupons", Icon: CouponsIcon, label: "Coupons & Offers", desc: "Exclusive deals", gradient: "from-pink-500 to-rose-600", soon: false, featureKey: "coupons" },
  { id: "donations", Icon: DonationsIcon, label: "Donations", desc: "Support causes", gradient: "from-red-500 to-rose-700", soon: false, featureKey: "donations" },
  { id: "loan", Icon: LoanIcon, label: "Loan", desc: "Quick personal loans", gradient: "from-amber-500 to-orange-600", soon: false, featureKey: "loan" },
  { id: "insurance", Icon: InsuranceIcon, label: "Insurance", desc: "Protect what matters", gradient: "from-violet-500 to-purple-600", soon: false, featureKey: "insurance" },
  { id: "giftcards", Icon: GiftCardsIcon, label: "Gift Cards", desc: "Send & redeem gifts", gradient: "from-orange-400 to-red-500", soon: false, featureKey: "gift_cards" },
];

const SlotIcon = ({ isHovered }: { isHovered?: boolean }) => (
  <Sparkles className={`w-6 h-6 transition-colors ${isHovered ? "text-primary" : "text-muted-foreground"}`} />
);

const blankSlots = [
  { id: "feature_slot_1", Icon: SlotIcon, label: "New Feature 1", desc: "Coming soon", gradient: "from-sky-500 to-blue-600", featureKey: "feature_slot_1", soon: false as boolean | undefined },
  { id: "feature_slot_2", Icon: SlotIcon, label: "New Feature 2", desc: "Coming soon", gradient: "from-indigo-500 to-violet-600", featureKey: "feature_slot_2", soon: false as boolean | undefined },
  { id: "feature_slot_3", Icon: SlotIcon, label: "New Feature 3", desc: "Coming soon", gradient: "from-teal-500 to-cyan-600", featureKey: "feature_slot_3", soon: false as boolean | undefined },
  { id: "feature_slot_4", Icon: SlotIcon, label: "New Feature 4", desc: "Coming soon", gradient: "from-fuchsia-500 to-pink-600", featureKey: "feature_slot_4", soon: false as boolean | undefined },
  { id: "feature_slot_5", Icon: SlotIcon, label: "New Feature 5", desc: "Coming soon", gradient: "from-lime-500 to-green-600", featureKey: "feature_slot_5", soon: false as boolean | undefined },
];

interface RippleState { x: number; y: number; id: number; }

/* ─── Sortable Action Item ─── */
interface SortableActionItemProps {
  action: ActionDef;
  index: number;
  isDraggable: boolean;
  isHovered: boolean;
  ripple: RippleState | null;
  label: string;
  isFeatureLocked: boolean;
  isGlobalOff: boolean;
  isUnavailable: boolean;
  expanded: boolean;
  longPressId: string | null;
  justDropped: boolean;
  iconSizePx: number;
  onTriggerRipple: (id: string, e: React.MouseEvent | React.TouchEvent) => void;
  onHandleAction: (id: string, label: string) => void;
  onHoverStart: (id: string) => void;
  onHoverEnd: () => void;
  onStartLongPress: (id: string) => void;
  onCancelLongPress: () => void;
  didLongPressRef: React.MutableRefObject<boolean>;
}

const SortableActionItem = ({
  action, index, isDraggable, isHovered, ripple, label,
  isFeatureLocked, isGlobalOff, isUnavailable, expanded, longPressId, justDropped, iconSizePx,
  onTriggerRipple, onHandleAction, onHoverStart, onHoverEnd,
  onStartLongPress, onCancelLongPress, didLongPressRef,
}: SortableActionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: action.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? (isDragging ? "transform 200ms ease" : undefined),
    zIndex: isDragging ? 50 : undefined,
    scale: isDragging ? 1.12 : 1,
  };

  // Ghost placeholder when this slot is the drop target
  if (isDragging) {
    return (
      <div ref={setNodeRef} style={style} className="relative">
        <div className="flex flex-col items-center gap-2.5">
          <div
            className="rounded-full border-2 border-dashed border-primary/40 bg-primary/5 animate-pulse"
            style={{ width: iconSizePx, height: iconSizePx }}
          />
          <span className="text-[10px] font-semibold text-transparent select-none px-0.5">
            {label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`relative transition-[scale,opacity] duration-200 ${isOver && isDraggable ? "scale-95 opacity-60" : ""} ${justDropped ? "animate-[drop-bounce_0.4s_ease-out]" : ""}`}>
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.04 + index * 0.05, ease: [0.23, 1, 0.32, 1] }}
        whileTap={isDragging ? undefined : { scale: 0.90 }}
        onClick={(e) => {
          if (isDragging) return;
          if (didLongPressRef.current) { didLongPressRef.current = false; return; }
          onTriggerRipple(action.id, e);
          onHandleAction(action.id, label);
        }}
        onTouchStart={(e) => { if (!isDragging) onTriggerRipple(action.id, e); }}
        onPointerDown={() => { if (!isDraggable) onStartLongPress(action.id); }}
        onPointerUp={onCancelLongPress}
        onPointerLeave={onCancelLongPress}
        onHoverStart={() => onHoverStart(action.id)}
        onHoverEnd={onHoverEnd}
        className={`flex flex-col items-center gap-2.5 group outline-none relative w-full ${isUnavailable ? "opacity-60" : ""}`}
      >
        {/* Drag handle indicator for draggable items */}
        {isDraggable && (
          <div
            {...attributes}
            {...listeners}
            className="absolute -top-1 -right-0.5 z-20 w-5 h-5 rounded-full bg-muted/80 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            style={{ touchAction: "none" }}
          >
            <GripVertical className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        <motion.div
          data-ripple-container
          whileHover={{ scale: 1.06, y: -2 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className="relative flex items-center justify-center rounded-full shadow-sm group-hover:shadow-md transition-all duration-200 overflow-hidden"
          style={{ width: iconSizePx, height: iconSizePx, background: action.bgStyle, outline: action.ringStyle, filter: isGlobalOff ? "grayscale(1)" : "none", opacity: isGlobalOff ? 0.5 : 1 }}
        >
          <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-[10px] transition-opacity duration-300 -z-10 scale-110" style={{ background: action.bgStyle }} />
          <AnimatePresence>
            {ripple && (
              <motion.span
                key={ripple.id}
                className="absolute rounded-full pointer-events-none"
                style={{ left: ripple.x, top: ripple.y, width: 8, height: 8, marginLeft: -4, marginTop: -4, background: action.rippleColor }}
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 10, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
          {action.id === "more" ? (
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-center">
              <MoreIcon />
            </motion.div>
          ) : (
            <action.Icon isHovered={isHovered} />
          )}
          {isFeatureLocked && (
            <div className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive flex items-center justify-center shadow-md z-10">
              <Lock className="w-2.5 h-2.5 text-destructive-foreground" />
            </div>
          )}
        </motion.div>
        <AnimatePresence>
          {longPressId === action.id && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-popover border border-border px-2.5 py-1 text-[10px] font-medium text-popover-foreground shadow-lg pointer-events-none"
            >
              {action.desc}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-popover border-r border-b border-border" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className={`text-[10px] sm:text-[10.5px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-all duration-150 px-0.5 ${isGlobalOff ? "opacity-50 grayscale" : ""}`}>
          {label}
        </span>
      </motion.button>
    </div>
  );
};

/* ─── Main Component ─── */
interface QuickActionsProps {
  onSendMoney: () => void;
  onCashOut: () => void;
  onPayment: () => void;
  onRecharge: () => void;
  onPayBill: () => void;
  onAddMoney: () => void;
  onRefer: () => void;
  onShop: () => void;
  onBankTransfer: () => void;
  
}

const QuickActions = ({ onSendMoney, onCashOut, onPayment, onRecharge, onPayBill, onAddMoney, onRefer, onShop, onBankTransfer }: QuickActionsProps) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isLocked } = useFeatureLocks();
  const { isDisabled: isGloballyDisabled, isHidden: isGloballyHidden, toggles } = useGlobalToggles();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ripples, setRipples] = useState<Record<string, RippleState | null>>({});
  const rippleCounterRef = useRef(0);
  const [expanded, setExpanded] = useState(() => sessionStorage.getItem("moreServicesExpanded") === "true");
  useEffect(() => {
    sessionStorage.setItem("moreServicesExpanded", String(expanded));
  }, [expanded]);
  const moreRef = useRef<HTMLDivElement>(null);

  // Auto-scroll into view when expanded
  useEffect(() => {
    if (expanded && moreRef.current) {
      setTimeout(() => {
        moreRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 280);
    }
  }, [expanded]);
  const [hoveredMoreId, setHoveredMoreId] = useState<string | null>(null);
  const [longPressId, setLongPressId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // Sortable order state (persisted to DB)
  const { order: sortableOrder, setOrder: setSortableOrder, resetOrder: resetOrderFn, isCustomOrder } = useQuickActionOrder();
  const isDnDEnabled = typeof window !== "undefined" && localStorage.getItem("mfs_dnd_enabled") === "true";
  const { iconSizePx, gridCols, compactMode } = useCustomization();

  const resetOrder = useCallback(() => {
    resetOrderFn();
    toast.success("Quick Actions order restored to default");
  }, [resetOrderFn]);

  // Build the final ordered action list: fixed first 3 + sorted rest
  const orderedActions = useMemo(() => {
    const fixed = allActionDefs.filter(a => FIXED_IDS.has(a.id));
    const sortableMap = new Map(allActionDefs.filter(a => !FIXED_IDS.has(a.id)).map(a => [a.id, a]));
    const sorted = sortableOrder.map(id => sortableMap.get(id)!).filter(Boolean);
    return [...fixed, ...sorted];
  }, [sortableOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    haptics.medium();
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const draggedId = event.active.id as string;
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    haptics.success();
    setJustDroppedId(draggedId);
    setTimeout(() => setJustDroppedId(null), 450);
    setSortableOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const startLongPress = useCallback((id: string) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      setLongPressId(id);
      didLongPress.current = true;
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    setLongPressId(null);
  }, []);

  const visibleMoreServices = useMemo(() => {
    const enabledSlots = blankSlots.filter((slot) => {
      const toggle = toggles.find((t) => t.feature_key === slot.featureKey);
      return toggle?.is_enabled === true;
    }).map((slot) => {
      const toggle = toggles.find((t) => t.feature_key === slot.featureKey);
      return { ...slot, label: toggle?.label || slot.label };
    });
    // Filter out hidden features from both regular services and slots
    return [...moreServices, ...enabledSlots].filter(
      (item) => !isGloballyHidden(item.featureKey)
    );
  }, [toggles, isGloballyHidden]);

  const triggerRipple = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    const el = (e.currentTarget as HTMLElement).querySelector("[data-ripple-container]") as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else if ("clientX" in e) { clientX = e.clientX; clientY = e.clientY; }
    else { clientX = rect.left + rect.width / 2; clientY = rect.top + rect.height / 2; }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    rippleCounterRef.current += 1;
    setRipples(prev => ({ ...prev, [id]: { x, y, id: rippleCounterRef.current } }));
    setTimeout(() => setRipples(prev => ({ ...prev, [id]: null })), 600);
  }, []);

  const handleAction = (id: string, label: string) => {
    const featureKey = FEATURE_MAP[id];
    if (featureKey && isGloballyDisabled(featureKey)) {
      toast.info(`${label} is temporarily unavailable`, {
        description: "This feature has been disabled by the system. Please try again later.",
      });
      return;
    }
    if (id === "send") return onSendMoney();
    if (id === "cashout") return onCashOut();
    if (id === "payment") return onPayment();
    if (id === "addmoney") return onAddMoney();
    if (id === "recharge") return onRecharge();
    if (id === "bill") return onPayBill();
    if (id === "bank") return onBankTransfer();
    if (id === "shop") return onShop();
    if (id === "more") { haptics.light(); return setExpanded(prev => !prev); }
    toast.info(`${label} coming soon!`);
  };

  const handleMoreService = (id: string, soon?: boolean) => {
    if (soon) { toast.info("Coming soon!"); return; }
    if (id === "refer") onRefer();
    else if (id === "donations") navigate("/donations");
    else if (id === "coupons") navigate("/coupons");
    else if (id === "careers") navigate("/careers");
    else if (id === "loan") navigate("/loan");
    else if (id === "insurance") navigate("/insurance");
    else if (id === "giftcards") navigate("/giftcards");
  };

  const filteredMoreServices = visibleMoreServices;

  return (
    <div className={`bg-card rounded-[19px] shadow-card border border-border/60 ${compactMode ? "p-3" : "p-4 sm:p-5"}`}>
      <AnimatePresence>
        {isDnDEnabled && isCustomOrder && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex justify-end mb-2 overflow-hidden"
          >
            <button
              onClick={resetOrder}
              className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-full bg-muted/60 hover:bg-muted"
            >
              <RotateCcw className="w-3 h-3" />
              Reset order
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableOrder} strategy={rectSortingStrategy}>
          <div className={`grid gap-x-2 sm:gap-x-3 ${compactMode ? "gap-y-3" : "gap-y-5"} ${gridCols === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
            {orderedActions.filter(action => {
              const fk = FEATURE_MAP[action.id];
              return !fk || !isGloballyHidden(fk);
            }).map((action, index) => {
              const isHov = hoveredId === action.id;
              const ripple = ripples[action.id];
              const label = t(action.labelKey);
              const featureKey = FEATURE_MAP[action.id];
              const lockStatus = featureKey ? isLocked(featureKey) : { locked: false };
              const isFeatureLocked = lockStatus.locked;
              const isGlobalOff = featureKey ? isGloballyDisabled(featureKey) : false;
              const isUnavailable = isFeatureLocked || isGlobalOff;
              const isDraggable = isDnDEnabled && !FIXED_IDS.has(action.id);

              return (
                <SortableActionItem
                  key={action.id}
                  action={action}
                  index={index}
                  isDraggable={isDraggable}
                  isHovered={isHov}
                  ripple={ripple}
                  label={label}
                  isFeatureLocked={isFeatureLocked}
                  isGlobalOff={isGlobalOff}
                  isUnavailable={isUnavailable}
                  expanded={expanded}
                  longPressId={longPressId}
                  justDropped={justDroppedId === action.id}
                  iconSizePx={iconSizePx}
                  onTriggerRipple={triggerRipple}
                  onHandleAction={handleAction}
                  onHoverStart={(id) => setHoveredId(id)}
                  onHoverEnd={() => setHoveredId(null)}
                  onStartLongPress={startLongPress}
                  onCancelLongPress={cancelLongPress}
                  didLongPressRef={didLongPress}
                />
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeDragId ? (() => {
            const action = allActionDefs.find(a => a.id === activeDragId);
            if (!action) return null;
            const label = t(action.labelKey);
            return (
              <div className="flex flex-col items-center gap-2.5 drop-shadow-xl">
                <div
                  className="relative flex items-center justify-center rounded-full shadow-lg ring-2 ring-primary/30 overflow-hidden"
                  style={{ width: iconSizePx, height: iconSizePx, background: action.bgStyle }}
                >
                  {action.id === "more" ? <MoreIcon /> : <action.Icon />}
                </div>
                <span className="text-[10px] sm:text-[10.5px] font-semibold text-foreground leading-tight text-center px-0.5">
                  {label}
                </span>
              </div>
            );
          })() : null}
        </DragOverlay>
      </DndContext>

      {/* More Services — inline expandable section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            ref={moreRef}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 mt-4 pt-4">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">More Services</h3>
                <button
                  onClick={() => setExpanded(false)}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <ChevronUp size={12} className="text-muted-foreground" />
                </button>
              </div>
              <div className={`grid gap-y-5 gap-x-2 sm:gap-x-3 ${gridCols === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                {filteredMoreServices.map((item, i) => {
                  const moreGlobalOff = item.featureKey ? isGloballyDisabled(item.featureKey) : false;
                  return (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 450, damping: 26, delay: 0.03 * i }}
                      whileTap={{ scale: 0.90 }}
                      onClick={() => {
                        if (didLongPress.current) { didLongPress.current = false; return; }
                        if (moreGlobalOff) { toast.info(`${item.label} is temporarily unavailable`, { description: "This feature has been disabled by the system. Please try again later." }); return; }
                        handleMoreService(item.id, item.soon);
                      }}
                      onPointerDown={() => startLongPress(item.id)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onMouseEnter={() => setHoveredMoreId(item.id)}
                      onMouseLeave={() => setHoveredMoreId(null)}
                      className="flex flex-col items-center gap-2.5 group outline-none relative"
                    >
                      <motion.div
                        whileHover={{ scale: 1.06, y: -2 }}
                        transition={{ type: "spring", stiffness: 380, damping: 22 }}
                        className="relative flex items-center justify-center rounded-full shadow-sm group-hover:shadow-md transition-all duration-200 overflow-hidden"
                        style={{ width: iconSizePx, height: iconSizePx, filter: moreGlobalOff ? "grayscale(1)" : "none", opacity: moreGlobalOff ? 0.5 : 1 }}
                      >
                        <div className={`absolute inset-0 rounded-full bg-gradient-to-b ${item.gradient} opacity-[0.14]`} />
                        {item.soon && <div className={`absolute inset-0 rounded-full bg-gradient-to-b ${item.gradient} opacity-20 animate-pulse`} />}
                        {item.soon && (
                          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                            <div className="absolute inset-0" style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)", animation: "shimmer-sweep 2.5s ease-in-out infinite" }} />
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-[10px] transition-opacity duration-300 -z-10 scale-110">
                          <div className={`w-full h-full bg-gradient-to-b ${item.gradient} opacity-30`} />
                        </div>
                        <item.Icon isHovered={hoveredMoreId === item.id} />
                      </motion.div>
                      {item.soon && (
                        <motion.div className="absolute -top-1 right-0 z-10" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                          <span className="text-[8px] font-bold text-muted-foreground" style={{ textShadow: '0 0.5px 2px hsl(var(--background) / 0.8)' }}>Soon</span>
                        </motion.div>
                      )}
                      <AnimatePresence>
                        {longPressId === item.id && (
                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.18 }}
                            className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg bg-popover border border-border px-2.5 py-1 text-[10px] font-medium text-popover-foreground shadow-lg pointer-events-none"
                          >
                            {item.desc}
                            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-popover border-r border-b border-border" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span className={`text-[10px] sm:text-[10.5px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight text-center transition-all duration-150 px-0.5 ${moreGlobalOff ? "opacity-50 grayscale" : ""}`}>
                        {item.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickActions;
