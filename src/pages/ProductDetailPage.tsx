import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Heart, ShoppingCart, Star, Store, Share2, Minus, Plus,
  ChevronRight, Truck, ShieldCheck, RefreshCw, Package, Banknote,
  Clock, ChevronLeft,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { user } = useAuth();

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState<{ name: string; slug?: string } | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [deliveredOrderId, setDeliveredOrderId] = useState<string | null>(null);
  const [reviewKey, setReviewKey] = useState(0);
  const [swipeDir, setSwipeDir] = useState(0);
  const [relatedFromVendor, setRelatedFromVendor] = useState<any[]>([]);
  const [relatedOthers, setRelatedOthers] = useState<any[]>([]);

  // ── Data loading (unchanged logic) ──
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: prod } = await supabase
        .from("merchant_products")
        .select("*, merchants!inner(id, business_name, user_id)")
        .eq("id", id)
        .single();
      if (prod) {
        setProduct(prod);
        const { data: store } = await (supabase as any)
          .from("vendor_stores").select("store_name, slug")
          .eq("merchant_id", prod.merchant_id).eq("is_active", true).maybeSingle();
        setVendorInfo({ name: store?.store_name || (prod.merchants as any)?.business_name || "Store", slug: store?.slug });
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

  if (loading) return <LoadingSkeleton />;
  if (!product) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Product not found</p></div>;

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
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-50 bg-card/70 backdrop-blur-xl border-b border-border/50 flex items-center justify-between px-3 py-2.5">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => toggleWishlist(product.id)}>
            <Heart className={cn("w-5 h-5 transition-colors", isWishlisted(product.id) ? "fill-destructive text-destructive" : "")} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full"><Share2 className="w-5 h-5" /></Button>
          <Button variant="ghost" size="icon" className="rounded-full relative" onClick={() => navigate("/shop/checkout")}>
            <ShoppingCart className="w-5 h-5" />
          </Button>
        </div>
      </div>

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
              initial={{ opacity: 0, x: swipeDir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: swipeDir * -60 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
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
        </div>

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1.5 py-2.5">
            {images.map((_: string, i: number) => (
              <button key={i} onClick={() => { setSwipeDir(i > imgIdx ? 1 : -1); setImgIdx(i); }}
                className={cn("w-1.5 h-1.5 rounded-full transition-all duration-300", i === imgIdx ? "bg-primary w-4" : "bg-muted-foreground/25")} />
            ))}
          </div>
        )}
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
            <p className="text-xs font-medium text-primary">You save ৳{savings.toLocaleString()}</p>
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
          <span className="text-xs text-muted-foreground">{product.rating?.toFixed(1)} · {product.review_count} reviews</span>
        </motion.div>

        {/* Stock urgency */}
        {product.stock > 0 && product.stock <= 20 && (
          <motion.div custom={3.5} variants={fadeUp} initial="hidden" animate="show" className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-destructive">Only {product.stock} left!</span>
              <span className="text-[10px] text-muted-foreground">Hurry up</span>
            </div>
            <Progress value={stockPct} className="h-1.5 bg-destructive/10 [&>div]:bg-destructive" />
          </motion.div>
        )}

        {/* Vendor row */}
        {vendorInfo && (
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show"
            className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">{vendorInfo.name}</span>
            </div>
            {vendorInfo.slug && (
              <Button variant="outline" size="sm" className="text-xs h-7 rounded-lg shrink-0" onClick={() => navigate(`/shop/${vendorInfo.slug}`)}>
                Visit Store <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            )}
          </motion.div>
        )}

        <Separator className="bg-border/50" />

        {/* Variants */}
        {Object.entries(variantGroups).map(([name, options], gi) => (
          <motion.div key={name} custom={5 + gi * 0.3} variants={fadeUp} initial="hidden" animate="show" className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{name}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((v) => (
                <button key={v.id} onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                  disabled={v.stock <= 0}
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
                </button>
              ))}
            </div>
          </motion.div>
        ))}

        {/* Quantity */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show" className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Quantity</span>
          <div className="flex items-center border border-border rounded-full overflow-hidden">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center hover:bg-muted/50 transition-colors">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center text-sm font-bold">{qty}</span>
            <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="w-9 h-9 flex items-center justify-center hover:bg-muted/50 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>

        <Separator className="bg-border/50" />

        {/* Delivery & Trust card */}
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show"
          className="bg-card border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
          {[
            { icon: Truck, label: "Free Delivery", sub: `Estimated ${getEstimatedDelivery()}`, color: "text-primary" },
            { icon: Banknote, label: "Cash on Delivery Available", color: "text-primary" },
            { icon: RefreshCw, label: "Easy Return", sub: "14 days return policy", color: "text-accent" },
            { icon: ShieldCheck, label: "100% Authentic", sub: "Genuine product guarantee", color: "text-primary" },
          ].map(({ icon: Icon, label, sub, color }) => (
            <div key={label} className="flex items-center gap-3 px-3.5 py-3">
              <div className={cn("w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">{label}</p>
                {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Tabs */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="show">
          <Tabs defaultValue="description">
            <TabsList className="w-full bg-muted/50 rounded-xl p-1 h-auto">
              <TabsTrigger value="description" className="flex-1 rounded-lg text-xs py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">Description</TabsTrigger>
              <TabsTrigger value="specs" className="flex-1 rounded-lg text-xs py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">Specifications</TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1 rounded-lg text-xs py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">Reviews ({product.review_count})</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-3 space-y-2">
              {(product.description || "No description available.").split("\n").filter(Boolean).map((line: string, i: number) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>
              ))}
            </TabsContent>

            <TabsContent value="specs" className="mt-3">
              <div className="bg-card border border-border/60 rounded-xl divide-y divide-border/40 overflow-hidden">
                {[
                  product.category && ["Category", product.category],
                  (product as any).brand && ["Brand", (product as any).brand],
                  (product as any).sku && ["SKU", (product as any).sku],
                  ["Stock", product.stock > 0 ? `${product.stock} units` : "Out of stock"],
                ].filter(Boolean).map(([k, v]: any) => (
                  <div key={k} className="flex justify-between px-3.5 py-2.5">
                    <span className="text-xs text-muted-foreground">{k}</span>
                    <span className="text-xs font-medium text-foreground">{v}</span>
                  </div>
                ))}
              </div>
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
              title="More from this Store"
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
              title="You May Also Like"
              products={relatedOthers}
              seeAllLink="/shop"
              onNavigate={(pid) => navigate(`/product/${pid}`)}
            />
          </motion.div>
        )}
      </div>

      {/* ── Fixed bottom bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50 px-3 py-3 flex items-center gap-2.5 safe-area-bottom">
        <Button variant="outline" size="icon" className="rounded-xl shrink-0 h-11 w-11" onClick={() => navigate("/shop/checkout")}>
          <ShoppingCart className="w-5 h-5" />
        </Button>
        <Button variant="outline" size="lg" className="flex-1 rounded-xl h-11 text-sm font-bold"
          onClick={handleAddToCart} disabled={product.stock <= 0}>
          Add to Cart
        </Button>
        <Button size="lg" className="flex-1 rounded-xl h-11 text-sm font-bold"
          onClick={() => { handleAddToCart(); navigate("/shop/checkout"); }} disabled={product.stock <= 0}>
          Buy Now
        </Button>
      </div>
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
            <button key={p.id} onClick={() => onNavigate(p.id)}
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
                <p className="text-[11px] font-medium text-foreground leading-tight line-clamp-2">{p.name}</p>
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
            </button>
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
