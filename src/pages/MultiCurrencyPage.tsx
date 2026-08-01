import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFx, quoteFx } from "@/hooks/use-fx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowDownUp, Globe2, TrendingUp, Loader2 } from "lucide-react";
import PinConfirmSheet from "@/components/PinConfirmSheet";

export default function MultiCurrencyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currencies, wallets, conversions, loading, converting, convert, balanceOf } = useFx();
  const [bdt, setBdt] = useState(0);
  const [from, setFrom] = useState("BDT");
  const [to, setTo] = useState("USD");
  const [amount, setAmount] = useState("");
  const [pinOpen, setPinOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("balance").eq("user_id", user.id).maybeSingle();
      if (active) setBdt(Number((data as any)?.balance ?? 0));
    };
    load();
    const ch = supabase
      .channel(`fx-bdt-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, (p) => {
        setBdt(Number((p.new as any)?.balance ?? 0));
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user?.id]);

  const active = useMemo(() => currencies.filter((c) => c.is_active), [currencies]);
  const fromCur = active.find((c) => c.code === from);
  const toCur = active.find((c) => c.code === to);
  const amt = Number(amount) || 0;
  const quote = quoteFx(fromCur, toCur, amt);
  const available = from === "BDT" ? bdt : balanceOf(from);
  const insufficient = amt > 0 && amt > available;

  const swap = () => { setFrom(to); setTo(from); };

  const doConvert = async () => {
    await convert(from, to, amt);
    setAmount("");
  };

  const fmt = (v: number, code: string) => {
    const c = currencies.find((x) => x.code === code);
    return `${c?.symbol ?? ""}${v.toLocaleString(undefined, { maximumFractionDigits: c?.decimals ?? 2 })}`;
  };

  return (
    <div className="min-h-screen bg-background gpu-stable">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-base font-bold text-foreground">Multi-currency wallet</h1>
          <p className="text-xs text-muted-foreground">Hold and convert at live rates</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 pb-24">
        {/* Balances */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Globe2 className="h-3.5 w-3.5" /> Your balances
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium text-muted-foreground">BDT</p>
                <p className="mt-1 text-lg font-bold text-foreground">{fmt(bdt, "BDT")}</p>
              </CardContent>
            </Card>
            {wallets
              .filter((w) => Number(w.balance) > 0)
              .map((w) => (
                <Card key={w.id} className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-medium text-muted-foreground">{w.currency_code}</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{fmt(Number(w.balance), w.currency_code)}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>

        {/* Converter */}
        <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">From</label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {active.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" className="mb-0.5 rounded-full" onClick={swap} aria-label="Swap currencies">
                <ArrowDownUp className="h-4 w-4" />
              </Button>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground">To</label>
                <Select value={to} onValueChange={setTo}>
                  <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {active.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} · {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-muted-foreground">Amount ({from})</label>
                <span className="text-[11px] text-muted-foreground">Available {fmt(available, from)}</span>
              </div>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="h-12 rounded-2xl text-lg font-semibold"
              />
              <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                {[500, 1000, 5000, 10000].map((v) => (
                  <Button key={v} variant="secondary" size="sm" className="shrink-0 rounded-full" onClick={() => setAmount(String(v))}>
                    {v.toLocaleString()}
                  </Button>
                ))}
              </div>
            </div>

            {quote && (
              <div className="space-y-1.5 rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Mid-market rate</span><span className="font-medium text-foreground">1 {from} = {quote.midRate.toFixed(4)} {to}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FX spread</span><span className="font-medium text-foreground">{(quote.spreadBps / 100).toFixed(2)}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FX fee</span><span className="font-medium text-foreground">{fmt(quote.fee, to)}</span></div>
                <div className="flex justify-between border-t border-border/60 pt-1.5 text-sm"><span className="font-semibold text-foreground">You receive</span><span className="font-bold text-emerald-500">{fmt(quote.receive, to)}</span></div>
              </div>
            )}

            <Button
              className="h-12 w-full rounded-2xl"
              disabled={!quote || insufficient || converting}
              onClick={() => setPinOpen(true)}
            >
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : insufficient ? `Insufficient ${from} balance` : "Convert"}
            </Button>
          </CardContent>
        </Card>

        {/* Rates */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Live rates (per BDT unit)
          </h2>
          <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
            <CardContent className="divide-y divide-border/50 p-0">
              {loading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : active.filter((c) => c.code !== "BDT").map((c) => (
                <div key={c.code} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.code} <span className="text-muted-foreground">· {c.name}</span></p>
                    <p className="text-[11px] text-muted-foreground">Spread {(c.spread_bps / 100).toFixed(2)}%</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">৳{Number(c.mid_rate_bdt).toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* History */}
        {conversions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent conversions</h2>
            <Card className="rounded-[19px] border-border/60 bg-card/60 backdrop-blur-xl gpu-stable-child">
              <CardContent className="divide-y divide-border/50 p-0">
                {conversions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{fmt(Number(c.from_amount), c.from_currency)} → {fmt(Number(c.to_amount), c.to_currency)}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">fee {fmt(Number(c.fee_amount), c.fee_currency)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      <PinConfirmSheet
        open={pinOpen}
        onOpenChange={setPinOpen}
        onVerified={doConvert}
        title="Confirm conversion"
        description={quote ? `Convert ${fmt(amt, from)} to ${fmt(quote.receive, to)}` : undefined}
      />
    </div>
  );
}
