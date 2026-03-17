import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Heart, ShoppingCart, Star, Store, Share2, Minus, Plus, ChevronRight, Truck, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import ProductImage from "@/components/ProductImage";
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

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { user } = useAuth();
  const [canReview, setCanReview] = useState(false);
  const [deliveredOrderId, setDeliveredOrderId] = useState<string | null>(null);
  const [reviewKey, setReviewKey] = useState(0);

  const [product, setProduct] = useState<any>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState<{ name: string; slug?: string } | null>(null);

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

        // Load vendor store
        const { data: store } = await (supabase as any)
          .from("vendor_stores")
          .select("store_name, slug")
          .eq("merchant_id", prod.merchant_id)
          .eq("is_active", true)
          .maybeSingle();

        setVendorInfo({
          name: store?.store_name || (prod.merchants as any)?.business_name || "Store",
          slug: store?.slug,
        });

        // Load variants
        const { data: vars } = await (supabase as any)
          .from("product_variants")
          .select("*")
          .eq("product_id", id)
          .eq("is_active", true);

        setVariants(vars ?? []);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Check if user can review (has delivered order, hasn't reviewed yet)
  useEffect(() => {
    if (!user || !id) return;
    const checkReview = async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, items")
        .eq("user_id", user.id)
        .eq("status", "delivered");

      const matchingOrder = (orders ?? []).find((o: any) =>
        Array.isArray(o.items) && o.items.some((item: any) => item.id === id || item.product_id === id)
      );

      if (matchingOrder) {
        const { data: existing } = await (supabase as any)
          .from("product_reviews")
          .select("id")
          .eq("product_id", id)
          .eq("user_id", user.id)
          .limit(1);

        if (!existing || existing.length === 0) {
          setCanReview(true);
          setDeliveredOrderId(matchingOrder.id);
        }
      }
    };
    checkReview();
  }, [user, id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="w-full aspect-square rounded-xl" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const images = [product.image_url, ...(product.images || [])].filter(Boolean);
  const finalPrice = product.price + (selectedVariant?.price_adjustment || 0);
  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  const variantGroups = variants.reduce((acc, v) => {
    if (!acc[v.variant_name]) acc[v.variant_name] = [];
    acc[v.variant_name].push(v);
    return acc;
  }, {} as Record<string, Variant[]>);

  const handleAddToCart = () => {
    addToCart({
      ...product,
      price: finalPrice,
      vendor_name: vendorInfo?.name,
      vendor_slug: vendorInfo?.slug,
    }, qty);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border flex items-center justify-between px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => toggleWishlist(product.id)}>
            <Heart className={cn("w-5 h-5", isWishlisted(product.id) ? "fill-destructive text-destructive" : "")} />
          </Button>
          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative">
        <div className="aspect-square bg-muted/30 overflow-hidden">
          {images.length > 0 ? (
            <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">{product.emoji}</div>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 px-4 py-2 overflow-x-auto">
            {images.map((img: string, i: number) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={cn(
                  "w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0",
                  selectedImage === i ? "border-primary" : "border-transparent"
                )}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {product.badge && (
          <Badge className="absolute top-4 left-4" style={{ backgroundColor: product.badge_color || undefined }}>
            {product.badge}
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-4 space-y-3">
        {/* Vendor */}
        {vendorInfo && (
          <button
            onClick={() => vendorInfo.slug && navigate(`/shop/${vendorInfo.slug}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            {vendorInfo.name}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}

        <h1 className="text-xl font-bold text-foreground leading-tight">{product.name}</h1>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < Math.round(product.rating) ? "fill-accent text-accent" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">{product.rating.toFixed(1)} ({product.review_count} reviews)</span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground">৳{finalPrice.toLocaleString()}</span>
          {product.original_price && product.original_price > product.price && (
            <>
              <span className="text-sm text-muted-foreground line-through">৳{product.original_price.toLocaleString()}</span>
              <Badge variant="destructive" className="text-xs">-{discount}%</Badge>
            </>
          )}
        </div>

        {product.stock > 0 && product.stock <= 10 && (
          <p className="text-xs text-destructive font-medium">Only {product.stock} left in stock!</p>
        )}

        <Separator />

        {/* Variants */}
        {Object.entries(variantGroups).map(([name, options]) => (
          <div key={name} className="space-y-2">
            <p className="text-sm font-medium text-foreground">{name}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVariant(selectedVariant?.id === v.id ? null : v)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    selectedVariant?.id === v.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/50"
                  )}
                  disabled={v.stock <= 0}
                >
                  {v.variant_value}
                  {v.price_adjustment !== 0 && (
                    <span className="ml-1 text-muted-foreground">
                      ({v.price_adjustment > 0 ? "+" : ""}৳{v.price_adjustment})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Quantity */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">Quantity</span>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-1">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 flex items-center justify-center">
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-sm font-medium">{qty}</span>
            <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="w-8 h-8 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <Separator />

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Truck, label: "Fast Delivery" },
            { icon: ShieldCheck, label: "Genuine Product" },
            { icon: RefreshCw, label: "Easy Returns" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 py-2 bg-muted/30 rounded-lg">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground text-center">{label}</span>
            </div>
          ))}
        </div>

        {/* Tabs: Description / Reviews */}
        <Tabs defaultValue="description" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="description" className="flex-1">Description</TabsTrigger>
            <TabsTrigger value="reviews" className="flex-1">Reviews ({product.review_count})</TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description || "No description available."}
            </p>
            {(product as any).brand && (
              <p className="text-xs text-muted-foreground mt-2">Brand: <span className="font-medium text-foreground">{(product as any).brand}</span></p>
            )}
            {(product as any).sku && (
              <p className="text-xs text-muted-foreground">SKU: {(product as any).sku}</p>
            )}
          </TabsContent>
          <TabsContent value="reviews" className="mt-3 -mx-4">
            <ProductReviews productId={product.id} key={reviewKey} />
            {canReview && (
              <div className="px-4 mt-4">
                <WriteReviewForm
                  productId={product.id}
                  orderId={deliveredOrderId ?? undefined}
                  onSuccess={() => { setCanReview(false); setReviewKey((k) => k + 1); }}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold text-foreground">৳{(finalPrice * qty).toLocaleString()}</p>
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Add to Cart
        </Button>
        <Button
          size="lg"
          onClick={() => { handleAddToCart(); navigate("/shop/checkout"); }}
          disabled={product.stock <= 0}
        >
          Buy Now
        </Button>
      </div>
    </div>
  );
}
