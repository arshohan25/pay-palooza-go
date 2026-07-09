import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import ProductCard, { type ShopProduct } from "@/components/shop/ProductCard";
import { useI18n } from "@/lib/i18n";

export default function WishlistPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const { wishlistIds, toggle, isWishlisted } = useWishlist();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || wishlistIds.size === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("merchant_products")
        .select("*")
        .in("id", Array.from(wishlistIds))
        .eq("is_active", true);

      setProducts((data ?? []).map((p: any) => ({ ...p, vendor_name: "Store" })));
      setLoading(false);
    };
    load();
  }, [user, wishlistIds]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Heart className="w-5 h-5 text-destructive" /> Wishlist
        </h1>
        <span className="text-xs text-muted-foreground ml-auto">{wishlistIds.size} items</span>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Your wishlist is empty</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/shop")}>
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={isWishlisted(product.id)}
                onAddToCart={addToCart}
                onToggleWishlist={toggle}
                onNavigate={navigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
