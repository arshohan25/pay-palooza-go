import { useEffect, useMemo } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const RETURN_STORAGE_KEY = "easypay_addmoney_return";

type AddMoneyReturnDetail = {
  type: "EASYPAY_ADD_MONEY_RETURN";
  provider: "uddoktapay";
  status: string;
  requestId: string | null;
  invoiceId: string | null;
};

const cleanHomeUrl = () => `${window.location.origin}/`;

export default function PaymentReturnPage() {
  const detail = useMemo<AddMoneyReturnDetail>(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("addmoney") || params.get("status") || "success";

    return {
      type: "EASYPAY_ADD_MONEY_RETURN",
      provider: "uddoktapay",
      status,
      requestId: params.get("request_id") || params.get("requestId"),
      invoiceId: params.get("invoice_id") || params.get("transaction_id") || params.get("transactionId"),
    };
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({ id: crypto.randomUUID(), createdAt: Date.now(), detail });
    localStorage.setItem(RETURN_STORAGE_KEY, payload);

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage(detail, window.location.origin);
      } catch {
        // localStorage above is the fallback when a mobile browser breaks the opener bridge.
      }
      window.setTimeout(() => {
        window.close();
        window.location.replace(cleanHomeUrl());
      }, 350);
      return;
    }

    const query = new URLSearchParams({ addmoney: detail.status, provider: "uddoktapay" });
    if (detail.requestId) query.set("request_id", detail.requestId);
    if (detail.invoiceId) query.set("invoice_id", detail.invoiceId);
    window.setTimeout(() => window.location.replace(`${cleanHomeUrl()}?${query.toString()}`), 350);
  }, [detail]);

  const isSuccess = detail.status === "success";

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
      <section className="w-full max-w-sm text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-3xl gradient-addmoney flex items-center justify-center shadow-glow">
          {isSuccess ? (
            <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
          ) : (
            <XCircle className="h-8 w-8 text-primary-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-extrabold tracking-tight">
            {isSuccess ? "Payment received" : "Payment not completed"}
          </h1>
          <p className="text-sm text-muted-foreground">Returning to EasyPay Home with your transaction status.</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
        </div>
      </section>
    </main>
  );
}