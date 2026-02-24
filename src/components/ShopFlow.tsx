import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, Search, Star, Plus, Minus, Trash2,
  CheckCircle2, Tag, X, MapPin, CreditCard, Wallet, Pencil, Package,
  ChevronRight, Truck, Clock, CircleCheck, ChevronDown, ChevronUp,
  Heart, Gift, Ticket, MessageSquarePlus, Send, Zap, AlertCircle,
  RefreshCw, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { getBalance, recordTransaction, addBalance, onBalanceChange, transferMoney } from "@/lib/balanceStore";
import { useI18n } from "@/lib/i18n";
import { fireSuccessConfetti } from "@/lib/confetti";
import { supabase } from "@/integrations/supabase/client";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import FeatureGuard from "@/components/FeatureGuard";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  emoji: string;
  category: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
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

// ── Sample Reviews ─────────────────────────────────────────────────────────────
const SAMPLE_REVIEWS: Review[] = [
  { productId: "p1", author: "Rafi H.",     avatar: "👨", rating: 5, date: "Jan 28, 2026", text: "Absolutely love the noise cancellation. Best earbuds I've owned!" },
  { productId: "p1", author: "Mitu A.",     avatar: "👩", rating: 4, date: "Jan 20, 2026", text: "Great sound quality, comfortable fit. Battery life is impressive." },
  { productId: "p1", author: "Siam K.",     avatar: "🧑", rating: 5, date: "Dec 30, 2025", text: "Crystal clear call quality. The case charges super fast too." },
  { productId: "p2", author: "Lamia R.",    avatar: "👩", rating: 4, date: "Feb 5, 2026",  text: "Gorgeous display, accurate health tracking. A bit pricey but worth it." },
  { productId: "p2", author: "Tanvir M.",   avatar: "👨", rating: 5, date: "Feb 1, 2026",  text: "Battery lasts nearly 2 weeks on a charge. GPS is spot-on!" },
  { productId: "p3", author: "Nadia S.",    avatar: "👩", rating: 5, date: "Jan 15, 2026", text: "The surround sound is insane for gaming. Mic is crystal clear too." },
  { productId: "p3", author: "Arif B.",     avatar: "👨", rating: 4, date: "Jan 8, 2026",  text: "Super comfortable for long sessions. Earcups are very plush." },
  { productId: "p4", author: "Shira N.",    avatar: "🧑", rating: 5, date: "Feb 10, 2026", text: "Charges my laptop TWICE! Compact and powerful." },
  { productId: "p5", author: "Kabir D.",    avatar: "👨", rating: 4, date: "Jan 22, 2026", text: "Bass is deep and clear. Waterproof tested in rain — works perfectly." },
  { productId: "p6", author: "Tania P.",    avatar: "👩", rating: 5, date: "Feb 3, 2026",  text: "Plug and play, all ports work perfectly. 4K HDMI is flawless." },
  { productId: "p7", author: "Reza C.",     avatar: "🧑", rating: 5, date: "Jan 31, 2026", text: "Typing feel is incredible. Hot-swap switches are a game-changer!" },
  { productId: "p8", author: "Dina W.",     avatar: "👩", rating: 4, date: "Feb 7, 2026",  text: "4K image is sharp in good lighting. Auto-correction works great." },
  { productId: "p9", author: "Fahim L.",    avatar: "👨", rating: 4, date: "Jan 18, 2026", text: "Warm light is perfect for late night work. USB port is handy." },
  { productId: "p10", author: "Suma V.",    avatar: "👩", rating: 5, date: "Feb 12, 2026", text: "Non-slip even on hardwood floors. The carrying strap is a bonus." },
  { productId: "p11", author: "Jalal E.",   avatar: "👨", rating: 5, date: "Jan 25, 2026", text: "Grinder is quiet and the thermal carafe keeps coffee hot for hours!" },
  { productId: "p12", author: "Aysha T.",   avatar: "👩", rating: 4, date: "Feb 14, 2026", text: "Very lightweight yet durable. My marathon times improved!" },
];

// ── Products ──────────────────────────────────────────────────────────────────
const PRODUCTS: Product[] = [
  { id: "p1",  name: "Wireless Earbuds Pro", brand: "SoundX",   price: 3499,  originalPrice: 4999,  rating: 4.7, reviews: 1240, emoji: "🎧", category: "Electronics", badge: "30% OFF",  badgeColor: "#E91E8C", description: "Premium sound quality with active noise cancellation. Up to 30h battery life with charging case. IPX5 water resistant." },
  { id: "p2",  name: "Smart Watch Ultra",    brand: "TimePro",  price: 8999,  originalPrice: 11999, rating: 4.5, reviews: 876,  emoji: "⌚", category: "Electronics", badge: "HOT",      badgeColor: "#FF5722", description: "Health tracking, GPS, AMOLED display. 14-day battery life, blood oxygen & ECG monitoring." },
  { id: "p3",  name: "Gaming Headset",       brand: "GameZone", price: 5499,  originalPrice: 6999,  rating: 4.6, reviews: 432,  emoji: "🎮", category: "Gaming",      badge: "NEW",      badgeColor: "#9C27B0", description: "7.1 virtual surround sound, memory foam earcups, detachable noise-cancelling mic. Compatible with PC, PS5, Xbox." },
  { id: "p4",  name: "Portable Charger",     brand: "PowerUp",  price: 1299,  originalPrice: 1799,  rating: 4.8, reviews: 2156, emoji: "🔋", category: "Accessories", badge: "BESTSELL", badgeColor: "#43A047", description: "20,000 mAh, 65W fast charging, charges 3 devices simultaneously. Can charge a laptop twice." },
  { id: "p5",  name: "Bluetooth Speaker",    brand: "BoomBox",  price: 2999,  originalPrice: 3999,  rating: 4.4, reviews: 654,  emoji: "🔊", category: "Electronics", description: "360° rich bass sound, 24h playtime, IPX7 waterproof. Pairs 2 speakers for stereo mode." },
  { id: "p6",  name: "USB-C Hub 7-in-1",    brand: "ConnectX", price: 1899,  originalPrice: 2499,  rating: 4.6, reviews: 987,  emoji: "🔌", category: "Accessories", description: "HDMI 4K, 3×USB-A, SD/MicroSD, 100W PD pass-through. Plug & play, no drivers needed." },
  { id: "p7",  name: "Mechanical Keyboard",  brand: "TypeX",    price: 4599,  originalPrice: 5999,  rating: 4.8, reviews: 1543, emoji: "⌨️", category: "Computing",   badge: "TOP PICK", badgeColor: "#00BCD4", description: "Hot-swappable switches, per-key RGB, aluminum frame. Available in Red, Brown, Blue switches." },
  { id: "p8",  name: "4K Webcam",            brand: "VisionX",  price: 3299,  originalPrice: 4299,  rating: 4.5, reviews: 738,  emoji: "📷", category: "Computing", description: "4K 30fps, built-in dual mic with noise reduction, auto light correction, privacy cover." },
  { id: "p9",  name: "LED Desk Lamp",        brand: "LightUp",  price: 899,   originalPrice: 1299,  rating: 4.3, reviews: 521,  emoji: "💡", category: "Home", description: "5 color temps, 10 brightness levels, USB charging port, touch control, auto-off timer." },
  { id: "p10", name: "Yoga Mat Premium",     brand: "FitLife",  price: 1499,  originalPrice: 2199,  rating: 4.7, reviews: 893,  emoji: "🧘", category: "Sports", description: "6mm thick non-slip surface, eco-friendly TPE material, carrying strap included." },
  { id: "p11", name: "Coffee Maker Pro",     brand: "BrewMate", price: 6999,  originalPrice: 8999,  rating: 4.6, reviews: 432,  emoji: "☕", category: "Home",        badge: "SALE",     badgeColor: "#FF9800", description: "12-cup capacity, programmable timer, built-in grinder, thermal carafe keeps coffee hot 4h." },
  { id: "p12", name: "Running Shoes X9",     brand: "SpeedFit", price: 4299,  originalPrice: 5999,  rating: 4.5, reviews: 1205, emoji: "👟", category: "Sports", description: "Breathable knit upper, carbon-fiber plate, responsive foam sole. Sizes 38–46." },
];

