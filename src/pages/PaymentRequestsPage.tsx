import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import Seo from "@/components/Seo";
import FlowHeader from "@/components/FlowHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Link2, Plus, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";
import { motion } from "framer-motion";

type PaymentLink = {
  id: string;
  title: string;
  amount: number | null;
  currency: string;
  short_code: string;
  is_active: boolean;
  used_count: number;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string;
  description: string | null;
};

const randomCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase() +
  Math.floor(Math.random() * 900 + 100);

const linkUrl = (code: string) => `${window.location.origin}/r/${code}`;

const statusOf = (l: PaymentLink) => {
  const expired = l.expires_at && new Date(l.expires_at) < new Date();
  const exhausted = l.max_uses != null && l.used_count >= l.max_uses;
  if (!l.is_active || expired || exhausted) {
    return exhausted ? "paid" : expired ? "expired" : "inactive";
  }
  return "active";
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: Clock },
    paid: { label: "Paid", cls: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle2 },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground border-border", icon: XCircle },
    inactive: { label: "Inactive", cls: "bg-muted text-muted-foreground border-border", icon: XCircle },
  };
  const cfg = map[status] ?? map.inactive;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`${cfg.cls} gap-1`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </Badge>
  );
};

const PaymentRequestsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_links")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setLinks((data ?? []) as PaymentLink[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Please sign in first");
    if (!title.trim()) return toast.error("Title is required");
    const amt = amount.trim() ? parseFloat(amount) : null;
    if (amt != null && (!Number.isFinite(amt) || amt <= 0)) {
      return toast.error("Amount must be a positive number");
    }
    setCreating(true);
    const short_code = randomCode();
    const { error } = await supabase.from("payment_links").insert({
      title: title.trim(),
      amount: amt,
      currency: "BDT",
      short_code,
      description: description.trim() || null,
      created_by: user.id,
      is_active: true,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Payment link created");
    setTitle(""); setAmount(""); setDescription("");
    load();
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkUrl(code));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const toggleActive = async (l: PaymentLink) => {
    const { error } = await supabase
      .from("payment_links")
      .update({ is_active: !l.is_active })
      .eq("id", l.id);
    if (error) return toast.error(error.message);
    load();
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Sign in to create payment requests.</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo title="Payment Requests" description="Create shareable payment request links and track their status." path="/payment-requests" />
      <FlowHeader title="Payment Requests" tagline="Share a link to get paid" />

      <div className="max-w-md mx-auto px-4 pt-4 space-y-6">
        <Card className="border-border/40 shadow-card">
          <CardContent className="p-5">
            <form onSubmit={submit} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Plus className="w-4 h-4 text-primary" /> New request
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-title">What's it for?</Label>
                <Input id="pr-title" placeholder="e.g. Rent for July" value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-amount">Amount (BDT) <span className="text-muted-foreground font-normal">— leave blank for payer to choose</span></Label>
                <Input id="pr-amount" type="number" min="1" step="1" placeholder="1000" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-desc">Note (optional)</Label>
                <Textarea id="pr-desc" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <Button type="submit" className="w-full rounded-xl h-11" disabled={creating}>
                {creating ? "Creating…" : "Create payment link"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Your links
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment links yet. Create your first one above.</p>
          ) : (
            <ul className="space-y-3">
              {links.map((l) => {
                const s = statusOf(l);
                return (
                  <motion.li
                    key={l.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{l.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {l.amount != null ? `৳${Number(l.amount).toLocaleString()}` : "Payer chooses"}
                          {" · "}
                          {l.used_count} paid
                          {l.max_uses ? ` / ${l.max_uses}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={s} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted rounded-lg px-2 py-1.5 truncate">{linkUrl(l.short_code)}</code>
                      <Button size="icon" variant="outline" onClick={() => copy(l.short_code)} title="Copy">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => window.open(linkUrl(l.short_code), "_blank")} title="Open">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        onClick={() => toggleActive(l)}
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      >
                        {l.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentRequestsPage;
