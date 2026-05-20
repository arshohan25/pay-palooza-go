import Seo from "@/components/Seo";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ArrowLeft, ShoppingCart, Store, Loader2,
  ShieldCheck, Truck, RotateCcw, Flame, ChevronRight,
  Clock, Sparkles, Zap, ClipboardList, Heart,
} from "lucide-react";
import SearchAutocomplete from "@/components/shop/SearchAutocomplete";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import ProductCard, { type ShopProduct } from "@/components/shop/ProductCard";
import CategoryNav from "@/components/shop/CategoryNav";
import CartDrawer from "@/components/shop/CartDrawer";
import FilterDrawer, { type ShopFilters, defaultFilters } from "@/components/shop/FilterDrawer";
import PromoSlider from "@/components/PromoSlider";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { cn } from "@/lib/utils";

type SortOption = "popular" | "price_low" | "price_high" | "newest" | "rating";

/* ── Section wrapper with staggered entry ── */
const Section = ({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay, ease: [0.23, 1, 0.32, 1] }}
    className={className}
  >
    {children}
  </motion.section>
);

/* ── Mini product card for trending row ── */
function FlashCard({ product, onNavigate }: { product: ShopProduct; onNavigate: (path: string) => void }) {
  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;
  const stockPercent = Math.min(100, Math.max(5, (product.stock / 50) * 100));

  return (
    <button
      onClick={() => onNavigate(`/product/${product.id}`)}
      className="min-w-[140px] max-w-[140px] shrink-0 rounded-2xl bg-card border border-border/40 overflow-hidden text-left group shadow-sm hover:shadow-lg transition-all duration-300"
    >
      <div className="relative aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <span className="text-3xl">{product.emoji}</span>
        )}
        {discount > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-md">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <p className="text-xs font-semibold text-foreground truncate">{product.name}</p>
        <p className="text-xs font-extrabold text-primary">৳{product.price.toLocaleString()}</p>
        {product.original_price && (
          <p className="text-[10px] text-muted-foreground line-through">৳{product.original_price.toLocaleString()}</p>
        )}
        {product.stock > 0 && product.stock <= 50 && (
          <div className="space-y-0.5 pt-0.5">
            <Progress value={stockPercent} className="h-1 bg-muted/60 [&>div]:bg-destructive/70" />
            <p className="text-[9px] text-muted-foreground">Selling fast</p>
          </div>
        )}
      </div>
    </button>
  );
}

/* ── Live countdown hook ── */
function useCountdown(endsAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(endsAt).getTime() - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { h, m, s, expired: diff <= 0 };
}

