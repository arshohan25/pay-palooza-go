import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Lock, Wallet, ArrowRight, Home } from "lucide-react";
import { toast } from "sonner";
import { haptics } from "@/lib/haptics";
import { fireSuccessConfetti } from "@/lib/confetti";
import { playPaymentSuccess, playPaymentError } from "@/lib/sounds";

type Link = {
  id: string;
  title: string;
  amount: number | null;
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
  const [success, setSuccess] = useState<{ amount: number; reference: string; payee: string } | null>(null);

  useEffect(() => {
    if (!shortCode) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_links")
        .select("id,title,amount,currency,short_code,is_active,used_count,max_uses,expires_at,description,created_by")
        .eq("short_code", shortCode)
        .maybeSingle();
      if (error) setError(error.message);
      else if (!data) setError("This payment link doesn't exist.");
      else {
        setLink(data as Link);
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
  }, [shortCode]);

  const status = useMemo(() => {
    if (!link) return "loading";
    if (!link.is_active) return "inactive";
    if (link.expires_at && new Date(link.expires_at) < new Date()) return "expired";
    if (link.max_uses != null && link.used_count >= link.max_uses) return "exhausted";
    return "ready";
  }, [link]);

  const finalAmount = link?.amount != null ? Number(link.amount) : parseFloat(customAmount || "0");

  const pay = async () => {
    if (!user) {
      navigate(`/?next=${encodeURIComponent(`/r/${shortCode}`)}`);
      return;
    }
    if (!link) return;
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return toast.error("Enter a valid amount");
    }
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke("pay-link", {
        body: { short_code: link.short_code, amount: link.amount == null ? finalAmount : undefined },
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background flex items-center justify-center p-4">
      <Seo title={`Pay: ${link.title}`} description={`Pay ${link.title} securely from your wallet.`} path={`/r/${link.short_code}`} />
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm"
          >
            <Card className="border-emerald-500/30 shadow-xl">
              <CardContent className="p-8 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto"
                >
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
          <motion.div
            key="pay"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm"
          >
            <Card className="shadow-xl border-border/40">
              <CardContent className="p-6 space-y-5">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment request</p>
                  <h1 className="text-lg font-bold text-foreground">{link.title}</h1>
                  {payeeName && <p className="text-sm text-muted-foreground">from {payeeName}</p>}
                </div>

                {link.description && (
                  <p className="text-sm text-center text-muted-foreground bg-muted/50 rounded-xl p-3">
                    {link.description}
                  </p>
                )}

                {status !== "ready" ? (
                  <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm text-center">
                    {status === "expired" && "This link has expired."}
                    {status === "exhausted" && "This link has already been paid."}
                    {status === "inactive" && "This link is no longer active."}
                  </div>
                ) : (
                  <>
                    {link.amount != null ? (
                      <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
                        <p className="text-4xl font-bold text-foreground mt-1">
                          ৳{Number(link.amount).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium">Enter amount (BDT)</label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
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
                      disabled={paying || (link.amount == null && !(finalAmount > 0))}
                    >
                      {paying ? (
                        "Processing…"
                      ) : user ? (
                        <>Pay from wallet <ArrowRight className="w-4 h-4 ml-2" /></>
                      ) : (
                        <>Sign in to pay <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                      <Lock className="w-3 h-3" /> Secured by EasyPay
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PayLinkPage;
