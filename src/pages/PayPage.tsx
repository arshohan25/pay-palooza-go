import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import PaymentFlow from "@/components/PaymentFlow";
import { Button } from "@/components/ui/button";
import { LogIn, CreditCard, QrCode, Keyboard, ArrowLeft, Download } from "lucide-react";
import QRCode from "qrcode";

const PayPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"choose" | "qr" | "manual">("choose");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const merchantCode = searchParams.get("merchant") || "";
  const amount = searchParams.get("amount") || "";
  const note = searchParams.get("note") || "";
  const ref = searchParams.get("ref") || "";

  const paymentUrl = `${window.location.origin}/pay?merchant=${encodeURIComponent(merchantCode)}${amount ? `&amount=${encodeURIComponent(amount)}` : ""}${note ? `&note=${encodeURIComponent(note)}` : ""}${ref ? `&ref=${encodeURIComponent(ref)}` : ""}`;

  useEffect(() => {
    if (mode === "qr") {
      QRCode.toDataURL(paymentUrl, { width: 280, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(""));
    }
  }, [mode, paymentUrl]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

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
            {ref && <p className="text-muted-foreground text-xs">Ref: <span className="font-mono font-medium text-foreground">{ref}</span></p>}
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

  // ── QR screen ─────────────────────────────────────────────
  if (mode === "qr") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)] mt-3 mb-2">
          <button onClick={() => setMode("choose")} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Scan to Pay</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border flex flex-col items-center gap-4 w-full max-w-xs">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Payment QR Code" className="w-56 h-56 rounded-xl" />
            ) : (
              <div className="w-56 h-56 rounded-xl bg-muted animate-pulse" />
            )}
            <p className="text-sm font-medium text-muted-foreground text-center">Scan with EasyPay App</p>
          </div>
          <div className="text-center space-y-1">
            {amount && <p className="text-2xl font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</p>}
            <p className="text-sm text-muted-foreground">Merchant: <span className="font-medium text-foreground">{merchantCode}</span></p>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
          </div>
          {qrDataUrl && (
            <a href={qrDataUrl} download={`pay-${merchantCode}.png`} className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
              <Download className="w-4 h-4" /> Save QR Image
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Manual payment screen ─────────────────────────────────
  if (mode === "manual") {
    return (
      <div className="min-h-screen bg-background">
        <PaymentFlow
          onClose={() => setMode("choose")}
          prefilledMerchantId={merchantCode}
          prefilledAmount={amount || undefined}
          prefilledNote={note || ref ? `${note}${note && ref ? " | " : ""}${ref ? `Ref: ${ref}` : ""}`.trim() : undefined}
        />
      </div>
    );
  }

  // ── Choice screen ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Payment summary */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <CreditCard className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Payment Request</h1>
          {amount && (
            <p className="text-3xl font-bold text-primary tabular-nums">৳{parseFloat(amount).toLocaleString()}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Merchant: <span className="font-semibold text-foreground">{merchantCode}</span>
          </p>
          {note && <p className="text-sm text-muted-foreground italic">"{note}"</p>}
        </div>

        {/* Method cards */}
        <div className="space-y-3">
          <button
            onClick={() => setMode("qr")}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <QrCode className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Show Dynamic QR</p>
              <p className="text-xs text-muted-foreground">Display QR code to scan with EasyPay app</p>
            </div>
          </button>

          <button
            onClick={() => setMode("manual")}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Keyboard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Pay Manually</p>
              <p className="text-xs text-muted-foreground">Enter details & confirm with PIN</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayPage;
