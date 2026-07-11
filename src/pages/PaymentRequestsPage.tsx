import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Link2, Plus, ExternalLink, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, TrendingUp, History, Filter } from "lucide-react";
import { motion } from "framer-motion";
import PaymentLinkTimeline, { LinkPaymentRow } from "@/components/PaymentLinkTimeline";
import { format, subDays } from "date-fns";

type PaymentLink = {
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
  created_at: string;
  description: string | null;
};

type ReceivedPayment = LinkPaymentRow & { link_id: string; payer_id: string };

const randomCode = () =>
  Math.random().toString(36).slice(2, 8).toUpperCase() +
  Math.floor(Math.random() * 900 + 100);

const linkUrl = (code: string) => `${window.location.origin}/r/${code}`;

const statusOf = (l: PaymentLink) => {
  if (l.amount != null && Number(l.amount_paid ?? 0) >= Number(l.amount)) return "paid";
  const expired = l.expires_at && new Date(l.expires_at) < new Date();
  const exhausted = l.max_uses != null && l.used_count >= l.max_uses;
  if (!l.is_active) return "inactive";
  if (expired) return "expired";
  if (exhausted) return "exhausted";
  return "active";
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: Clock },
    paid: { label: "Paid", cls: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle2 },
    exhausted: { label: "Exhausted", cls: "bg-primary/10 text-primary border-primary/30", icon: CheckCircle2 },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground border-border", icon: XCircle },
    inactive: { label: "Inactive", cls: "bg-muted text-muted-foreground border-border", icon: XCircle },
  };
  const cfg = map[status] ?? map.inactive;
  const Icon = cfg.icon;
  return <Badge variant="outline" className={`${cfg.cls} gap-1`}><Icon className="w-3 h-3" /> {cfg.label}</Badge>;
};

const PaymentRequestsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [payments, setPayments] = useState<ReceivedPayment[]>([]);
  const [payerNames, setPayerNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expandedLink, setExpandedLink] = useState<string | null>(null);

  // Filters for history section
  const [filterLink, setFilterLink] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<string>("30");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: linksData, error: le }, { data: paysData }] = await Promise.all([
      supabase.from("payment_links").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("payment_link_payments").select("id,link_id,payer_id,amount,status,created_at,transaction_id,refunded_at,refund_reason").eq("payee_id", user.id).order("created_at", { ascending: false }).limit(500),
    ]);
    if (le) toast.error(le.message);
    setLinks((linksData ?? []) as PaymentLink[]);
    const pays = (paysData ?? []) as ReceivedPayment[];
    setPayments(pays);

    // Fetch payer names
    const payerIds = Array.from(new Set(pays.map(p => p.payer_id))).filter(Boolean);
    if (payerIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id,name").in("user_id", payerIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { if (p.name) map[p.user_id] = p.name; });
      setPayerNames(map);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Realtime: keep links + payments fresh
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`pr-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_links", filter: `created_by=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "payment_link_payments", filter: `payee_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

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
    try { await navigator.clipboard.writeText(linkUrl(code)); toast.success("Link copied"); }
    catch { toast.error("Could not copy"); }
  };

  const toggleActive = async (l: PaymentLink) => {
    const { error } = await supabase.from("payment_links").update({ is_active: !l.is_active }).eq("id", l.id);
    if (error) return toast.error(error.message);
    load();
  };

  const paymentsByLink = useMemo(() => {
    const map: Record<string, ReceivedPayment[]> = {};
    for (const p of payments) (map[p.link_id] ??= []).push({ ...p, payer_name: payerNames[p.payer_id] });
    return map;
  }, [payments, payerNames]);

  const filteredPayments = useMemo(() => {
    const cutoff = filterRange === "all" ? null : subDays(new Date(), parseInt(filterRange, 10));
    return payments
      .filter(p => filterLink === "all" || p.link_id === filterLink)
      .filter(p => !cutoff || new Date(p.created_at) >= cutoff);
  }, [payments, filterLink, filterRange]);

  const totals = useMemo(() => {
    const total = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
    return { count: filteredPayments.length, total };
  }, [filteredPayments]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Sign in to create payment requests.</div>;

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
                <p className="text-[11px] text-muted-foreground">Payers can settle it in one go or in partial payments.</p>
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

        {/* Received payments dashboard */}
        <Card className="border-border/40">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> Received payments
              </h3>
              <span className="text-[11px] text-muted-foreground">Live</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-primary/5 rounded-xl p-3">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Total received</p>
                <p className="text-lg font-bold text-foreground flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-primary" /> ৳{totals.total.toLocaleString()}
                </p>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Payments</p>
                <p className="text-lg font-bold text-foreground">{totals.count}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={filterLink} onValueChange={setFilterLink}>
                <SelectTrigger className="h-9 text-xs"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All links</SelectItem>
                  {links.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterRange} onValueChange={setFilterRange}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredPayments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">No payments in this period.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {filteredPayments.slice(0, 25).map(p => {
                  const link = links.find(l => l.id === p.link_id);
                  return (
                    <li key={p.id} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{link?.title ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {payerNames[p.payer_id] ?? "Unknown payer"} · {format(new Date(p.created_at), "d MMM, HH:mm")}
                        </p>
                        {p.transaction_id && (
                          <p className="text-[10px] font-mono text-muted-foreground">ref {p.transaction_id.slice(0, 8).toUpperCase()}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-emerald-600">+৳{Number(p.amount).toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Links list */}
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
                const linkPays = paymentsByLink[l.id] ?? [];
                const remaining = l.amount != null ? Math.max(Number(l.amount) - Number(l.amount_paid ?? 0), 0) : null;
                const expanded = expandedLink === l.id;
                return (
                  <motion.li key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{l.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {l.amount != null
                            ? <>৳{Number(l.amount_paid ?? 0).toLocaleString()} / ৳{Number(l.amount).toLocaleString()}
                              {remaining != null && remaining > 0 && <span className="text-primary"> · ৳{remaining.toLocaleString()} left</span>}</>
                            : `${l.used_count} payments · payer chooses`}
                        </p>
                      </div>
                      <StatusBadge status={s} />
                    </div>

                    {l.amount != null && (
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (Number(l.amount_paid ?? 0) / Number(l.amount)) * 100)}%` }}
                        />
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted rounded-lg px-2 py-1.5 truncate">{linkUrl(l.short_code)}</code>
                      <Button size="icon" variant="outline" onClick={() => copy(l.short_code)} title="Copy"><Copy className="w-4 h-4" /></Button>
                      <Button size="icon" variant="outline" onClick={() => window.open(linkUrl(l.short_code), "_blank")} title="Open"><ExternalLink className="w-4 h-4" /></Button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <button
                        onClick={() => setExpandedLink(expanded ? null : l.id)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Timeline ({linkPays.length})
                      </button>
                      <button
                        onClick={() => toggleActive(l)}
                        className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                      >
                        {l.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>

                    {expanded && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <PaymentLinkTimeline payments={linkPays} emptyLabel="No payments on this link yet." />
                      </div>
                    )}
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
