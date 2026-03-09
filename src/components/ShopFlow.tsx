import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, Search, Star, Plus, Minus, Trash2,
  CheckCircle2, Tag, X, MapPin, CreditCard, Wallet, Pencil, Package,
  ChevronRight, Truck, Clock, CircleCheck, ChevronDown, ChevronUp,
  Heart, Gift, Ticket, MessageSquarePlus, Send, Zap, AlertCircle,
  RefreshCw, TrendingUp, Store, BadgeCheck, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getBalance, recordTransaction, onBalanceChange, transferMoney } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { haptics } from "@/lib/haptics";
import SlideToConfirm from "@/components/SlideToConfirm";
import { useI18n } from "@/lib/i18n";
import { fireSuccessConfetti } from "@/lib/confetti";
import { supabase } from "@/integrations/supabase/client";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import FeatureGuard from "@/components/FeatureGuard";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import ProductImage from "@/components/ProductImage";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  merchant_id: string;
  name: string;
  price: number;
  original_price?: number | null;
  rating: number;
  review_count: number;
  emoji: string;
  category: string;
  description?: string | null;
  badge?: string | null;
  badge_color?: string | null;
  vendor_name: string;
  stock: number;
  image_url?: string | null;
  images?: string[];
  video_url?: string | null;
}

interface CartItem extends Product { qty: number; }

interface Address {
  id: string;
  label: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  phone: string;
}

interface Order {
  id: string;
  orderNum: string;
  date: string;
  items: CartItem[];
  total: number;
  address: Address;
  paymentMethod: "wallet" | "card";
  status: "processing" | "confirmed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled";
  estimatedDelivery: string;
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  step: Order["status"];
  label: string;
  timestamp: string | null;
  done: boolean;
}

interface Review {
  productId: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  text: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DEFAULT_ADDRESSES: Address[] = [
  { id: "a1", label: "Home", name: "Karim Hossain", line1: "House 12, Road 5, Block D", line2: "Mirpur-10", city: "Dhaka-1216", phone: "01712-345678" },
  { id: "a2", label: "Office", name: "Karim Hossain", line1: "Level 4, Tower A, Bashundhara City", line2: "Panthapath", city: "Dhaka-1215", phone: "01712-345678" },
];

const PROMO_CODES: Record<string, number> = { "SAVE10": 10, "WELCOME20": 20, "FLASH15": 15, "MFS5": 5 };

const TIMELINE_STEP_KEYS: { step: Order["status"]; labelKey: string }[] = [
  { step: "processing", labelKey: "orderPlacedTimeline" },
  { step: "confirmed", labelKey: "confirmed2" },
  { step: "shipped", labelKey: "shipped" },
  { step: "out_for_delivery", labelKey: "outForDelivery" },
  { step: "delivered", labelKey: "delivered" },
];

const makeTimeline = (currentStatus: Order["status"], baseDate: string): TimelineEvent[] => {
  const stepOrder = TIMELINE_STEP_KEYS.map(s => s.step);
  const currentIdx = stepOrder.indexOf(currentStatus);
  return TIMELINE_STEP_KEYS.map((s, i) => ({
    step: s.step, label: s.labelKey, done: i <= currentIdx,
    timestamp: i <= currentIdx ? (i === 0 ? baseDate : `${baseDate} +${i}d`) : null,
  }));
};

const SAMPLE_ORDERS: Order[] = [];

type Screen = "browse" | "detail" | "cart" | "checkout" | "success" | "orders" | "wishlist";
type PaymentMethod = "wallet" | "card";

const SHOP_GRADIENT = "linear-gradient(135deg, hsl(var(--primary)), hsl(350 65% 38%))";

// ── Video Embed Helper ─────────────────────────────────────────────────────────
const getVideoEmbed = (url: string | null | undefined): { type: string; id: string } | null => {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };
  return null;
};

// ── Order Status Config ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Order["status"], { label: string; color: string; icon: React.ElementType }> = {
  processing:       { label: "Processing",       color: "hsl(36 100% 50%)", icon: Clock },
  confirmed:        { label: "Confirmed",        color: "hsl(291 64% 42%)", icon: CheckCircle2 },
  shipped:          { label: "Shipped",          color: "hsl(207 90% 54%)", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "hsl(14 100% 57%)", icon: Package },
  delivered:        { label: "Delivered",        color: "hsl(122 39% 49%)", icon: CircleCheck },
  cancelled:        { label: "Cancelled",        color: "hsl(0 0% 62%)",    icon: X },
};

// ── Star Rating ────────────────────────────────────────────────────────────────
const StarRating = ({ value, size = 13, onRate }: { value: number; size?: number; onRate?: (n: number) => void }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={size}
        className={`${s <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"} ${onRate ? "cursor-pointer" : ""}`}
        onClick={() => onRate?.(s)} />
    ))}
  </div>
);

// ── Write Review Sheet ─────────────────────────────────────────────────────────
const WriteReviewSheet = ({ productId, productName, onSubmit, onCancel }: {
  productId: string; productName: string;
  onSubmit: (r: Review) => void; onCancel: () => void;
}) => {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[70] flex flex-col justify-end"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-background rounded-t-3xl p-5 space-y-4 pb-10">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-2" />
        <p className="text-[16px] font-bold text-foreground">{t("reviewProduct")} {productName}</p>
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-[12px] text-muted-foreground">{t("tapToRate")}</p>
          <StarRating value={rating} size={32} onRate={setRating} />
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t("shareExperience")} rows={3}
          className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-[13px] outline-none focus:border-primary resize-none text-foreground" />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-12 rounded-2xl border border-border text-[14px] font-semibold text-muted-foreground bg-background">{t("cancel")}</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
            if (rating === 0) { toast.error(t("pleaseSelectRating")); return; }
            if (!text.trim()) { toast.error(t("pleaseWriteSomething")); return; }
            onSubmit({ productId, author: "You", avatar: "🙋", rating, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), text });
          }}
            className="flex-1 h-12 rounded-2xl text-primary-foreground font-bold text-[14px] flex items-center justify-center gap-2"
            style={{ background: SHOP_GRADIENT }}>
            <Send size={14} /> {t("submit")}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Address Editor Sheet ───────────────────────────────────────────────────────