const CATEGORIES = ["All", "Electronics", "Gaming", "Accessories", "Computing", "Home", "Sports"];

// ── Flash Deals ────────────────────────────────────────────────────────────────
const FLASH_DEALS = [
  { productId: "p1", endsInMs: 2 * 3600 * 1000 + 14 * 60 * 1000 },
  { productId: "p4", endsInMs: 1 * 3600 * 1000 + 45 * 60 * 1000 },
  { productId: "p9", endsInMs: 0 * 3600 * 1000 + 38 * 60 * 1000 },
];

const DEFAULT_ADDRESSES: Address[] = [
  { id: "a1", label: "Home",   name: "Karim Hossain", line1: "House 12, Road 5, Block D", line2: "Mirpur-10",  city: "Dhaka-1216", phone: "01712-345678" },
  { id: "a2", label: "Office", name: "Karim Hossain", line1: "Level 4, Tower A, Bashundhara City", line2: "Panthapath", city: "Dhaka-1215", phone: "01712-345678" },
];

const PROMO_CODES: Record<string, number> = {
  "SAVE10": 10, "WELCOME20": 20, "FLASH15": 15, "MFS5": 5,
};

const TIMELINE_STEP_KEYS: { step: Order["status"]; labelKey: string }[] = [
  { step: "processing",       labelKey: "orderPlacedTimeline" },
  { step: "confirmed",        labelKey: "confirmed2" },
  { step: "shipped",          labelKey: "shipped" },
  { step: "out_for_delivery", labelKey: "outForDelivery" },
  { step: "delivered",        labelKey: "delivered" },
];

const makeTimeline = (currentStatus: Order["status"], baseDate: string): TimelineEvent[] => {
  const stepOrder = TIMELINE_STEP_KEYS.map(s => s.step);
  const currentIdx = stepOrder.indexOf(currentStatus);
  return TIMELINE_STEP_KEYS.map((s, i) => ({
    step: s.step,
    label: s.labelKey,
    done: i <= currentIdx,
    timestamp: i <= currentIdx ? (i === 0 ? baseDate : `${baseDate} +${i}d`) : null,
  }));
};

const SAMPLE_ORDERS: Order[] = [
  {
    id: "o1", orderNum: "ORD-A1B2C3", date: "Feb 15, 2026",
    items: [{ ...PRODUCTS[0], qty: 1 }, { ...PRODUCTS[3], qty: 2 }],
    total: PRODUCTS[0].price + PRODUCTS[3].price * 2,
    address: DEFAULT_ADDRESSES[0], paymentMethod: "wallet", status: "shipped",
    estimatedDelivery: "Feb 20, 2026", timeline: makeTimeline("shipped", "Feb 15"),
  },
  {
    id: "o2", orderNum: "ORD-D4E5F6", date: "Feb 10, 2026",
    items: [{ ...PRODUCTS[6], qty: 1 }],
    total: PRODUCTS[6].price,
    address: DEFAULT_ADDRESSES[0], paymentMethod: "card", status: "delivered",
    estimatedDelivery: "Feb 14, 2026", timeline: makeTimeline("delivered", "Feb 10"),
  },
];

type Screen = "browse" | "detail" | "cart" | "checkout" | "success" | "orders" | "wishlist";
type PaymentMethod = "wallet" | "card";

const SHOP_GRADIENT = "linear-gradient(135deg,#FF7043,#BF360C)";

// ── Countdown Timer Hook ───────────────────────────────────────────────────────
const useCountdown = (ms: number) => {
  const [remaining, setRemaining] = useState(ms);
  useEffect(() => {
    const iv = setInterval(() => setRemaining(r => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(iv);
  }, []);
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${h > 0 ? `${h}h ` : ""}${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
};

// ── Flash Deal Card ────────────────────────────────────────────────────────────
const FlashDealCard = ({ deal, product, onAdd, inCart, onClick }: {
  deal: typeof FLASH_DEALS[0]; product: Product;
  onAdd: () => void; inCart: boolean; onClick: () => void;
}) => {
  const { t } = useI18n();
  const countdown = useCountdown(deal.endsInMs);
  const discount = product.originalPrice ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="shrink-0 w-40 bg-card border border-border/60 rounded-3xl overflow-hidden shadow-card cursor-pointer"
    >
      <div className="h-24 flex flex-col items-center justify-center relative" style={{ background: "rgba(255,112,67,0.08)" }}>
        <span className="text-4xl">{product.emoji}</span>
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          <Zap size={8} className="fill-white" /> {discount}% OFF
        </div>
      </div>
      <div className="p-2.5 space-y-1">
        <p className="text-[11px] font-bold text-foreground leading-tight line-clamp-2">{product.name}</p>
        <p className="text-[12px] font-extrabold" style={{ color: "#FF7043" }}>৳{product.price.toLocaleString()}</p>
        <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/30 rounded-lg px-1.5 py-0.5">
          <Clock size={9} className="text-orange-500 shrink-0" />
          <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 tabular-nums">{countdown}</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={e => { e.stopPropagation(); onAdd(); }}
          className="w-full h-7 rounded-xl text-white text-[11px] font-bold flex items-center justify-center gap-1"
          style={{ background: inCart ? "#43A047" : SHOP_GRADIENT }}
        >
          {inCart ? <CheckCircle2 size={11} /> : <Plus size={11} />}
          {inCart ? t("added") : t("add")}
        </motion.button>
      </div>
    </motion.div>
  );
};

// ── Star Rating ────────────────────────────────────────────────────────────────
const StarRating = ({ value, size = 13, onRate }: { value: number; size?: number; onRate?: (n: number) => void }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <Star
        key={s} size={size}
        className={`${s <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"} ${onRate ? "cursor-pointer" : ""}`}
        onClick={() => onRate?.(s)}
      />
    ))}
  </div>
);

