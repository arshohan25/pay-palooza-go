import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, LifeBuoy, Phone, Send, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface MerchantForgotPinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill phone (clean 11-digit BD form). */
  defaultPhone?: string;
  /** Which login page opened this — used for ticket source attribution. */
  source?: "merchant-login" | "merchant-manager-login";
  /** Accent color theme matching the host page. */
  accent?: "amber" | "sky";
}

export function maskBdPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "").replace(/^88/, "");
  if (clean.length !== 11) return phone;
  return `${clean.slice(0, 3)}••••••${clean.slice(8)}`;
}

export default function MerchantForgotPinSheet({
  open,
  onOpenChange,
  defaultPhone = "",
  source = "merchant-login",
  accent = "amber",
}: MerchantForgotPinSheetProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone);
      setNote("");
    }
  }, [open, defaultPhone]);

  const accentRing = accent === "sky" ? "focus-within:border-sky-200/50" : "focus-within:border-amber-200/50";
  const accentIcon = accent === "sky" ? "text-sky-200" : "text-amber-200";
  const accentBtn =
    accent === "sky"
      ? "bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 hover:from-sky-400 hover:via-indigo-400 hover:to-violet-500 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.7)]"
      : "bg-gradient-to-r from-orange-500 via-rose-500 to-rose-600 hover:from-orange-400 hover:via-rose-400 hover:to-rose-500 shadow-[0_10px_30px_-10px_rgba(244,63,94,0.7)]";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, "").replace(/^88/, "");
    if (!/^01[3-9]\d{8}$/.test(cleaned)) {
      toast.error("Enter a valid 11-digit Bangladeshi mobile number.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-forgot-pin", {
        body: { phone: cleaned, note: note.trim(), source },
      });
      const ctx: any = (error as any)?.context;
      let body: any = data ?? null;
      if (!body && ctx?.json) { try { body = await ctx.json(); } catch {} }
      if (!body && ctx?.text) { try { body = JSON.parse(await ctx.text()); } catch {} }

      if (body?.ok) {
        toast.success(body.message || "Request received. Our team will reach out shortly.");
        onOpenChange(false);
        return;
      }
      toast.error(body?.message || error?.message || "Couldn't submit request. Please try again.");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[28px] border-white/10 bg-gradient-to-b from-[#1a1424] via-[#221728] to-[#1a1424] text-white p-0 max-h-[92vh] overflow-y-auto [&>button]:text-white/70"
      >
        <div className="px-5 pt-5 pb-6">
          <SheetHeader className="space-y-2 text-left">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] ${accentIcon}`}>
              <LifeBuoy className="h-5 w-5" />
            </div>
            <SheetTitle className="text-lg font-semibold text-white">
              Reset your merchant PIN
            </SheetTitle>
            <SheetDescription className="text-[13px] leading-snug text-white/60">
              Our support team will verify your identity over a call/SMS and help you set a new PIN.
              Typical response: <span className="text-white/80 font-medium">within 15 minutes</span> during business hours (10am–10pm).
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-phone" className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                Registered mobile number
              </Label>
              <div className={`flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-1 transition-colors ${accentRing}`}>
                <div className="flex items-center gap-1.5 border-r border-white/10 pr-2.5 text-sm text-white/70">
                  <Phone className={`h-4 w-4 ${accentIcon}`} />
                  <span className="font-medium">+880</span>
                </div>
                <Input
                  id="forgot-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="1XXXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="h-9 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              {phone.length === 11 && (
                <p className="text-[11px] text-white/50">
                  We'll contact you on <span className="text-white/80 font-medium">+880 {maskBdPhone(phone)}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="forgot-note" className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                Anything we should know? <span className="text-white/40 normal-case">(optional)</span>
              </Label>
              <Textarea
                id="forgot-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                placeholder="e.g. I changed my phone, can't receive SMS at the old SIM..."
                className="min-h-[88px] rounded-2xl border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-white/30 focus-visible:ring-amber-200/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70">
                <Clock className={`h-3.5 w-3.5 ${accentIcon}`} />
                ~15 min response
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70">
                <ShieldCheck className={`h-3.5 w-3.5 ${accentIcon}`} />
                Identity verified
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className={`h-11 w-full rounded-2xl text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-70 ${accentBtn}`}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending request...</>
              ) : (
                <><Send className="h-4 w-4" /> Send to support team</>
              )}
            </Button>

            <p className="text-center text-[11px] text-white/45">
              By submitting, you agree to be contacted by EasyPay support for identity verification.
            </p>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
