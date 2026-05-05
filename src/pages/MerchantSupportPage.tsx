import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, type PanInfo } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import SupportChat from "@/components/SupportChat";
import PinResetTicketChat from "@/components/merchant/PinResetTicketChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ShieldCheck, LogIn, KeyRound } from "lucide-react";
import { toast } from "sonner";

const PEEK_HEIGHT = 72;

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
  const [shutterOpen, setShutterOpen] = useState(true);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && shutterOpen) setShutterOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shutterOpen]);

  const handleGuestExpiry = () => {
    toast.error("Your verification expired. Please request a new code.");
    navigate("/merchant-login", { replace: true });
  };

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    if (shutterOpen) {
      if (offset.y > 120 || velocity.y > 500) setShutterOpen(false);
    } else {
      if (offset.y < -80 || velocity.y < -400) setShutterOpen(true);
    }
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-[#f5f6f8] text-foreground"
      style={{
        paddingLeft: "max(env(safe-area-inset-left), 0px)",
        paddingRight: "max(env(safe-area-inset-right), 0px)",
      }}
    >
      {/* Soft minimal accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-32 right-[-20%] h-72 w-72 rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      {/* Header */}
      <header
        className="relative z-10 mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 px-4 pb-3 md:max-w-3xl"
        style={{ paddingTop: "max(env(safe-area-inset-top), 14px)" }}
      >
        <button
          type="button"
          onClick={() => navigate("/merchant-login")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white text-foreground/80 shadow-sm transition hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {isGuestTicketMode ? "PIN reset · Live support" : "Merchant Live Support"}
          </h1>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {isGuestTicketMode
              ? `Verified guest · +88 ${maskedPhone}`
              : "End-to-end encrypted"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
          <ShieldCheck className="h-3 w-3" /> {isGuestTicketMode ? "Verified" : "Secure"}
        </div>
      </header>

      {!shutterOpen && (
        <button
          type="button"
          aria-label="Open chat"
          onClick={() => setShutterOpen(true)}
          className="absolute inset-x-0 top-0 bottom-[72px] z-10 cursor-pointer"
        />
      )}

      {/* Drawer */}
      <motion.div
        className="relative z-20 mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden rounded-t-[28px] border border-border/60 border-b-0 bg-white text-foreground shadow-[0_-12px_40px_-20px_rgba(15,23,42,0.18)] md:max-w-3xl"
        initial={false}
        animate={{ y: shutterOpen ? 0 : `calc(100% - ${PEEK_HEIGHT}px)` }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
      >
        <button
          type="button"
          onClick={() => setShutterOpen((v) => !v)}
          className="group relative flex w-full shrink-0 items-center justify-center pt-2.5 pb-1.5"
          aria-label={shutterOpen ? "Collapse chat" : "Expand chat"}
        >
          <span className="block h-1 w-10 rounded-full bg-foreground/15 transition-colors group-hover:bg-foreground/30" />
        </button>

        {!shutterOpen && (
          <div className="flex items-center gap-2 px-5 pb-2 text-[13px] font-medium text-foreground/80">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">PIN reset · Tap to reopen chat</span>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
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
      </motion.div>
    </div>
  );
}
