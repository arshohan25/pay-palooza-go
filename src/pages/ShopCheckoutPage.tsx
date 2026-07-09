import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Wallet, CreditCard, ShoppingCart, Package,
  X, Ticket, Gift, AlertCircle, Loader2, Truck, Smartphone, Ban,
} from "lucide-react";
import AddressManager from "@/components/shop/AddressManager";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/use-cart";
import type { CartItem } from "@/components/shop/CartDrawer";
import { useAuth } from "@/hooks/use-auth";
import { getBalance, onBalanceChange } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import SlideToConfirm from "@/components/SlideToConfirm";
import ProductImage from "@/components/ProductImage";
import { useI18n } from "@/lib/i18n";

interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  area: string | null;
  city: string;
  is_default: boolean;
}

interface AppliedCoupon {
  code: string;
  discount: number;
  coupon_id: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
}
interface CheckoutPaymentMethod {
  id: string;
  key: string;
  label: string;
  icon: string;
  description: string | null;
  is_enabled: boolean;
  sort_order: number;
}
const PAY_ICON_MAP: Record<string, any> = { wallet: Wallet, truck: Truck, smartphone: Smartphone, "credit-card": CreditCard };

interface DeliveryZone {
  id: string;
  zone_name: string;
  cities: string[];
  delivery_fee: number;
  estimated_days: string;
  courier_providers: { name: string } | null;
}

