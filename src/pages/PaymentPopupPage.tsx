import { useEffect, useMemo, useState } from "react";
import { Loader2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECKOUT_POPUP_STORAGE_PREFIX = "easypay_uddoktapay_checkout_";

type CheckoutPayload = {
  url: string;
  amount?: number;
  provider?: string;
  expiresAt?: number;
};

export default function PaymentPopupPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Checkout session is missing.");
      return;
    }

    const storageKey = `${CHECKOUT_POPUP_STORAGE_PREFIX}${token}`;
    let redirectTimer: number | null = null;
    let expiryTimer: number | null = null;

    const openPayload = (rawPayload: CheckoutPayload | string) => {
      try {
        const parsed = typeof rawPayload === "string" ? JSON.parse(rawPayload) as CheckoutPayload : rawPayload;
        const checkoutUrl = new URL(parsed.url);
        if (checkoutUrl.protocol !== "https:") throw new Error("Insecure checkout URL");
        if (parsed.expiresAt && parsed.expiresAt < Date.now()) throw new Error("Checkout session expired");

        localStorage.removeItem(storageKey);
        setPayload(parsed);
        setError("");
        redirectTimer = window.setTimeout(() => {
          window.location.replace(checkoutUrl.toString());
        }, 650);
      } catch {
        setError("Checkout link is invalid. Please start again from EasyPay.");
      }
    };

    const initial = localStorage.getItem(storageKey);
    if (initial) openPayload(initial);

    const storageHandler = (event: StorageEvent) => {
      if (event.key === storageKey && event.newValue) openPayload(event.newValue);
    };

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "EASYPAY_CHECKOUT_READY") return;
      if (event.data?.token !== token || !event.data?.payload) return;
      openPayload(event.data.payload as CheckoutPayload);
    };

    window.addEventListener("storage", storageHandler);
    window.addEventListener("message", messageHandler);
    expiryTimer = window.setTimeout(() => {
      if (!payload) setError("Checkout took too long to prepare. Please close this popup and try again.");
    }, 60000);

    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("message", messageHandler);
      if (redirectTimer) window.clearTimeout(redirectTimer);
      if (expiryTimer) window.clearTimeout(expiryTimer);
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
      <section className="w-full max-w-sm text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-3xl gradient-addmoney flex items-center justify-center shadow-glow">
          {error ? (
            <XCircle className="h-8 w-8 text-primary-foreground" />
          ) : (
            <Lock className="h-8 w-8 text-primary-foreground" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-extrabold tracking-tight">
            {error ? "Checkout unavailable" : payload ? "Opening secure checkout" : "Preparing secure checkout"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {error || "Keep this popup open. You will return to EasyPay Home with the transaction status."}
          </p>
        </div>

        {payload && !error && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Provider</span>
              <span className="text-sm font-semibold">{payload.provider ?? "UddoktaPay"}</span>
            </div>
            {Number.isFinite(payload.amount) && (
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="text-lg font-extrabold">৳{Number(payload.amount).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {!error ? (
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
            <Loader2 className="h-4 w-4 animate-spin" /> {payload ? "Redirecting…" : "Waiting for checkout…"}
          </div>
        ) : (
          <Button className="w-full" onClick={() => window.close()}>
            Close popup
          </Button>
        )}
      </section>
    </main>
  );
}