const AddressEditor = ({ address, onSave, onCancel }: { address: Address | null; onSave: (a: Address) => void; onCancel: () => void; }) => {
  const { t } = useI18n();
  const [form, setForm] = useState<Address>(address ?? { id: `a${Date.now()}`, label: "Home", name: "", line1: "", line2: "", city: "", phone: "" });
  const set = (k: keyof Address, v: string) => setForm(f => ({ ...f, [k]: v }));
  const labels = ["Home", "Office", "Other"];
  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-background rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto pb-10">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-2" />
        <p className="text-[16px] font-bold text-foreground">{address ? t("editAddress") : t("newAddress")}</p>
        <div className="flex gap-2">
          {labels.map(l => (
            <button key={l} onClick={() => set("label", l)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${form.label === l ? "text-primary-foreground border-transparent" : "bg-muted text-muted-foreground border-border"}`}
              style={form.label === l ? { background: SHOP_GRADIENT } : {}}>{l}</button>
          ))}
        </div>
        {([
          { key: "name" as const, label: t("fullName"), placeholder: "e.g. Karim Hossain" },
          { key: "phone" as const, label: t("phone"), placeholder: "e.g. 01712-345678" },
          { key: "line1" as const, label: t("addressLine1"), placeholder: "House/Flat, Road, Block" },
          { key: "line2" as const, label: t("areaThana"), placeholder: "e.g. Mirpur-10" },
          { key: "city" as const, label: t("cityPostcode"), placeholder: "e.g. Dhaka-1216" },
        ]).map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
            <input type="text" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
              className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-[13px] text-foreground outline-none focus:border-primary transition-colors" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="flex-1 h-12 rounded-2xl border border-border text-[14px] font-semibold text-muted-foreground bg-background">{t("cancel")}</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { if (!form.name || !form.line1 || !form.city) { toast.error(t("fillAllRequired")); return; } onSave(form); }}
            className="flex-1 h-12 rounded-2xl text-primary-foreground font-bold text-[14px]" style={{ background: SHOP_GRADIENT }}>{t("saveAddress")}</motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Order Timeline ─────────────────────────────────────────────────────────────
const OrderTimeline = ({ timeline }: { timeline: TimelineEvent[] }) => {
  const { t } = useI18n();
  const doneCount = timeline.filter(t => t.done).length;
  const progress = ((doneCount - 1) / (timeline.length - 1)) * 100;
  return (
    <div className="space-y-3 pt-1">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${Math.max(0, progress)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
      </div>
      <div className="space-y-0">
        {timeline.map((event, i) => {
          const cfg = STATUS_CONFIG[event.step];
          const Icon = cfg.icon;
          const isLast = i === timeline.length - 1;
          return (
            <div key={event.step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.07 }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${event.done ? "text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  style={event.done ? { background: cfg.color } : {}}>
                  <Icon size={13} />
                </motion.div>
                {!isLast && <div className={`w-0.5 flex-1 min-h-[20px] my-0.5 rounded-full ${event.done ? "bg-primary/30" : "bg-border"}`} />}
              </div>
              <div className="pb-4 flex-1">
                <p className={`text-[12.5px] font-bold ${event.done ? "text-foreground" : "text-muted-foreground"}`}>{t(event.label as any)}</p>
                {event.timestamp && <p className="text-[10.5px] text-muted-foreground mt-0.5">{event.timestamp}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Order Card ─────────────────────────────────────────────────────────────────
const OrderCard = ({ order, onCancel }: { order: Order; onCancel?: (id: string) => void; }) => {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;
  const canCancel = order.status === "processing" || order.status === "confirmed";

  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
      <button className="w-full p-4 flex items-center gap-3 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}18` }}>
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground font-mono">{order.orderNum}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{order.date} · {order.items.length} item{order.items.length > 1 ? "s" : ""} · ৳{order.total.toLocaleString()}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-primary-foreground" style={{ background: cfg.color }}>{cfg.label}</span>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              {order.items.map(item => (
                <div key={item.id} className="flex items-center gap-2.5">
                  <span className="text-xl">{item.image_url ? <img src={item.image_url} alt={item.name} className="w-7 h-7 rounded object-cover inline" /> : item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate text-foreground">{item.name}</p>
                    <p className="text-[10.5px] text-muted-foreground">{t("qty")}: {item.qty} · <span className="text-primary">{item.vendor_name}</span></p>
                  </div>
                  <p className="text-[12px] font-bold text-foreground">৳{(item.price * item.qty).toLocaleString()}</p>
                </div>
              ))}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-snug">{order.address.line1}, {order.address.line2}, {order.address.city}</p>
                </div>
                {order.status !== "cancelled" && (
                  <div className="flex items-center gap-2">
                    <Truck size={12} className="text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">{t("estDelivery")}: {order.estimatedDelivery}</p>
                  </div>
                )}
              </div>
              {order.status !== "cancelled" && (
                <>
                  <button onClick={() => setShowTimeline(s => !s)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-border/60 bg-muted/50 text-[12px] font-semibold text-foreground">
                    <div className="flex items-center gap-2"><Truck size={13} className="text-primary" />{t("trackShipment")}</div>
                    {showTimeline ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {showTimeline && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-muted/30 rounded-xl p-3">
                        <OrderTimeline timeline={order.timeline} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
              {canCancel && onCancel && !confirmCancel && (
                <button onClick={() => setConfirmCancel(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/30 text-destructive text-[12px] font-semibold bg-destructive/5">
                  <AlertCircle size={13} /> {t("cancelOrder")}
                </button>
              )}
              {canCancel && onCancel && confirmCancel && (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2">
                  <p className="text-[12px] font-semibold text-destructive text-center">{t("cancelThisOrder")}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmCancel(false)} className="flex-1 h-9 rounded-xl border border-border text-[12px] font-semibold text-muted-foreground bg-background">{t("keepOrder")}</button>
                    <button onClick={() => { onCancel(order.id); setConfirmCancel(false); setExpanded(false); }}
                      className="flex-1 h-9 rounded-xl bg-destructive text-destructive-foreground text-[12px] font-bold">{t("yesCancel")}</button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Product Skeleton ───────────────────────────────────────────────────────────
const ProductSkeleton = () => (
  <div className="bg-card border border-border/40 rounded-2xl overflow-hidden">
    <Skeleton className="h-32 w-full" />
    <div className="p-3 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-20" />
      <div className="flex justify-between items-center pt-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// ── Main ShopFlow ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
interface ShopFlowProps { onClose: () => void; }

const ShopFlow = ({ onClose }: ShopFlowProps) => {
  const { t } = useI18n();
  const [screen, setScreen] = useState<Screen>("browse");
  const [category, setCategory] = useState("All");
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [detail, setDetail] = useState<Product | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [orderNum, setOrderNum] = useState("");
  const [lastOrderTotal, setLastOrderTotal] = useState(0);
  const [lastPayMethod, setLastPayMethod] = useState<PaymentMethod>("wallet");
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── DB Products ───────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    const { data, error } = await (supabase as any).rpc("get_shop_products");
    if (!error && data) {
      setProducts(data.map((p: any) => ({
        id: p.id,
        merchant_id: p.merchant_id,
        name: p.name,
        price: Number(p.price),
        original_price: p.original_price ? Number(p.original_price) : undefined,
        rating: Number(p.rating),
        review_count: Number(p.review_count),
        emoji: p.emoji || "📦",
        category: p.category || "General",
        description: p.description,
        badge: p.badge,
        badge_color: p.badge_color,
        vendor_name: p.vendor_name || "Shop",
        stock: p.stock,
        image_url: p.image_url,
        images: p.images || [],
        video_url: p.video_url,
      })));
    }
    setProductsLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Realtime product updates
  useEffect(() => {
    const channel = supabase
      .channel("shop-products-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_products" }, () => { fetchProducts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchProducts]);

  // Pull to refresh
  usePullToRefresh({ onRefresh: fetchProducts, containerRef: bodyRef as any });

  // Reactive wallet balance
  const [walletBalance, setWalletBalance] = useState(getBalance);
  useEffect(() => {
    const unsub = onBalanceChange(setWalletBalance);
    return () => { unsub(); };
  }, []);

  // Wishlist
  const [wishlist, setWishlist] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("shop_wishlist") || "[]")); }
    catch { return new Set(); }
  });

  // Address state
  const [addresses, setAddresses] = useState<Address[]>(DEFAULT_ADDRESSES);
  const [selectedAddressId, setSelectedAddressId] = useState("a1");
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null | "new">(null);

  // Payment method
  const [payMethod, setPayMethod] = useState<PaymentMethod>("wallet");
  const [savedCard] = useState({ last4: "4242", brand: "Visa" });

  // PIN
  const [checkoutPin, setCheckoutPin] = useState("");
  const [checkoutPinError, setCheckoutPinError] = useState("");
  const [checkoutProcessing, setCheckoutProcessing] = useState(false);

  // Promo
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoInput, setPromoInput] = useState("");

  // Orders
  const [orders, setOrders] = useState<Order[]>(SAMPLE_ORDERS);

  useOrderNotifications((update) => {
    setOrders(prev => prev.map(o => {
      if (o.orderNum === update.order_num || o.id === update.id) {
        const newStatus = update.status as Order["status"];
        return { ...o, status: newStatus, timeline: makeTimeline(newStatus, o.date) };
      }
      return o;
    }));
  });

  // Fetch DB orders
  useEffect(() => {
    const fetchDbOrders = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data && data.length > 0) {
        const dbOrders: Order[] = data.map((o: any) => ({
          id: o.id,
          orderNum: o.order_num,
          date: new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          items: (Array.isArray(o.items) ? o.items : []).map((item: any) => ({
            id: item.id, name: item.name, price: item.price, qty: item.qty,
            emoji: item.emoji ?? "📦", category: "", vendor_name: item.vendor_name || "Shop",
            merchant_id: item.merchant_id || "", rating: 0, review_count: 0, stock: 0,
            image_url: item.image_url || null,
          })),
          total: Number(o.total),
          address: {
            id: "db", label: "Shipping",
            name: o.shipping_name ?? "", line1: o.shipping_address?.split(",")[0] ?? "",
            line2: o.shipping_address?.split(",").slice(1).join(",").trim() ?? "",
            city: o.shipping_city ?? "", phone: o.shipping_phone ?? "",
          },
          paymentMethod: (o.payment_method ?? "wallet") as PaymentMethod,
          status: o.status as Order["status"],
          estimatedDelivery: o.estimated_delivery ?? "",
          timeline: makeTimeline(o.status as Order["status"], new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
        }));
        setOrders(prev => {
          const dbIds = new Set(dbOrders.map(o => o.orderNum));
          const kept = prev.filter(o => !dbIds.has(o.orderNum));
          return [...dbOrders, ...kept];
        });
      }
    };
    fetchDbOrders();
  }, []);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showWriteReview, setShowWriteReview] = useState(false);

  useEffect(() => { localStorage.setItem("shop_wishlist", JSON.stringify([...wishlist])); }, [wishlist]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [screen, detail]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ["All", ...Array.from(cats).sort()];
  }, [products]);

  const vendors = useMemo(() => {
    const vs = new Map<string, string>();
    products.forEach(p => vs.set(p.merchant_id, p.vendor_name));
    return Array.from(vs.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filtered = useMemo(() => products.filter(p =>
    (category === "All" || p.category === category) &&
    (!vendorFilter || p.merchant_id === vendorFilter) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.vendor_name.toLowerCase().includes(search.toLowerCase()))
  ), [category, vendorFilter, search, products]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt = appliedPromo ? Math.round(cartSubtotal * appliedPromo.discount / 100) : 0;
  const cartTotal = cartSubtotal - discountAmt;
  const selectedAddress = addresses.find(a => a.id === selectedAddressId) ?? addresses[0];
  const purchasedProductIds = useMemo(() => new Set(orders.flatMap(o => o.items.map(i => i.id))), [orders]);
  const wishlistProducts = products.filter(p => wishlist.has(p.id));
  const relatedProducts = useMemo(() =>
    detail ? products.filter(p => p.category === detail.category && p.id !== detail.id).slice(0, 4) : [], [detail, products]);

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id);
      if (ex) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...p, qty: 1 }];
    });
    toast.success(`${p.emoji} ${t("addedToCart")}`);
  };
  const changeQty = (id: string, delta: number) => setCart(prev => prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));
  const buyNow = (p: Product) => { setCart([{ ...p, qty: 1 }]); setAppliedPromo(null); setPromoInput(""); setScreen("checkout"); };

  // ── Wishlist ────────────────────────────────────────────────────────────────
  const toggleWishlist = (id: string) => {
    setWishlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast(t("removedFromWishlist")); }
      else { next.add(id); toast.success(`❤️ ${t("addedToWishlist")}`); }
      return next;
    });
  };

  // ── Promo ────────────────────────────────────────────────────────────────────
  const applyPromo = () => {
    const upper = promoInput.trim().toUpperCase();
    if (!upper) return;
    if (appliedPromo?.code === upper) { toast.error("Already applied"); return; }
    const disc = PROMO_CODES[upper];
    if (!disc) { toast.error("Invalid promo code"); return; }
    setAppliedPromo({ code: upper, discount: disc });
    toast.success(`🎉 ${disc}% discount applied!`);
  };
  const removePromo = () => { setAppliedPromo(null); setPromoInput(""); };

  // ── Cancel ────────────────────────────────────────────────────────────────────
  const cancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled" as const, timeline: [] } : o));
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("orders").update({ status: "cancelled" } as any).eq("order_num", order.orderNum).eq("user_id", session.user.id);
    }
    toast.success(order.paymentMethod === "wallet"
      ? `Order cancelled · Refund of ৳${order.total.toLocaleString()} will be processed within 24 hours`
      : "Order cancelled · Refund will be processed to your card");
  };

  // ── Checkout ──────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (checkoutPin.length < 4) { setCheckoutPinError("Enter your 4-digit PIN."); return; }
    if (checkoutProcessing) return;
    setCheckoutProcessing(true);
    setCheckoutPinError("");

    const pinValid = await verifyPin(checkoutPin);
    if (!pinValid) { setCheckoutPinError("Incorrect PIN. Please try again."); setCheckoutPin(""); setCheckoutProcessing(false); return; }
    haptics.success();

    if (payMethod === "wallet") {
      if (cartTotal > walletBalance) { toast.error("Insufficient wallet balance"); setCheckoutProcessing(false); return; }
      try {
        await transferMoney({
          recipientPhone: "SHOP-EASYPAY",
          amount: cartTotal, fee: 0, type: "payment",
          recipientName: "EasyPay Shop",
          description: `Shop order: ${cart.map(i => i.name).join(", ")}`,
          reference: `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        });
      } catch (e: any) { toast.error(e.message ?? "Payment failed"); setCheckoutProcessing(false); return; }
    }

    const num = `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const estDelivery = new Date(Date.now() + 5 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const newOrder: Order = {
      id: `o${Date.now()}`, orderNum: num, date: dateStr, items: [...cart], total: cartTotal,
      address: selectedAddress, paymentMethod: payMethod, status: "processing",
      estimatedDelivery: estDelivery, timeline: makeTimeline("processing", dateStr),
    };
    setOrders(prev => [newOrder, ...prev]);

    // Persist — include merchant_id from first item
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const firstMerchantId = cart[0]?.merchant_id || null;
      await (supabase as any).from("orders").insert({
        user_id: session.user.id,
        order_num: num,
        status: "processing",
        total: cartTotal,
        payment_method: payMethod,
        shipping_name: selectedAddress.name,
        shipping_address: `${selectedAddress.line1}, ${selectedAddress.line2}`,
        shipping_city: selectedAddress.city,
        shipping_phone: selectedAddress.phone,
        merchant_id: firstMerchantId,
        items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, emoji: c.emoji, image_url: c.image_url, vendor_name: c.vendor_name, merchant_id: c.merchant_id })),
        estimated_delivery: estDelivery,
      });
    }

    setOrderNum(num);
    setLastOrderTotal(cartTotal);
    setLastPayMethod(payMethod);
    fireSuccessConfetti();
    setCart([]); setAppliedPromo(null); setPromoInput(""); setCheckoutPin(""); setCheckoutPinError(""); setCheckoutProcessing(false);
    setScreen("success");
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const goBack = () => {
    if (screen === "detail") { setDetail(null); setScreen("browse"); return; }
    if (screen === "cart") { setScreen("browse"); return; }
    if (screen === "checkout") { setScreen("cart"); return; }
    if (screen === "success") { setScreen("browse"); return; }
    if (screen === "orders") { setScreen("browse"); return; }
    if (screen === "wishlist") { setScreen("browse"); return; }
    onClose();
  };

  const headerTitle: Record<Screen, string> = {
    browse: t("shopTitle"), detail: detail?.name ?? t("product"),
    cart: `${t("cart")} (${cartCount})`, checkout: t("checkout"),
    success: t("orderPlaced"), orders: t("myOrders"),
    wishlist: `${t("wishlist")} (${wishlist.size})`,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <motion.div
        className="text-primary-foreground px-4 pt-3 pb-3 shrink-0"
        style={{ background: SHOP_GRADIENT }}
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.88 }} onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center tap-target shrink-0">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold leading-tight truncate">{headerTitle[screen]}</p>
            <p className="text-[11px] opacity-60">
              {screen === "browse" && `${filtered.length} products${vendorFilter ? ` from ${vendors.find(v => v.id === vendorFilter)?.name}` : ""}`}
              {screen === "cart" && `৳${cartTotal.toLocaleString()} ${t("total")}`}
              {screen === "checkout" && t("confirmYourOrder")}
              {screen === "success" && orderNum}
              {screen === "orders" && `${orders.length} ${t("orders")}`}
              {screen === "wishlist" && `${wishlist.size} ${t("savedItems")}`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {(screen === "browse" || screen === "detail") && (
              <>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setScreen("wishlist")}
                  className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center tap-target">
                  <Heart size={17} />
                  {wishlist.size > 0 && <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">{wishlist.size}</span>}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setScreen("orders")}
                  className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center tap-target">
                  <Package size={17} />
                  {orders.filter(o => o.status !== "cancelled" && o.status !== "delivered").length > 0 && (
                    <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">
                      {orders.filter(o => o.status !== "cancelled" && o.status !== "delivered").length}
                    </span>
                  )}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setScreen("cart")}
                  className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center tap-target">
                  <ShoppingCart size={17} />
                  {cartCount > 0 && <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-accent text-[9px] font-bold text-accent-foreground flex items-center justify-center">{cartCount}</span>}
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Body ── */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto pb-32 scrollbar-none">
        <AnimatePresence mode="wait">

          {/* ──── BROWSE ──── */}
          {screen === "browse" && (
            <motion.div key="browse" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder={t("searchProducts")} value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground outline-none focus:border-primary transition-colors" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>}
              </div>

              {/* Vendor chips (Shop by Vendor) */}
              {vendors.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Store size={12} /> Shop by Vendor
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button onClick={() => setVendorFilter(null)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${!vendorFilter ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"}`}>
                      All Vendors
                    </button>
                    {vendors.map(v => (
                      <button key={v.id} onClick={() => setVendorFilter(vendorFilter === v.id ? null : v.id)}
                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 ${vendorFilter === v.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground"}`}>
                        <BadgeCheck size={10} /> {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setCategory(cat)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold transition-all ${category === cat ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Products grid */}
              {productsLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1,2,3,4].map(i => <ProductSkeleton key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-5xl mb-3">{products.length === 0 ? "🏪" : "🔍"}</p>
                  <p className="font-semibold text-foreground">{products.length === 0 ? "No products available" : t("noProductsFound")}</p>
                  <p className="text-sm mt-1">{products.length === 0 ? "Merchants haven't listed any products yet" : t("tryDifferentSearch")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filtered.map((p, i) => {
                    const inCart = cart.find(c => c.id === p.id);
                    const isWished = wishlist.has(p.id);
                    const discount = p.original_price ? Math.round((1 - p.price / Number(p.original_price)) * 100) : 0;
                    return (
                      <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className="bg-card border border-border/50 rounded-2xl overflow-hidden cursor-pointer group"
                        onClick={() => { setDetail(p); setScreen("detail"); }}>
                        <div className="relative h-32 flex items-center justify-center bg-muted/30 overflow-hidden">
                          <ProductImage imageUrl={p.image_url} emoji={p.emoji} alt={p.name} emojiSize="text-5xl" />
                          {p.badge && <span className="absolute top-2 left-2 text-[9px] font-bold text-primary-foreground px-2 py-0.5 rounded-full" style={{ background: p.badge_color || "hsl(var(--primary))" }}>{p.badge}</span>}
                          {discount > 0 && !p.badge && <span className="absolute top-2 left-2 text-[9px] font-bold text-destructive-foreground px-1.5 py-0.5 rounded-full bg-destructive">-{discount}%</span>}
                          <motion.button whileTap={{ scale: 0.8 }} onClick={e => { e.stopPropagation(); toggleWishlist(p.id); }}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
                            <Heart size={12} className={isWished ? "fill-destructive text-destructive" : "text-muted-foreground"} />
                          </motion.button>
                          {p.stock === 0 && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <span className="text-[11px] font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full">Out of Stock</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3 space-y-1">
                          {/* Vendor badge */}
                          <div className="flex items-center gap-1">
                            <BadgeCheck size={9} className="text-primary shrink-0" />
                            <span className="text-[9px] font-semibold text-primary truncate">{p.vendor_name}</span>
                          </div>
                          <p className="text-[12.5px] font-bold text-foreground leading-tight line-clamp-2">{p.name}</p>
                          <div className="flex items-center gap-1">
                            <Star size={10} className="fill-amber-400 text-amber-400" />
                            <span className="text-[10px] font-semibold text-foreground">{p.rating}</span>
                            <span className="text-[10px] text-muted-foreground">({p.review_count})</span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <p className="text-[13px] font-extrabold text-foreground">৳{p.price.toLocaleString()}</p>
                              {p.original_price && <p className="text-[10px] text-muted-foreground line-through">৳{Number(p.original_price).toLocaleString()}</p>}
                            </div>
                            <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); if (p.stock > 0) addToCart(p); }}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center text-primary-foreground transition-colors ${p.stock === 0 ? "bg-muted text-muted-foreground" : ""}`}
                              style={p.stock > 0 ? { background: inCart ? "hsl(122 39% 49%)" : "hsl(var(--primary))" } : {}}
                              disabled={p.stock === 0}>
                              {inCart ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ──── DETAIL ──── */}
          {screen === "detail" && detail && (() => {
            const allImages = detail.images && detail.images.length > 0
              ? detail.images
              : detail.image_url
                ? [detail.image_url]
                : [];
            const videoEmbed = getVideoEmbed(detail.video_url);
            const safeIdx = Math.min(activeImageIdx, Math.max(0, allImages.length - 1));
            return (
            <motion.div key={`detail-${detail.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-4">
              {/* Image Carousel */}
              <div className="relative rounded-2xl overflow-hidden">
                <div className="relative h-56 flex items-center justify-center bg-muted/30">
                  {allImages.length > 0 ? (
                    <img 
                      src={allImages[activeImageIdx]} 
                      alt={detail.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = ''; e.currentTarget.className = 'hidden'; }}
                    />
                  ) : (
                    <span className="text-8xl">{detail.emoji}</span>
                  )}
                  {detail.badge && <span className="absolute top-3 left-3 text-[10px] font-bold text-primary-foreground px-2.5 py-1 rounded-full" style={{ background: detail.badge_color || "hsl(var(--primary))" }}>{detail.badge}</span>}
                  <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleWishlist(detail.id)}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/90 shadow-md flex items-center justify-center">
                    <Heart size={17} className={wishlist.has(detail.id) ? "fill-destructive text-destructive" : "text-muted-foreground"} />
                  </motion.button>
                </div>
                {/* Carousel dots */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allImages.map((_, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setActiveImageIdx(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${idx === activeImageIdx ? 'bg-primary w-4' : 'bg-background/60'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {/* Thumbnail strip */}
              {allImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {allImages.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImageIdx(idx)}
                      className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${idx === activeImageIdx ? 'border-primary' : 'border-transparent'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Video Embed */}
              {videoEmbed && (
                <div className="rounded-2xl overflow-hidden bg-black aspect-video">
                  {videoEmbed.type === 'youtube' && (
                    <iframe 
                      src={`https://www.youtube.com/embed/${videoEmbed.id}`}
                      title="Product video"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                  {videoEmbed.type === 'vimeo' && (
                    <iframe 
                      src={`https://player.vimeo.com/video/${videoEmbed.id}`}
                      title="Product video"
                      className="w-full h-full"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              )}

              <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
                {/* Vendor badge */}
                <div className="flex items-center gap-1.5 bg-primary/5 rounded-lg px-2.5 py-1.5 w-fit">
                  <Store size={11} className="text-primary" />
                  <span className="text-[11px] font-bold text-primary">Sold by {detail.vendor_name}</span>
                  <BadgeCheck size={11} className="text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">{detail.category}</p>
                  <p className="text-[18px] font-bold text-foreground leading-snug mt-0.5">{detail.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating value={detail.rating} size={14} />
                  <span className="text-[12px] font-semibold text-foreground">{detail.rating}</span>
                  <span className="text-[12px] text-muted-foreground">({detail.review_count} reviews)</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-[26px] font-extrabold text-foreground">৳{detail.price.toLocaleString()}</p>
                  {detail.original_price && (
                    <>
                      <p className="text-[14px] text-muted-foreground line-through mb-1">৳{Number(detail.original_price).toLocaleString()}</p>
                      <span className="mb-1 text-[11px] font-bold text-destructive-foreground px-2 py-0.5 rounded-full bg-destructive">{Math.round((1 - detail.price / Number(detail.original_price)) * 100)}% OFF</span>
                    </>
                  )}
                </div>
                {detail.stock > 0 ? (
                  <p className="text-[11px] text-muted-foreground">{detail.stock} in stock</p>
                ) : (
                  <p className="text-[11px] text-destructive font-bold">Out of stock</p>
                )}
              </div>

              {detail.stock > 0 && (
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { addToCart(detail); setScreen("cart"); }}
                    className="flex-1 h-14 rounded-2xl font-bold text-[14px] border-2 border-primary flex items-center justify-center gap-2 text-primary bg-background">
                    <ShoppingCart size={17} /> {t("addToCart")}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => buyNow(detail)}
                    className="flex-1 h-14 rounded-2xl text-primary-foreground font-bold text-[14px] shadow-lg flex items-center justify-center gap-2"
                    style={{ background: SHOP_GRADIENT }}>
                    {t("buyNow")}
                  </motion.button>
                </div>
              )}

              {detail.description && (
                <div className="bg-card rounded-2xl border border-border/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{t("shopDescription")}</p>
                  <p className="text-[13px] text-foreground leading-relaxed">{detail.description}</p>
                </div>
              )}

              {/* Reviews */}
              <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-foreground">{t("customerReviews")}</p>
                  {purchasedProductIds.has(detail.id) && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowWriteReview(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-primary-foreground text-[11px] font-bold"
                      style={{ background: SHOP_GRADIENT }}>
                      <MessageSquarePlus size={12} /> {t("writeReview")}
                    </motion.button>
                  )}
                </div>
                <div className="space-y-3">
                  {reviews.filter(r => r.productId === detail.id).slice(0, 3).map((r, i) => (
                    <div key={i} className="bg-muted/40 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{r.avatar}</span>
                          <div>
                            <p className="text-[12px] font-bold text-foreground leading-none">{r.author}</p>
                            <p className="text-[10px] text-muted-foreground">{r.date}</p>
                          </div>
                        </div>
                        <StarRating value={r.rating} size={11} />
                      </div>
                      <p className="text-[12px] text-muted-foreground leading-snug">{r.text}</p>
                    </div>
                  ))}
                  {reviews.filter(r => r.productId === detail.id).length === 0 && (
                    <p className="text-[12px] text-muted-foreground text-center py-3">{t("noReviewsYet")}</p>
                  )}
                </div>
              </div>

              {/* Related Products */}
              {relatedProducts.length > 0 && (
                <div className="space-y-3 pb-2">
                  <p className="text-[14px] font-bold text-foreground">{t("relatedProducts")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {relatedProducts.map(p => {
                      const inCart = cart.find(c => c.id === p.id);
                      return (
                        <motion.div key={p.id} whileTap={{ scale: 0.97 }}
                          className="bg-card border border-border/50 rounded-2xl overflow-hidden cursor-pointer"
                          onClick={() => setDetail(p)}>
                          <div className="h-20 flex items-center justify-center bg-muted/30 overflow-hidden">
                            <ProductImage imageUrl={p.image_url} emoji={p.emoji} alt={p.name} emojiSize="text-3xl" />
                          </div>
                          <div className="p-2.5 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <BadgeCheck size={8} className="text-primary" />
                              <span className="text-[8px] font-semibold text-primary truncate">{p.vendor_name}</span>
                            </div>
                            <p className="text-[11.5px] font-bold text-foreground leading-tight line-clamp-1">{p.name}</p>
                            <div className="flex items-center justify-between">
                              <p className="text-[12px] font-bold text-primary">৳{p.price.toLocaleString()}</p>
                              <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); addToCart(p); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-primary-foreground"
                                style={{ background: inCart ? "hsl(122 39% 49%)" : "hsl(var(--primary))" }}>
                                {inCart ? <CheckCircle2 size={11} /> : <Plus size={11} />}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          );
          })()}

          {/* ──── WISHLIST ──── */}
          {screen === "wishlist" && (
            <motion.div key="wishlist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-3">
              {wishlistProducts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground space-y-3">
                  <p className="text-5xl">💝</p>
                  <p className="font-semibold text-foreground">{t("yourWishlistEmpty")}</p>
                  <p className="text-[13px]">{t("tapHeartToSave")}</p>
                  <button onClick={() => setScreen("browse")} className="text-sm font-semibold text-primary-foreground px-5 py-2.5 rounded-2xl" style={{ background: SHOP_GRADIENT }}>
                    {t("browseProducts")}
                  </button>
                </div>
              ) : (
                wishlistProducts.map(p => {
                  const inCart = cart.find(c => c.id === p.id);
                  return (
                    <div key={p.id} className="bg-card border border-border/50 rounded-2xl p-3 flex items-center gap-3 cursor-pointer"
                      onClick={() => { setDetail(p); setScreen("detail"); }}>
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-muted/30 overflow-hidden"><ProductImage imageUrl={p.image_url} emoji={p.emoji} alt={p.name} emojiSize="text-3xl" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><BadgeCheck size={9} className="text-primary" /> {p.vendor_name}</p>
                        <p className="text-[13px] font-bold mt-0.5 text-primary">৳{p.price.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); addToCart(p); }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-primary-foreground" style={{ background: inCart ? "hsl(122 39% 49%)" : "hsl(var(--primary))" }}>
                          {inCart ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); toggleWishlist(p.id); }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-destructive/10">
                          <Heart size={14} className="fill-destructive text-destructive" />
                        </motion.button>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ──── CART ──── */}
          {screen === "cart" && (
            <motion.div key="cart" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground space-y-3">
                  <p className="text-5xl">🛒</p>
                  <p className="font-semibold text-foreground">{t("yourCartEmpty")}</p>
                  <button onClick={() => setScreen("browse")} className="text-sm font-semibold text-primary-foreground px-5 py-2.5 rounded-2xl" style={{ background: SHOP_GRADIENT }}>{t("continueShopping")}</button>
                </div>
              ) : (
                <>
                  {cart.map(item => (
                    <div key={item.id} className="bg-card rounded-2xl border border-border/50 p-3.5 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-muted/30 overflow-hidden"><ProductImage imageUrl={item.image_url} emoji={item.emoji} alt={item.name} emojiSize="text-3xl" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-foreground leading-tight truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><BadgeCheck size={8} className="text-primary" /> {item.vendor_name}</p>
                        <p className="text-[13px] font-bold mt-0.5 text-primary">৳{(item.price * item.qty).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground"><Minus size={12} /></motion.button>
                        <span className="text-[13px] font-bold w-4 text-center text-foreground">{item.qty}</span>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, +1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground"><Plus size={12} /></motion.button>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center ml-1"><Trash2 size={12} className="text-destructive" /></motion.button>
                      </div>
                    </div>
                  ))}

                  {/* Promo */}
                  <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("promoCode")}</p>
                    {appliedPromo ? (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50 border border-accent">
                        <Gift size={16} className="text-primary shrink-0" />
                        <div className="flex-1">
                          <p className="text-[13px] font-bold text-foreground">{appliedPromo.code}</p>
                          <p className="text-[11px] text-muted-foreground">{appliedPromo.discount}% off · saving ৳{discountAmt.toLocaleString()}</p>
                        </div>
                        <button onClick={removePromo} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"><X size={12} className="text-muted-foreground" /></button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Ticket size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && applyPromo()}
                            placeholder={t("enterPromoCode")} className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted border border-border text-[13px] text-foreground font-mono outline-none focus:border-primary transition-colors uppercase" />
                        </div>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={applyPromo} className="px-4 py-2.5 rounded-xl text-primary-foreground text-[13px] font-bold shrink-0" style={{ background: SHOP_GRADIENT }}>{t("apply")}</motion.button>
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-2">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{t("orderSummary")}</p>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">{t("subtotal")} ({cartCount} {t("items")})</span>
                      <span className="font-semibold text-foreground">৳{cartSubtotal.toLocaleString()}</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex justify-between text-[13px]">
                        <span className="text-primary">{t("discount")} ({appliedPromo.discount}%)</span>
                        <span className="font-semibold text-primary">-৳{discountAmt.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">{t("delivery")}</span>
                      <span className="font-semibold text-primary">{t("freeCaps")}</span>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between text-[15px] font-bold">
                      <span className="text-foreground">{t("total")}</span>
                      <span className="text-primary">৳{cartTotal.toLocaleString()}</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">{t("walletBalanceLabel")}: ৳{walletBalance.toLocaleString()}</p>
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("checkout")}
                    className="w-full h-14 rounded-2xl text-primary-foreground font-bold text-[15px] shadow-lg" style={{ background: SHOP_GRADIENT }}>
                    {t("proceedToCheckout")}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {/* ──── CHECKOUT ──── */}
          {screen === "checkout" && (
            <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-4">
              {/* Address */}
              <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("deliveryAddress")}</p>
                  <button onClick={() => setShowAddressPicker(p => !p)} className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                    {t("change")} <ChevronRight size={12} />
                  </button>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
                  <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground">{selectedAddress.label}</p>
                    <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{selectedAddress.name} · {selectedAddress.phone}</p>
                    <p className="text-[12px] text-muted-foreground leading-snug">{selectedAddress.line1}, {selectedAddress.line2}, {selectedAddress.city}</p>
                  </div>
                  <button onClick={() => setEditingAddress(selectedAddress)} className="shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                    <Pencil size={12} className="text-muted-foreground" />
                  </button>
                </div>
                <AnimatePresence>
                  {showAddressPicker && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2">
                      {addresses.map(a => (
                        <button key={a.id} onClick={() => { setSelectedAddressId(a.id); setShowAddressPicker(false); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${a.id === selectedAddressId ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40"}`}>
                          <MapPin size={14} className="text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-bold text-foreground">{a.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{a.line1}, {a.city}</p>
                          </div>
                          {a.id === selectedAddressId && <CheckCircle2 size={15} className="text-primary" />}
                        </button>
                      ))}
                      <button onClick={() => { setEditingAddress("new"); setShowAddressPicker(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border text-muted-foreground bg-muted/20">
                        <Plus size={14} /><span className="text-[12.5px] font-semibold">{t("addNewAddress")}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Payment */}
              <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("paymentMethod")}</p>
                <button onClick={() => setPayMethod("wallet")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors text-left ${payMethod === "wallet" ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wallet size={16} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-foreground">EasyPay Wallet</p>
                    <p className="text-[11px] text-muted-foreground">Balance: ৳{walletBalance.toLocaleString()}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === "wallet" ? "border-primary" : "border-border"}`}>
                    {payMethod === "wallet" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
                {payMethod === "wallet" && cartTotal > walletBalance && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20">
                    <AlertCircle size={13} className="text-destructive shrink-0" />
                    <p className="text-[11px] text-destructive font-semibold">{t("insufficientBalanceNeed")} ৳{(cartTotal - walletBalance).toLocaleString()} {t("shopMore")}</p>
                  </div>
                )}
                <button onClick={() => setPayMethod("card")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors text-left ${payMethod === "card" ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                  <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <CreditCard size={16} className="text-accent-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-foreground">{savedCard.brand} •••• {savedCard.last4}</p>
                    <p className="text-[11px] text-muted-foreground">{t("savedCard")}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === "card" ? "border-primary" : "border-border"}`}>
                    {payMethod === "card" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
              </div>

              {/* Items */}
              <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("items")} ({cartCount})</p>
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.image_url ? <img src={item.image_url} alt={item.name} className="w-6 h-6 rounded object-cover" /> : item.emoji}</span>
                      <div>
                        <p className="text-[12px] font-semibold text-foreground leading-tight">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{t("qty")}: {item.qty} · {item.vendor_name}</p>
                      </div>
                    </div>
                    <p className="text-[13px] font-bold text-foreground">৳{(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex justify-between font-bold text-[14px]">
                  <span className="text-foreground">{t("total")}</span>
                  <span className="text-primary">৳{cartTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* PIN */}
              <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Confirm PIN</p>
                <p className="text-[12px] text-muted-foreground">Enter your 4-digit PIN to authorize this purchase</p>
                <div className="flex justify-center gap-5 py-2">
                  {[0,1,2,3].map(i => (
                    <motion.div key={i} animate={{ scale: checkoutPin.length > i ? 1.2 : 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${checkoutPin.length > i ? "border-transparent bg-primary shadow-md" : "border-muted-foreground/30 bg-transparent"}`} />
                  ))}
                </div>
                {checkoutPinError && <p className="text-xs text-destructive flex items-center justify-center gap-1"><AlertCircle size={12} /> {checkoutPinError}</p>}
                <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={checkoutPin}
                  onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > checkoutPin.length) haptics.light(); setCheckoutPin(v); setCheckoutPinError(""); }}
                  className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none transition-colors placeholder:text-muted-foreground/30" placeholder="••••" />
              </div>

              <SlideToConfirm
                onConfirm={handleCheckout}
                label={`Place Order · ৳${cartTotal.toLocaleString()}`}
                gradient="bg-gradient-to-r from-primary to-primary/80"
                disabled={checkoutPin.length < 4 || (payMethod === "wallet" && cartTotal > walletBalance) || checkoutProcessing}
                pinComplete={checkoutPin.length === 4}
                icon={ShoppingCart}
              />
            </motion.div>
          )}

          {/* ──── SUCCESS ──── */}
          {screen === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }} className="px-4 pt-16 flex flex-col items-center text-center space-y-5">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
                className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg bg-primary/10 ring-2 ring-primary/20">
                🎉
              </motion.div>
              <div>
                <h2 className="text-[22px] font-extrabold text-foreground">{t("orderPlaced")}</h2>
                <p className="text-muted-foreground text-sm mt-1">{t("orderConfirmed")}</p>
                <p className="text-[12px] font-mono font-semibold mt-2 text-muted-foreground">{orderNum}</p>
              </div>
              <div className="w-full bg-card rounded-2xl border border-border/50 p-4 space-y-2 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("deliveryInfo")}</p>
                <div className="flex items-center gap-2 text-[13px]"><span>📦</span><span className="font-semibold text-foreground">{t("estimated35Days")}</span></div>
                <div className="flex items-center gap-2 text-[13px]">
                  {lastPayMethod === "wallet"
                    ? <><Wallet size={14} className="text-primary" /><span className="font-semibold text-foreground">৳{lastOrderTotal.toLocaleString()} {t("deductedFromWallet")}</span></>
                    : <><CreditCard size={14} className="text-accent-foreground" /><span className="font-semibold text-foreground">৳{lastOrderTotal.toLocaleString()} {t("chargedTo")} {savedCard.brand} ••••{savedCard.last4}</span></>}
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <MapPin size={14} className="text-muted-foreground" />
                  <span className="text-muted-foreground text-[12px]">{selectedAddress.line1}, {selectedAddress.city}</span>
                </div>
              </div>
              <div className="w-full flex gap-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("orders")}
                  className="flex-1 h-14 rounded-2xl font-bold text-[14px] border-2 border-primary flex items-center justify-center gap-2 bg-background text-primary">
                  <Package size={17} /> {t("myOrders")}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("browse")}
                  className="flex-1 h-14 rounded-2xl text-primary-foreground font-bold text-[14px] shadow-lg" style={{ background: SHOP_GRADIENT }}>
                  {t("continueShopping")}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ──── ORDERS ──── */}
          {screen === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground space-y-3">
                  <p className="text-5xl">📦</p>
                  <p className="font-semibold text-foreground">{t("noOrdersYet")}</p>
                  <button onClick={() => setScreen("browse")} className="text-sm font-semibold text-primary-foreground px-5 py-2.5 rounded-2xl" style={{ background: SHOP_GRADIENT }}>{t("startShopping")}</button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                      const count = orders.filter(o => o.status === key).length;
                      if (count === 0) return null;
                      return (
                        <div key={key} className="shrink-0 flex items-center gap-1.5 bg-card border border-border/50 rounded-xl px-3 py-2">
                          <cfg.icon size={12} style={{ color: cfg.color }} />
                          <span className="text-[11px] font-semibold text-foreground">{cfg.label}</span>
                          <span className="text-[11px] font-bold ml-0.5" style={{ color: cfg.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  {orders.map(order => <OrderCard key={order.id} order={order} onCancel={cancelOrder} />)}
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Bottom Checkout Bar ── */}
      <AnimatePresence>
        {screen === "cart" && cart.length > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-10">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("checkout")}
              className="w-full h-14 rounded-2xl text-primary-foreground font-bold text-[15px] shadow-lg flex items-center justify-center gap-2"
              style={{ background: SHOP_GRADIENT }}>
              {t("checkout")} · ৳{cartTotal.toLocaleString()} <ChevronRight size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <AnimatePresence>
        {editingAddress !== null && (
          <AddressEditor
            address={editingAddress === "new" ? null : editingAddress}
            onSave={(a) => {
              setAddresses(prev => { const exists = prev.find(p => p.id === a.id); if (exists) return prev.map(p => p.id === a.id ? a : p); return [...prev, a]; });
              setSelectedAddressId(a.id); setEditingAddress(null); setShowAddressPicker(false); toast.success(t("addressSaved"));
            }}
            onCancel={() => setEditingAddress(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showWriteReview && detail && (
          <WriteReviewSheet productId={detail.id} productName={detail.name}
            onSubmit={(r) => { setReviews(prev => [r, ...prev]); setShowWriteReview(false); toast.success(`${t("reviewSubmitted")} 🌟`); }}
            onCancel={() => setShowWriteReview(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ShopFlowGuarded = (props: ShopFlowProps) => (
  <FeatureGuard featureKey="payment" onClose={props.onClose}>
    <ShopFlow {...props} />
  </FeatureGuard>
);

export default ShopFlowGuarded;
