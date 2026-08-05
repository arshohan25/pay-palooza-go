import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Route, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface OrderRow {
  shipping_city: string | null;
  courier_provider: string | null;
  delivery_fee: number | null;
  courier_booked_at: string | null;
  courier_last_scan_at: string | null;
  status: string | null;
}

interface Suggestion {
  city: string;
  courier: string;
  avgFee: number;
  avgDays: number | null;
  shipments: number;
  savings: number;
}

export default function MerchantCourierRoutingCard({ merchantId }: { merchantId: string }) {
  const { t, lang } = useI18n();
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-BD", { maximumFractionDigits: 0 }).format(n);
  const [rows, setRows] = useState<OrderRow[] | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data } = await (supabase as any)
      .from("orders")
      .select("shipping_city, courier_provider, delivery_fee, courier_booked_at, courier_last_scan_at, status")
      .eq("merchant_id", merchantId)
      .gte("created_at", since)
      .not("courier_provider", "is", null)
      .limit(1000);
    setRows((data as OrderRow[]) ?? []);
  }, [merchantId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`merchant-routing-${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `merchant_id=eq.${merchantId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, merchantId]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!rows) return [];
    // city -> courier -> stats
    const byCity = new Map<string, Map<string, { fee: number; n: number; days: number; dn: number }>>();
    for (const r of rows) {
      const city = (r.shipping_city || "").trim();
      const courier = (r.courier_provider || "").trim();
      if (!city || !courier) continue;
      if (!byCity.has(city)) byCity.set(city, new Map());
      const m = byCity.get(city)!;
      const s = m.get(courier) ?? { fee: 0, n: 0, days: 0, dn: 0 };
      s.fee += Number(r.delivery_fee || 0);
      s.n += 1;
      if (r.courier_booked_at && r.courier_last_scan_at) {
        const d = (new Date(r.courier_last_scan_at).getTime() - new Date(r.courier_booked_at).getTime()) / 86400000;
        if (d >= 0 && d < 30) { s.days += d; s.dn += 1; }
      }
      m.set(courier, s);
    }

    const out: Suggestion[] = [];
    for (const [city, m] of byCity) {
      const entries = [...m.entries()].map(([courier, s]) => ({
        courier,
        avgFee: s.n > 0 ? s.fee / s.n : 0,
        avgDays: s.dn > 0 ? s.days / s.dn : null,
        shipments: s.n,
      }));
      if (entries.length === 0) continue;
      const sorted = [...entries].sort((a, b) => a.avgFee - b.avgFee);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      out.push({
        city,
        courier: best.courier,
        avgFee: best.avgFee,
        avgDays: best.avgDays,
        shipments: entries.reduce((s, e) => s + e.shipments, 0),
        savings: Math.max(0, worst.avgFee - best.avgFee),
      });
    }
    return out.sort((a, b) => b.shipments - a.shipments).slice(0, 8);
  }, [rows]);

  if (!rows) {
    return (
      <Card className="p-4 border-0 shadow-card rounded-2xl flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-muted-foreground" />
        <span className="text-[12px] text-muted-foreground">{t("mcrLoading")}</span>
      </Card>
    );
  }

  return (
    <Card className="p-3 border-0 shadow-card rounded-2xl space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Route size={16} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{t("mcrTitle")}</p>
          <p className="text-[11px] text-muted-foreground">{t("mcrSubtitle")}</p>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <p className="text-[12px] text-muted-foreground text-center py-3">{t("mcrEmpty")}</p>
      ) : (
        <div className="space-y-1.5">
          {suggestions.map((s) => (
            <div key={s.city} className="flex items-center gap-2 bg-muted/40 rounded-xl px-2.5 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-foreground truncate">{s.city}</p>
                <p className="text-[10.5px] text-muted-foreground">
                  {t("mcrUse").replace("{courier}", s.courier)}
                  {s.avgDays != null ? ` · ${t("mcrAvgDays").replace("{n}", s.avgDays.toFixed(1))}` : ""}
                  {` · ${t("mcrShipments").replace("{n}", fmt(s.shipments))}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12px] font-bold text-foreground">৳{fmt(Math.round(s.avgFee))}</p>
                {s.savings > 0 && (
                  <p className="text-[10px] font-bold text-emerald-600">
                    {t("mcrSaves").replace("{n}", fmt(Math.round(s.savings)))}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
