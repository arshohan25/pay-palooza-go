import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import {
  Store,
  ShieldCheck,
  Lock,
  Phone,
  Sparkles,
  Loader2,
  ArrowRight,
  ShoppingBag,
  Wallet,
  QrCode,
  BarChart3,
  Eye,
  EyeOff,
} from "lucide-react";

const MERCHANT_ROLES = ["merchant", "admin"] as const;

export default function MerchantLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const bound = typeof window !== "undefined" ? localStorage.getItem("mfs_device_phone") : null;
    if (bound) setPhone(bound.replace(/^88/, ""));
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const cleanedPhone = phone.replace(/\D/g, "").replace(/^88/, "");
    if (!/^01[3-9]\d{8}$/.test(cleanedPhone)) {
      toast.error("Enter a valid 11-digit Bangladeshi mobile number");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Enter your 4-digit PIN");
      return;
    }

    setLoading(true);
    try {
      await signIn(cleanedPhone, pin);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Sign-in failed");

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roles = (rolesData ?? []).map((r: any) => r.role);
      const isMerchant = roles.some((r) => (MERCHANT_ROLES as readonly string[]).includes(r));

      if (!isMerchant) {
        await supabase.auth.signOut();
        toast.error("This account isn't a merchant account", {
          description: "Apply to become a merchant or use customer login.",
        });
        return;
      }

      try {
        localStorage.setItem("mfs_device_phone", cleanedPhone);
        localStorage.setItem("mfs_has_authenticated", "1");
      } catch {}

      toast.success("Welcome back, merchant!");
      navigate("/merchant", { replace: true });
    } catch (err: any) {
      const msg = err?.message || "Sign-in failed";
      toast.error(msg.includes("Invalid login credentials") ? "Wrong phone or PIN" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-950 text-white">
      {/* Bokeh blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-emerald-500/30 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-indigo-500/30 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/10 blur-[120px]"
      />

      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div
          className="w-full max-w-md animate-fade-in"
          style={{ animationDuration: "500ms" }}
        >
          {/* Logo + eyebrow */}
          <div className="mb-6 flex flex-col items-center text-center animate-scale-in">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[19px] border border-white/15 bg-white/10 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.6)] backdrop-blur-2xl">
              <Store className="h-8 w-8 text-emerald-300" strokeWidth={1.8} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
              <Sparkles className="h-3 w-3" />
              Merchant Portal
            </span>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 max-w-xs text-sm text-white/60">
              Sign in to manage your store, orders, payouts and QR.
            </p>
          </div>

          {/* Glass card */}
          <form
            onSubmit={handleSignIn}
            className="rounded-[19px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:p-7"
          >
            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="merchant-phone" className="text-xs font-medium uppercase tracking-wider text-white/60">
                Mobile number
              </Label>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1.5 transition-colors focus-within:border-emerald-300/40 focus-within:bg-white/[0.06]">
                <div className="flex items-center gap-1.5 border-r border-white/10 pr-3 text-sm text-white/70">
                  <Phone className="h-4 w-4 text-emerald-300" />
                  <span className="font-medium">+880</span>
                </div>
                <Input
                  id="merchant-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="1XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="h-10 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            {/* PIN */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-white/60">
                  4-digit PIN
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-white/60 transition-colors hover:text-white"
                >
                  {showPin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPin ? "Hide" : "Show"}
                </button>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors focus-within:border-emerald-300/40">
                <InputOTP
                  maxLength={4}
                  value={pin}
                  onChange={setPin}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-12 w-12 rounded-xl border-white/15 bg-white/[0.06] text-lg font-semibold text-white"
                        // mask via CSS when hidden
                        style={
                          !showPin && pin[i]
                            ? { color: "transparent", textShadow: "0 0 0 white", caretColor: "transparent" }
                            : undefined
                        }
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="mt-6 h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-base font-semibold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.7)] transition-transform hover:scale-[1.01] hover:from-emerald-400 hover:to-teal-400 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in to dashboard
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Trust pills */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { icon: Lock, label: "Secure PIN" },
                { icon: ShieldCheck, label: "Encrypted" },
                { icon: Sparkles, label: "Bank-grade" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10.5px] font-medium text-white/70"
                >
                  <Icon className="h-3 w-3 text-emerald-300" />
                  {label}
                </div>
              ))}
            </div>

            {/* Perks strip */}
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.03] to-white/[0.06] px-4 py-3">
              {[
                { icon: ShoppingBag, label: "Orders" },
                { icon: Wallet, label: "Payouts" },
                { icon: QrCode, label: "QR" },
                { icon: BarChart3, label: "Insights" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 text-white/70">
                  <Icon className="h-4 w-4 text-emerald-300" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>
          </form>

          {/* Footer links */}
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={() => navigate("/merchant")}
              className="group inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 transition-colors hover:text-emerald-200"
            >
              New here? Apply as a merchant
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="hover:text-white"
              >
                Customer login
              </button>
              <span className="h-3 w-px bg-white/15" />
              <button
                type="button"
                onClick={() => navigate("/team-login")}
                className="hover:text-white"
              >
                Staff login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
