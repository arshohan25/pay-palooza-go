import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMySubscriptions, INTERVAL_LABEL, MerchantPlan } from "@/hooks/use-subscriptions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Repeat, ShieldCheck, Loader2 } from "lucide-react";
import PinConfirmSheet from "@/components/PinConfirmSheet";

export default function SubscribePlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { subscribe } = useMySubscriptions();
  const [plan, setPlan] = useState<(MerchantPlan & { merchant_name?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [mandate, setMandate] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!planId) return;
    supabase
      .from("merchant_plans" as any)
      .select("*, merchants(business_name)")
      .eq("id", planId)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as any;
        setPlan(row ? { ...row, merchant_name: row.merchants?.business_name } : null);
        setLoading(false);
      });
  }, [planId]);

  const start = async () => {
    if (!planId) return;
    setBusy(true);
    try {
      await subscribe(planId, mandate ? Number(mandate) : undefined);
      navigate("/subscriptions");
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!plan || !plan.is_active) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="font-semibold text-foreground">This plan is unavailable</p>
        <p className="text-sm text-muted-foreground">The merchant may have paused or removed it.</p>
        <Button onClick={() => navigate("/")}>Back to home</Button>
      </div>
    );
  }

  const cycle = `${plan.interval_count > 1 ? `${plan.interval_count} ` : ""}${INTERVAL_LABEL[plan.billing_interval]}${plan.interval_count > 1 ? "s" : ""}`;

  return (
    <div className="min-h-screen bg-background gpu-stable">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-base font-bold text-foreground">Subscribe</h1>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
          <CardContent className="space-y-3 p-5">
            <Repeat className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-lg font-bold text-foreground">{plan.name}</p>
              {plan.merchant_name && <p className="text-xs text-muted-foreground">by {plan.merchant_name}</p>}
            </div>
            {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
            <p className="text-2xl font-bold text-foreground">
              ৳{Number(plan.amount).toLocaleString()}
              <span className="text-sm font-medium text-muted-foreground"> / {cycle}</span>
            </p>
            {plan.trial_days > 0 && (
              <p className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-500">
                First {plan.trial_days} days free — you won't be charged until the trial ends.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
          <CardContent className="space-y-2 p-4">
            <label className="text-xs font-medium text-muted-foreground">Auto-debit cap per charge (optional)</label>
            <Input inputMode="decimal" placeholder={`Default ৳${Number(plan.amount).toLocaleString()}`} value={mandate} onChange={(e) => setMandate(e.target.value.replace(/[^\d.]/g, ""))} />
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              We will never debit more than this amount in one cycle. Cancel any time from My subscriptions.
            </p>
          </CardContent>
        </Card>

        <Button className="h-12 w-full rounded-2xl" disabled={busy} onClick={() => setPinOpen(true)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : plan.trial_days > 0 ? "Start free trial" : `Subscribe for ৳${Number(plan.amount).toLocaleString()}`}
        </Button>
      </main>

      <PinConfirmSheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onConfirmed={start}
        title="Authorise auto-debit"
        description={`${plan.name} · ৳${Number(plan.amount).toLocaleString()} every ${cycle}`}
      />
    </div>
  );
}
