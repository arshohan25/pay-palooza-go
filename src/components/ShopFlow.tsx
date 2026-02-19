import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShoppingCart, Search, Star, Plus, Minus, Trash2,
  CheckCircle2, Tag, X, MapPin, CreditCard, Wallet, Pencil, Package,
  ChevronRight, Truck, Clock, CircleCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { getBalance, deductBalance } from "@/lib/balanceStore";
import { fireSuccessConfetti } from "@/lib/confetti";

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
  status: "processing" | "shipped" | "delivered";
  estimatedDelivery: string;
}

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

const DEFAULT_ADDRESSES: Address[] = [
  { id: "a1", label: "Home", name: "Karim Hossain", line1: "House 12, Road 5, Block D", line2: "Mirpur-10", city: "Dhaka-1216", phone: "01712-345678" },
  { id: "a2", label: "Office", name: "Karim Hossain", line1: "Level 4, Tower A, Bashundhara City", line2: "Panthapath", city: "Dhaka-1215", phone: "01712-345678" },
];

const SAMPLE_ORDERS: Order[] = [
  {
    id: "o1",
    orderNum: "ORD-A1B2C3",
    date: "Feb 15, 2026",
    items: [{ ...PRODUCTS[0], qty: 1 }, { ...PRODUCTS[3], qty: 2 }],
    total: PRODUCTS[0].price + PRODUCTS[3].price * 2,
    address: DEFAULT_ADDRESSES[0],
    paymentMethod: "wallet",
    status: "shipped",
    estimatedDelivery: "Feb 20, 2026",
  },
  {
    id: "o2",
    orderNum: "ORD-D4E5F6",
    date: "Feb 10, 2026",
    items: [{ ...PRODUCTS[6], qty: 1 }],
    total: PRODUCTS[6].price,
    address: DEFAULT_ADDRESSES[0],
    paymentMethod: "card",
    status: "delivered",
    estimatedDelivery: "Feb 14, 2026",
  },
];

type Screen = "browse" | "detail" | "cart" | "checkout" | "success" | "orders";
type PaymentMethod = "wallet" | "card";

const headerGradient = "linear-gradient(135deg,#FF7043,#BF360C)";