export default function ShopCheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const cart = useCart();
  const { t } = useI18n();

  // Buy Now: a single product passed via navigation state bypasses the cart entirely.
  // Capture once on mount so re-renders / state-loss don't drop the item.
  // Fall back to sessionStorage in case the navigation state was cleared (e.g. refresh, lazy-load race).
  const [buyNowItem] = useState<CartItem | undefined>(() => {
    const fromState = (location.state as any)?.buyNowItem as CartItem | undefined;
    if (fromState) {
      try { sessionStorage.setItem("easypay_buy_now", JSON.stringify(fromState)); } catch {}
      return fromState;
    }
    try {
      const raw = sessionStorage.getItem("easypay_buy_now");
      return raw ? (JSON.parse(raw) as CartItem) : undefined;
    } catch { return undefined; }
  });
  const isBuyNow = !!buyNowItem;

  const items: CartItem[] = isBuyNow ? [buyNowItem!] : cart.items;
  const subtotal = isBuyNow ? buyNowItem!.price * buyNowItem!.qty : cart.total;
  const count = isBuyNow ? buyNowItem!.qty : cart.count;
  const clearCart = isBuyNow
    ? () => { try { sessionStorage.removeItem("easypay_buy_now"); } catch {} }
    : cart.clearCart;

  const [walletBalance, setWalletBalance] = useState(getBalance());
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [payMethod, setPayMethod] = useState("wallet");
  const [paymentMethods, setPaymentMethods] = useState<CheckoutPaymentMethod[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedCoupon | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderNum, setOrderNum] = useState("");
  const [orderId, setOrderId] = useState("");
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  // Redirect if cart is empty and not showing success (skip for Buy Now)
  useEffect(() => {
    if (isBuyNow) return;
    if (items.length === 0 && !success) {
      navigate("/shop", { replace: true });
    }
  }, [items.length, success, navigate, isBuyNow]);

  // Listen to balance changes
  useEffect(() => {
    const unsub = onBalanceChange(setWalletBalance);
    return () => { unsub(); };
  }, []);

  // Load delivery zones + payment methods
  useEffect(() => {
    if (!user) return;
    supabase
      .from("delivery_zones")
      .select("*, courier_providers(name)")
      .eq("is_active", true)
      .then(({ data }) => setDeliveryZones((data as any[]) ?? []));
    supabase
      .from("checkout_payment_methods")
      .select("*")
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => setPaymentMethods((data as any[]) ?? []));
  }, [user]);

  // Match delivery zone by city
  const matchedZone = selectedAddress
    ? deliveryZones.find((z) =>
        z.cities.some((c) => c.toLowerCase() === selectedAddress.city.toLowerCase())
      )
    : null;
  const deliveryFee = matchedZone?.delivery_fee ?? 0;

  const discountAmt = appliedPromo ? Math.min(appliedPromo.discount, subtotal) : 0;
  const orderTotal = Math.max(0, subtotal - discountAmt + deliveryFee);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (appliedPromo?.code === code) { toast.error(t("scpAlreadyApplied")); return; }
    setPromoLoading(true);
    try {
      const { data, error } = await supabase.rpc("validate_and_apply_coupon", {
        p_code: code,
        p_cart_total: subtotal,
        p_merchant_id: null,
      });
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (error || !result?.valid) {
        toast.error(result?.error || error?.message || t("scpInvalidCoupon"));
        setPromoLoading(false);
        return;
      }
      setAppliedPromo({
        code: result.code,
        discount: result.discount_amount,
        coupon_id: result.coupon_id,
        discount_type: result.discount_type,
        discount_value: result.discount_value,
        max_discount: result.max_discount,
      });
      toast.success(`🎉 ৳${Math.round(result.discount_amount).toLocaleString()} ${t("scpDiscountApplied")}`);
    } catch (e: any) {
      toast.error(e.message || t("scpFailedValidate"));
    }
    setPromoLoading(false);
  };

  const isCod = payMethod === "cod";
  const needsPin = payMethod === "wallet";

  const handleCheckout = async () => {
    if (needsPin && pin.length < 4) { setPinError(t("scpEnterPin")); return; }
    if (!selectedAddress) { toast.error(t("scpSelectAddress")); return; }
    if (processing) return;
    setProcessing(true);
    setPinError("");

    if (needsPin) {
      const pinValid = await verifyPin(pin);
      if (!pinValid) {
        setPinError(t("scpIncorrectPin"));
        setPin("");
        setProcessing(false);
        return;
      }
    }
    haptics.success();

    if (payMethod === "wallet" && orderTotal > walletBalance) {
      toast.error(t("scpInsufficientBalance"));
      setProcessing(false);
      return;
    }

    try {
      const itemsPayload = items.map((c) => ({
        product_id: c.id,
        merchant_id: c.merchant_id || null,
        name: c.name,
        price: c.price,
        qty: c.qty,
        emoji: c.emoji,
        image_url: c.image_url || null,
        vendor_name: c.vendor_name,
      }));

      const { data, error } = await supabase.rpc("place_shop_order", {
        p_items: itemsPayload,
        p_shipping_name: selectedAddress.recipient_name,
        p_shipping_address: `${selectedAddress.address_line}${selectedAddress.area ? ", " + selectedAddress.area : ""}`,
        p_shipping_city: selectedAddress.city,
        p_shipping_phone: selectedAddress.phone,
        p_delivery_fee: deliveryFee,
        p_coupon_id: appliedPromo?.coupon_id || null,
        p_coupon_discount: discountAmt,
        p_payment_method: payMethod,
      });

      if (error) throw error;
      const result = typeof data === "string" ? JSON.parse(data) : data;
      if (!result?.success) throw new Error("Order placement failed");

      setOrderNum(result.order_num);
      setOrderId(result.order_id);
      if (payMethod === "wallet") setWalletBalance(result.balance);
      fireSuccessConfetti();
      clearCart();
      setSuccess(true);
    } catch (e: any) {
      toast.error(e.message ?? t("scpPaymentFailed"));
      setPin("");
    }
    setProcessing(false);
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shop")} className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-bold text-primary-foreground">{t("scpOrderPlaced")}</h1>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 pt-16 flex flex-col items-center text-center space-y-5"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-lg bg-primary/10 ring-2 ring-primary/20"
          >
            🎉
          </motion.div>
          <div>
            <h2 className="text-xl font-extrabold text-foreground">{t("scpOrderConfirmed")}</h2>
            <p className="text-muted-foreground text-sm mt-1">{t("scpOrderSuccess")}</p>
            <p className="text-xs font-mono font-semibold mt-2 text-muted-foreground">{orderNum}</p>
          </div>
          <div className="w-full bg-card rounded-2xl border border-border p-4 space-y-2 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("scpDeliveryInfo")}</p>
            <div className="flex items-center gap-2 text-sm">
              <span>📦</span>
              <span className="font-semibold text-foreground">{t("scpEstDays")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {isCod ? <Truck className="w-3.5 h-3.5 text-primary" /> : <Wallet className="w-3.5 h-3.5 text-primary" />}
              <span className="font-semibold text-foreground">
                {isCod ? t("scpPayOnDelivery").replace("{n}", orderTotal.toLocaleString()) : t("scpDeductedWallet").replace("{n}", orderTotal.toLocaleString())}
              </span>
            </div>
            {selectedAddress && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-xs">
                  {selectedAddress.address_line}, {selectedAddress.city}
                </span>
              </div>
            )}
          </div>
          <div className="w-full flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => navigate(`/orders/${orderId}`)}
            >
              <Package className="w-4 h-4 mr-2" />
              {t("scpViewOrder")}
            </Button>
            <Button
              className="flex-1 h-12"
              onClick={() => navigate("/shop")}
            >
              {t("scpContinueShopping")}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 gradient-hero text-primary-foreground border-b border-primary/30 shadow-glow px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold text-primary-foreground">{t("scpCheckout")}</h1>
        <span className="text-xs text-primary-foreground/80 ml-auto">{count} {t("scpItems")}</span>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Delivery Address */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("scpDeliveryAddress")}</p>
          {user && (
            <AddressManager
              userId={user.id}
              onSelect={(addr) => setSelectedAddress(addr)}
              selectedId={selectedAddress?.id}
              compact
            />
          )}
        </div>

        {/* Payment Method */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("scpPaymentMethod")}
          </p>
          {paymentMethods.length === 0 ? (
            <button
              onClick={() => setPayMethod("wallet")}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors text-left ${
                payMethod === "wallet" ? "border-primary/30 bg-primary/5" : "border-border"
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{t("scpEasyPayWallet")}</p>
                <p className="text-[11px] text-muted-foreground">{t("scpBalance")}: ৳{walletBalance.toLocaleString()}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${payMethod === "wallet" ? "border-primary" : "border-border"}`}>
                {payMethod === "wallet" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </div>
            </button>
          ) : (
            paymentMethods.map(m => {
              const IconComp = PAY_ICON_MAP[m.icon] || CreditCard;
              const isSelected = payMethod === m.key;
              const isComingSoon = !["wallet", "cod"].includes(m.key);
              return (
                <button
                  key={m.id}
                  onClick={() => !isComingSoon && setPayMethod(m.key)}
                  disabled={isComingSoon}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-colors text-left ${
                    isSelected ? "border-primary/30 bg-primary/5" : "border-border"
                  } ${isComingSoon ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <IconComp className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{m.label}</p>
                      {isComingSoon && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{t("scpComingSoon")}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {m.key === "wallet" ? `${t("scpBalance")}: ৳${walletBalance.toLocaleString()}` : m.description || ""}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-primary" : "border-border"}`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
              );
            })
          )}
          {payMethod === "wallet" && orderTotal > walletBalance && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/5 border border-destructive/20">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <p className="text-[11px] text-destructive font-semibold">
                {t("scpInsufficientNeed").replace("{n}", (orderTotal - walletBalance).toLocaleString())}
              </p>
            </div>
          )}
          {isCod && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/50 border border-accent">
              <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
              <p className="text-[11px] text-muted-foreground font-semibold">
                {t("scpCodNote").replace("{n}", orderTotal.toLocaleString())}
              </p>
            </div>
          )}
        </div>

        {/* Items Summary */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("scpItemsLabel")} ({count})
          </p>
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted shrink-0">
                  <ProductImage
                    imageUrl={item.image_url}
                    emoji={item.emoji}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-tight">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("scpQty")}: {item.qty} · {item.vendor_name}
                  </p>
                </div>
              </div>
              <p className="text-sm font-bold text-foreground">
                ৳{(item.price * item.qty).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Coupon */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("scpPromoCode")}
          </p>
          {appliedPromo ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/50 border border-accent">
              <Gift className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{appliedPromo.code}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("scpSaving")} ৳{discountAmt.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => {
                  setAppliedPromo(null);
                  setPromoInput("");
                }}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  placeholder={t("scpEnterPromo")}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground font-mono outline-none focus:border-primary transition-colors uppercase"
                />
              </div>
              <Button onClick={applyPromo} disabled={promoLoading} size="sm" className="shrink-0">
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("scpApply")}
              </Button>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("scpOrderSummary")}
          </p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("scpSubtotal")} ({count} {t("scpItems")})</span>
            <span className="font-semibold text-foreground">৳{subtotal.toLocaleString()}</span>
          </div>
          {appliedPromo && (
            <div className="flex justify-between text-sm">
              <span className="text-primary">{t("scpDiscount")} ({appliedPromo.code})</span>
              <span className="font-semibold text-primary">-৳{discountAmt.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {t("scpDelivery")}{matchedZone ? ` (${matchedZone.zone_name})` : ""}
            </span>
            <span className={`font-semibold ${deliveryFee > 0 ? "text-foreground" : "text-primary"}`}>
              {deliveryFee > 0 ? `৳${deliveryFee.toLocaleString()}` : t("scpFree")}
            </span>
          </div>
          {matchedZone && (
            <p className="text-[10px] text-muted-foreground text-right">
              {t("scpEst")} {matchedZone.estimated_days}{matchedZone.courier_providers?.name ? ` ${t("scpVia")} ${matchedZone.courier_providers.name}` : ""}
            </p>
          )}
          <div className="h-px bg-border my-1" />
          <div className="flex justify-between text-base font-bold">
            <span className="text-foreground">{t("scpTotal")}</span>
            <span className="text-primary">৳{orderTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* PIN — only for wallet */}
        {needsPin && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("scpConfirmPin")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("scpConfirmPinDesc")}
          </p>
          <div className="flex justify-center gap-5 py-2">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: pin.length > i ? 1.2 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  pin.length > i
                    ? "border-transparent bg-primary shadow-md"
                    : "border-muted-foreground/30 bg-transparent"
                }`}
              />
            ))}
          </div>
          {pinError && (
            <p className="text-xs text-destructive flex items-center justify-center gap-1">
              <AlertCircle className="w-3 h-3" /> {pinError}
            </p>
          )}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              if (v.length > pin.length) haptics.light();
              setPin(v);
              setPinError("");
            }}
            className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none transition-colors placeholder:text-muted-foreground/30"
            placeholder="••••"
          />
        </div>
        )}

      </div>

      {/* Fixed bottom Slide to Confirm */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        <SlideToConfirm
          onConfirm={handleCheckout}
          label={isCod ? `Place COD Order · ৳${orderTotal.toLocaleString()}` : `Place Order · ৳${orderTotal.toLocaleString()}`}
          gradient="gradient-primary"
          disabled={
            (needsPin && pin.length < 4) ||
            !selectedAddress ||
            (payMethod === "wallet" && orderTotal > walletBalance) ||
            processing
          }
          pinComplete={needsPin ? pin.length === 4 : true}
          icon={isCod ? Truck : ShoppingCart}
        />
      </div>
    </div>
  );
}
