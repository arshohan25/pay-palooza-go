import { Heart, Star, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProductImage from "@/components/ProductImage";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface ShopProduct {
  id: string;
  merchant_id: string;
  name: string;
  price: number;
  original_price?: number | null;
  rating: number;
  review_count: number;
  emoji: string;
  category: string;
  description?: string | null;
  badge?: string | null;
  badge_color?: string | null;
  stock: number;
  image_url?: string | null;
  images?: string[] | null;
  sku?: string | null;
  brand?: string | null;
  tags?: string[] | null;
  vendor_name?: string;
  vendor_slug?: string;
  created_at?: string;
}

interface ProductCardProps {
  product: ShopProduct;
  isWishlisted?: boolean;
  onAddToCart: (product: ShopProduct) => void;
  onToggleWishlist: (productId: string) => void;
  onNavigate: (path: string) => void;
}

export default function ProductCard({ product, isWishlisted, onAddToCart, onToggleWishlist, onNavigate }: ProductCardProps) {
  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <div
      className="bg-card rounded-2xl border border-border/40 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group"
      onClick={() => onNavigate(`/product/${product.id}`)}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted/30 overflow-hidden">
        <ProductImage
          imageUrl={product.image_url}
          emoji={product.emoji}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.badge && (
          <Badge className="absolute top-2 left-2 text-[10px] font-semibold" style={{ backgroundColor: product.badge_color || undefined }}>
            {product.badge}
          </Badge>
        )}
        {discount > 0 && (
          <Badge variant="destructive" className="absolute top-2 right-10 text-[10px]">
            -{discount}%
          </Badge>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWishlist(product.id); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-card/80 backdrop-blur flex items-center justify-center"
        >
          <Heart className={cn("w-3.5 h-3.5", isWishlisted ? "fill-destructive text-destructive" : "text-muted-foreground")} />
        </button>
        {product.stock <= 0 && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-sm font-semibold text-destructive">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-medium text-foreground truncate leading-tight">{product.name}</h3>
        <div className="flex items-center gap-1">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs text-muted-foreground">{product.rating.toFixed(1)} ({product.review_count})</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-base font-extrabold", discount > 0 ? "text-primary" : "text-foreground")}>
              ৳{product.price.toLocaleString()}
            </span>
            {product.original_price && product.original_price > product.price && (
              <span className="text-xs text-muted-foreground line-through">৳{product.original_price.toLocaleString()}</span>
            )}
          </div>
          <Button
            size="icon"
            className="h-7 w-7 rounded-full"
            disabled={product.stock <= 0}
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
