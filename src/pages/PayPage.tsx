import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import GuestCheckoutFlow from "@/components/GuestCheckoutFlow";
import { QrCode, ArrowLeft, Download, Smartphone, ChevronRight, Shield } from "lucide-react";
import QRCode from "qrcode";

const PayPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"choose" | "qr" | "guest">("choose");
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      </div>
    );
  }

  // Unauthenticated users go straight to guest checkout
  if (!user && !loading) {
    return (
      <GuestCheckoutFlow
        merchantCode={merchantCode}
        amount={amount}
        note={note}
        reference={ref}
        onClose={() => navigate("/")}
      />
    );
  }

  if (mode === "guest") {
    return (
      <GuestCheckoutFlow
        merchantCode={merchantCode}
        amount={amount}
        note={note}
        reference={ref}
        onClose={() => setMode("choose")}
      />
    );
  }

  // ── QR screen ─────────────────────────────────────────────
  if (user && mode === "qr") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-[env(safe-area-inset-top,12px)] mt-3 mb-2">
          <button
            onClick={() => setMode("choose")}
            className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Scan to Pay</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div className="backdrop-blur-xl bg-card/60 rounded-3xl p-8 shadow-xl border border-border/30 flex flex-col items-center gap-5 w-full max-w-xs animate-scale-in">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Payment QR Code" className="w-56 h-56 rounded-2xl shadow-lg" />
            ) : (
              <div className="w-56 h-56 rounded-2xl bg-muted/50 animate-pulse" />
            )}
            <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Scan with EasyPay App</p>
          </div>
          <div className="text-center space-y-1.5 animate-fade-in">
            {amount && <p className="text-3xl font-bold text-foreground tabular-nums tracking-tight">৳{parseFloat(amount).toLocaleString()}</p>}
            <p className="text-sm text-muted-foreground">
              Merchant: <span className="font-medium text-foreground">{merchantCode}</span>
            </p>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            {ref && (
              <p className="text-xs text-muted-foreground">
                Ref: <span className="font-mono font-medium text-foreground">{ref}</span>
              </p>
            )}
          </div>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`pay-${merchantCode}.png`}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:underline transition-colors"
            >
              <Download className="w-4 h-4" /> Save QR Image
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Choice screen ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm animate-scale-in">
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-card/60 rounded-3xl border border-border/30 shadow-xl overflow-hidden">
          {/* Payment Summary Header */}
          <div className="px-6 pt-8 pb-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Payment Request</p>
              {amount && (
                <p className="text-4xl font-bold text-foreground tabular-nums tracking-tight">
                  ৳{parseFloat(amount).toLocaleString()}
                </p>
              )}
            </div>
            <div className="inline-flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
              <span className="text-xs text-muted-foreground">To</span>
              <span className="text-xs font-semibold text-foreground font-mono">{merchantCode}</span>
            </div>
            {note && <p className="text-xs text-muted-foreground italic">"{note}"</p>}
            {ref && (
              <p className="text-xs text-muted-foreground">
                Ref: <span className="font-mono font-semibold text-foreground">{ref}</span>
              </p>
            )}
          </div>

          {/* Separator */}
          <div className="mx-6 h-px bg-border/40" />

          {/* Method Cards */}
          <div className="p-4 space-y-2.5">
            {/* Guest pay */}
            <button
              onClick={() => setMode("guest")}
              className="group w-full flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border/30 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all duration-200 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">Pay with Phone & PIN</p>
                <p className="text-xs text-muted-foreground mt-0.5">Verify via OTP, no login needed</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary/60 transition-colors shrink-0" />
            </button>

            {user ? (
              <button
                onClick={() => setMode("qr")}
                className="group w-full flex items-center gap-4 p-4 rounded-2xl bg-background/50 border border-border/30 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all duration-200 text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
                  <QrCode className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">Show Dynamic QR</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Display QR to scan with app</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary/60 transition-colors shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Footer badge */}
        <p className="text-center text-[11px] text-muted-foreground/60 mt-6 tracking-wide">
          Secured by <span className="font-semibold text-muted-foreground/80">EasyPay</span>
        </p>
      </div>
    </div>
  );
};

export default PayPage;
