import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SupportChat from "@/components/SupportChat";
import PinResetTicketChat from "@/components/merchant/PinResetTicketChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ShieldCheck, LogIn, KeyRound } from "lucide-react";
import { toast } from "sonner";

/**
 * Merchant-side Live Chat handoff page.
 *
 * Two modes:
 *  1. Guest PIN-reset ticket — `?ticket=<request_id>&t=<otp_ticket>&masked=<masked_phone>`
 *     Renders <PinResetTicketChat> backed by the merchant-pin-reset-chat edge function.
 *     No Supabase auth required.
 *  2. Authenticated merchant support — legacy `?openChat=1&prefill=...&contextTitle=...`
 *     Renders <SupportChat> tied to the signed-in user's encrypted thread.
 */
export default function MerchantSupportPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const ticketId = params.get("ticket");
  const otpTicket = params.get("t");
  const maskedPhone = params.get("masked") ?? "•••••••••••";
  const isGuestTicketMode = Boolean(ticketId && otpTicket);

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [context, setContext] = useState<{ title: string; body: string } | null>(null);

  // Parse legacy openChat query params (only when not in guest mode)
  useEffect(() => {
    if (isGuestTicketMode) return;
    const prefill = params.get("prefill");
    if (prefill) {
      try { setDraft(decodeURIComponent(prefill)); } catch { setDraft(prefill); }
    }
    const ctxTitle = params.get("contextTitle");
    const ctxBody = params.get("contextBody");
    if (ctxTitle && ctxBody) {
      try {
        setContext({ title: decodeURIComponent(ctxTitle), body: decodeURIComponent(ctxBody) });
      } catch {
        setContext({ title: ctxTitle, body: ctxBody });
      }
    }
  }, [params, isGuestTicketMode]);

  // Resolve current session (only needed in legacy mode)
  useEffect(() => {
    if (isGuestTicketMode) { setAuthChecked(true); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUserId(session?.user?.id ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [isGuestTicketMode]);

  const handleGuestExpiry = () => {
    toast.error("Your verification expired. Please request a new code.");
    navigate("/merchant-login", { replace: true });
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#1a1424] via-[#221728] to-[#1a1424] text-white">
      {/* Header */}
      <header
        className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.03] pb-3 backdrop-blur md:max-w-3xl"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/merchant-login")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 transition hover:bg-white/[0.12]"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-tight">
            {isGuestTicketMode ? "PIN reset · Live support" : "Merchant Live Support"}
          </h1>
          <p className="truncate text-[11px] leading-tight text-white/55">
            {isGuestTicketMode
              ? `Verified guest chat · +88 ${maskedPhone}`
              : "End-to-end encrypted · PIN reset assistance"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
          <ShieldCheck className="h-3 w-3" /> {isGuestTicketMode ? "OTP-Verified" : "Verified"}
        </div>
      </header>

      {/* Body */}
      <div className="-mt-1 mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden rounded-t-3xl bg-white text-foreground sm:max-w-2xl md:max-w-3xl lg:max-w-3xl">
        {isGuestTicketMode ? (
          <PinResetTicketChat
            requestId={ticketId!}
            initialTicket={otpTicket!}
            maskedPhone={maskedPhone}
            onSessionExpired={handleGuestExpiry}
          />
        ) : !authChecked ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : userId ? (
          <SupportChat userId={userId} initialDraft={draft} initialContext={context} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
              <LogIn className="h-6 w-6 text-amber-600" />
            </div>
            <div className="max-w-sm space-y-1.5">
              <h2 className="text-base font-semibold text-foreground">
                Sign in to continue your support chat
              </h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                You'll need to sign in to your EasyPay account so we can chat with you securely.
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-[11px] text-muted-foreground">
                <KeyRound className="h-3 w-3" />
                Forgot your PIN? Use the "Forgot PIN" option on the merchant login.
              </p>
            </div>
            <Button
              onClick={() => navigate("/")}
              className="h-11 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-rose-600 px-6 font-semibold text-white"
            >
              Sign in to EasyPay
            </Button>
            <button
              type="button"
              onClick={() => navigate("/merchant-login")}
              className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
            >
              Back to merchant login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
