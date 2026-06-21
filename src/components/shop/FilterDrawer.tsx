import { useState } from "react";
import { SlidersHorizontal, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export interface ShopFilters {
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number | null;
  brands: string[];
}

interface FilterDrawerProps {
  filters: ShopFilters;
  onApply: (filters: ShopFilters) => void;
  availableBrands: string[];
  activeCount: number;
}

export const defaultFilters: ShopFilters = {
  minPrice: null,
  maxPrice: null,
  minRating: null,
  brands: [],
};

export default function FilterDrawer({ filters, onApply, availableBrands, activeCount }: FilterDrawerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<ShopFilters>(filters);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setLocal(filters);
    setOpen(isOpen);
  };

  const handleApply = () => {
    onApply(local);
    setOpen(false);
  };

  const handleClear = () => {
    const cleared = { ...defaultFilters };
    setLocal(cleared);
    onApply(cleared);
    setOpen(false);
  };

  const toggleBrand = (brand: string) => {
    setLocal((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <SlidersHorizontal className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("fdTitle")}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Price Range */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("fdPriceRange")}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder={t("fdMin")}
                value={local.minPrice ?? ""}
                onChange={(e) => setLocal((p) => ({ ...p, minPrice: e.target.value ? Number(e.target.value) : null }))}
                className="h-9"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                placeholder={t("fdMax")}
                value={local.maxPrice ?? ""}
                onChange={(e) => setLocal((p) => ({ ...p, maxPrice: e.target.value ? Number(e.target.value) : null }))}
                className="h-9"
              />
            </div>
          </div>

          {/* Rating Filter */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Minimum Rating</p>
            <div className="flex gap-2">
              {[4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  onClick={() => setLocal((p) => ({ ...p, minRating: p.minRating === r ? null : r }))}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                    local.minRating === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/50"
                  )}
                >
                  {r}<Star className="w-3 h-3 fill-accent text-accent" />&up
                </button>
              ))}
            </div>
          </div>

          {/* Brand Filter */}
          {availableBrands.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Brand</p>
              <div className="flex flex-wrap gap-2">
                {availableBrands.map((brand) => (
                  <Badge
                    key={brand}
                    variant={local.brands.includes(brand) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleBrand(brand)}
                  >
                    {brand}
                    {local.brands.includes(brand) && <X className="w-3 h-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={handleClear}>
            Clear All
          </Button>
          <Button className="flex-1" onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
