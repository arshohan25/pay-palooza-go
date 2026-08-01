import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchantPlans, INTERVAL_LABEL, MerchantPlan } from "@/hooks/use-subscriptions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil, Repeat, Users, TrendingUp, Copy } from "lucide-react";
import { toast } from "sonner";

const emptyForm = {
  name: "",
  description: "",
  amount: "",
  billing_interval: "monthly" as MerchantPlan["billing_interval"],
  interval_count: "1",
  trial_days: "0",
};

export default function MerchantPlansPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchantId, setMerchantId] = useState<string>();
  const { plans, subs, charges, loading, savePlan, togglePlan, deletePlan, mrr } = useMerchantPlans(merchantId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("merchants").select("id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setMerchantId((data as any)?.id));
  }, [user?.id]);

  const activeSubs = useMemo(() => subs.filter((s) => s.status === "active" || s.status === "trialing"), [subs]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: MerchantPlan) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      amount: String(p.amount),
      billing_interval: p.billing_interval,
      interval_count: String(p.interval_count),
      trial_days: String(p.trial_days),
    });
    setOpen(true);
  };

  const submit = async () => {
    const amount = Number(form.amount);
    if (!form.name.trim() || !amount || amount <= 0) { toast.error("Enter a plan name and amount"); return; }
    setSaving(true);
    try {
      await savePlan({
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        description: form.description.trim() || null,
        amount,
        billing_interval: form.billing_interval,
        interval_count: Math.max(1, Number(form.interval_count) || 1),
        trial_days: Math.max(0, Number(form.trial_days) || 0),
      } as any);
      setOpen(false);
    } finally { setSaving(false); }
  };

  const copyLink = (p: MerchantPlan) => {
    navigator.clipboard.writeText(`${window.location.origin}/subscribe/${p.id}`);
    toast.success("Subscribe link copied");
  };

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-500",
    trialing: "bg-sky-500/15 text-sky-500",
    past_due: "bg-amber-500/15 text-amber-500",
    paused: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="min-h-screen bg-background gpu-stable">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={() => navigate("/merchant")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Plans & recurring billing</h1>
          <p className="text-xs text-muted-foreground">Auto-debit your subscribers on a schedule</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="mr-1 h-4 w-4" />New plan</Button>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active subs", value: activeSubs.length, icon: Users },
            { label: "Est. MRR", value: `৳${Math.round(mrr).toLocaleString()}`, icon: TrendingUp },
            { label: "Plans", value: plans.length, icon: Repeat },
          ].map((k) => (
            <Card key={k.label} className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
              <CardContent className="p-4">
                <k.icon className="mb-2 h-4 w-4 text-muted-foreground" />
                <p className="text-lg font-bold text-foreground">{k.value}</p>
                <p className="text-[11px] text-muted-foreground">{k.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plans</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : plans.length === 0 ? (
            <Card className="rounded-[19px] border-dashed border-border/60"><CardContent className="p-6 text-center text-sm text-muted-foreground">No plans yet. Create one to start recurring billing.</CardContent></Card>
          ) : plans.map((p) => (
            <Card key={p.id} className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ৳{Number(p.amount).toLocaleString()} every {p.interval_count > 1 ? `${p.interval_count} ` : ""}
                    {INTERVAL_LABEL[p.billing_interval]}{p.interval_count > 1 ? "s" : ""}
                    {p.trial_days > 0 && ` · ${p.trial_days}-day trial`}
                  </p>
                </div>
                <Switch checked={p.is_active} onCheckedChange={(v) => togglePlan(p.id, v)} />
                <Button size="icon" variant="ghost" onClick={() => copyLink(p)} aria-label="Copy subscribe link"><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(p)} aria-label="Edit plan"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePlan(p.id)} aria-label="Delete plan"><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscribers</h2>
          <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
            <CardContent className="divide-y divide-border/50 p-0">
              {subs.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No subscribers yet.</p>
              ) : subs.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.merchant_plans?.name ?? "Plan"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Next charge {new Date(s.next_charge_at).toLocaleDateString()} · {s.charges_count} paid
                    </p>
                  </div>
                  <Badge className={`border-0 text-[10px] ${statusColor[s.status]}`}>{s.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent charges</h2>
          <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
            <CardContent className="divide-y divide-border/50 p-0">
              {charges.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No charges yet.</p>
              ) : charges.map((c) => (
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
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit plan" : "New plan"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Plan name</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Gold membership" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Amount (৳)</label>
                <Input inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d.]/g, "") }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Interval</label>
                <Select value={form.billing_interval} onValueChange={(v) => setForm((f) => ({ ...f, billing_interval: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["daily", "weekly", "monthly", "yearly"].map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Every N intervals</label>
                <Input inputMode="numeric" value={form.interval_count} onChange={(e) => setForm((f) => ({ ...f, interval_count: e.target.value.replace(/\D/g, "") }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Trial days</label>
                <Input inputMode="numeric" value={form.trial_days} onChange={(e) => setForm((f) => ({ ...f, trial_days: e.target.value.replace(/\D/g, "") }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save plan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
