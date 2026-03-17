import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, ArrowLeft, ShoppingCart, Store, TrendingUp, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import ProductCard, { type ShopProduct } from "@/components/shop/ProductCard";
import CategoryNav from "@/components/shop/CategoryNav";
import CartDrawer from "@/components/shop/CartDrawer";
import FilterDrawer, { type ShopFilters, defaultFilters } from "@/components/shop/FilterDrawer";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";

type SortOption = "popular" | "price_low" | "price_high" | "newest" | "rating";

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
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ShopFilters>(defaultFilters);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  // Load products with vendor info
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: prods } = await supabase
        .from("merchant_products")
        .select("*, merchants!inner(id, business_name, user_id)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (prods) {
        // Get vendor store slugs
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
        if (!error && data?.product_ids) {
          setRecommendedIds(data.product_ids);
        }
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

    if (selectedCategory !== "All") {
      result = result.filter((p) => p.category === selectedCategory);
    }
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

    // Apply advanced filters
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

  const recommendedProducts = useMemo(() => {
    if (recommendedIds.length === 0) return [];
    return recommendedIds.map((id) => products.find((p) => p.id === id)).filter(Boolean) as ShopProduct[];
  }, [recommendedIds, products]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products, brands, stores..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CartDrawer
            items={items}
            onUpdateQty={updateQty}
            onRemove={removeFromCart}
            onCheckout={() => { setCartOpen(false); navigate("/shop/checkout"); }}
            open={cartOpen}
            onOpenChange={setCartOpen}
          />
        </div>

        {/* Categories */}
        <CategoryNav categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />

        {/* Sort & Filter bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1">
            <FilterDrawer
              filters={filters}
              onApply={setFilters}
              availableBrands={availableBrands}
              activeCount={activeFilterCount}
            />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-auto h-7 text-xs gap-1 border-0 bg-muted/50">
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
      </div>

      {/* Product Grid */}
      <div className="px-4 pt-4">
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
          >
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={isWishlisted(product.id)}
                onAddToCart={addToCart}
                onToggleWishlist={toggleWishlist}
                onNavigate={navigate}
              />
            ))}
          </motion.div>
        )}

        {/* AI Recommendations */}
        {recommendedProducts.length > 0 && !search.trim() && selectedCategory === "All" && (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> Recommended For You
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
