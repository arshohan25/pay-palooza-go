import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Trash2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductImage from "@/components/ProductImage";
import { useI18n } from "@/lib/i18n";
import type { ShopProduct } from "./ProductCard";

export interface CartItem extends ShopProduct {
  qty: number;
}

interface CartDrawerProps {
  items: CartItem[];
  onUpdateQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CartDrawer({ items, onUpdateQty, onRemove, onCheckout, open, onOpenChange }: CartDrawerProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="w-5 h-5" />
          {count > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
              {count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> {t("cart")} ({count})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            {t("yourCartEmpty")}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                    <ProductImage imageUrl={item.image_url} emoji={item.emoji} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1 cursor-pointer hover:text-primary transition-colors" onClick={() => { onOpenChange(false); navigate(`/product/${item.id}`); }}>{item.name}</p>
                    {item.vendor_name && <p className="text-[11px] text-muted-foreground">{item.vendor_name}</p>}
                    <p className="text-sm font-bold text-foreground mt-0.5">৳{(item.price * item.qty).toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => onUpdateQty(item.id, item.qty - 1)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-medium w-5 text-center">{item.qty}</span>
                      <button onClick={() => onUpdateQty(item.id, item.qty + 1)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => onRemove(item.id)} className="ml-auto text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between text-base font-bold">
                <span>{t("total")}</span>
                <span>৳{total.toLocaleString()}</span>
              </div>
              <Button className="w-full" size="lg" onClick={() => { onOpenChange(false); navigate("/shop/checkout"); }}>
                {t("proceedToCheckout")}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
