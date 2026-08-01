import { useNavigate } from "react-router-dom";
import { useMySubscriptions, INTERVAL_LABEL } from "@/hooks/use-subscriptions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Repeat } from "lucide-react";
import { useState } from "react";

const statusColor: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-500",
  trialing: "bg-sky-500/15 text-sky-500",
  past_due: "bg-amber-500/15 text-amber-500",
  paused: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function MySubscriptionsPage() {
  const navigate = useNavigate();
  const { subs, charges, loading, cancel } = useMySubscriptions();
  const [cancelId, setCancelId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background gpu-stable">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-base font-bold text-foreground">My subscriptions</h1>
          <p className="text-xs text-muted-foreground">Recurring payments you have authorised</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 p-4 pb-24">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : subs.length === 0 ? (
          <Card className="rounded-[19px] border-dashed border-border/60">
            <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
              <Repeat className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">You have no active subscriptions.</p>
            </CardContent>
          </Card>
        ) : subs.map((s) => (
          <Card key={s.id} className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{s.merchant_plans?.name ?? "Plan"}</p>
                  <p className="text-xs text-muted-foreground">
                    ৳{Number(s.merchant_plans?.amount ?? 0).toLocaleString()} every{" "}
                    {(s.merchant_plans?.interval_count ?? 1) > 1 ? `${s.merchant_plans?.interval_count} ` : ""}
                    {INTERVAL_LABEL[s.merchant_plans?.billing_interval ?? "monthly"]}
                  </p>
                </div>
                <Badge className={`border-0 text-[10px] ${statusColor[s.status]}`}>{s.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span>Next charge: <span className="font-medium text-foreground">{new Date(s.next_charge_at).toLocaleDateString()}</span></span>
                <span>Charges paid: <span className="font-medium text-foreground">{s.charges_count}</span></span>
                {s.mandate_max_amount != null && <span>Cap: <span className="font-medium text-foreground">৳{Number(s.mandate_max_amount).toLocaleString()}</span></span>}
                {s.failed_count > 0 && <span className="text-amber-500">Failed attempts: {s.failed_count}</span>}
              </div>
              {s.status !== "cancelled" && (
                <Button variant="outline" size="sm" className="w-full rounded-2xl text-destructive" onClick={() => setCancelId(s.id)}>
                  Cancel subscription
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {charges.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Charge history</h2>
            <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
              <CardContent className="divide-y divide-border/50 p-0">
                {charges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">৳{Number(c.amount).toLocaleString()}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(c.charged_at).toLocaleString()}{c.failure_reason ? ` · ${c.failure_reason}` : ""}</p>
                    </div>
                    <Badge className={`border-0 text-[10px] ${c.status === "success" ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/10 text-destructive"}`}>{c.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <AlertDialog open={!!cancelId} onOpenChange={(o) => { if (!o) setCancelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
            <AlertDialogDescription>No further automatic charges will be made. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (cancelId) await cancel(cancelId); setCancelId(null); }}
            >
              Cancel subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
