import { Star, MapPin, BadgeCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

interface VendorStoreHeaderProps {
  storeName: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  rating: number;
  reviewCount: number;
  productCount: number;
}

export default function VendorStoreHeader({ storeName, description, logoUrl, bannerUrl, rating, reviewCount, productCount }: VendorStoreHeaderProps) {
  return (
    <div className="relative">
      {/* Banner */}
      <div className="h-32 bg-gradient-to-r from-primary/20 to-accent/20 overflow-hidden">
        {bannerUrl && <img src={bannerUrl} alt="" className="w-full h-full object-cover" />}
      </div>

      {/* Store info */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="flex items-end gap-3">
          <div className="w-16 h-16 rounded-xl border-2 border-card bg-card overflow-hidden shadow-md flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">🏪</span>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-lg font-bold text-foreground flex items-center gap-1.5">
              {storeName}
              <BadgeCheck className="w-4 h-4 text-primary" />
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Star className="w-3 h-3 fill-accent text-accent" />
                {rating.toFixed(1)} ({reviewCount})
              </span>
              <span>•</span>
              <span>{productCount} products</span>
            </div>
          </div>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{description}</p>
        )}
      </div>
    </div>
  );
}
