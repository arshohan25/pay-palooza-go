import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, CircleCheck, Truck, Package, XCircle, MapPin,
  CreditCard, Wallet, Star, Loader2, Ban, Shield, Download, Printer,
  ExternalLink, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadInvoice, printInvoice } from "@/components/InvoiceGenerator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink as SafeExternalLink } from "@/components/ExternalLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOrderNotifications } from "@/hooks/use-order-notifications";
import WriteReviewForm from "@/components/shop/WriteReviewForm";
import { toast } from "sonner";
import ProductImage from "@/components/ProductImage";

const STATUS_STEPS = [
  { key: "processing", label: "Order Placed", icon: Clock, color: "hsl(36 100% 50%)" },
  { key: "confirmed", label: "Confirmed", icon: CircleCheck, color: "hsl(291 64% 42%)" },
  { key: "shipped", label: "Shipped", icon: Package, color: "hsl(207 90% 54%)" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck, color: "hsl(14 100% 57%)" },
  { key: "delivered", label: "Delivered", icon: CircleCheck, color: "hsl(122 39% 49%)" },
];

const ESCROW_LABELS: Record<string, { label: string; color: string }> = {
  held: { label: "Funds Held in Escrow", color: "text-amber-600" },
  released: { label: "Funds Released to Vendor", color: "text-emerald-600" },
  refunded: { label: "Refunded to Wallet", color: "text-blue-600" },
};