// ── Rating Bar Chart ───────────────────────────────────────────────────────────
const RatingBars = ({ productId, allReviews, overallRating, totalReviews }: {
  productId: string; allReviews: Review[]; overallRating: number; totalReviews: number;
}) => {
  const productReviews = allReviews.filter(r => r.productId === productId);
  const total = Math.max(productReviews.length, 1);
  const counts = [5,4,3,2,1].map(star => ({
    star,
    count: productReviews.filter(r => Math.round(r.rating) === star).length,
  }));
  return (
    <div className="flex gap-4 items-center">
      {/* Big average */}
      <div className="flex flex-col items-center shrink-0">
        <p className="text-[36px] font-extrabold text-foreground leading-none">{overallRating}</p>
        <StarRating value={overallRating} size={12} />
        <p className="text-[10px] text-muted-foreground mt-1">{totalReviews.toLocaleString()} reviews</p>
      </div>
      {/* Bars */}
      <div className="flex-1 space-y-1">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground w-3 shrink-0">{star}</span>
            <Star size={8} className="fill-amber-400 text-amber-400 shrink-0" />
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / total) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: (5 - star) * 0.05 }}
                className="h-full rounded-full bg-amber-400"
              />
            </div>
            <span className="text-[9px] text-muted-foreground w-3 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Write Review Sheet ─────────────────────────────────────────────────────────
