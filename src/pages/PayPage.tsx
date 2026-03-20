import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import PaymentFlow from "@/components/PaymentFlow";

/**
 * Public payment page accessed via merchant-generated payment links.
 * URL format: /pay?merchant=MRC-XXXX&amount=500&ref=ABC&note=Hello
 */
const PayPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [closed, setClosed] = useState(false);

  const merchantCode = searchParams.get("merchant") || "";
  // amount and note are informational — the PaymentFlow handles them via merchant lookup

  if (closed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 p-6">
          <h1 className="text-2xl font-bold text-foreground">Payment Closed</h1>
          <p className="text-muted-foreground">You can close this window or return home.</p>
          <button
            onClick={() => navigate("/")}
            className="text-primary underline hover:text-primary/90"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentFlow
        onClose={() => setClosed(true)}
        prefilledMerchantId={merchantCode}
      />
    </div>
  );
};

export default PayPage;
