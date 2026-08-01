import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFx, FxCurrency } from "@/hooks/use-fx";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Save, History } from "lucide-react";

interface RateHistoryRow {
  id: string;
  code: string;
  old_rate: number | null;
  new_rate: number;
  new_spread_bps: number | null;
  created_at: string;
}

export default function AdminFxRatesPage() {
  const navigate = useNavigate();
  const { currencies, loading, reload } = useFx();
  const [draft, setDraft] = useState<Record<string, { rate: string; spread: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [history, setHistory] = useState<RateHistoryRow[]>([]);

  useEffect(() => {
    supabase
      .from("fx_rate_history" as any)
      .select("id,code,old_rate,new_rate,new_spread_bps,created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory(((data as any) ?? []) as RateHistoryRow[]));
  }, [currencies]);

  const valueFor = (c: FxCurrency) => draft[c.code] ?? { rate: String(c.mid_rate_bdt), spread: String(c.spread_bps) };

  const setField = (code: string, field: "rate" | "spread", v: string) =>
    setDraft((d) => ({ ...d, [code]: { ...(d[code] ?? { rate: "", spread: "" }), ...valueFallback(code), [field]: v } }));

  const valueFallback = (code: string) => {
    const c = currencies.find((x) => x.code === code);
    return c ? { rate: String(c.mid_rate_bdt), spread: String(c.spread_bps) } : {};
  };

  const save = async (c: FxCurrency) => {
    const v = valueFor(c);
    const rate = Number(v.rate);
    const spread = Number(v.spread);
    if (!rate || rate <= 0) { toast.error("Rate must be greater than zero"); return; }
    if (spread < 0 || spread > 2000) { toast.error("Spread must be between 0 and 2000 bps"); return; }
    setSaving(c.code);
    const { error } = await supabase
      .from("fx_currencies" as any)
      .update({ mid_rate_bdt: rate, spread_bps: spread, rate_source: "manual" } as any)
      .eq("code", c.code);
    setSaving(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`${c.code} updated`);
    setDraft((d) => { const n = { ...d }; delete n[c.code]; return n; });
    await reload();
  };

  const toggle = async (c: FxCurrency, is_active: boolean) => {
    const { error } = await supabase.from("fx_currencies" as any).update({ is_active } as any).eq("code", c.code);
    if (error) { toast.error(error.message); return; }
    await reload();
  };

  return (
    <div className="min-h-screen bg-background gpu-stable">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-base font-bold text-foreground">FX rates & currencies</h1>
          <p className="text-xs text-muted-foreground">Mid-market rate to BDT and the spread charged on conversions</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-4">
        <Card className="rounded-[19px] border-border/60">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead>Rate (1 unit = BDT)</TableHead>
                  <TableHead>Spread (bps)</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Loading…</TableCell></TableRow>
                ) : currencies.map((c) => {
                  const v = valueFor(c);
                  const dirty = Number(v.rate) !== Number(c.mid_rate_bdt) || Number(v.spread) !== Number(c.spread_bps);
                  return (
                    <TableRow key={c.code}>
                      <TableCell>
                        <p className="font-medium text-foreground">{c.symbol} {c.code}</p>
                        <p className="text-[11px] text-muted-foreground">{c.name}</p>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-9 w-32"
                          inputMode="decimal"
                          disabled={c.code === "BDT"}
                          value={v.rate}
                          onChange={(e) => setField(c.code, "rate", e.target.value.replace(/[^\d.]/g, ""))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-9 w-24"
                          inputMode="numeric"
                          disabled={c.code === "BDT"}
                          value={v.spread}
                          onChange={(e) => setField(c.code, "spread", e.target.value.replace(/\D/g, ""))}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch checked={c.is_active} disabled={c.code === "BDT"} onCheckedChange={(x) => toggle(c, x)} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || saving === c.code} onClick={() => save(c)}>
                          <Save className="mr-1 h-3.5 w-3.5" />Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Recent rate changes
          </h2>
          <Card className="rounded-[19px] border-border/60">
            <CardContent className="divide-y divide-border/50 p-0">
              {history.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No rate changes recorded yet.</p>
              ) : history.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">{h.code}</span>
                  <span className="text-muted-foreground">
                    ৳{Number(h.old_rate ?? 0).toFixed(4)} → <span className="font-semibold text-foreground">৳{Number(h.new_rate).toFixed(4)}</span>
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{((h.new_spread_bps ?? 0) / 100).toFixed(2)}%</Badge>
                  <span className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