interface WriteReviewProps { productId: string; productName: string; onSubmit: (r: Review) => void; onCancel: () => void; }
const WriteReviewSheet = ({ productId, productName, onSubmit, onCancel }: WriteReviewProps) => {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
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
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder={t("shareExperience")}
          rows={3}
          className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-[13px] outline-none focus:border-orange-400 resize-none text-foreground"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 h-12 rounded-2xl border border-border text-[14px] font-semibold text-muted-foreground bg-background">{t("cancel")}</button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (rating === 0) { toast.error(t("pleaseSelectRating")); return; }
              if (!text.trim()) { toast.error(t("pleaseWriteSomething")); return; }
              onSubmit({ productId, author: "You", avatar: "🙋", rating, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), text });
            }}
            className="flex-1 h-12 rounded-2xl text-white font-bold text-[14px] flex items-center justify-center gap-2"
            style={{ background: SHOP_GRADIENT }}
          >
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
  const [form, setForm] = useState<Address>(
    address ?? { id: `a${Date.now()}`, label: "Home", name: "", line1: "", line2: "", city: "", phone: "" }
  );
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
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${form.label === l ? "text-white border-transparent" : "bg-muted text-muted-foreground border-border"}`}
              style={form.label === l ? { background: SHOP_GRADIENT } : {}}>
              {l}
            </button>
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
            <input
              type="text" value={form[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
              className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-[13px] text-foreground outline-none focus:border-orange-400 transition-colors"
            />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="flex-1 h-12 rounded-2xl border border-border text-[14px] font-semibold text-muted-foreground bg-background">{t("cancel")}</button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { if (!form.name || !form.line1 || !form.city) { toast.error(t("fillAllRequired")); return; } onSave(form); }}
            className="flex-1 h-12 rounded-2xl text-white font-bold text-[14px]"
            style={{ background: SHOP_GRADIENT }}>
            {t("saveAddress")}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Order Status Config ────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Order["status"], { label: string; color: string; icon: React.ElementType }> = {
  processing:       { label: "Processing",       color: "#FF9800", icon: Clock },
  confirmed:        { label: "Confirmed",         color: "#9C27B0", icon: CheckCircle2 },
  shipped:          { label: "Shipped",           color: "#2196F3", icon: Truck },
  out_for_delivery: { label: "Out for Delivery",  color: "#FF5722", icon: Package },
  delivered:        { label: "Delivered",         color: "#43A047", icon: CircleCheck },
  cancelled:        { label: "Cancelled",         color: "#9E9E9E", icon: X },
};

// ── Order Timeline ─────────────────────────────────────────────────────────────
const OrderTimeline = ({ timeline }: { timeline: TimelineEvent[] }) => {
  const { t } = useI18n();
  const doneCount = timeline.filter(t => t.done).length;
  const progress = ((doneCount - 1) / (timeline.length - 1)) * 100;
  return (
    <div className="space-y-3 pt-1">
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: SHOP_GRADIENT }}
          initial={{ width: 0 }} animate={{ width: `${Math.max(0, progress)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
      </div>
      <div className="space-y-0">
        {timeline.map((event, i) => {
          const cfg = STATUS_CONFIG[event.step];
          const Icon = cfg.icon;
          const isLast = i === timeline.length - 1;
          return (
            <div key={event.step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.07 }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${event.done ? "text-white" : "bg-muted text-muted-foreground"}`}
                  style={event.done ? { background: cfg.color } : {}}>
                  <Icon size={13} />
                </motion.div>
                {!isLast && <div className={`w-0.5 flex-1 min-h-[20px] my-0.5 rounded-full ${event.done ? "bg-orange-300" : "bg-border"}`} />}
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
    <div className="bg-card rounded-3xl border border-border/60 overflow-hidden shadow-card">
      <button className="w-full p-4 flex items-center gap-3 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}18` }}>
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground font-mono">{order.orderNum}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{order.date} · {order.items.length} item{order.items.length > 1 ? "s" : ""} · ৳{order.total.toLocaleString()}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.color }}>{cfg.label}</span>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              {/* Items */}
              <div className="space-y-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate text-foreground">{item.name}</p>
                      <p className="text-[10.5px] text-muted-foreground">{t("qty")}: {item.qty}</p>
                    </div>
                    <p className="text-[12px] font-bold text-foreground">৳{(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Shipping & Payment */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-snug">{order.address.line1}, {order.address.line2}, {order.address.city}</p>
                </div>
                <div className="flex items-center gap-2">
                  {order.paymentMethod === "wallet" ? <Wallet size={12} className="text-muted-foreground" /> : <CreditCard size={12} className="text-muted-foreground" />}
                  <p className="text-[11px] text-muted-foreground">{order.paymentMethod === "wallet" ? t("paidViaWallet") : t("paidViaCard")}</p>
                </div>
                {order.status !== "cancelled" && (
                  <div className="flex items-center gap-2">
                    <Truck size={12} className="text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">{t("estDelivery")}: {order.estimatedDelivery}</p>
                  </div>
                )}
              </div>

              {/* Track Shipment */}
              {order.status !== "cancelled" && (
                <>
                  <button onClick={() => setShowTimeline(s => !s)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-border/60 bg-muted/50 text-[12px] font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <Truck size={13} style={{ color: "#FF7043" }} />{t("trackShipment")}
                    </div>
                    {showTimeline ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                  </button>
                  <AnimatePresence>
                    {showTimeline && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden bg-muted/30 rounded-2xl p-3">
                        <OrderTimeline timeline={order.timeline} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Cancel Order */}
              {canCancel && onCancel && !confirmCancel && (
                <button onClick={() => setConfirmCancel(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-red-200 dark:border-red-800 text-red-500 text-[12px] font-semibold bg-red-50 dark:bg-red-950/30">
                  <AlertCircle size={13} /> {t("cancelOrder")}
                </button>
              )}
              {canCancel && onCancel && confirmCancel && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-3 space-y-2">
                  <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 text-center">{t("cancelThisOrder")}</p>
                  <p className="text-[11px] text-muted-foreground text-center">
                    {order.paymentMethod === "wallet" ? `${t("refundOf")} ৳${order.total.toLocaleString()} ${t("refundToWallet")}` : t("refundToCard")}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmCancel(false)} className="flex-1 h-9 rounded-xl border border-border text-[12px] font-semibold text-muted-foreground bg-background">{t("keepOrder")}</button>
                    <button onClick={() => { onCancel(order.id); setConfirmCancel(false); setExpanded(false); }}
                      className="flex-1 h-9 rounded-xl bg-red-500 text-white text-[12px] font-bold">{t("yesCancel")}</button>
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

// ── Main ShopFlow ─────────────────────────────────────────────────────────────
interface ShopFlowProps { onClose: () => void; }

const ShopFlow = ({ onClose }: ShopFlowProps) => {
  const { t } = useI18n();
  const [screen, setScreen]           = useState<Screen>("browse");
  const [category, setCategory]       = useState("All");
  const [search, setSearch]           = useState("");
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [detail, setDetail]           = useState<Product | null>(null);
  const [orderNum, setOrderNum]       = useState("");
  const [lastOrderTotal, setLastOrderTotal] = useState(0);
  const [lastPayMethod, setLastPayMethod] = useState<PaymentMethod>("wallet");
  const bodyRef = useRef<HTMLDivElement>(null);

  // Reactive wallet balance
  const [walletBalance, setWalletBalance] = useState(getBalance);
  useEffect(() => {
    const unsub = onBalanceChange(setWalletBalance);
    return () => { unsub(); };
  }, []);

  // Wishlist — persisted in localStorage
  const [wishlist, setWishlist] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("shop_wishlist") || "[]")); }
    catch { return new Set(); }
  });

  // Address state
  const [addresses, setAddresses]         = useState<Address[]>(DEFAULT_ADDRESSES);
  const [selectedAddressId, setSelectedAddressId] = useState("a1");
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null | "new">(null);

  // Payment method
  const [payMethod, setPayMethod]     = useState<PaymentMethod>("wallet");
  const [savedCard]                   = useState({ last4: "4242", brand: "Visa" });

  // Promo code
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoInput, setPromoInput]   = useState("");

  // Orders
  const [orders, setOrders]           = useState<Order[]>(SAMPLE_ORDERS);

  // Real-time order status updates from admin
  useOrderNotifications((update) => {
    setOrders(prev => prev.map(o => {
      if (o.orderNum === update.order_num || o.id === update.id) {
        const newStatus = update.status as Order["status"];
        return { ...o, status: newStatus, timeline: makeTimeline(newStatus, o.date) };
      }
      return o;
    }));
  });

  // Fetch user's orders from database on mount
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
            ...PRODUCTS.find(p => p.id === item.id) ?? { id: item.id, name: item.name, brand: item.brand ?? "", rating: 0, reviews: 0, emoji: item.emoji ?? "📦", category: "" },
            price: item.price,
            qty: item.qty,
          })),
          total: Number(o.total),
          address: {
            id: "db", label: "Shipping",
            name: o.shipping_name ?? "",
            line1: o.shipping_address?.split(",")[0] ?? "",
            line2: o.shipping_address?.split(",").slice(1).join(",").trim() ?? "",
            city: o.shipping_city ?? "",
            phone: o.shipping_phone ?? "",
          },
          paymentMethod: (o.payment_method ?? "wallet") as PaymentMethod,
          status: o.status as Order["status"],
          estimatedDelivery: o.estimated_delivery ?? "",
          timeline: makeTimeline(o.status as Order["status"], new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
        }));
        setOrders(prev => {
          // Merge: DB orders take priority, keep sample orders that aren't in DB
          const dbIds = new Set(dbOrders.map(o => o.orderNum));
          const kept = prev.filter(o => !dbIds.has(o.orderNum));
          return [...dbOrders, ...kept];
        });
      }
    };
    fetchDbOrders();
  }, []);

  // Reviews
  const [reviews, setReviews]         = useState<Review[]>(SAMPLE_REVIEWS);
  const [showWriteReview, setShowWriteReview] = useState(false);

  // Persist wishlist
  useEffect(() => {
    localStorage.setItem("shop_wishlist", JSON.stringify([...wishlist]));
  }, [wishlist]);

  // Scroll body to top on screen change
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [screen, detail]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => PRODUCTS.filter(p =>
    (category === "All" || p.category === category) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()))
  ), [category, search]);

  const cartCount    = cart.reduce((s, i) => s + i.qty, 0);
  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountAmt  = appliedPromo ? Math.round(cartSubtotal * appliedPromo.discount / 100) : 0;
  const cartTotal    = cartSubtotal - discountAmt;
  const selectedAddress = addresses.find(a => a.id === selectedAddressId) ?? addresses[0];
  const purchasedProductIds = useMemo(() => new Set(orders.flatMap(o => o.items.map(i => i.id))), [orders]);
  const wishlistProducts = PRODUCTS.filter(p => wishlist.has(p.id));
  const relatedProducts = useMemo(() =>
    detail ? PRODUCTS.filter(p => p.category === detail.category && p.id !== detail.id).slice(0, 4) : [], [detail]);
  const flashDealsWithProduct = FLASH_DEALS.map(d => ({ deal: d, product: PRODUCTS.find(p => p.id === d.productId)! })).filter(x => x.product);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id);
      if (ex) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...p, qty: 1 }];
    });
    toast.success(`${p.emoji} ${t("addedToCart")}`);
  };

  const changeQty = (id: string, delta: number) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const buyNow = (p: Product) => {
    setCart([{ ...p, qty: 1 }]);
    setAppliedPromo(null);
    setPromoInput("");
    setScreen("checkout");
  };

  // ── Wishlist helpers ─────────────────────────────────────────────────────────
  const toggleWishlist = (id: string) => {
    setWishlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast(t("removedFromWishlist")); }
      else { next.add(id); toast.success(`❤️ ${t("addedToWishlist")}`); }
      return next;
    });
  };

  // ── Promo code ──────────────────────────────────────────────────────────────
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

  // ── Order cancellation ──────────────────────────────────────────────────────
  const cancelOrder = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "cancelled" as const, timeline: [] } : o));
    if (order.paymentMethod === "wallet") {
      await recordTransaction({
        type: "addmoney",
        amount: order.total,
        fee: 0,
        description: `Refund for cancelled order ${order.orderNum}`,
        reference: `REF-${order.orderNum}`,
      });
      toast.success(`Order cancelled · ৳${order.total.toLocaleString()} refunded to wallet`);
    } else {
      toast.success("Order cancelled · Refund will be processed to your card");
    }
  };

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (payMethod === "wallet") {
      if (cartTotal > walletBalance) { toast.error("Insufficient wallet balance"); return; }
      try {
        await transferMoney({
          recipientPhone: "SHOP-EASYPAY",
          amount: cartTotal,
          fee: 0,
          type: "payment",
          recipientName: "EasyPay Shop",
          description: `Shop order: ${cart.map(i => i.name).join(", ")}`,
          reference: `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        });
      } catch (e: any) {
        toast.error(e.message ?? "Payment failed");
        return;
      }
    }
    const num = `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const estDelivery = new Date(Date.now() + 5 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const newOrder: Order = {
      id: `o${Date.now()}`, orderNum: num, date: dateStr, items: [...cart], total: cartTotal,
      address: selectedAddress, paymentMethod: payMethod, status: "processing",
      estimatedDelivery: estDelivery,
      timeline: makeTimeline("processing", dateStr),
    };
    setOrders(prev => [newOrder, ...prev]);

    // Persist to database
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("orders").insert({
        user_id: session.user.id,
        order_num: num,
        status: "processing",
        total: cartTotal,
        payment_method: payMethod,
        shipping_name: selectedAddress.name,
        shipping_address: `${selectedAddress.line1}, ${selectedAddress.line2}`,
        shipping_city: selectedAddress.city,
        shipping_phone: selectedAddress.phone,
        items: cart.map(c => ({ id: c.id, name: c.name, brand: c.brand, price: c.price, qty: c.qty, emoji: c.emoji })),
        estimated_delivery: estDelivery,
      } as any);
    }

    setOrderNum(num);
    setLastOrderTotal(cartTotal);
    setLastPayMethod(payMethod);
    fireSuccessConfetti();
    setCart([]);
    setAppliedPromo(null);
    setPromoInput("");
    setScreen("success");
  };

  // ── Back navigation ────────────────────────────────────────────────────────
  const goBack = () => {
    if (screen === "detail")   { setDetail(null); setScreen("browse"); return; }
    if (screen === "cart")     { setScreen("browse"); return; }
    if (screen === "checkout") { setScreen("cart"); return; }
    if (screen === "success")  { setScreen("browse"); return; }
    if (screen === "orders")   { setScreen("browse"); return; }
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
        className="text-white px-4 pt-3 pb-3 shrink-0"
        style={{ background: SHOP_GRADIENT }}
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-3">
          <motion.div
            className="h-full rounded-full bg-white/60"
            animate={{ width: { browse: "20%", detail: "40%", cart: "55%", checkout: "75%", success: "100%", orders: "20%", wishlist: "20%" }[screen] }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.88 }} onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target shrink-0">
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>

          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold leading-tight truncate">{headerTitle[screen]}</p>
            <p className="text-[11px] opacity-60">
              {screen === "browse"   && `${filtered.length} ${t("products")}`}
              {screen === "cart"     && `৳${cartTotal.toLocaleString()} ${t("total")}`}
              {screen === "checkout" && t("confirmYourOrder")}
              {screen === "success"  && orderNum}
              {screen === "orders"   && `${orders.length} ${t("orders")}`}
              {screen === "wishlist" && `${wishlist.size} ${t("savedItems")}`}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {(screen === "browse" || screen === "detail") && (
              <>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setScreen("wishlist")}
                  className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target">
                  <Heart size={17} />
                  {wishlist.size > 0 && (
                    <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-yellow-400 text-[9px] font-bold text-gray-900 flex items-center justify-center">{wishlist.size}</span>
                  )}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setScreen("orders")}
                  className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target">
                  <Package size={17} />
                  {orders.filter(o => o.status !== "cancelled" && o.status !== "delivered").length > 0 && (
                    <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-yellow-400 text-[9px] font-bold text-gray-900 flex items-center justify-center">
                      {orders.filter(o => o.status !== "cancelled" && o.status !== "delivered").length}
                    </span>
                  )}
                </motion.button>
                <motion.button whileTap={{ scale: 0.88 }} onClick={() => setScreen("cart")}
                  className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target">
                  <ShoppingCart size={17} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-yellow-400 text-[9px] font-bold text-gray-900 flex items-center justify-center">{cartCount}</span>
                  )}
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-card border border-border text-sm text-foreground outline-none focus:border-orange-400 transition-colors" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={14} /></button>
                )}
              </div>

              {/* Flash Deals Section */}
              {!search && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={15} className="fill-orange-500 text-orange-500" />
                      <p className="text-[14px] font-bold text-foreground">{t("flashDeals")}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                      <TrendingUp size={11} /> {t("limitedTimeOnly")}
                    </div>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                    {flashDealsWithProduct.map(({ deal, product }) => (
                      <FlashDealCard
                        key={deal.productId} deal={deal} product={product}
                        inCart={!!cart.find(c => c.id === product.id)}
                        onAdd={() => addToCart(product)}
                        onClick={() => { setDetail(product); setScreen("detail"); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setCategory(cat)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold transition-all ${category === cat ? "text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    style={category === cat ? { background: SHOP_GRADIENT } : {}}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((p, i) => {
                  const inCart = cart.find(c => c.id === p.id);
                  const isWished = wishlist.has(p.id);
                  const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-card cursor-pointer"
                      onClick={() => { setDetail(p); setScreen("detail"); }}>
                      <div className="relative h-28 flex items-center justify-center" style={{ background: "rgba(255,112,67,0.07)" }}>
                        <span className="text-5xl">{p.emoji}</span>
                        {p.badge && <span className="absolute top-2 left-2 text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: p.badgeColor }}>{p.badge}</span>}
                        {discount > 0 && !p.badge && <span className="absolute top-2 left-2 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full bg-red-500">-{discount}%</span>}
                        <motion.button whileTap={{ scale: 0.8 }}
                          onClick={e => { e.stopPropagation(); toggleWishlist(p.id); }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center shadow-sm">
                          <Heart size={12} className={isWished ? "fill-red-500 text-red-500" : "text-muted-foreground"} />
                        </motion.button>
                      </div>
                      <div className="p-3 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-medium">{p.brand}</p>
                        <p className="text-[12.5px] font-bold text-foreground leading-tight line-clamp-2">{p.name}</p>
                        <div className="flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-semibold text-foreground">{p.rating}</span>
                          <span className="text-[10px] text-muted-foreground">({p.reviews})</span>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <p className="text-[13px] font-bold text-foreground">৳{p.price.toLocaleString()}</p>
                            {p.originalPrice && <p className="text-[10px] text-muted-foreground line-through">৳{p.originalPrice.toLocaleString()}</p>}
                          </div>
                          <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); addToCart(p); }}
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-white transition-colors"
                            style={{ background: inCart ? "#43A047" : SHOP_GRADIENT }}>
                            {inCart ? <CheckCircle2 size={13} /> : <Plus size={13} />}
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="font-semibold text-foreground">{t("noProductsFound")}</p>
                  <p className="text-sm mt-1">{t("tryDifferentSearch")}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ──── DETAIL ──── */}
          {screen === "detail" && detail && (
            <motion.div key={`detail-${detail.id}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-4">
              {/* Hero */}
              <div className="relative rounded-3xl h-52 flex items-center justify-center" style={{ background: "rgba(255,112,67,0.07)" }}>
                <span className="text-8xl">{detail.emoji}</span>
                {detail.badge && (
                  <span className="absolute top-3 left-3 text-[10px] font-bold text-white px-2.5 py-1 rounded-full" style={{ background: detail.badgeColor }}>{detail.badge}</span>
                )}
                <motion.button whileTap={{ scale: 0.8 }}
                  onClick={() => toggleWishlist(detail.id)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/90 shadow-md flex items-center justify-center">
                  <Heart size={17} className={wishlist.has(detail.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"} />
                </motion.button>
              </div>

              {/* Info */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                <div>
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">{detail.brand} · {detail.category}</p>
                  <p className="text-[18px] font-bold text-foreground leading-snug mt-0.5">{detail.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StarRating value={detail.rating} size={14} />
                  <span className="text-[12px] font-semibold text-foreground">{detail.rating}</span>
                  <span className="text-[12px] text-muted-foreground">({detail.reviews} reviews)</span>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-[26px] font-extrabold text-foreground">৳{detail.price.toLocaleString()}</p>
                  {detail.originalPrice && (
                    <>
                      <p className="text-[14px] text-muted-foreground line-through mb-1">৳{detail.originalPrice.toLocaleString()}</p>
                      <span className="mb-1 text-[11px] font-bold text-white px-2 py-0.5 rounded-full bg-red-500">{Math.round((1 - detail.price / detail.originalPrice) * 100)}% OFF</span>
                    </>
                  )}
                </div>
                {detail.badge && (
                  <div className="flex items-center gap-2 p-2.5 rounded-2xl" style={{ background: `${detail.badgeColor}18` }}>
                    <Tag size={12} style={{ color: detail.badgeColor }} />
                    <span className="text-[11.5px] font-semibold" style={{ color: detail.badgeColor }}>{detail.badge} — {t("limitedTimeOffer")}</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { addToCart(detail); setScreen("cart"); }}
                  className="flex-1 h-14 rounded-2xl font-bold text-[14px] border-2 flex items-center justify-center gap-2 transition-colors bg-background"
                  style={{ borderColor: "#FF7043", color: "#FF7043" }}>
                  <ShoppingCart size={17} /> {t("addToCart")}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => buyNow(detail)}
                  className="flex-1 h-14 rounded-2xl text-white font-bold text-[14px] shadow-lg flex items-center justify-center gap-2"
                  style={{ background: SHOP_GRADIENT }}>
                  {t("buyNow")}
                </motion.button>
              </div>

              {/* Description */}
              {detail.description && (
                <div className="bg-card rounded-3xl border border-border/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{t("shopDescription")}</p>
                  <p className="text-[13px] text-foreground leading-relaxed">{detail.description}</p>
                </div>
              )}

              {/* Reviews Section */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-foreground">{t("customerReviews")}</p>
                  {purchasedProductIds.has(detail.id) && (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowWriteReview(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-white text-[11px] font-bold"
                      style={{ background: SHOP_GRADIENT }}>
                      <MessageSquarePlus size={12} /> {t("writeReview")}
                    </motion.button>
                  )}
                </div>

                {/* Rating bar chart */}
                <RatingBars
                  productId={detail.id} allReviews={reviews}
                  overallRating={detail.rating} totalReviews={detail.reviews}
                />

                <div className="h-px bg-border" />

                <div className="space-y-3">
                  {reviews.filter(r => r.productId === detail.id).slice(0, 3).map((r, i) => (
                    <div key={i} className="bg-muted/40 rounded-2xl p-3 space-y-1.5">
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
                  {!purchasedProductIds.has(detail.id) && (
                    <p className="text-[11px] text-muted-foreground text-center py-1 flex items-center justify-center gap-1">
                      <CheckCircle2 size={11} /> {t("purchaseToReview")}
                    </p>
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
                          className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-card cursor-pointer"
                          onClick={() => setDetail(p)}>
                          <div className="h-20 flex items-center justify-center" style={{ background: "rgba(255,112,67,0.07)" }}>
                            <span className="text-3xl">{p.emoji}</span>
                          </div>
                          <div className="p-2.5 space-y-0.5">
                            <p className="text-[11.5px] font-bold text-foreground leading-tight line-clamp-1">{p.name}</p>
                            <div className="flex items-center justify-between">
                              <p className="text-[12px] font-bold" style={{ color: "#FF7043" }}>৳{p.price.toLocaleString()}</p>
                              <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); addToCart(p); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                                style={{ background: inCart ? "#43A047" : SHOP_GRADIENT }}>
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
          )}

          {/* ──── WISHLIST ──── */}
          {screen === "wishlist" && (
            <motion.div key="wishlist" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-3">
              {wishlistProducts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground space-y-3">
                  <p className="text-5xl">💝</p>
                  <p className="font-semibold text-foreground">{t("yourWishlistEmpty")}</p>
                  <p className="text-[13px]">{t("tapHeartToSave")}</p>
                  <button onClick={() => setScreen("browse")} className="text-sm font-semibold text-white px-5 py-2.5 rounded-2xl" style={{ background: SHOP_GRADIENT }}>
                    {t("browseProducts")}
                  </button>
                </div>
              ) : (
                wishlistProducts.map(p => {
                  const inCart = cart.find(c => c.id === p.id);
                  return (
                    <div key={p.id} className="bg-card border border-border/60 rounded-2xl p-3 flex items-center gap-3 shadow-card cursor-pointer"
                      onClick={() => { setDetail(p); setScreen("detail"); }}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl" style={{ background: "rgba(255,112,67,0.08)" }}>
                        {p.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.brand}</p>
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: "#FF7043" }}>৳{p.price.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); addToCart(p); }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: inCart ? "#43A047" : SHOP_GRADIENT }}>
                          {inCart ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); toggleWishlist(p.id); }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-950/30">
                          <Heart size={14} className="fill-red-500 text-red-500" />
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
                  <button onClick={() => setScreen("browse")} className="text-sm font-semibold text-white px-5 py-2.5 rounded-2xl" style={{ background: SHOP_GRADIENT }}>
                    {t("continueShopping")}
                  </button>
                </div>
              ) : (
                <>
                  {cart.map(item => (
                    <div key={item.id} className="bg-card rounded-3xl border border-border/60 p-3.5 flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-3xl" style={{ background: "rgba(255,112,67,0.08)" }}>
                        {item.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-bold text-foreground leading-tight truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">{item.brand}</p>
                        <p className="text-[13px] font-bold mt-0.5" style={{ color: "#FF7043" }}>৳{(item.price * item.qty).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, -1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground"><Minus size={12} /></motion.button>
                        <span className="text-[13px] font-bold w-4 text-center text-foreground">{item.qty}</span>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, +1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground"><Plus size={12} /></motion.button>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center ml-1"><Trash2 size={12} className="text-red-500" /></motion.button>
                      </div>
                    </div>
                  ))}

                  {/* Promo in cart */}
                  <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("promoCode")}</p>
                    {appliedPromo ? (
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <Gift size={16} className="text-green-600 shrink-0" />
                        <div className="flex-1">
                          <p className="text-[13px] font-bold text-green-700 dark:text-green-400">{appliedPromo.code}</p>
                          <p className="text-[11px] text-green-600 dark:text-green-500">{appliedPromo.discount}% off · saving ৳{discountAmt.toLocaleString()}</p>
                        </div>
                        <button onClick={removePromo} className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <X size={12} className="text-green-700 dark:text-green-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <Ticket size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())}
                            onKeyDown={e => e.key === "Enter" && applyPromo()}
                            placeholder={t("enterPromoCode")}
                            className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-muted border border-border text-[13px] text-foreground font-mono outline-none focus:border-orange-400 transition-colors uppercase" />
                        </div>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={applyPromo}
                          className="px-4 py-2.5 rounded-2xl text-white text-[13px] font-bold shrink-0" style={{ background: SHOP_GRADIENT }}>{t("apply")}</motion.button>
                      </div>
                    )}
                    <p className="text-[10.5px] text-muted-foreground">Try: SAVE10, WELCOME20, FLASH15</p>
                  </div>

                  {/* Order summary */}
                  <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{t("orderSummary")}</p>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">{t("subtotal")} ({cartCount} {t("items")})</span>
                      <span className="font-semibold text-foreground">৳{cartSubtotal.toLocaleString()}</span>
                    </div>
                    {appliedPromo && (
                      <div className="flex justify-between text-[13px]">
                        <span className="text-green-600">{t("discount")} ({appliedPromo.discount}%)</span>
                        <span className="font-semibold text-green-600">-৳{discountAmt.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">{t("delivery")}</span>
                      <span className="font-semibold text-green-600">{t("freeCaps")}</span>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between text-[15px] font-bold">
                      <span className="text-foreground">{t("total")}</span>
                      <span style={{ color: "#FF7043" }}>৳{cartTotal.toLocaleString()}</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">{t("walletBalanceLabel")}: ৳{walletBalance.toLocaleString()}</p>
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("checkout")}
                    className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg" style={{ background: SHOP_GRADIENT }}>
                    {t("proceedToCheckout")}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {/* ──── CHECKOUT ──── */}
          {screen === "checkout" && (
            <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }} className="px-4 pt-4 space-y-4">
              {/* Delivery address */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("deliveryAddress")}</p>
                  <button onClick={() => setShowAddressPicker(p => !p)} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#FF7043" }}>
                    {t("change")} <ChevronRight size={12} />
                  </button>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-2xl border" style={{ background: "rgba(255,112,67,0.06)", borderColor: "rgba(255,112,67,0.25)" }}>
                  <MapPin size={16} style={{ color: "#FF7043" }} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-foreground">{selectedAddress.label}</p>
                      <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: "#FF7043" }}>{selectedAddress.label.toUpperCase()}</span>
                    </div>
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
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${a.id === selectedAddressId ? "border-orange-300" : "border-border bg-muted/40"}`}
                          style={a.id === selectedAddressId ? { background: "rgba(255,112,67,0.06)" } : {}}>
                          <MapPin size={14} className="text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-bold text-foreground">{a.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{a.line1}, {a.city}</p>
                          </div>
                          {a.id === selectedAddressId && <CheckCircle2 size={15} style={{ color: "#FF7043" }} />}
                        </button>
                      ))}
                      <button onClick={() => { setEditingAddress("new"); setShowAddressPicker(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-border text-muted-foreground bg-muted/20">
                        <Plus size={14} /><span className="text-[12.5px] font-semibold">{t("addNewAddress")}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Promo Code */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("promoCode")}</p>
                {appliedPromo ? (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                    <Gift size={16} className="text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-green-700 dark:text-green-400">{appliedPromo.code}</p>
                      <p className="text-[11px] text-green-600 dark:text-green-500">{appliedPromo.discount}% off applied · saving ৳{discountAmt.toLocaleString()}</p>
                    </div>
                    <button onClick={removePromo} className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <X size={12} className="text-green-700 dark:text-green-400" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Ticket size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input type="text" value={promoInput} onChange={e => setPromoInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === "Enter" && applyPromo()}
                        placeholder={t("enterPromoCode")}
                        className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-muted border border-border text-[13px] text-foreground font-mono outline-none focus:border-orange-400 transition-colors uppercase" />
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={applyPromo}
                      className="px-4 py-2.5 rounded-2xl text-white text-[13px] font-bold shrink-0" style={{ background: SHOP_GRADIENT }}>{t("apply")}</motion.button>
                  </div>
                )}
                <p className="text-[10.5px] text-muted-foreground">Try: SAVE10, WELCOME20, FLASH15</p>
              </div>

              {/* Payment method */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("paymentMethod")}</p>
                <button onClick={() => setPayMethod("wallet")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-colors text-left ${payMethod === "wallet" ? "border-orange-300" : "border-border"}`}
                  style={payMethod === "wallet" ? { background: "rgba(255,112,67,0.06)" } : {}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,112,67,0.12)" }}>
                    <Wallet size={16} style={{ color: "#FF7043" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-foreground">{t("mfsWallet")}</p>
                    <p className="text-[11px] text-muted-foreground">{t("balance")}: ৳{walletBalance.toLocaleString()}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === "wallet" ? "border-orange-500" : "border-border"}`}>
                    {payMethod === "wallet" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF7043" }} />}
                  </div>
                </button>
                {payMethod === "wallet" && cartTotal > walletBalance && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <AlertCircle size={13} className="text-red-500 shrink-0" />
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{t("insufficientBalanceNeed")} ৳{(cartTotal - walletBalance).toLocaleString()} {t("shopMore")}</p>
                  </div>
                )}
                <button onClick={() => setPayMethod("card")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-colors text-left ${payMethod === "card" ? "border-orange-300" : "border-border"}`}
                  style={payMethod === "card" ? { background: "rgba(255,112,67,0.06)" } : {}}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(33,150,243,0.12)" }}>
                    <CreditCard size={16} style={{ color: "#2196F3" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold text-foreground">{savedCard.brand} •••• {savedCard.last4}</p>
                    <p className="text-[11px] text-muted-foreground">{t("savedCard")}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === "card" ? "border-orange-500" : "border-border"}`}>
                    {payMethod === "card" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF7043" }} />}
                  </div>
                </button>
              </div>

              {/* Items summary */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("items")} ({cartCount})</p>
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.emoji}</span>
                      <div>
                        <p className="text-[12px] font-semibold text-foreground leading-tight">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{t("qty")}: {item.qty}</p>
                      </div>
                    </div>
                    <p className="text-[13px] font-bold text-foreground">৳{(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{t("subtotal")}</span>
                  <span className="font-semibold text-foreground">৳{cartSubtotal.toLocaleString()}</span>
                </div>
                {appliedPromo && (
                  <div className="flex justify-between text-[13px]">
                    <span className="text-green-600 flex items-center gap-1"><Gift size={11} /> {appliedPromo.code} ({appliedPromo.discount}%)</span>
                    <span className="font-semibold text-green-600">-৳{discountAmt.toLocaleString()}</span>
                  </div>
                )}
                <div className="h-px bg-border" />
                <div className="flex justify-between font-bold text-[14px]">
                  <span className="text-foreground">{t("total")}</span>
                  <span style={{ color: "#FF7043" }}>৳{cartTotal.toLocaleString()}</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCheckout}
                disabled={payMethod === "wallet" && cartTotal > walletBalance}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: SHOP_GRADIENT }}>
                {t("placeOrder")} · ৳{cartTotal.toLocaleString()}
              </motion.button>
            </motion.div>
          )}

          {/* ──── SUCCESS ──── */}
          {screen === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }} className="px-4 pt-16 flex flex-col items-center text-center space-y-5">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
                className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg"
                style={{ background: "rgba(255,112,67,0.12)", outline: "2px solid rgba(255,112,67,0.3)" }}>
                🎉
              </motion.div>
              <div>
                <h2 className="text-[22px] font-extrabold text-foreground">{t("orderPlaced")}</h2>
                <p className="text-muted-foreground text-sm mt-1">{t("orderConfirmed")}</p>
                <p className="text-[12px] font-mono font-semibold mt-2 text-muted-foreground">{orderNum}</p>
              </div>
              <div className="w-full bg-card rounded-3xl border border-border/60 p-4 space-y-2 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("deliveryInfo")}</p>
                <div className="flex items-center gap-2 text-[13px]">
                  <span>📦</span><span className="font-semibold text-foreground">{t("estimated35Days")}</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  {lastPayMethod === "wallet"
                    ? <><Wallet size={14} style={{ color: "#FF7043" }} /><span className="font-semibold text-foreground">৳{lastOrderTotal.toLocaleString()} {t("deductedFromWallet")}</span></>
                    : <><CreditCard size={14} style={{ color: "#2196F3" }} /><span className="font-semibold text-foreground">৳{lastOrderTotal.toLocaleString()} {t("chargedTo")} {savedCard.brand} ••••{savedCard.last4}</span></>
                  }
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <MapPin size={14} className="text-muted-foreground" />
                  <span className="text-muted-foreground text-[12px]">{selectedAddress.line1}, {selectedAddress.city}</span>
                </div>
              </div>
              <div className="w-full flex gap-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("orders")}
                  className="flex-1 h-14 rounded-2xl font-bold text-[14px] border-2 flex items-center justify-center gap-2 bg-background"
                  style={{ borderColor: "#FF7043", color: "#FF7043" }}>
                  <Package size={17} /> {t("myOrders")}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("browse")}
                  className="flex-1 h-14 rounded-2xl text-white font-bold text-[14px] shadow-lg" style={{ background: SHOP_GRADIENT }}>
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
                  <button onClick={() => setScreen("browse")} className="text-sm font-semibold text-white px-5 py-2.5 rounded-2xl" style={{ background: SHOP_GRADIENT }}>{t("startShopping")}</button>
                </div>
              ) : (
                <>
                  {/* Status legend */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                      const count = orders.filter(o => o.status === key).length;
                      if (count === 0) return null;
                      return (
                        <div key={key} className="shrink-0 flex items-center gap-1.5 bg-card border border-border/60 rounded-2xl px-3 py-2">
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
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border z-10">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setScreen("checkout")}
              className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg flex items-center justify-center gap-2"
              style={{ background: SHOP_GRADIENT }}>
              {t("checkout")} · ৳{cartTotal.toLocaleString()}
              <ChevronRight size={18} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Address Editor Overlay ── */}
      <AnimatePresence>
        {editingAddress !== null && (
          <AddressEditor
            address={editingAddress === "new" ? null : editingAddress}
            onSave={(a) => {
              setAddresses(prev => {
                const exists = prev.find(p => p.id === a.id);
                if (exists) return prev.map(p => p.id === a.id ? a : p);
                return [...prev, a];
              });
              setSelectedAddressId(a.id);
              setEditingAddress(null);
              setShowAddressPicker(false);
              toast.success(t("addressSaved"));
            }}
            onCancel={() => setEditingAddress(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Write Review Overlay ── */}
      <AnimatePresence>
        {showWriteReview && detail && (
          <WriteReviewSheet
            productId={detail.id} productName={detail.name}
            onSubmit={(r) => { setReviews(prev => [r, ...prev]); setShowWriteReview(false); toast.success(`${t("reviewSubmitted")} 🌟`); }}
            onCancel={() => setShowWriteReview(false)}
          />
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
