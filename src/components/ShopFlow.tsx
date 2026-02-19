import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShoppingCart, Search, Star, Plus, Minus, Trash2, CheckCircle2, Tag, X } from "lucide-react";
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
  badge?: string;
  badgeColor?: string;
}

interface CartItem extends Product { qty: number; }

// ── Products ──────────────────────────────────────────────────────────────────
const PRODUCTS: Product[] = [
  { id: "p1",  name: "Wireless Earbuds Pro", brand: "SoundX",   price: 3499,  originalPrice: 4999,  rating: 4.7, reviews: 1240, emoji: "🎧", category: "Electronics", badge: "30% OFF",  badgeColor: "#E91E8C" },
  { id: "p2",  name: "Smart Watch Ultra",    brand: "TimePro",  price: 8999,  originalPrice: 11999, rating: 4.5, reviews: 876,  emoji: "⌚", category: "Electronics", badge: "HOT",      badgeColor: "#FF5722" },
  { id: "p3",  name: "Gaming Headset",       brand: "GameZone", price: 5499,  originalPrice: 6999,  rating: 4.6, reviews: 432,  emoji: "🎮", category: "Gaming",      badge: "NEW",      badgeColor: "#9C27B0" },
  { id: "p4",  name: "Portable Charger",     brand: "PowerUp",  price: 1299,  originalPrice: 1799,  rating: 4.8, reviews: 2156, emoji: "🔋", category: "Accessories", badge: "BESTSELL", badgeColor: "#43A047" },
  { id: "p5",  name: "Bluetooth Speaker",    brand: "BoomBox",  price: 2999,  originalPrice: 3999,  rating: 4.4, reviews: 654,  emoji: "🔊", category: "Electronics" },
  { id: "p6",  name: "USB-C Hub 7-in-1",    brand: "ConnectX", price: 1899,  originalPrice: 2499,  rating: 4.6, reviews: 987,  emoji: "🔌", category: "Accessories" },
  { id: "p7",  name: "Mechanical Keyboard",  brand: "TypeX",    price: 4599,  originalPrice: 5999,  rating: 4.8, reviews: 1543, emoji: "⌨️", category: "Computing",   badge: "TOP PICK", badgeColor: "#00BCD4" },
  { id: "p8",  name: "4K Webcam",            brand: "VisionX",  price: 3299,  originalPrice: 4299,  rating: 4.5, reviews: 738,  emoji: "📷", category: "Computing" },
  { id: "p9",  name: "LED Desk Lamp",        brand: "LightUp",  price: 899,   originalPrice: 1299,  rating: 4.3, reviews: 521,  emoji: "💡", category: "Home" },
  { id: "p10", name: "Yoga Mat Premium",     brand: "FitLife",  price: 1499,  originalPrice: 2199,  rating: 4.7, reviews: 893,  emoji: "🧘", category: "Sports" },
  { id: "p11", name: "Coffee Maker Pro",     brand: "BrewMate", price: 6999,  originalPrice: 8999,  rating: 4.6, reviews: 432,  emoji: "☕", category: "Home",        badge: "SALE",     badgeColor: "#FF9800" },
  { id: "p12", name: "Running Shoes X9",     brand: "SpeedFit", price: 4299,  originalPrice: 5999,  rating: 4.5, reviews: 1205, emoji: "👟", category: "Sports" },
];

const CATEGORIES = ["All", "Electronics", "Gaming", "Accessories", "Computing", "Home", "Sports"];

type Screen = "browse" | "detail" | "cart" | "checkout" | "success";

interface ShopFlowProps { onClose: () => void; }

const ShopFlow = ({ onClose }: ShopFlowProps) => {
  const [screen, setScreen]           = useState<Screen>("browse");
  const [category, setCategory]       = useState("All");
  const [search, setSearch]           = useState("");
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [detail, setDetail]           = useState<Product | null>(null);
  const [orderNum, setOrderNum]       = useState("");

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => PRODUCTS.filter(p =>
    (category === "All" || p.category === category) &&
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase()))
  ), [category, search]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);

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

  // ── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    const bal = getBalance();
    if (cartTotal > bal) {
      toast.error("Insufficient wallet balance");
      return;
    }
    deductBalance(cartTotal);
    const num = `ORD-${Date.now().toString(36).toUpperCase()}`;
    setOrderNum(num);
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
    onClose();
  };

  const headerTitle = {
    browse:   "Shop",
    detail:   detail?.name ?? "Product",
    cart:     `Cart (${cartCount})`,
    checkout: "Checkout",
    success:  "Order Placed!",
  }[screen];

  const headerGradient = "linear-gradient(135deg,#FF7043,#BF360C)";

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
            animate={{ width: { browse: "25%", detail: "50%", cart: "50%", checkout: "75%", success: "100%" }[screen] }}
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
              {screen === "browse" && `${filtered.length} products`}
              {screen === "cart"   && `৳${cartTotal.toLocaleString()} total`}
              {screen === "checkout" && "Confirm your order"}
              {screen === "success" && orderNum}
            </p>
          </div>

          {/* Cart icon */}
          {(screen === "browse" || screen === "detail") && (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setScreen("cart")}
              className="relative w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors tap-target shrink-0"
            >
              <ShoppingCart size={17} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-yellow-400 text-[9px] font-bold text-gray-900 flex items-center justify-center min-w-[18px] h-[18px] px-1">
                  {cartCount}
                </span>
              )}
            </motion.button>
          )}
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
              </div>

              {/* Add to cart */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { addToCart(detail); setScreen("cart"); }}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg flex items-center justify-center gap-2"
                style={{ background: headerGradient }}
              >
                <ShoppingCart size={18} />
                Add to Cart
              </motion.button>
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
              {/* Delivery address */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Delivery Address</p>
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50">
                  <span className="text-xl mt-0.5">📍</span>
                  <div>
                    <p className="text-[13px] font-bold">Home</p>
                    <p className="text-[12px] text-muted-foreground leading-snug">House 12, Road 5, Block D,<br />Mirpur-10, Dhaka-1216</p>
                  </div>
                </div>
              </div>

              {/* Payment method */}
              <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Payment Method</p>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50">
                  <span className="text-xl">💳</span>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold">MFS Wallet</p>
                    <p className="text-[12px] text-muted-foreground">Balance: ৳{getBalance().toLocaleString()}</p>
                  </div>
                  <CheckCircle2 size={16} className="text-green-500" />
                </div>
              </div>

              {/* Items summary */}
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
                  <span>💳</span><span className="font-semibold">৳{cartTotal > 0 ? cartTotal.toLocaleString() : "—"} deducted from wallet</span>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setScreen("browse")}
                className="w-full h-14 rounded-2xl text-white font-bold text-[15px] shadow-lg"
                style={{ background: headerGradient }}
              >
                Continue Shopping
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ShopFlow;
