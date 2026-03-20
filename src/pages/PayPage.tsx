import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import PaymentFlow from "@/components/PaymentFlow";
import { Button } from "@/components/ui/button";
import { LogIn, CreditCard } from "lucide-react";

/**
 * Public payment page accessed via merchant-generated payment links.
 * URL format: /pay?merchant=MRC-XXXX&amount=500&ref=ABC&note=Hello
 */
const PayPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [closed, setClosed] = useState(false);

  const merchantCode = searchParams.get("merchant") || "";
  const amount = searchParams.get("amount") || "";
  const note = searchParams.get("note") || "";

  // Loading auth state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Not logged in — prompt to log in first
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Payment Request</h1>
            {amount && (
              <p className="text-3xl font-bold text-primary">৳{parseFloat(amount).toLocaleString()}</p>
            )}
            {note && <p className="text-muted-foreground text-sm">{note}</p>}
            <p className="text-muted-foreground">Merchant: <span className="font-medium text-foreground">{merchantCode}</span></p>
          </div>
          <p className="text-sm text-muted-foreground">Please log in to your account to complete this payment.</p>
          <Button
            onClick={() => navigate(`/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
            className="w-full h-12 rounded-xl font-bold"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Log In to Pay
          </Button>
        </div>
      </div>
    );
  }

  // Payment was closed/completed
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