// ── Address Editor Sheet ───────────────────────────────────────────────────────
interface AddressEditorProps {
  address: Address | null;
  onSave: (a: Address) => void;
  onCancel: () => void;
}
const AddressEditor = ({ address, onSave, onCancel }: AddressEditorProps) => {
  const [form, setForm] = useState<Address>(
    address ?? { id: `a${Date.now()}`, label: "Home", name: "", line1: "", line2: "", city: "", phone: "" }
  );
  const set = (k: keyof Address, v: string) => setForm(f => ({ ...f, [k]: v }));

  const labels = ["Home", "Office", "Other"];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-background rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto pb-10">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-2" />
        <p className="text-[16px] font-bold text-foreground">{address ? "Edit Address" : "New Address"}</p>

        {/* Label picker */}
        <div className="flex gap-2">
          {labels.map(l => (
            <button
              key={l}
              onClick={() => set("label", l)}
              className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                form.label === l
                  ? "text-white border-transparent"
                  : "bg-muted text-muted-foreground border-border"
              }`}
              style={form.label === l ? { background: headerGradient } : {}}
            >
              {l}
            </button>
          ))}
        </div>

        {[
          { key: "name" as const, label: "Full Name", placeholder: "e.g. Karim Hossain" },
          { key: "phone" as const, label: "Phone", placeholder: "e.g. 01712-345678" },
          { key: "line1" as const, label: "Address Line 1", placeholder: "House/Flat, Road, Block" },
          { key: "line2" as const, label: "Area / Thana", placeholder: "e.g. Mirpur-10" },
          { key: "city" as const, label: "City / Postcode", placeholder: "e.g. Dhaka-1216" },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
            <input
              type="text"
              value={form[key]}
              onChange={e => set(key, e.target.value)}
              placeholder={placeholder}
              className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-[13px] outline-none focus:border-orange-400 transition-colors"
            />
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 h-12 rounded-2xl border border-border text-[14px] font-semibold text-muted-foreground"
          >
            Cancel
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (!form.name || !form.line1 || !form.city) {
                toast.error("Please fill all required fields");
                return;
              }
              onSave(form);
            }}
            className="flex-1 h-12 rounded-2xl text-white font-bold text-[14px]"
            style={{ background: headerGradient }}
          >
            Save Address
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Order Status Badge ────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  processing: { label: "Processing", color: "#FF9800", icon: Clock },
  shipped:    { label: "Shipped",    color: "#2196F3", icon: Truck },
  delivered:  { label: "Delivered", color: "#43A047", icon: CircleCheck },
};

interface OrderCardProps {
  order: Order;
}
const OrderCard = ({ order }: OrderCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;

  return (
    <div className="bg-card rounded-3xl border border-border/60 overflow-hidden shadow-card">
      <button
        className="w-full p-4 flex items-center gap-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${cfg.color}18` }}>
          <Icon size={18} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-foreground font-mono">{order.orderNum}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{order.date} · {order.items.length} item{order.items.length > 1 ? "s" : ""} · ৳{order.total.toLocaleString()}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: cfg.color }}>
            {cfg.label}
          </span>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              {/* Items */}
              <div className="space-y-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate">{item.name}</p>
                      <p className="text-[10.5px] text-muted-foreground">Qty: {item.qty}</p>
                    </div>
                    <p className="text-[12px] font-bold">৳{(item.price * item.qty).toLocaleString()}</p>
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
                  {order.paymentMethod === "wallet"
                    ? <Wallet size={12} className="text-muted-foreground" />
                    : <CreditCard size={12} className="text-muted-foreground" />}
                  <p className="text-[11px] text-muted-foreground">{order.paymentMethod === "wallet" ? "Paid via Wallet" : "Paid via Card"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Truck size={12} className="text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">Est. delivery: {order.estimatedDelivery}</p>
                </div>
              </div>
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
  const [screen, setScreen]           = useState<Screen>("browse");
  const [category, setCategory]       = useState("All");
  const [search, setSearch]           = useState("");
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [detail, setDetail]           = useState<Product | null>(null);
  const [orderNum, setOrderNum]       = useState("");
  const [lastOrderTotal, setLastOrderTotal] = useState(0);

  // Address state
  const [addresses, setAddresses]     = useState<Address[]>(DEFAULT_ADDRESSES);
  const [selectedAddressId, setSelectedAddressId] = useState("a1");
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null | "new">(null);

  // Payment method
  const [payMethod, setPayMethod]     = useState<PaymentMethod>("wallet");
  const [savedCard]                   = useState({ last4: "4242", brand: "Visa" });

  // Orders
  const [orders, setOrders]           = useState<Order[]>(SAMPLE_ORDERS);

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => PRODUCTS.filter(p =>
    (category === "All" || p.category === category) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()))
  ), [category, search]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const selectedAddress = addresses.find(a => a.id === selectedAddressId) ?? addresses[0];

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id);
      if (ex) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...p, qty: 1 }];
    });
    toast.success(`${p.emoji} Added to cart`);
  };

  const changeQty = (id: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.id === id ? { ...c, qty: c.qty + delta } : c)
      .filter(c => c.qty > 0)
    );
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  // Buy Now – goes directly to checkout with just this item
  const buyNow = (p: Product) => {
    setCart([{ ...p, qty: 1 }]);
    setScreen("checkout");
  };

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    if (payMethod === "wallet") {
      const bal = getBalance();
      if (cartTotal > bal) {
        toast.error("Insufficient wallet balance");
        return;
      }
      deductBalance(cartTotal);
    }
    const num = `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const newOrder: Order = {
      id: `o${Date.now()}`,
      orderNum: num,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      items: [...cart],
      total: cartTotal,
      address: selectedAddress,
      paymentMethod: payMethod,
      status: "processing",
      estimatedDelivery: new Date(Date.now() + 5 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    setOrders(prev => [newOrder, ...prev]);
    setOrderNum(num);
    setLastOrderTotal(cartTotal);
    fireSuccessConfetti();
    setCart([]);
    setScreen("success");
  };

  // ── Back navigation ────────────────────────────────────────────────────────
  const goBack = () => {
    if (screen === "detail")   { setDetail(null); setScreen("browse"); return; }
    if (screen === "cart")     { setScreen("browse"); return; }
    if (screen === "checkout") { setScreen("cart"); return; }
    if (screen === "success")  { setScreen("browse"); return; }
    if (screen === "orders")   { setScreen("browse"); return; }
    onClose();
  };

  const headerTitle = {
    browse:   "Shop",
    detail:   detail?.name ?? "Product",
    cart:     `Cart (${cartCount})`,
    checkout: "Checkout",
    success:  "Order Placed!",
    orders:   "My Orders",
  }[screen];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <motion.div
        className="text-primary-foreground px-4 pt-3 pb-3 shrink-0"
        style={{ background: headerGradient }}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-3">
          <motion.div
            className="h-full rounded-full bg-white/60"
            animate={{ width: { browse: "20%", detail: "40%", cart: "55%", checkout: "75%", success: "100%", orders: "20%" }[screen] }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={goBack}
            className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target shrink-0"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </motion.button>

          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold leading-tight truncate">{headerTitle}</p>
            <p className="text-[11px] opacity-60">
              {screen === "browse"   && `${filtered.length} products`}
              {screen === "cart"     && `৳${cartTotal.toLocaleString()} total`}
              {screen === "checkout" && "Confirm your order"}
              {screen === "success"  && orderNum}
              {screen === "orders"   && `${orders.length} orders`}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {/* Orders icon */}
            {(screen === "browse" || screen === "detail") && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setScreen("orders")}
                className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target"
              >
                <Package size={17} />
                {orders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-yellow-400 text-[9px] font-bold text-gray-900 flex items-center justify-center">
                    {orders.length}
                  </span>
                )}
              </motion.button>
            )}

            {/* Cart icon */}
            {(screen === "browse" || screen === "detail") && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setScreen("cart")}
                className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target"
              >
                <ShoppingCart size={17} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-yellow-400 text-[9px] font-bold text-gray-900 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto pb-32">
        <AnimatePresence mode="wait">

          {/* ──── BROWSE ──── */}
          {screen === "browse" && (
            <motion.div
              key="browse"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22 }}
              className="px-4 pt-4 space-y-4"
            >
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-card border border-border text-sm outline-none focus:border-orange-400 transition-colors"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold transition-all ${
                      category === cat
                        ? "text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                    style={category === cat ? { background: headerGradient } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((p, i) => {
                  const inCart = cart.find(c => c.id === p.id);
                  const discount = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-card border border-border/60 rounded-3xl overflow-hidden shadow-card cursor-pointer"
                      onClick={() => { setDetail(p); setScreen("detail"); }}
                    >
                      {/* Product image area */}
                      <div className="relative h-28 flex items-center justify-center" style={{ background: "rgba(255,112,67,0.07)" }}>
                        <span className="text-5xl">{p.emoji}</span>
                        {p.badge && (
                          <span
                            className="absolute top-2 left-2 text-[9px] font-bold text-white px-2 py-0.5 rounded-full"
                            style={{ background: p.badgeColor }}
                          >
                            {p.badge}
                          </span>
                        )}
                        {discount > 0 && !p.badge && (
                          <span className="absolute top-2 right-2 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full bg-red-500">
                            -{discount}%
                          </span>
                        )}
                      </div>

                      <div className="p-3 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-medium">{p.brand}</p>
                        <p className="text-[12.5px] font-bold text-foreground leading-tight line-clamp-2">{p.name}</p>

                        {/* Stars */}
                        <div className="flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-semibold text-foreground">{p.rating}</span>
                          <span className="text-[10px] text-muted-foreground">({p.reviews})</span>
                        </div>

                        {/* Price + Add */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            <p className="text-[13px] font-bold text-foreground">৳{p.price.toLocaleString()}</p>
                            {p.originalPrice && (
                              <p className="text-[10px] text-muted-foreground line-through">৳{p.originalPrice.toLocaleString()}</p>
                            )}
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={e => { e.stopPropagation(); addToCart(p); }}
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-white transition-colors"
                            style={{ background: inCart ? "#43A047" : headerGradient }}
                          >
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
                  <p className="font-semibold">No products found</p>
                  <p className="text-sm mt-1">Try a different search or category</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ──── DETAIL ──── */}
          {screen === "detail" && detail && (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.22 }}
              className="px-4 pt-4 space-y-4"
            >
              {/* Hero image */}
              <div className="rounded-3xl h-52 flex items-center justify-center" style={{ background: "rgba(255,112,67,0.07)" }}>
                <span className="text-8xl">{detail.emoji}</span>
              </div>

              {/* Info card */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                <div>
                  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">{detail.brand} · {detail.category}</p>
                  <p className="text-[18px] font-bold text-foreground leading-snug mt-0.5">{detail.name}</p>
                </div>

                <div className="flex items-center gap-2">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={14} className={s <= Math.round(detail.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"} />
                  ))}
                  <span className="text-[12px] font-semibold">{detail.rating}</span>
                  <span className="text-[12px] text-muted-foreground">({detail.reviews} reviews)</span>
                </div>

                <div className="flex items-end gap-2">
                  <p className="text-[26px] font-extrabold text-foreground">৳{detail.price.toLocaleString()}</p>
                  {detail.originalPrice && (
                    <>
                      <p className="text-[14px] text-muted-foreground line-through mb-1">৳{detail.originalPrice.toLocaleString()}</p>
                      <span className="mb-1 text-[11px] font-bold text-white px-2 py-0.5 rounded-full bg-red-500">
                        {Math.round((1 - detail.price / detail.originalPrice) * 100)}% OFF
                      </span>
                    </>
                  )}
                </div>

                {detail.badge && (
                  <div className="flex items-center gap-2 p-2.5 rounded-2xl" style={{ background: `${detail.badgeColor}18` }}>
                    <Tag size={12} style={{ color: detail.badgeColor }} />
                    <span className="text-[11.5px] font-semibold" style={{ color: detail.badgeColor }}>{detail.badge} — Limited time offer</span>
                  </div>
                )}

                {detail.description && (
                  <div className="pt-1 border-t border-border/40">
                    <p className="text-[11.5px] text-muted-foreground leading-relaxed">{detail.description}</p>
                  </div>
                )}
              </div>

              {/* Action buttons — Buy Now + Add to Cart */}
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { addToCart(detail); setScreen("cart"); }}
                  className="flex-1 h-14 rounded-2xl font-bold text-[14px] border-2 flex items-center justify-center gap-2 transition-colors"
                  style={{ borderColor: "#FF7043", color: "#FF7043" }}
                >
                  <ShoppingCart size={17} />
                  Add to Cart
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => buyNow(detail)}
                  className="flex-1 h-14 rounded-2xl text-white font-bold text-[14px] shadow-lg flex items-center justify-center gap-2"
                  style={{ background: headerGradient }}
                >
                  Buy Now
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ──── CART ──── */}
          {screen === "cart" && (
            <motion.div
              key="cart"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.22 }}
              className="px-4 pt-4 space-y-3"
            >
              {cart.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground space-y-3">
                  <p className="text-5xl">🛒</p>
                  <p className="font-semibold text-foreground">Your cart is empty</p>
                  <button
                    onClick={() => setScreen("browse")}
                    className="text-sm font-semibold text-white px-5 py-2.5 rounded-2xl"
                    style={{ background: headerGradient }}
                  >
                    Continue Shopping
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
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, -1)}
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                          <Minus size={12} />
                        </motion.button>
                        <span className="text-[13px] font-bold w-4 text-center">{item.qty}</span>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => changeQty(item.id, +1)}
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                          <Plus size={12} />
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.85 }} onClick={() => removeFromCart(item.id)}
                          className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center ml-1">
                          <Trash2 size={12} className="text-red-500" />
                        </motion.button>
                      </div>
                    </div>
                  ))}

                  {/* Order summary */}
                  <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Order Summary</p>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Subtotal ({cartCount} items)</span>
                      <span className="font-semibold">৳{cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="font-semibold text-green-600">FREE</span>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between text-[15px] font-bold">
                      <span>Total</span>
                      <span style={{ color: "#FF7043" }}>৳{cartTotal.toLocaleString()}</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">Wallet balance: ৳{getBalance().toLocaleString()}</p>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setScreen("checkout")}
                    className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg"
                    style={{ background: headerGradient }}
                  >
                    Proceed to Checkout
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {/* ──── CHECKOUT ──── */}
          {screen === "checkout" && (
            <motion.div
              key="checkout"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.22 }}
              className="px-4 pt-4 space-y-4"
            >
              {/* ── Delivery address ── */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Delivery Address</p>
                  <button
                    onClick={() => setShowAddressPicker(p => !p)}
                    className="flex items-center gap-1 text-[11px] font-semibold"
                    style={{ color: "#FF7043" }}
                  >
                    Change <ChevronRight size={12} />
                  </button>
                </div>

                {/* Selected address */}
                <div className="flex items-start gap-3 p-3 rounded-2xl border" style={{ background: "rgba(255,112,67,0.06)", borderColor: "rgba(255,112,67,0.25)" }}>
                  <MapPin size={16} style={{ color: "#FF7043" }} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold">{selectedAddress.label}</p>
                      <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: "#FF7043" }}>
                        {selectedAddress.label.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
                      {selectedAddress.name} · {selectedAddress.phone}
                    </p>
                    <p className="text-[12px] text-muted-foreground leading-snug">
                      {selectedAddress.line1}, {selectedAddress.line2}, {selectedAddress.city}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingAddress(selectedAddress)}
                    className="shrink-0 w-8 h-8 rounded-xl bg-muted flex items-center justify-center"
                  >
                    <Pencil size={12} className="text-muted-foreground" />
                  </button>
                </div>

                {/* Address picker */}
                <AnimatePresence>
                  {showAddressPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-2"
                    >
                      {addresses.map(a => (
                        <button
                          key={a.id}
                          onClick={() => { setSelectedAddressId(a.id); setShowAddressPicker(false); }}
                          className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${
                            a.id === selectedAddressId
                              ? "border-orange-300"
                              : "border-border bg-muted/40"
                          }`}
                          style={a.id === selectedAddressId ? { background: "rgba(255,112,67,0.06)" } : {}}
                        >
                          <MapPin size={14} className="text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-bold">{a.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{a.line1}, {a.city}</p>
                          </div>
                          {a.id === selectedAddressId && <CheckCircle2 size={15} style={{ color: "#FF7043" }} />}
                        </button>
                      ))}
                      <button
                        onClick={() => { setEditingAddress("new"); setShowAddressPicker(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-2xl border border-dashed border-border text-muted-foreground"
                      >
                        <Plus size={14} />
                        <span className="text-[12.5px] font-semibold">Add New Address</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Payment method ── */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Payment Method</p>

                {/* Wallet */}
                <button
                  onClick={() => setPayMethod("wallet")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-colors text-left ${
                    payMethod === "wallet" ? "border-orange-300" : "border-border"
                  }`}
                  style={payMethod === "wallet" ? { background: "rgba(255,112,67,0.06)" } : {}}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,112,67,0.12)" }}>
                    <Wallet size={16} style={{ color: "#FF7043" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold">MFS Wallet</p>
                    <p className="text-[11px] text-muted-foreground">Balance: ৳{getBalance().toLocaleString()}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === "wallet" ? "border-orange-500" : "border-border"}`}>
                    {payMethod === "wallet" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF7043" }} />}
                  </div>
                </button>

                {/* Card */}
                <button
                  onClick={() => setPayMethod("card")}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-colors text-left ${
                    payMethod === "card" ? "border-orange-300" : "border-border"
                  }`}
                  style={payMethod === "card" ? { background: "rgba(255,112,67,0.06)" } : {}}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(33,150,243,0.12)" }}>
                    <CreditCard size={16} style={{ color: "#2196F3" }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold">{savedCard.brand} •••• {savedCard.last4}</p>
                    <p className="text-[11px] text-muted-foreground">Saved card</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === "card" ? "border-orange-500" : "border-border"}`}>
                    {payMethod === "card" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF7043" }} />}
                  </div>
                </button>
              </div>

              {/* ── Items summary ── */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Items ({cartCount})</p>
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.emoji}</span>
                      <div>
                        <p className="text-[12px] font-semibold leading-tight">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">Qty: {item.qty}</p>
                      </div>
                    </div>
                    <p className="text-[13px] font-bold">৳{(item.price * item.qty).toLocaleString()}</p>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex justify-between font-bold text-[14px]">
                  <span>Total</span>
                  <span style={{ color: "#FF7043" }}>৳{cartTotal.toLocaleString()}</span>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCheckout}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg"
                style={{ background: headerGradient }}
              >
                Place Order · ৳{cartTotal.toLocaleString()}
              </motion.button>
            </motion.div>
          )}

          {/* ──── SUCCESS ──── */}
          {screen === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="px-4 pt-16 flex flex-col items-center text-center space-y-5"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
                className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg"
                style={{ background: "rgba(255,112,67,0.12)", outline: "2px solid rgba(255,112,67,0.3)" }}
              >
                🎉
              </motion.div>
              <div>
                <h2 className="text-[22px] font-extrabold text-foreground">Order Placed!</h2>
                <p className="text-muted-foreground text-sm mt-1">Your order has been confirmed</p>
                <p className="text-[12px] font-mono font-semibold mt-2 text-muted-foreground">{orderNum}</p>
              </div>
              <div className="w-full bg-card rounded-3xl border border-border/60 p-4 space-y-2 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Delivery Info</p>
                <div className="flex items-center gap-2 text-[13px]">
                  <span>📦</span><span className="font-semibold">Estimated: 3–5 business days</span>
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  {payMethod === "wallet"
                    ? <><Wallet size={14} style={{ color: "#FF7043" }} /><span className="font-semibold">৳{lastOrderTotal.toLocaleString()} deducted from wallet</span></>
                    : <><CreditCard size={14} style={{ color: "#2196F3" }} /><span className="font-semibold">৳{lastOrderTotal.toLocaleString()} charged to {savedCard.brand} ••••{savedCard.last4}</span></>
                  }
                </div>
                <div className="flex items-center gap-2 text-[13px]">
                  <MapPin size={14} className="text-muted-foreground" />
                  <span className="text-muted-foreground text-[12px]">{selectedAddress.line1}, {selectedAddress.city}</span>
                </div>
              </div>
              <div className="w-full flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setScreen("orders")}
                  className="flex-1 h-14 rounded-2xl font-bold text-[14px] border-2 flex items-center justify-center gap-2"
                  style={{ borderColor: "#FF7043", color: "#FF7043" }}
                >
                  <Package size={17} />
                  My Orders
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setScreen("browse")}
                  className="flex-1 h-14 rounded-2xl text-white font-bold text-[14px] shadow-lg"
                  style={{ background: headerGradient }}
                >
                  Continue Shopping
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ──── ORDERS ──── */}
          {screen === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.22 }}
              className="px-4 pt-4 space-y-3"
            >
              {orders.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground space-y-3">
                  <p className="text-5xl">📦</p>
                  <p className="font-semibold text-foreground">No orders yet</p>
                  <button
                    onClick={() => setScreen("browse")}
                    className="text-sm font-semibold text-white px-5 py-2.5 rounded-2xl"
                    style={{ background: headerGradient }}
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <>
                  {/* Status legend */}
                  <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                      const count = orders.filter(o => o.status === key).length;
                      return (
                        <div key={key} className="shrink-0 flex items-center gap-1.5 bg-card border border-border/60 rounded-2xl px-3 py-2">
                          <cfg.icon size={12} style={{ color: cfg.color }} />
                          <span className="text-[11px] font-semibold text-foreground">{cfg.label}</span>
                          <span className="text-[11px] font-bold ml-0.5" style={{ color: cfg.color }}>{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {orders.map(order => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Address Editor Sheet ── */}
      <AnimatePresence>
        {editingAddress !== null && (
          <AddressEditor
            address={editingAddress === "new" ? null : editingAddress}
            onSave={(saved) => {
              if (editingAddress === "new") {
                setAddresses(prev => [...prev, saved]);
                setSelectedAddressId(saved.id);
              } else {
                setAddresses(prev => prev.map(a => a.id === saved.id ? saved : a));
              }
              setEditingAddress(null);
              toast.success("Address saved");
            }}
            onCancel={() => setEditingAddress(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ShopFlow;
