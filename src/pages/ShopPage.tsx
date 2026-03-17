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

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

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

    switch (sortBy) {
      case "price_low": result = [...result].sort((a, b) => a.price - b.price); break;
      case "price_high": result = [...result].sort((a, b) => b.price - a.price); break;
      case "newest": result = [...result]; break; // already sorted by created_at desc
      case "rating": result = [...result].sort((a, b) => b.rating - a.rating); break;
      case "popular": result = [...result].sort((a, b) => b.review_count - a.review_count); break;
    }

    return result;
  }, [products, selectedCategory, search, sortBy]);

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
            onCheckout={() => { setCartOpen(false); navigate("/"); }}
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
      </div>
    </div>
  );
}
