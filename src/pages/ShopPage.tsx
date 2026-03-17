import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, ArrowLeft, ShoppingCart, Store, Sparkles, Loader2,
  ShieldCheck, Truck, RotateCcw, Flame, Ticket, ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import ProductCard, { type ShopProduct } from "@/components/shop/ProductCard";
import CategoryNav from "@/components/shop/CategoryNav";
import CartDrawer from "@/components/shop/CartDrawer";
import FilterDrawer, { type ShopFilters, defaultFilters } from "@/components/shop/FilterDrawer";
import PromoSlider from "@/components/PromoSlider";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type SortOption = "popular" | "price_low" | "price_high" | "newest" | "rating";

/* ── Section wrapper with staggered entry ── */
const Section = ({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay, ease: [0.23, 1, 0.32, 1] }}
    className={className}
  >
    {children}
  </motion.section>
);

/* ── Mini product card for flash sale row ── */
function FlashCard({ product, onNavigate }: { product: ShopProduct; onNavigate: (path: string) => void }) {
  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <button
      onClick={() => onNavigate(`/product/${product.id}`)}
      className="min-w-[130px] max-w-[130px] shrink-0 rounded-xl bg-card border border-border/50 overflow-hidden text-left group shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
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
      <div className="p-2 space-y-0.5">
        <p className="text-xs font-semibold text-foreground truncate">{product.name}</p>
        <p className="text-xs font-bold text-primary">৳{product.price.toLocaleString()}</p>
        {product.original_price && (
          <p className="text-[10px] text-muted-foreground line-through">৳{product.original_price.toLocaleString()}</p>
        )}
      </div>
    </button>
  );
}

export default function ShopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, addToCart, updateQty, removeFromCart, count } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const [cartOpen, setCartOpen] = useState(false);

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [filters, setFilters] = useState<ShopFilters>(defaultFilters);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  // Load products
  useEffect(() => {
    const load = async () => {
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
    };
    load();
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products, brands, stores..."
              className="pl-9 h-9 text-sm rounded-full border-border/50 bg-muted/40 focus-visible:ring-primary/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
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
      </div>

      {/* ── Trust Bar ── */}
      <Section delay={0.05}>
        <div className="flex items-center justify-around py-2.5 px-4 bg-muted/40 border-b border-border/30">
          {[
            { icon: ShieldCheck, label: "Safe Payment" },
            { icon: Truck, label: "Fast Delivery" },
            { icon: RotateCcw, label: "Free Return" },
          ].map(({ icon: Icon, label }, i) => (
            <div key={label} className="flex items-center gap-1.5">
              {i > 0 && <div className="w-px h-4 bg-border/60 mr-3" />}
              <Icon className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Promo Slider ── */}
      <Section delay={0.1} className="px-4 pt-4">
        <PromoSlider />
      </Section>

      {/* ── Category Icons ── */}
      <Section delay={0.15} className="pt-4">
        <CategoryNav categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
      </Section>

      {/* ── Voucher / Deals Banner ── */}
      <Section delay={0.2} className="px-4">
        <button
          className="w-full rounded-2xl p-4 flex items-center gap-3 overflow-hidden relative"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))" }}
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <Ticket className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-primary-foreground">Collect Vouchers</p>
            <p className="text-[10px] text-primary-foreground/70">Save up to ৳500 on your next order</p>
          </div>
          <ChevronRight className="w-5 h-5 text-primary-foreground/60 shrink-0" />
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
        </button>
      </Section>

      {/* ── Flash Sale / Trending ── */}
      {!loading && trendingProducts.length > 0 && !search.trim() && selectedCategory === "All" && (
        <Section delay={0.25} className="pt-5">
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
            <div className="flex gap-3 px-4 pb-1">
              {trendingProducts.map((p) => (
                <FlashCard key={`flash-${p.id}`} product={p} onNavigate={navigate} />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Section>
      )}

      {/* ── Sort & Filter Bar ── */}
      <Section delay={0.3} className="px-4 pt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            Just For You
          </h2>
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
        <p className="text-[10px] text-muted-foreground -mt-1 mb-3">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </p>
      </Section>

      {/* ── Product Grid ── */}
      <div className="px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Store className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No products found</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-3"
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
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </motion.span>
              Recommended For You
            </h2>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
