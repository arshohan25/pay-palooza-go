import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import ProductCard, { type ShopProduct } from "@/components/shop/ProductCard";
import CategoryNav from "@/components/shop/CategoryNav";
import VendorStoreHeader from "@/components/shop/VendorStoreHeader";
import CartDrawer from "@/components/shop/CartDrawer";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";

export default function VendorStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { items, addToCart, updateQty, removeFromCart } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const [cartOpen, setCartOpen] = useState(false);

  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      // Fetch store
      const { data: storeData } = await (supabase as any)
        .from("vendor_stores")
        .select("*, merchants!inner(id, business_name)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!storeData) {
        setLoading(false);
        return;
      }
      setStore(storeData);

      // Fetch products
      const { data: prods } = await supabase
        .from("merchant_products")
        .select("*")
        .eq("merchant_id", storeData.merchant_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      setProducts(
        (prods ?? []).map((p: any) => ({
          ...p,
          vendor_name: storeData.store_name,
          vendor_slug: slug,
        }))
      );
      setLoading(false);
    };
    load();
  }, [slug]);

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category));
    return Array.from(cats).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let result = products;
    if (selectedCategory !== "All") result = result.filter((p) => p.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [products, selectedCategory, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="px-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Store not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header bar */}
      <div className="sticky top-0 z-40 gradient-hero text-primary-foreground backdrop-blur-lg border-b border-primary/30 shadow-glow flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-semibold text-sm text-foreground">{store.store_name}</span>
        <CartDrawer
          items={items}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
          onCheckout={() => { setCartOpen(false); navigate("/"); }}
          open={cartOpen}
          onOpenChange={setCartOpen}
        />
      </div>

      <VendorStoreHeader
        storeName={store.store_name}
        description={store.description}
        logoUrl={store.logo_url}
        bannerUrl={store.banner_url}
        rating={store.rating}
        reviewCount={store.review_count}
        productCount={products.length}
      />

      {/* Search */}
      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search this store..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <CategoryNav categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />

      {/* Products */}
      <div className="px-4 pt-2">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No products found</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        )}
      </div>
    </div>
  );
}
