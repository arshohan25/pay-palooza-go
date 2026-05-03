import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SupportChat from "@/components/SupportChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ShieldCheck, LogIn } from "lucide-react";

/**
 * Merchant-side Live Chat handoff page.
 * Used by the Merchant Forgot-PIN flow (and any other merchant pre-login support flow)
 * to land users in a merchant-themed support surface instead of the user /account page.
 *
 * Reads ?openChat=1&prefill=...&contextTitle=...&contextBody=... query params,
 * identical to AccountPage's chat opener.
 */
export default function MerchantSupportPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [draft, setDraft] = useState<string | undefined>(undefined);
  const [context, setContext] = useState<{ title: string; body: string } | null>(null);

  // Parse the openChat query params once on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve current session (chat needs a userId)
  useEffect(() => {
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
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-[#1a1424] via-[#221728] to-[#1a1424] text-white">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 border-b border-white/10 bg-white/[0.03] backdrop-blur">
        <button
          type="button"
          onClick={() => navigate("/merchant-login")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 hover:bg-white/[0.12] transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold leading-tight truncate">Merchant Live Support</h1>
          <p className="text-[11px] text-white/55 leading-tight truncate">
            End-to-end encrypted · PIN reset assistance
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
          <ShieldCheck className="h-3 w-3" /> Verified
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 bg-white text-foreground rounded-t-3xl mt-[-4px] overflow-hidden flex flex-col">
        {!authChecked ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : userId ? (
          <SupportChat userId={userId} initialDraft={draft} initialContext={context} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <LogIn className="h-6 w-6 text-amber-600" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h2 className="text-base font-semibold text-foreground">
                Sign in to continue your PIN reset chat
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Your verified PIN-reset request has been logged with our support team. Sign in to your EasyPay account so we can chat with you securely and complete the reset.
              </p>
            </div>
            <Button
              onClick={() => navigate("/")}
              className="h-11 rounded-2xl px-6 bg-gradient-to-r from-orange-500 via-rose-500 to-rose-600 text-white font-semibold"
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
