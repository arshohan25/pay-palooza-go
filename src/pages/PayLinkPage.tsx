import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Wallet, ArrowRight, Home, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { playPaymentSuccess, playPaymentError } from "@/lib/sounds";
import PaymentLinkTimeline, { LinkPaymentRow } from "@/components/PaymentLinkTimeline";

type Link = {
  id: string;
  title: string;
  amount: number | null;
  amount_paid: number | null;
  currency: string;
  short_code: string;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
  expires_at: string | null;
  description: string | null;
  created_by: string | null;
};

const PayLinkPage = () => {
  const { shortCode } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [link, setLink] = useState<Link | null>(null);
  const [payeeName, setPayeeName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [payments, setPayments] = useState<LinkPaymentRow[]>([]);
  const [success, setSuccess] = useState<{ amount: number; reference: string; payee: string } | null>(null);

  const loadPayments = useCallback(async (linkId: string) => {
    const { data } = await supabase
      .from("payment_link_payments")
      .select("id,amount,status,created_at,transaction_id,refunded_at,refund_reason,refunded_amount")
      .eq("link_id", linkId)
      .order("created_at", { ascending: false })
      .limit(20);
    setPayments((data ?? []) as LinkPaymentRow[]);
  }, []);

  // Stable idempotency key per attempt: reset only after success or on link change.
  const [idemKey, setIdemKey] = useState<string>(() => crypto.randomUUID());
  useEffect(() => { setIdemKey(crypto.randomUUID()); }, [shortCode]);


  useEffect(() => {
    if (!shortCode) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_links")
        .select("id,title,amount,amount_paid,currency,short_code,is_active,used_count,max_uses,expires_at,description,created_by")
        .eq("short_code", shortCode)
        .maybeSingle();
      if (error) setError(error.message);
      else if (!data) setError("This payment link doesn't exist.");
      else {
        setLink(data as Link);
        loadPayments(data.id);
        if (data.created_by) {
          const { data: p } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", data.created_by)
            .maybeSingle();
          if (p?.name) setPayeeName(p.name);
        }
      }
      setLoading(false);
    })();
  }, [shortCode, loadPayments]);

  // Live updates for this link + its payments
  useEffect(() => {
    if (!link?.id) return;
    const ch = supabase
      .channel(`paylink-${link.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payment_links", filter: `id=eq.${link.id}` },
        (payload) => setLink((prev) => (prev ? { ...prev, ...(payload.new as Link) } : prev)),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payment_link_payments", filter: `link_id=eq.${link.id}` },
        () => loadPayments(link.id),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "payment_link_payments", filter: `link_id=eq.${link.id}` },
        () => loadPayments(link.id),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [link?.id, loadPayments]);


  const remaining = useMemo(() => {
    if (!link || link.amount == null) return null;
    return Math.max(Number(link.amount) - Number(link.amount_paid ?? 0), 0);
  }, [link]);

  const status = useMemo(() => {
    if (!link) return "loading";
    if (paying) return "processing";
    if (link.amount != null && remaining !== null && remaining <= 0) return "paid";
    if (!link.is_active) return "inactive";
    if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
    if (link.max_uses != null && link.used_count >= link.max_uses) return "exhausted";
    return "active";
  }, [link, remaining, paying]);

  const finalAmount = link?.amount != null
    ? (customAmount ? parseFloat(customAmount) : (remaining ?? Number(link.amount)))
    : parseFloat(customAmount || "0");

  const pay = async () => {
    if (!user) {
      navigate(`/?next=${encodeURIComponent(`/r/${shortCode}`)}`);
      return;
    }
    if (!link) return;
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return toast.error("Enter a valid amount");
    }
    if (remaining !== null && finalAmount > remaining) {
      return toast.error(`Only ৳${remaining} remaining`);
    }
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-link", {
        body: { short_code: link.short_code, amount: finalAmount, idempotency_key: idemKey },
      });

      if (error) {
        const ctx = (error as unknown as { context?: { text?: () => Promise<string> } }).context;
        const detail = ctx?.text ? await ctx.text() : error.message;
        let msg = detail;
        try { msg = JSON.parse(detail).error ?? detail; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (!data?.success) throw new Error(data?.error ?? "Payment failed");
      haptics.success?.();
      fireSuccessConfetti();
      playPaymentSuccess();
      setSuccess({ amount: data.amount, reference: data.reference, payee: data.payee_name ?? payeeName ?? "recipient" });
      setIdemKey(crypto.randomUUID());

    } catch (e) {
      playPaymentError();
      toast.error((e as Error).message);
    } finally {
      setPaying(false);
    }
  };

  if (loading || authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center space-y-3">
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-semibold text-foreground">Link unavailable</p>
            <p className="text-sm text-muted-foreground">{error ?? "This payment link doesn't exist."}</p>
            <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusPill = () => {
    const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
      active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> },
      processing: { label: "Processing", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      paid: { label: "Paid", cls: "bg-primary/10 text-primary border-primary/30", icon: <CheckCircle2 className="w-3 h-3" /> },
      expired: { label: "Expired", cls: "bg-muted text-muted-foreground border-border", icon: <XCircle className="w-3 h-3" /> },
      exhausted: { label: "Fully paid", cls: "bg-primary/10 text-primary border-primary/30", icon: <CheckCircle2 className="w-3 h-3" /> },
      inactive: { label: "Inactive", cls: "bg-muted text-muted-foreground border-border", icon: <XCircle className="w-3 h-3" /> },
    };
    const cfg = map[status] ?? map.inactive;
    return (
      <Badge variant="outline" className={`${cfg.cls} gap-1.5`}>{cfg.icon} {cfg.label}</Badge>
    );
  };

  const canPay = status === "active" || status === "processing";

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-start justify-center p-4 py-8">
      <Seo title={`Pay: ${link.title}`} description={`Pay ${link.title} securely from your wallet.`} path={`/r/${link.short_code}`} />
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-full max-w-sm">
            <Card className="border-emerald-500/30 shadow-xl">
              <CardContent className="p-8 text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260 }} className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                </motion.div>
                <div>
                  <p className="text-2xl font-bold text-foreground">৳{success.amount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">paid to {success.payee}</p>
                </div>
                <div className="bg-muted rounded-xl p-3 text-xs text-muted-foreground">
                  Reference: <span className="font-mono text-foreground">{success.reference}</span>
                </div>
                <Button className="w-full rounded-xl h-11" onClick={() => navigate("/")}>
                  <Home className="w-4 h-4 mr-2" /> Back to app
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="pay" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full max-w-sm space-y-4">
            <Card className="shadow-xl border-border/40">
              <CardContent className="p-6 space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment request</p>
                  <h1 className="text-lg font-bold text-foreground">{link.title}</h1>
                  {payeeName && <p className="text-sm text-muted-foreground">from {payeeName}</p>}
                  <div className="pt-2 flex justify-center">{statusPill()}</div>
                </div>

                {link.description && (
                  <p className="text-sm text-center text-muted-foreground bg-muted/50 rounded-xl p-3">{link.description}</p>
                )}

                {link.amount != null && (
                  <div className="bg-muted/40 rounded-xl p-3 text-center space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Requested / Paid</p>
                    <p className="text-sm font-medium text-foreground">
                      ৳{Number(link.amount).toLocaleString()} · paid ৳{Number(link.amount_paid ?? 0).toLocaleString()}
                    </p>
                    {remaining !== null && remaining > 0 && (
                      <p className="text-xs text-primary font-semibold">৳{remaining.toLocaleString()} remaining</p>
                    )}
                  </div>
                )}

                {!canPay ? (
                  <div className="bg-muted rounded-xl p-4 text-sm text-center text-muted-foreground">
                    {status === "expired" && "This link has expired."}
                    {status === "exhausted" && "This link reached its use limit."}
                    {status === "paid" && "This request has been fully paid."}
                    {status === "inactive" && "This link is no longer active."}
                  </div>
                ) : (
                  <>
                    {link.amount != null ? (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Pay amount (BDT)</label>
                        <Input
                          type="number" min="1" step="1" inputMode="numeric"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="text-center text-2xl h-14 font-bold"
                          placeholder={remaining ? String(remaining) : ""}
                        />
                        <p className="text-[11px] text-muted-foreground text-center">
                          Leave blank to pay the full remaining ৳{remaining?.toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Enter amount (BDT)</label>
                        <Input
                          type="number" min="1" step="1" inputMode="numeric"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          className="text-center text-2xl h-14 font-bold"
                          placeholder="0"
                        />
                      </div>
                    )}

                    <Button
                      className="w-full rounded-xl h-12 text-base font-semibold"
                      onClick={pay}
                      disabled={paying || !(finalAmount > 0)}
                    >
                      {paying ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>)
                        : user ? (<>Pay ৳{finalAmount > 0 ? finalAmount.toLocaleString() : ""} from wallet <ArrowRight className="w-4 h-4 ml-2" /></>)
                        : (<>Sign in to pay <ArrowRight className="w-4 h-4 ml-2" /></>)}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/40">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Payment timeline</h3>
                  <span className="text-[11px] text-muted-foreground">Live · {payments.length}</span>
                </div>
                <PaymentLinkTimeline payments={payments} emptyLabel="No payments recorded yet." />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PayLinkPage;
