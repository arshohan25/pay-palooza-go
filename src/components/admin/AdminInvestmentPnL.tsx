import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Loader2, Download, ArrowUpDown, Coins, LineChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGoldPrice } from "@/hooks/use-gold-price";
import { useStockPrices } from "@/hooks/use-stock-prices";

type Filter = "all" | "winners" | "losers";
type SortDir = "desc" | "asc";

interface GoldRow {
  id: string;
  user_id: string;
  karat: string;
  grams: number;
  avg_buy_price: number;
  profiles: { name: string | null; phone: string | null } | null;
}
interface StockRow {
  id: string;
  user_id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_buy_price: number;
  current_price: number | null;
  profiles: { name: string | null; phone: string | null } | null;
}

export default function AdminInvestmentPnL() {
  const { price22k, price24k } = useGoldPrice();
  const { stocks: liveStocks } = useStockPrices();
  const [gold, setGold] = useState<GoldRow[]>([]);
  const [stocksH, setStocksH] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from("gold_holdings").select("id,user_id,karat,grams,avg_buy_price,profiles!inner(name,phone)").gt("grams", 0),
      supabase.from("stock_holdings").select("id,user_id,symbol,name,quantity,avg_buy_price,current_price,profiles!inner(name,phone)").gt("quantity", 0),
    ]);
    setGold((g as any) ?? []);
    setStocksH((s as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Live sync: realtime updates on holdings
  useEffect(() => {
    const ch = supabase
      .channel("admin-investment-pnl")
      .on("postgres_changes", { event: "*", schema: "public", table: "gold_holdings" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_holdings" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Merge live stock prices into rows for instant updates
  useEffect(() => {
    if (!liveStocks.length) return;
    setStocksH(prev => prev.map(h => {
      const live = liveStocks.find(l => l.symbol === h.symbol);
      return live ? { ...h, current_price: live.price } : h;
    }));
  }, [liveStocks]);

  const goldPx = (k: string) => (k === "24k" ? price24k : price22k);

  const goldRows = useMemo(() => gold.map(r => {
    const cur = goldPx(r.karat);
    const invested = Number(r.avg_buy_price) * Number(r.grams);
    const value = cur * Number(r.grams);
    const pl = value - invested;
    const pct = invested > 0 ? (pl / invested) * 100 : 0;
    return { ...r, current: cur, invested, value, pl, pct };
  }), [gold, price22k, price24k]);

  const stockRows = useMemo(() => stocksH.map(r => {
    const cur = Number(r.current_price ?? r.avg_buy_price);
    const invested = Number(r.avg_buy_price) * Number(r.quantity);
    const value = cur * Number(r.quantity);
    const pl = value - invested;
    const pct = invested > 0 ? (pl / invested) * 100 : 0;
    return { ...r, current: cur, invested, value, pl, pct };
  }), [stocksH]);

  const totals = useMemo(() => {
    const gi = goldRows.reduce((s, r) => s + r.invested, 0);
    const gv = goldRows.reduce((s, r) => s + r.value, 0);
    const si = stockRows.reduce((s, r) => s + r.invested, 0);
    const sv = stockRows.reduce((s, r) => s + r.value, 0);
    return { gi, gv, gpl: gv - gi, gpct: gi > 0 ? ((gv - gi) / gi) * 100 : 0, si, sv, spl: sv - si, spct: si > 0 ? ((sv - si) / si) * 100 : 0 };
  }, [goldRows, stockRows]);

  const applyFilters = <T extends { pl: number; profiles: { name: string | null; phone: string | null } | null }>(rows: T[]) => {
    let out = rows;
    if (filter === "winners") out = out.filter(r => r.pl > 0);
    if (filter === "losers") out = out.filter(r => r.pl < 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r => (r.profiles?.name ?? "").toLowerCase().includes(q) || (r.profiles?.phone ?? "").includes(q));
    }
    return [...out].sort((a, b) => sortDir === "desc" ? b.pl - a.pl : a.pl - b.pl);
  };

  const exportCSV = (kind: "gold" | "stocks") => {
    const rows = kind === "gold"
      ? [["User", "Phone", "Karat", "Grams", "Avg Buy", "Current", "Invested", "Value", "P/L", "P/L %"],
         ...applyFilters(goldRows).map(r => [r.profiles?.name ?? "", r.profiles?.phone ?? "", r.karat, r.grams, r.avg_buy_price, r.current.toFixed(2), r.invested.toFixed(2), r.value.toFixed(2), r.pl.toFixed(2), r.pct.toFixed(2)])]
      : [["User", "Phone", "Symbol", "Qty", "Avg Buy", "Current", "Invested", "Value", "P/L", "P/L %"],
         ...applyFilters(stockRows).map(r => [r.profiles?.name ?? "", r.profiles?.phone ?? "", r.symbol, r.quantity, r.avg_buy_price, r.current.toFixed(2), r.invested.toFixed(2), r.value.toFixed(2), r.pl.toFixed(2), r.pct.toFixed(2)])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${kind}-pnl-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Investment P/L
        <Badge variant="secondary" className="text-[10px] ml-1">Live</Badge>
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <SummaryCard icon={<Coins className="w-3.5 h-3.5" />} label="Gold Invested" value={totals.gi} />
        <SummaryCard icon={<Coins className="w-3.5 h-3.5" />} label="Gold Value" value={totals.gv} pl={totals.gpl} pct={totals.gpct} />
        <SummaryCard icon={<LineChart className="w-3.5 h-3.5" />} label="Stocks Invested" value={totals.si} />
        <SummaryCard icon={<LineChart className="w-3.5 h-3.5" />} label="Stocks Value" value={totals.sv} pl={totals.spl} pct={totals.spct} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search user / phone…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-xs flex-1 min-w-[160px]" />
        <div className="flex items-center gap-1">
          {(["all", "winners", "losers"] as Filter[]).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-xs px-2 capitalize" onClick={() => setFilter(f)}>{f}</Button>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}>
            <ArrowUpDown className="w-3 h-3 mr-1" /> P/L {sortDir === "desc" ? "↓" : "↑"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="gold" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-auto">
          <TabsTrigger value="gold" className="text-xs">Gold ({goldRows.length})</TabsTrigger>
          <TabsTrigger value="stocks" className="text-xs">Stocks ({stockRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="gold">
          {loading ? <Loader /> : (
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-2 border-b border-border">
                  <p className="text-xs text-muted-foreground">22k: ৳{price22k.toLocaleString()}/g · 24k: ৳{price24k.toLocaleString()}/g</p>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => exportCSV("gold")}><Download className="w-3.5 h-3.5" /></Button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium text-xs">User</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Grams</th>
                    <th className="text-right px-3 py-2 font-medium text-xs hidden sm:table-cell">Avg / Cur</th>
                    <th className="text-right px-3 py-2 font-medium text-xs hidden md:table-cell">Invested</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Value</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">P/L</th>
                  </tr></thead>
                  <tbody>
                    {applyFilters(goldRows).map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <p className="text-xs font-medium truncate max-w-[120px]">{r.profiles?.name ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{r.profiles?.phone ?? ""} · {r.karat}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-right">{Number(r.grams).toFixed(3)}g</td>
                        <td className="px-3 py-2 text-xs text-right hidden sm:table-cell">৳{Number(r.avg_buy_price).toLocaleString()} / ৳{r.current.toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs text-right hidden md:table-cell">৳{r.invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-xs text-right font-semibold">৳{r.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-right"><PnLBadge pl={r.pl} pct={r.pct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {goldRows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No gold holdings</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stocks">
          {loading ? <Loader /> : (
            <Card className="border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-2 border-b border-border">
                  <p className="text-xs text-muted-foreground">{stockRows.length} positions · live polled 30s</p>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => exportCSV("stocks")}><Download className="w-3.5 h-3.5" /></Button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-3 py-2 font-medium text-xs">User</th>
                    <th className="text-left px-3 py-2 font-medium text-xs">Symbol</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Qty</th>
                    <th className="text-right px-3 py-2 font-medium text-xs hidden sm:table-cell">Avg / Cur</th>
                    <th className="text-right px-3 py-2 font-medium text-xs hidden md:table-cell">Invested</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">Value</th>
                    <th className="text-right px-3 py-2 font-medium text-xs">P/L</th>
                  </tr></thead>
                  <tbody>
                    {applyFilters(stockRows).map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <p className="text-xs font-medium truncate max-w-[120px]">{r.profiles?.name ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{r.profiles?.phone ?? ""}</p>
                        </td>
                        <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{r.symbol}</Badge></td>
                        <td className="px-3 py-2 text-xs text-right">{r.quantity}</td>
                        <td className="px-3 py-2 text-xs text-right hidden sm:table-cell">৳{Number(r.avg_buy_price).toFixed(2)} / ৳{r.current.toFixed(2)}</td>
                        <td className="px-3 py-2 text-xs text-right hidden md:table-cell">৳{r.invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-xs text-right font-semibold">৳{r.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-2 text-right"><PnLBadge pl={r.pl} pct={r.pct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stockRows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No stock holdings</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon, label, value, pl, pct }: { icon: React.ReactNode; label: string; value: number; pl?: number; pct?: number }) {
  const positive = (pl ?? 0) >= 0;
  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon}<span>{label}</span></div>
        <p className="text-sm font-bold text-foreground mt-0.5">৳{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        {pl !== undefined && (
          <Badge variant="secondary" className={`text-[10px] mt-1 ${positive ? "text-emerald-600" : "text-destructive"}`}>
            {positive ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
            ৳{Math.abs(pl).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pct?.toFixed(2)}%)
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function PnLBadge({ pl, pct }: { pl: number; pct: number }) {
  const positive = pl >= 0;
  return (
    <div className={`text-xs font-semibold ${positive ? "text-emerald-600" : "text-destructive"}`}>
      {positive ? "+" : "−"}৳{Math.abs(pl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
      <p className="text-[10px] font-normal">{positive ? "+" : ""}{pct.toFixed(2)}%</p>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
}