/* ── Shop Promo Banner Card ── */
function ShopPromoBanner({ banner, onNavigate }: { banner: any; onNavigate: (path: string) => void }) {
  const handleClick = () => {
    if (banner.link_url) {
      if (banner.link_url.startsWith("feature:")) {
        const feature = banner.link_url.replace("feature:", "");
        const featureRoutes: Record<string, string> = {
          sendmoney: "/", cashout: "/", payment: "/", recharge: "/",
          paybill: "/", addmoney: "/", shop: "/shop", banktransfer: "/",
          savings: "/", refer: "/refer", kyc: "/", history: "/history",
        };
        onNavigate(featureRoutes[feature] || "/");
      } else {
        window.open(banner.link_url, "_blank");
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-2xl overflow-hidden relative min-h-[80px]"
    >
      {banner.media_url ? (
        <>
          {banner.media_type === "video" ? (
            <video src={banner.media_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <img src={banner.media_url} alt={banner.title || ""} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${banner.gradient_from || 'hsl(var(--primary))'}, ${banner.gradient_to || 'hsl(var(--primary) / 0.7)'})` }}
        />
      )}
      <div className="relative z-10 p-4 text-left">
        {banner.badge_text && (
          <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full mb-1">
            {banner.badge_text}
          </span>
        )}
        {banner.title && <p className="text-sm font-bold text-white">{banner.title}</p>}
        {banner.subtitle && <p className="text-[11px] text-white/70 mt-0.5">{banner.subtitle}</p>}
      </div>
      {banner.link_url && (
        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
      )}
    </button>
  );
}

/* ── Flash Sale Card ── */
function FlashSaleCard({ sale, onNavigate }: { sale: any; onNavigate: (path: string) => void }) {
  const prod = sale.merchant_products;
  const { h, m, s, expired } = useCountdown(sale.ends_at);
  if (expired) return null;

  return (
    <button
      onClick={() => onNavigate(`/product/${prod?.id || sale.product_id}`)}
      className="w-full rounded-2xl overflow-hidden bg-destructive/10 border border-destructive/20 p-3 flex items-center gap-3 text-left"
    >
      {/* Product image / emoji */}
      <div className="w-14 h-14 rounded-xl bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
        {prod?.image_url ? (
          <img src={prod.image_url} alt={prod?.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl">{prod?.emoji || "⚡"}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-destructive uppercase tracking-wide">⚡ Flash Sale</p>
        <p className="text-sm font-semibold text-foreground truncate">{prod?.name}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-base font-extrabold text-destructive">৳{sale.sale_price}</span>
          <span className="text-xs text-muted-foreground line-through">৳{prod?.price}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[9px] text-muted-foreground">Ends in</p>
        <p className="text-sm font-bold text-foreground tabular-nums">
          {h}h {m}m {s}s
        </p>
      </div>
    </button>
  );
}

export default function ShopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, addToCart, updateQty, removeFromCart, count } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { recentIds } = useRecentlyViewed();
  const [cartOpen, setCartOpen] = useState(false);

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [filters, setFilters] = useState<ShopFilters>(defaultFilters);
  const [shopBanners, setShopBanners] = useState<any[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  

  // Load products
  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data: prods } = await supabase
      .from("merchant_products")
      .select("*, merchants!inner(id, business_name, user_id)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (prods) {
      const merchantIds = [...new Set(prods.map((p: any) => p.merchant_id))];
      const { data: stores } = await (supabase as any)
        .from("vendor_stores")
        .select("merchant_id, slug, store_name")
        .in("merchant_id", merchantIds)
        .eq("is_active", true);

      const storeMap = new Map((stores ?? []).map((s: any) => [s.merchant_id, s]));
      setProducts(prods.map((p: any) => {
        const storeEntry = storeMap.get(p.merchant_id) as { store_name?: string; slug?: string } | undefined;
        return {
          ...p,
          vendor_name: storeEntry?.store_name || (p.merchants as any)?.business_name || "Store",
          vendor_slug: storeEntry?.slug,
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Realtime: re-fetch when merchant_products change
  useEffect(() => {
    const channel = supabase
      .channel("shop-page-products-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_products" }, () => {
        loadProducts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadProducts]);

  // Load shop-specific banners
  useEffect(() => {
    const loadBanners = async () => {
      const { data } = await (supabase as any)
        .from("promo_banners")
        .select("*")
        .eq("is_active", true)
        .in("placement", ["shop", "both"])
        .order("sort_order");
      if (data) setShopBanners(data);
    };
    loadBanners();
  }, []);

  // AI recommendations
  useEffect(() => {
    if (!user) return;
    const loadRecs = async () => {
      setRecsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("product-recommendations", {});
        if (!error && data?.product_ids) setRecommendedIds(data.product_ids);
      } catch { /* ignore */ }
      setRecsLoading(false);
    };
    loadRecs();
  }, [user]);

  // Load flash sales
  useEffect(() => {
    const loadFlash = async () => {
      const { data } = await (supabase as any)
        .from("flash_sales")
        .select("*, merchant_products(id, name, price, image_url, emoji)")
        .eq("is_active", true)
        .lte("starts_at", new Date().toISOString())
        .gte("ends_at", new Date().toISOString());
      if (data) setFlashSales(data);
    };
    loadFlash();
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const availableBrands = useMemo(() => {
    const brands = new Set(
      products
        .filter((p) => selectedCategory === "All" || p.category === selectedCategory)
        .map((p) => p.brand)
        .filter(Boolean) as string[]
    );
    return Array.from(brands).sort();
  }, [products, selectedCategory]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.minPrice !== null) c++;
    if (filters.maxPrice !== null) c++;
    if (filters.minRating !== null) c++;
    if (filters.brands.length > 0) c++;
    return c;
  }, [filters]);

  const filtered = useMemo(() => {
    let result = products;
    if (selectedCategory !== "All") result = result.filter((p) => p.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.vendor_name?.toLowerCase().includes(q)
      );
    }
    if (filters.minPrice !== null) result = result.filter((p) => p.price >= filters.minPrice!);
    if (filters.maxPrice !== null) result = result.filter((p) => p.price <= filters.maxPrice!);
    if (filters.minRating !== null) result = result.filter((p) => p.rating >= filters.minRating!);
    if (filters.brands.length > 0) result = result.filter((p) => p.brand && filters.brands.includes(p.brand));

    switch (sortBy) {
      case "price_low": result = [...result].sort((a, b) => a.price - b.price); break;
      case "price_high": result = [...result].sort((a, b) => b.price - a.price); break;
      case "newest": result = [...result]; break;
      case "rating": result = [...result].sort((a, b) => b.rating - a.rating); break;
      case "popular": result = [...result].sort((a, b) => b.review_count - a.review_count); break;
    }
    return result;
  }, [products, selectedCategory, search, sortBy, filters]);




  const trendingProducts = useMemo(
    () => [...products].sort((a, b) => b.review_count - a.review_count).slice(0, 10),
    [products]
  );

  const recommendedProducts = useMemo(() => {
    if (recommendedIds.length === 0) return [];
    return recommendedIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as ShopProduct[];
  }, [recommendedIds, products]);

  const newArrivals = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return products.filter((p) => p.created_at && p.created_at >= weekAgo).slice(0, 10);
  }, [products]);

  const recentlyViewedProducts = useMemo(() => {
    if (recentIds.length === 0) return [];
    return recentIds.map((id) => products.find((p) => p.id === id)).filter(Boolean).slice(0, 10) as ShopProduct[];
  }, [recentIds, products]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border/30">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4.5 h-4.5" />
          </Button>
          <SearchAutocomplete
            value={search}
            onChange={setSearch}
            onNavigate={navigate}
          />
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-8 w-8" onClick={() => navigate("/wishlist")}>
            <Heart className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-8 w-8" onClick={() => navigate("/orders")}>
            <ClipboardList className="w-4 h-4" />
          </Button>
          <div className="relative">
            <CartDrawer
              items={items}
              onUpdateQty={updateQty}
              onRemove={removeFromCart}
              onCheckout={() => { setCartOpen(false); navigate("/shop/checkout"); }}
              open={cartOpen}
              onOpenChange={setCartOpen}
            />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center pointer-events-none">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </div>
        </div>
        {/* Trust Bar */}
        <div className="flex items-center justify-center gap-6 py-1.5 px-4 border-t border-border/20">
          {[
            { icon: ShieldCheck, label: "Safe Payment" },
            { icon: Truck, label: "Fast Delivery" },
            { icon: RotateCcw, label: "Free Return" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1">
              <Icon className="w-3 h-3 text-primary/70" />
              <span className="text-[9px] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Promo Slider + Shop Banners (directly under header) ── */}
      <Section delay={0.05} className="px-4 pt-3">
        <PromoSlider />
      </Section>

      {shopBanners.length > 0 && !search.trim() && (
        <Section delay={0.07} className="px-4 pt-1 space-y-2">
          {shopBanners.map((banner) => (
            <ShopPromoBanner key={banner.id} banner={banner} onNavigate={navigate} />
          ))}
        </Section>
      )}

      {/* ── Category Icons ── */}
      <Section delay={0.1} className="pt-3">
        <CategoryNav categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
      </Section>

      {/* ── Flash Sale Banner ── */}
      {!loading && flashSales.length > 0 && !search.trim() && selectedCategory === "All" && (
        <Section delay={0.17} className="px-4 pt-3 space-y-2">
          {flashSales.slice(0, 1).map((sale) => (
            <FlashSaleCard key={sale.id} sale={sale} onNavigate={navigate} />
          ))}
        </Section>
      )}

      {/* ── New Arrivals ── */}
      {!loading && newArrivals.length > 0 && !search.trim() && selectedCategory === "All" && (
        <Section delay={0.18} className="pt-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              New Arrivals
            </h2>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2.5 px-4 pb-1">
              {newArrivals.map((p) => (
                <FlashCard key={`new-${p.id}`} product={p} onNavigate={navigate} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Section>
      )}

      {!loading && trendingProducts.length > 0 && !search.trim() && selectedCategory === "All" && (
        <Section delay={0.2} className="pt-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-destructive" />
              Trending Now
            </h2>
            <button className="text-[10px] font-medium text-primary" onClick={() => setSortBy("popular")}>
              See All
            </button>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2.5 px-4 pb-1">
              {trendingProducts.map((p) => (
                <FlashCard key={`flash-${p.id}`} product={p} onNavigate={navigate} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Section>
      )}

      {/* ── Sort & Filter Bar ── */}
      <Section delay={0.25} className="px-4 pt-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-foreground">All Products</h2>
          <div className="flex items-center gap-1">
            <FilterDrawer
              filters={filters}
              onApply={setFilters}
              availableBrands={availableBrands}
              activeCount={activeFilterCount}
            />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-auto h-7 text-xs gap-1 border-0 bg-muted/50 rounded-full px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_low">Price: Low → High</SelectItem>
                <SelectItem value="price_high">Price: High → Low</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </p>
      </Section>

      {/* ── Product Grid ── */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No products found</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-2.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {filtered.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
              >
                <ProductCard
                  product={product}
                  isWishlisted={isWishlisted(product.id)}
                  onAddToCart={addToCart}
                  onToggleWishlist={toggleWishlist}
                  onNavigate={navigate}
                />
              </motion.div>
            ))}
          </motion.div>
        )}


        {/* AI Recommendations */}
        {recommendedProducts.length > 0 && !search.trim() && selectedCategory === "All" && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-bold text-foreground">Recommended For You</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {recommendedProducts.map((product) => (
                <ProductCard
                  key={`rec-${product.id}`}
                  product={product}
                  isWishlisted={isWishlisted(product.id)}
                  onAddToCart={addToCart}
                  onToggleWishlist={toggleWishlist}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </div>
        )}
        {recsLoading && !search.trim() && selectedCategory === "All" && (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-5 w-48" />
            <div className="grid grid-cols-2 gap-2.5">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentlyViewedProducts.length > 0 && !search.trim() && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Recently Viewed
            </h2>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2.5 pb-1">
                {recentlyViewedProducts.map((p) => (
                  <FlashCard key={`recent-${p.id}`} product={p} onNavigate={navigate} />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