const RETURN_REASONS = [
  "Defective or damaged product",
  "Wrong item received",
  "Product not as described",
  "Changed my mind",
  "Quality not satisfactory",
  "Other",
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reviewSheet, setReviewSheet] = useState<{ productId: string; orderId: string } | null>(null);
  const [courierProvider, setCourierProvider] = useState<any>(null);
  // Return request state
  const [returnSheet, setReturnSheet] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnDetails, setReturnDetails] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [existingReturn, setExistingReturn] = useState<any>(null);

  useOrderNotifications((update) => {
    if (update.id === id) {
      setOrder((prev: any) => prev ? { ...prev, status: update.status } : prev);
    }
  });

  useEffect(() => {
    if (!authLoading && !user) { setLoading(false); return; }
    if (!user || !id) return;
    const load = async () => {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).eq("user_id", user.id).single(),
        supabase.from("order_items").select("*").eq("order_id", id),
      ]);
      if (orderRes.data) {
        setOrder(orderRes.data);
        // Load courier provider if exists
        if (orderRes.data.courier_provider_id) {
          const { data: cp } = await supabase
            .from("courier_providers")
            .select("*")
            .eq("id", orderRes.data.courier_provider_id)
            .single();
          if (cp) setCourierProvider(cp);
        }
      }
      if (itemsRes.data) setItems(itemsRes.data);
      // Check for existing return request
      const { data: returnData } = await (supabase as any)
        .from("return_requests")
        .select("*")
        .eq("order_id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (returnData) setExistingReturn(returnData);
      setLoading(false);
    };
    load();
  }, [user, id, authLoading]);

  const handleCancel = async () => {
    if (!order || cancelling) return;
    setCancelling(true);
    try {
      const { error } = await supabase.from("orders").update({ status: "cancelled" } as any).eq("id", order.id).eq("user_id", user!.id);
      if (error) throw error;
      setOrder((prev: any) => ({ ...prev, status: "cancelled" }));
      toast.success("Order cancelled · Refund will be processed within 24 hours");
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel order");
    }
    setCancelling(false);
  };

  const handleReturnRequest = async () => {
    if (!returnReason || !order || !user) return;
    setSubmittingReturn(true);
    try {
      const { error } = await (supabase as any)
        .from("return_requests")
        .insert({
          order_id: order.id,
          user_id: user.id,
          reason: returnReason,
          details: returnDetails || null,
        });
      if (error) throw error;
      setExistingReturn({ status: "pending", reason: returnReason });
      setReturnSheet(false);
      setReturnReason("");
      setReturnDetails("");
      toast.success("Return request submitted");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit return request");
    }
    setSubmittingReturn(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-40 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Package className="w-16 h-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">{!user ? "Please log in to view this order" : "Order not found"}</p>
        <Button variant="outline" onClick={() => navigate(!user ? "/auth" : "/orders")}>{!user ? "Log In" : "Back to Orders"}</Button>
      </div>
    );
  }

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";
  const isShipped = ["shipped", "out_for_delivery", "delivered"].includes(order.status);
  const canCancel = order.status === "processing";
  const canReturn = isDelivered && !existingReturn;
  const escrow = ESCROW_LABELS[order.escrow_status] ?? null;
  const orderItems = items.length > 0 ? items : (Array.isArray(order.items) ? order.items : []);
  const subtotal = orderItems.reduce((s: number, i: any) => s + (Number(i.price) * Number(i.qty || i.quantity || 1)), 0);
  const couponDiscount = Number(order.coupon_discount) || 0;
  const deliveryFee = Number(order.delivery_fee) || 0;

  // Build tracking URL
  const trackingUrl = order.tracking_number && courierProvider?.tracking_url_template
    ? courierProvider.tracking_url_template.replace("{tracking_number}", order.tracking_number)
    : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b border-border flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-foreground truncate">{order.order_num}</h1>
          <p className="text-[11px] text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${isCancelled ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          {isCancelled ? "Cancelled" : STATUS_STEPS[currentStepIdx]?.label ?? order.status}
        </Badge>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Status Timeline */}
        {!isCancelled && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Order Tracking</p>
            <div className="space-y-0">
              {STATUS_STEPS.map((step, i) => {
                const done = i <= currentStepIdx;
                const isCurrent = i === currentStepIdx;
                const Icon = step.icon;
                const isLast = i === STATUS_STEPS.length - 1;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          done ? "text-primary-foreground" : "bg-muted text-muted-foreground"
                        } ${isCurrent ? "ring-2 ring-offset-2 ring-offset-card" : ""}`}
                        style={done ? { background: step.color, ...(isCurrent ? { ringColor: step.color } : {}) } : {}}
                      >
                        <Icon className="w-4 h-4" />
                      </motion.div>
                      {!isLast && (
                        <div className={`w-0.5 flex-1 min-h-[24px] my-1 rounded-full transition-colors ${done ? "bg-primary/30" : "bg-border"}`} />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <p className={`text-[13px] font-bold ${done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</p>
                      {done && i === 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(order.created_at).toLocaleDateString("en-BD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Courier Tracking */}
            {isShipped && order.tracking_number && (
              <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-xl px-3 py-2">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Tracking: <span className="font-semibold text-foreground">{order.tracking_number}</span></span>
                {trackingUrl && (
                  <SafeExternalLink href={trackingUrl} className="ml-auto text-primary flex items-center gap-1 font-semibold hover:underline">
                    Track <ExternalLink className="w-3 h-3" />
                  </SafeExternalLink>
                )}
              </div>
            )}
            {order.estimated_delivery && !isDelivered && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
                <Truck className="w-3.5 h-3.5" />
                <span>Estimated delivery: {order.estimated_delivery}</span>
              </div>
            )}
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-bold text-destructive">Order Cancelled</p>
              <p className="text-xs text-muted-foreground mt-0.5">Refund will be processed within 24 hours</p>
            </div>
          </div>
        )}

        {/* Return Request Status */}
        {existingReturn && (
          <div className={`rounded-2xl border p-4 flex items-center gap-3 ${
            existingReturn.status === "approved" ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800" :
            existingReturn.status === "rejected" ? "bg-destructive/5 border-destructive/20" :
            "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
          }`}>
            <RotateCcw className="w-6 h-6 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Return {existingReturn.status === "approved" ? "Approved" : existingReturn.status === "rejected" ? "Rejected" : "Requested"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{existingReturn.reason}</p>
            </div>
            <Badge variant="outline" className="shrink-0 capitalize">{existingReturn.status}</Badge>
          </div>
        )}

        {/* Escrow Status */}
        {escrow && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className={`text-xs font-semibold ${escrow.color}`}>{escrow.label}</span>
          </div>
        )}

        {/* Items */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Items ({orderItems.length})
          </p>
          {orderItems.map((item: any, i: number) => (
            <div key={item.id || i} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                <ProductImage imageUrl={item.image_url} emoji={item.emoji || "📦"} alt={item.name || item.product_name} emojiSize="text-2xl" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">{item.name || item.product_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Qty: {item.qty || item.quantity || 1}
                  {item.vendor_name && <> · <span className="text-primary">{item.vendor_name}</span></>}
                </p>
              </div>
              <p className="text-[13px] font-bold text-foreground shrink-0">
                ৳{(Number(item.price) * Number(item.qty || item.quantity || 1)).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Payment Summary */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Payment Summary</p>
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-foreground">৳{subtotal.toLocaleString()}</span>
          </div>
          {couponDiscount > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-primary">Coupon Discount</span>
              <span className="font-semibold text-primary">-৳{couponDiscount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px]">
            <span className="text-muted-foreground">Delivery</span>
            <span className="font-semibold text-foreground">{deliveryFee > 0 ? `৳${deliveryFee.toLocaleString()}` : "Free"}</span>
          </div>
          <div className="h-px bg-border my-1" />
          <div className="flex justify-between text-[15px] font-bold">
            <span className="text-foreground">Total</span>
            <span className="text-primary">৳{Number(order.total).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            {order.payment_method === "wallet" ? (
              <><Wallet className="w-3.5 h-3.5" /> Paid via EasyPay Wallet</>
            ) : (
              <><CreditCard className="w-3.5 h-3.5" /> Paid via Card</>
            )}
          </div>
        </div>

        {/* Shipping Info */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Shipping Details</p>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-foreground">{order.shipping_name}</p>
              <p className="text-[12px] text-muted-foreground">{order.shipping_phone}</p>
              <p className="text-[12px] text-muted-foreground">{order.shipping_address}, {order.shipping_city}</p>
            </div>
          </div>
        </div>

        {/* Invoice Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => downloadInvoice(order)}>
            <Download className="w-4 h-4" /> Download Invoice
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={() => printInvoice(order)}>
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {canCancel && (
            <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              Cancel Order
            </Button>
          )}
          <div className="flex gap-3">
            {isDelivered && orderItems.length > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setReviewSheet({ productId: orderItems[0].product_id || orderItems[0].id, orderId: order.id })}>
                <Star className="w-4 h-4 mr-2" /> Rate & Review
              </Button>
            )}
            {canReturn && (
              <Button variant="outline" className="flex-1" onClick={() => setReturnSheet(true)}>
                <RotateCcw className="w-4 h-4 mr-2" /> Request Return
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Review Sheet */}
      <Sheet open={!!reviewSheet} onOpenChange={(o) => !o && setReviewSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Write a Review</SheetTitle>
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

      {/* Return Request Sheet */}
      <Sheet open={returnSheet} onOpenChange={setReturnSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Request a Return</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Reason for return</p>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Additional details (optional)</p>
              <Textarea
                value={returnDetails}
                onChange={(e) => setReturnDetails(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
              />
            </div>
            <Button
              className="w-full"
              disabled={!returnReason || submittingReturn}
              onClick={handleReturnRequest}
            >
              {submittingReturn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Submit Return Request
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
