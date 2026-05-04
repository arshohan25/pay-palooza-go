import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, type PanInfo } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import SupportChat from "@/components/SupportChat";
import PinResetTicketChat from "@/components/merchant/PinResetTicketChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ShieldCheck, LogIn, KeyRound, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const PEEK_HEIGHT = 72; // px visible when shutter is closed

// Tiny inline grain to kill banding on the dark backdrop
const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>\")";

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

  // Esc closes the shutter
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
      className="fixed inset-0 flex flex-col overflow-hidden text-white sm:px-5"
      style={{
        background:
          "radial-gradient(120% 80% at 50% -10%, #6d4ea8 0%, #3b2563 28%, #1f1638 60%, #15102b 100%)",
        paddingLeft: "max(env(safe-area-inset-left), 12px)",
        paddingRight: "max(env(safe-area-inset-right), 12px)",
      }}
    >
      {/* Aurora blooms */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-12%] h-80 w-[140%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(closest-side, hsl(var(--primary) / 0.45), transparent 70%)" }}
        />
        <div className="absolute left-[-10%] top-[28%] h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute right-[-8%] bottom-[18%] h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div
          className="absolute inset-0 mix-blend-overlay opacity-[0.05]"
          style={{ backgroundImage: GRAIN_SVG }}
        />
      </div>

      {/* Frosted halo behind drawer */}
      <div className="pointer-events-none absolute inset-x-4 bottom-0 top-20 -z-0 rounded-t-[40px] bg-white/5 backdrop-blur-2xl" />

      {/* Header */}
      <header
        className="relative z-10 mx-auto flex w-full max-w-2xl shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.06] pb-3 backdrop-blur md:max-w-3xl"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 12px)",
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/merchant-login")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/85 ring-1 ring-white/10 transition hover:bg-white/[0.16]"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-tight">
            {isGuestTicketMode ? "PIN reset · Live support" : "Merchant Live Support"}
          </h1>
          <p className="truncate text-[11px] leading-tight text-white/60">
            {isGuestTicketMode
              ? `Verified guest chat · +88 ${maskedPhone}`
              : "End-to-end encrypted · PIN reset assistance"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
          <ShieldCheck className="h-3 w-3" /> {isGuestTicketMode ? "OTP-Verified" : "Verified"}
        </div>
      </header>

      {/* Backdrop tap zone — opens the shutter when collapsed */}
      {!shutterOpen && (
        <button
          type="button"
          aria-label="Open chat"
          onClick={() => setShutterOpen(true)}
          className="absolute inset-x-0 top-0 bottom-[72px] z-10 cursor-pointer"
        />
      )}

      {/* Shutter Drawer */}
      <motion.div
        className="relative z-20 mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden rounded-t-[28px] bg-white text-foreground sm:max-w-2xl md:max-w-3xl lg:max-w-3xl"
        style={{
          boxShadow:
            "0 -22px 60px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.7)",
          // ring effect
          outline: "1px solid rgba(255,255,255,0.18)",
          outlineOffset: "-1px",
        }}
        initial={false}
        animate={{ y: shutterOpen ? 0 : `calc(100% - ${PEEK_HEIGHT}px)` }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
      >
        {/* Grab handle / shutter toggle */}
        <button
          type="button"
          onClick={() => setShutterOpen((v) => !v)}
          className="group relative flex w-full shrink-0 items-center justify-center pt-2.5 pb-1.5"
          aria-label={shutterOpen ? "Collapse chat" : "Expand chat"}
        >
          <span className="block h-1 w-10 rounded-full bg-foreground/25 transition-colors group-hover:bg-foreground/45" />
          <span className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            {shutterOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        </button>

        {/* Peek strip — only visible when collapsed */}
        {!shutterOpen && (
          <div className="flex items-center gap-2 px-5 pb-2 text-[13px] font-medium text-foreground/80">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">PIN reset · Tap to reopen chat</span>
          </div>
        )}

        {/* Chat body */}
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
