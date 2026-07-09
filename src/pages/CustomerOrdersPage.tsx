import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, ChevronRight, Clock, CircleCheck, Truck, XCircle, Loader2, Star, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import WriteReviewForm from "@/components/shop/WriteReviewForm";
import { downloadInvoice } from "@/components/InvoiceGenerator";

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: any }> = {
  processing: { labelKey: "processing", color: "bg-blue-500/10 text-blue-600", icon: Clock },
  confirmed: { labelKey: "confirmed2", color: "bg-primary/10 text-primary", icon: CircleCheck },
  shipped: { labelKey: "shipped", color: "bg-accent/10 text-accent", icon: Truck },
  out_for_delivery: { labelKey: "outForDelivery", color: "bg-orange-500/10 text-orange-600", icon: Truck },
  delivered: { labelKey: "delivered", color: "bg-emerald-500/10 text-emerald-600", icon: CircleCheck },
  cancelled: { labelKey: "cancelled", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

export default function CustomerOrdersPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewSheet, setReviewSheet] = useState<{ open: boolean; productId: string; orderId: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { setLoading(false); return; }
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setOrders(data ?? []);
      setLoading(false);
    };
    load();
  }, [user, authLoading]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Package className="w-5 h-5" /> {t("myOrders")}
        </h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
        ) : !user ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("coPleaseLogIn")}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/auth")}>{t("coLogIn")}</Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("noOrdersYet")}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/shop")}>
              {t("startShopping")}
            </Button>
          </div>
        ) : (
          orders.map((order) => {
            const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.processing;
            const StatusIcon = config.icon;
            const items = Array.isArray(order.items) ? order.items : [];

            return (
              <div
                key={order.id}
                className="bg-card rounded-xl border border-border p-4 space-y-2 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{order.order_num}</span>
                  <Badge variant="outline" className={config.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {t(config.labelKey as any)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{items.length} {items.length !== 1 ? t("moItems") : t("moItem")}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-sm font-bold text-foreground">৳{Number(order.total).toLocaleString()}</span>
                </div>
                {order.estimated_delivery && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Truck className="w-3 h-3" /> {t("estDelivery")}: {order.estimated_delivery}
                  </p>
                )}
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={(e) => { e.stopPropagation(); downloadInvoice(order); }}
                  >
                    <FileText className="w-3 h-3 mr-1" /> {t("coInvoice")}
                  </Button>
                  {order.status === "delivered" && items.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReviewSheet({ open: true, productId: items[0].id || items[0].product_id, orderId: order.id });
                      }}
                    >
                      <Star className="w-3 h-3 mr-1" /> {t("coRateReview")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Review Sheet */}
      <Sheet open={!!reviewSheet?.open} onOpenChange={(o) => !o && setReviewSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("wrWriteReview")}</SheetTitle>
          </SheetHeader>
          {reviewSheet && (
            <WriteReviewForm
              productId={reviewSheet.productId}
              orderId={reviewSheet.orderId}
              onSuccess={() => setReviewSheet(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
