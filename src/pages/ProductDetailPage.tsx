import Seo from "@/components/Seo";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Heart, ShoppingCart, Star, Store, Share2, Minus, Plus,
  ChevronRight, Truck, ShieldCheck, RefreshCw, Package, Banknote,
  Clock, ChevronLeft, Tag, MessageCircle, Loader2, Send, Check, CheckCheck, Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import ProductReviews from "@/components/shop/ProductReviews";
import WriteReviewForm from "@/components/shop/WriteReviewForm";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { useOnlinePresence } from "@/hooks/use-online-presence";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { useChat } from "@/hooks/use-chat";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface Variant {
  id: string;
  variant_name: string;
  variant_value: string;
  price_adjustment: number;
  stock: number;
  image_url?: string | null;
}

/* ── Stagger helpers ── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] } }),
};

/* ── Estimated delivery helper ── */
function getEstimatedDelivery() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() + 3);
  const to = new Date(now);
  to.setDate(to.getDate() + 7);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

export default function ProductDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const { addViewed } = useRecentlyViewed();
  const { createDirectConversation, sendMessage, openConversation, closeConversation, messages, messagesLoading, conversations } = useChat();
  const { isOnline } = useOnlinePresence(user?.id ?? null);

  const [showInlineChat, setShowInlineChat] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { typingUsers, setTyping } = useTypingIndicator(showInlineChat, user?.id ?? null, user?.user_metadata?.name || "User");

  // Track recently viewed
  useEffect(() => {
    if (id) addViewed(id);
  }, [id, addViewed]);

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState<{ name: string; slug?: string; category?: string } | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [deliveredOrderId, setDeliveredOrderId] = useState<string | null>(null);
  const [reviewKey, setReviewKey] = useState(0);
  const [swipeDir, setSwipeDir] = useState(0);
  const [relatedFromVendor, setRelatedFromVendor] = useState<any[]>([]);
  const [relatedOthers, setRelatedOthers] = useState<any[]>([]);
  const [chattingWithMerchant, setChattingWithMerchant] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [headerOpaque, setHeaderOpaque] = useState(false);

  // Scroll-based header opacity
  useEffect(() => {
    const onScroll = () => setHeaderOpaque(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const merchantUserId = product?.merchants?.user_id;
  const merchantOnline = merchantUserId ? isOnline(merchantUserId) : false;

  const handleChatWithMerchant = useCallback(async () => {
    if (!user) {
      toast.error(t("pdpLoginToChat"));
      return;
    }
    const merchantUserId = (product?.merchants as any)?.user_id;
    if (!merchantUserId) {
      toast.error(t("pdpMerchantUnavailable"));
      return;
    }
    if (merchantUserId === user.id) {
      toast.info(t("pdpOwnStore"));
      return;
    }
    setChattingWithMerchant(true);
    try {
      const convId = await createDirectConversation(merchantUserId, {
        context: "merchant_inquiry",
        merchant_id: (product?.merchants as any)?.id || merchantUserId,
      });
      if (convId) {
        // Send product inquiry as a "product" type message with metadata
        await sendMessage(convId, `${t("pdpInquiryAbout")} ${product.name}`, "text", {
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          productImage: product.image_url || product.images?.[0] || null,
          productEmoji: product.emoji,
          isProductInquiry: true,
        });
        await openConversation(convId);
        setShowInlineChat(convId);
      } else {
        toast.error(t("pdpConvFailed"));
      }
    } catch {
      toast.error(t("pdpChatFailed"));
    } finally {
      setChattingWithMerchant(false);
    }
  }, [user, product, createDirectConversation, sendMessage, openConversation, t]);

  // ── Data loading (unchanged logic) ──
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: prod } = await supabase
        .from("merchant_products")
        .select("*, merchants!inner(id, business_name, user_id, category)")
        .eq("id", id)
        .single();
      if (prod) {
        setProduct(prod);
        const { data: store } = await (supabase as any)
          .from("vendor_stores").select("store_name, slug")
          .eq("merchant_id", prod.merchant_id).eq("is_active", true).maybeSingle();
        setVendorInfo({ name: store?.store_name || (prod.merchants as any)?.business_name || "Store", slug: store?.slug, category: (prod.merchants as any)?.category });
        const { data: vars } = await (supabase as any)
          .from("product_variants").select("*").eq("product_id", id).eq("is_active", true);
        setVariants(vars ?? []);

        // Fetch related products in parallel
        const [vendorRes, othersRes] = await Promise.all([
          supabase.from("merchant_products").select("id, name, price, original_price, image_url, rating, review_count, stock, badge")
            .eq("merchant_id", prod.merchant_id).neq("id", id).eq("is_active", true).limit(10),
          supabase.from("merchant_products").select("id, name, price, original_price, image_url, rating, review_count, stock, badge")
            .eq("category", prod.category).neq("merchant_id", prod.merchant_id).eq("is_active", true).limit(10),
        ]);
        setRelatedFromVendor(vendorRes.data ?? []);
        setRelatedOthers(othersRes.data ?? []);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const checkReview = async () => {
      const { data: orders } = await supabase.from("orders").select("id, items").eq("user_id", user.id).eq("status", "delivered");
      const match = (orders ?? []).find((o: any) => Array.isArray(o.items) && o.items.some((item: any) => item.id === id || item.product_id === id));
      if (match) {
        const { data: existing } = await (supabase as any).from("product_reviews").select("id").eq("product_id", id).eq("user_id", user.id).limit(1);
        if (!existing || existing.length === 0) { setCanReview(true); setDeliveredOrderId(match.id); }
      }
    };
    checkReview();
  }, [user, id]);

  // ── Swipe handlers ──
  const images: string[] = product ? [product.image_url, ...(product.images || [])].filter(Boolean) : [];
  const goImg = useCallback((dir: number) => {
    if (!images.length) return;
    setSwipeDir(dir);
    setImgIdx((p) => (p + dir + images.length) % images.length);
  }, [images.length]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showInlineChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, showInlineChat, typingUsers]);

  const handleSendInlineChat = useCallback(async () => {
    if (!chatInput.trim() || !showInlineChat || sendingChat) return;
    setSendingChat(true);
    setTyping(false);
    const text = chatInput.trim();
    setChatInput("");
    try {
      await sendMessage(showInlineChat, text);
    } catch {
      toast.error(t("pdpSendFailed"));
    } finally {
      setSendingChat(false);
    }
  }, [chatInput, showInlineChat, sendingChat, sendMessage, setTyping, t]);

  if (loading) return <LoadingSkeleton />;
  if (!product) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">{t("pdpProductNotFound")}</p></div>;

  const finalPrice = product.price + (selectedVariant?.price_adjustment || 0);
  const discount = product.original_price ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : 0;
  const savings = product.original_price ? product.original_price - product.price : 0;
  const stockPct = product.stock <= 20 ? Math.max(5, (product.stock / 20) * 100) : 100;

  const variantGroups = variants.reduce((acc, v) => {
    if (!acc[v.variant_name]) acc[v.variant_name] = [];
    acc[v.variant_name].push(v);
    return acc;
  }, {} as Record<string, Variant[]>);

  const handleAddToCart = () => {
    addToCart({ ...product, price: finalPrice, vendor_name: vendorInfo?.name, vendor_slug: vendorInfo?.slug }, qty);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 600);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <Seo
        title={`${product.name} – EasyPay Shop`}
        description={(product.description ?? `Buy ${product.name} on EasyPay Shop. Secure checkout, fast delivery across Bangladesh.`).slice(0, 160)}
        path={`/product/${product.id}`}
        type="product"
        image={images[0]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description ?? undefined,
          image: images[0],
          offers: {
            "@type": "Offer",
            priceCurrency: "BDT",
            price: product.price,
            availability: (product.stock ?? 1) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: `https://pay-palooza-go.lovable.app/product/${product.id}`,
          },
        }}
      />
      {/* ── Sticky header ── */}
      <motion.div
        className="sticky top-0 z-50 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow flex items-center gap-2 px-3 py-2.5"
        initial={false}
      >
        {(() => {
          const iconBtn = "rounded-full text-primary-foreground hover:bg-white/15 hover:text-primary-foreground";
          return (
            <>
              <Button variant="ghost" size="icon" className={iconBtn} onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="flex-1 min-w-0 text-[15px] font-semibold text-primary-foreground truncate">
                {product?.name ?? t("pdpProduct")}
              </h1>
              <div className="flex items-center gap-1">
                <motion.div whileTap={{ scale: 0.75 }} className="relative">
                  <Button variant="ghost" size="icon" className={iconBtn} onClick={() => toggleWishlist(product.id)}>
                    <AnimatePresence mode="wait">
                      <motion.div key={isWishlisted(product.id) ? "filled" : "empty"}
                        initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                        <Heart className={cn("w-5 h-5 transition-colors", isWishlisted(product.id) ? "fill-destructive text-destructive" : "")} />
                      </motion.div>
                    </AnimatePresence>
                  </Button>
                </motion.div>
                <Button variant="ghost" size="icon" className={iconBtn}><Share2 className="w-5 h-5" /></Button>
                <Button variant="ghost" size="icon" className={cn(iconBtn, "relative")} onClick={() => navigate("/shop/checkout")}>
                  <ShoppingCart className="w-5 h-5" />
                </Button>
              </div>
            </>
          );
        })()}
      </motion.div>

      {/* ── Image carousel ── */}
      <motion.section custom={0} variants={fadeUp} initial="hidden" animate="show" className="relative bg-card overflow-hidden">
        <div
          className="aspect-[4/4] relative touch-pan-y"
          onTouchStart={(e) => { (e.currentTarget as any)._sx = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._sx || 0);
            if (Math.abs(dx) > 50) goImg(dx < 0 ? 1 : -1);
          }}
        >
          <AnimatePresence mode="popLayout" custom={swipeDir}>
            <motion.img
              key={imgIdx}
              src={images[imgIdx] || "/placeholder.svg"}
              alt={product.name}
              className="absolute inset-0 w-full h-full object-contain"
              initial={{ opacity: 0, x: swipeDir * 80, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: swipeDir * -80, scale: 0.96 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              whileTap={{ scale: 1.03 }}
            />
          </AnimatePresence>

          {/* Nav arrows (desktop) */}
          {images.length > 1 && (
            <>
              <button onClick={() => goImg(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/60 backdrop-blur flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => goImg(1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-card/60 backdrop-blur flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><ChevronRight className="w-4 h-4" /></button>
            </>
          )}

          {/* Image counter pill */}
          {images.length > 1 && (
            <span className="absolute bottom-3 right-3 text-[10px] font-medium bg-foreground/60 text-card px-2 py-0.5 rounded-full backdrop-blur">
              {imgIdx + 1}/{images.length}
            </span>
          )}

          {/* Badge */}
          {product.badge && (
            <span className="absolute bottom-3 left-3 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-card/70 backdrop-blur-md text-foreground border border-border/50" style={product.badge_color ? { backgroundColor: product.badge_color, color: "#fff", borderColor: "transparent" } : undefined}>
              {product.badge}
            </span>
          )}

          {/* Dot indicators — inside image */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-foreground/20 backdrop-blur-sm rounded-full px-2 py-1">
              {images.map((_: string, i: number) => (
                <button key={i} onClick={() => { setSwipeDir(i > imgIdx ? 1 : -1); setImgIdx(i); }}
                  className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", i === imgIdx ? "bg-background w-4" : "bg-background/40")} />
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ── Main content ── */}
      <div className="px-4 space-y-4 mt-3">

        {/* Price block */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show" className="space-y-1.5">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">৳{finalPrice.toLocaleString()}</span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-base text-muted-foreground line-through">৳{product.original_price.toLocaleString()}</span>
            )}
            {discount > 0 && (
              <Badge variant="destructive" className="text-[11px] font-bold px-2 py-0.5 rounded-md">-{discount}%</Badge>
            )}
          </div>
          {savings > 0 && (
            <p className="text-xs font-medium text-primary">{t("pdpYouSave")} ৳{savings.toLocaleString()}</p>
          )}
        </motion.div>

        {/* Title */}
        <motion.h1 custom={2} variants={fadeUp} initial="hidden" animate="show" className="text-lg font-bold text-foreground leading-snug">
          {product.name}
        </motion.h1>

        {/* Rating */}
        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn("w-3.5 h-3.5", i < Math.round(product.rating) ? "fill-accent text-accent" : "text-muted-foreground/20")} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{product.rating?.toFixed(1)} · {product.review_count} {t("pdpReviews")}</span>
        </motion.div>

        {/* Stock urgency */}
        {product.stock > 0 && product.stock <= 20 && (
          <motion.div custom={3.5} variants={fadeUp} initial="hidden" animate="show" className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-destructive">{t("pdpOnlyLeft").replace("{n}", String(product.stock))}</span>
              <span className="text-[10px] text-muted-foreground">{t("pdpHurryUp")}</span>
            </div>
            <Progress value={stockPct} className="h-1.5 bg-destructive/10 [&>div]:bg-destructive" />
          </motion.div>
        )}

        {/* Vendor row */}
        {vendorInfo && (
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show"
            className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">{vendorInfo.name}</span>
                <div className="flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span>{product.rating || "4.5"}</span>
                  <span className="mx-0.5">·</span>
                  <span className="truncate">{vendorInfo?.category || product.category}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {vendorInfo.slug && (
                <Button variant="outline" size="sm" className="text-xs h-7 rounded-lg" onClick={() => navigate(`/shop/${vendorInfo.slug}`)}>
                  {t("pdpVisitStore")} <ChevronRight className="w-3 h-3 ml-0.5" />
                </Button>
              )}
            </div>
          </motion.div>
        )}

        <Separator className="bg-border/50" />

        {/* Variants */}
        {Object.entries(variantGroups).map(([name, options], gi) => (
          <motion.div key={name} custom={5 + gi * 0.3} variants={fadeUp} initial="hidden" animate="show" className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{name}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((v) => (
                <motion.button key={v.id} onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                  disabled={v.stock <= 0}
                  whileTap={{ scale: 0.9 }}
                  layout
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
                    selectedVariant?.id === v.id
                      ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                      : "border-border text-foreground hover:border-primary/40",
                    v.stock <= 0 && "opacity-40 cursor-not-allowed"
                  )}>
                  {v.image_url && <img src={v.image_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                  {v.variant_value}
                  {v.price_adjustment !== 0 && <span className="text-muted-foreground">({v.price_adjustment > 0 ? "+" : ""}৳{v.price_adjustment})</span>}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Stock + Quantity Row */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show">
          <div className="flex items-center justify-between bg-muted/20 border border-border/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <div className={cn("w-2.5 h-2.5 rounded-full", product.stock > 0 ? "bg-green-500" : "bg-destructive")} />
              <span className="text-sm font-semibold text-foreground">
                {product.stock > 0 ? t("pdpInStock") : t("pdpOutOfStock")}
              </span>
              {product.stock > 0 && (
                <span className="text-xs text-muted-foreground">· {product.stock} {t("pdpAvailable")}</span>
              )}
            </div>
            <div className="flex items-center border border-border rounded-full overflow-hidden bg-background">
              <motion.button whileTap={{ scale: 0.8 }} onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center hover:bg-muted/50 transition-colors">
                <Minus className="w-3.5 h-3.5" />
              </motion.button>
              <div className="w-10 text-center text-sm font-bold overflow-hidden relative h-6">
                <AnimatePresence mode="popLayout">
                  <motion.span key={qty} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute inset-0 flex items-center justify-center">
                    {qty}
                  </motion.span>
                </AnimatePresence>
              </div>
              <motion.button whileTap={{ scale: 0.8 }} onClick={() => setQty(Math.min(product.stock, qty + 1))} className="w-9 h-9 flex items-center justify-center hover:bg-muted/50 transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Key Highlights (moved here, below Quantity) */}
        {(product.category || (product as any).brand) && (
          <motion.div custom={6.5} variants={fadeUp} initial="hidden" animate="show">
            <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-muted/30 border-b border-border/40">
                <Tag className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">{t("pdpKeyHighlights")}</span>
              </div>
              <div className="flex flex-wrap gap-2 px-3.5 py-3">
                {product.category && <Badge variant="secondary" className="text-xs">{product.category}</Badge>}
                {(product as any).brand && <Badge variant="outline" className="text-xs">{(product as any).brand}</Badge>}
              </div>
            </div>
          </motion.div>
        )}

        <Separator className="bg-border/50" />

        {/* Delivery & Trust card */}
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show"
          className="bg-card border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
          {[
            { icon: Truck, label: t("pdpFreeDelivery"), sub: `${t("pdpEstimated")} ${getEstimatedDelivery()}`, color: "text-primary" },
            { icon: Banknote, label: t("pdpCOD"), color: "text-primary" },
            { icon: RefreshCw, label: t("pdpEasyReturn"), sub: t("pdpReturnPolicy"), color: "text-accent" },
            { icon: ShieldCheck, label: t("pdpAuthentic"), sub: t("pdpGenuine"), color: "text-primary" },
          ].map(({ icon: Icon, label, sub, color }, idx) => (
            <motion.div key={label} className="flex items-center gap-3 px-3.5 py-3"
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.35 }}>
              <div className={cn("w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{label}</p>
                {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="show">
          <Tabs defaultValue="description">
            <TabsList className="w-full bg-muted/50 rounded-xl p-1 h-auto">
              <TabsTrigger value="description" className="flex-1 rounded-lg text-xs py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">{t("pdpDescription")}</TabsTrigger>
              <TabsTrigger value="specs" className="flex-1 rounded-lg text-xs py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">{t("pdpSpecifications")}</TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1 rounded-lg text-xs py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">{t("pdpReviewsTab")} ({product.review_count})</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-3 space-y-3">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              {/* Product Details Card */}
              <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-muted/30 border-b border-border/40">
                  <Package className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">{t("pdpProductDetails")}</span>
                </div>
                {(() => {
                  const lines = (product.description || t("pdpNoDescription")).split("\n").filter(Boolean);
                  if (lines.length <= 1) {
                    return (
                      <div className="px-3.5 py-3 border-l-2 border-primary/40 ml-3 my-3">
                        <p className="text-sm text-muted-foreground leading-relaxed">{lines[0] || t("pdpNoDescription")}</p>
                      </div>
                    );
                  }
                  return (
                    <div className="divide-y divide-border/40">
                      {lines.map((line: string, i: number) => (
                        <div key={i} className="flex items-start gap-2.5 px-3.5 py-2.5">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                          <p className="text-sm text-muted-foreground leading-relaxed">{line}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="specs" className="mt-3">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <div className="bg-card border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
                {[
                  product.category && [t("pdpCategory"), product.category],
                  (product as any).brand && [t("pdpBrand"), (product as any).brand],
                  (product as any).sku && [t("pdpSku"), (product as any).sku],
                  [t("pdpStock"), product.stock > 0 ? `${product.stock} ${t("pdpUnits")}` : t("pdpOutOfStock")],
                ].filter(Boolean).map(([k, v]: any) => (
                  <div key={k} className="flex justify-between px-3.5 py-2.5">
                    <span className="text-xs text-muted-foreground">{k}</span>
                    <span className="text-xs font-medium text-foreground">{v}</span>
                  </div>
                ))}
              </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="reviews" className="mt-3 -mx-4">
              <RatingDistribution rating={product.rating} count={product.review_count} />
              <ProductReviews productId={product.id} key={reviewKey} />
              {canReview && (
                <div className="px-4 mt-4">
                  <WriteReviewForm productId={product.id} orderId={deliveredOrderId ?? undefined}
                    onSuccess={() => { setCanReview(false); setReviewKey((k) => k + 1); }} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Related: More from this Store */}
        {relatedFromVendor.length > 0 && (
          <motion.div custom={9} variants={fadeUp} initial="hidden" animate="show">
            <RelatedProductsRow
              title={t("pdpMoreFromStore")}
              products={relatedFromVendor}
              seeAllLink={vendorInfo?.slug ? `/shop/${vendorInfo.slug}` : "/shop"}
              onNavigate={(pid) => navigate(`/product/${pid}`)}
            />
          </motion.div>
        )}

        {/* Related: You May Also Like */}
        {relatedOthers.length > 0 && (
          <motion.div custom={10} variants={fadeUp} initial="hidden" animate="show">
            <RelatedProductsRow
              title={t("pdpYouMayLike")}
              products={relatedOthers}
              seeAllLink="/shop"
              onNavigate={(pid) => navigate(`/product/${pid}`)}
            />
          </motion.div>
        )}
      </div>

      {/* ── Fixed bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50 px-3 py-3 flex items-center gap-2.5 safe-area-bottom">
        {merchantUserId && merchantUserId !== user?.id && (
          <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0 relative"
            onClick={handleChatWithMerchant} disabled={chattingWithMerchant}>
            {chattingWithMerchant ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
            <span className={cn("absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-card",
              merchantOnline ? "bg-emerald-500" : "bg-muted-foreground/40")} />
          </Button>
        )}
        <motion.div whileTap={{ scale: 0.96 }} className="flex-1 min-w-0">
          <Button variant="outline" size="lg" className="w-full rounded-xl h-11 text-sm font-bold"
            onClick={handleAddToCart} disabled={product.stock <= 0}>
            <AnimatePresence mode="wait">
              {addedToCart ? (
                <motion.span key="check" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-primary" /> {t("pdpAdded")}
                </motion.span>
              ) : (
                <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {t("pdpAddToCart")}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.96 }} className="flex-1 min-w-0">
          <Button size="lg" className="w-full rounded-xl h-11 text-sm font-bold"
            onClick={() => {
              if (product.stock <= 0) return;
              const item = { ...product, qty: Math.max(1, qty) };
              try {
                sessionStorage.setItem("easypay_buy_now", JSON.stringify(item));
              } catch {}
              navigate("/shop/checkout", { state: { buyNowItem: item } });
            }} disabled={product.stock <= 0}>
            {t("pdpBuyNow")}
          </Button>
        </motion.div>
      </div>

      {/* ── Inline Chat Overlay ── */}
      <AnimatePresence>
        {showInlineChat && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-[70] bg-background flex flex-col"
          >
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 bg-card/90 backdrop-blur-xl shrink-0">
              <Button variant="ghost" size="icon" className="rounded-full shrink-0" onClick={() => { setShowInlineChat(null); closeConversation(); }}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="relative w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-primary" />
                <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card", merchantOnline ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">{vendorInfo?.name || "Seller"}</span>
                <span className={cn("text-[10px]", merchantOnline ? "text-emerald-600" : "text-muted-foreground")}>
                  {typingUsers.length > 0 ? "typing..." : merchantOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            {/* Product Context Banner */}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-muted/30 border-b border-border/30 shrink-0">
              <span className="text-lg">{product.emoji || "📦"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                <p className="text-[11px] text-primary font-bold">৳{product.price?.toLocaleString()}</p>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="px-3 py-3 space-y-2">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-10">No messages yet</p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    const isProductCard = (msg.metadata as any)?.isProductInquiry;
                    const convParticipants = conversations?.find(c => c.id === showInlineChat)?.participants || [];
                    const otherRead = convParticipants
                      .filter(p => p.user_id !== user?.id)
                      .some(p => p.last_read_at && new Date(p.last_read_at) >= new Date(msg.created_at));

                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm relative",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        )}>
                          {isProductCard ? (
                            <div className="space-y-1">
                              <p className="text-xs opacity-80">Product inquiry</p>
                              <div className="flex items-center gap-2">
                                <span className="text-base">{(msg.metadata as any)?.productEmoji || "📦"}</span>
                                <div>
                                  <p className="text-xs font-semibold">{(msg.metadata as any)?.productName}</p>
                                  <p className="text-[11px] font-bold">৳{(msg.metadata as any)?.productPrice?.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.decryptedContent || msg.content}</p>
                          )}
                          <div className={cn("flex items-center gap-1 mt-0.5", isMine ? "justify-end" : "justify-start")}>
                            <span className="text-[9px] opacity-60">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isMine && (
                              otherRead
                                ? <Eye className="w-2.5 h-2.5 opacity-70" />
                                : <CheckCheck className="w-2.5 h-2.5 opacity-50" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2">
                      <span className="text-xs text-muted-foreground italic">{typingUsers[0]} is typing…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border/50 bg-card/90 backdrop-blur-xl shrink-0 safe-area-bottom">
              <Input
                value={chatInput}
                onChange={(e) => { setChatInput(e.target.value); setTyping(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && chatInput.trim()) {
                    e.preventDefault();
                    handleSendInlineChat();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 rounded-full h-10 bg-muted/50 border-border/50"
              />
              <Button size="icon" className="rounded-full h-10 w-10 shrink-0"
                disabled={!chatInput.trim() || sendingChat}
                onClick={handleSendInlineChat}>
                {sendingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Related products row ── */
function RelatedProductsRow({ title, products, seeAllLink, onNavigate }: {
  title: string; products: any[]; seeAllLink: string; onNavigate: (id: string) => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <button onClick={() => navigate(seeAllLink)} className="text-xs font-medium text-primary flex items-center gap-0.5">
          See All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-1 -mx-4 px-4 scrollbar-hide">
        {products.map((p) => {
          const discount = p.original_price && p.original_price > p.price
            ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 0;
          return (
            <motion.button key={p.id} onClick={() => onNavigate(p.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              className="snap-start shrink-0 w-[140px] bg-card border border-border/60 rounded-xl overflow-hidden text-left hover:shadow-md transition-shadow">
              <div className="aspect-square relative bg-muted/30">
                <img src={p.image_url || "/placeholder.svg"} alt={p.name}
                  className="w-full h-full object-cover" loading="lazy" />
                {discount > 0 && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground">
                    -{discount}%
                  </span>
                )}
              </div>
              <div className="p-2 space-y-1">
                <p className="text-[11px] font-medium text-foreground leading-tight truncate">{p.name}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-bold text-foreground">৳{p.price?.toLocaleString()}</span>
                  {p.original_price && p.original_price > p.price && (
                    <span className="text-[10px] text-muted-foreground line-through">৳{p.original_price?.toLocaleString()}</span>
                  )}
                </div>
                {p.rating > 0 && (
                  <div className="flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-accent text-accent" />
                    <span className="text-[10px] text-muted-foreground">{p.rating?.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Rating distribution bar chart ── */
function RatingDistribution({ rating, count }: { rating: number; count: number }) {
  if (!count) return null;
  // Approximate distribution from overall rating
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const diff = Math.abs(star - rating);
    return Math.max(2, Math.round(100 * Math.exp(-diff * 0.8)));
  });
  const total = dist.reduce((a, b) => a + b, 0);

  return (
    <div className="px-4 pb-4 flex items-start gap-4">
      <div className="text-center shrink-0">
        <p className="text-4xl font-extrabold text-foreground">{rating?.toFixed(1)}</p>
        <div className="flex justify-center gap-0.5 mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn("w-3 h-3", i < Math.round(rating) ? "fill-accent text-accent" : "text-muted-foreground/20")} />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{count} reviews</p>
      </div>
      <div className="flex-1 space-y-1.5 pt-1">
        {[5, 4, 3, 2, 1].map((star, i) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-3 text-right">{star}</span>
            <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(dist[i] / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Loading skeleton ── */
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-12 bg-card border-b border-border" />
      <Skeleton className="w-full aspect-square" />
      <div className="px-4 py-4 space-y-3">
        <Skeleton className="h-8 w-1/3 rounded-lg" />
        <Skeleton className="h-5 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-lg" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
