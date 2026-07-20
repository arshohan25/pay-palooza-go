import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Truck, Loader2, Package, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const COURIERS = ["Pathao", "Steadfast", "RedX", "Sundarban", "Paperfly", "eCourier", "Other"];

interface Props {
  orderId: string | null;
  orderNum?: string;
  items: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBooked?: () => void;
  merchantId?: string;
}

interface CourierStat { provider: string; shipped: number; delivered: number; avgHours: number | null; score: number; }

/**
 * Quickly book one courier for every remaining item on an order.
 * Creates one fulfillment row per item using the same tracking number,
 * then marks the order as `shipped`.
 */
export default function QuickCourierBookSheet({ orderId, orderNum, items, open, onOpenChange, onBooked, merchantId }: Props) {
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const fmt = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
  const [courier, setCourier] = useState("Pathao");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingByIdx, setExistingByIdx] = useState<Record<number, number>>({});
  const [stats, setStats] = useState<CourierStat[] | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    setTracking("");
    (async () => {
      const { data } = await (supabase as any)
        .from("order_item_fulfillments")
        .select("order_item_index, qty_shipped")
        .eq("order_id", orderId);
      const map: Record<number, number> = {};
      (data ?? []).forEach((f: any) => {
        map[f.order_item_index] = (map[f.order_item_index] || 0) + Number(f.qty_shipped || 0);
      });
      setExistingByIdx(map);
    })();
  }, [open, orderId]);

  // Smart courier scoring: pull last 90 days of merchant fulfillments,
  // compute per-provider success rate + avg delivery time.
  useEffect(() => {
    if (!open || !merchantId) return;
    (async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: mOrders } = await (supabase as any)
        .from("orders").select("id").eq("merchant_id", merchantId).gte("created_at", since).limit(1000);
      const ids = (mOrders ?? []).map((o: any) => o.id);
      if (ids.length === 0) { setStats([]); return; }
      const { data: fs } = await (supabase as any)
        .from("order_item_fulfillments")
        .select("courier_provider, status, shipped_at, delivered_at")
        .in("order_id", ids);
      const agg = new Map<string, { shipped: number; delivered: number; hours: number[] }>();
      (fs ?? []).forEach((f: any) => {
        const p = f.courier_provider || "Other";
        if (!agg.has(p)) agg.set(p, { shipped: 0, delivered: 0, hours: [] });
        const a = agg.get(p)!;
        a.shipped += 1;
        if (f.status === "delivered" || f.delivered_at) {
          a.delivered += 1;
          if (f.shipped_at && f.delivered_at) {
            a.hours.push((new Date(f.delivered_at).getTime() - new Date(f.shipped_at).getTime()) / 3600000);
          }
        }
      });
      const out: CourierStat[] = [...agg.entries()].map(([provider, a]) => {
        const rate = a.shipped > 0 ? a.delivered / a.shipped : 0;
        const avgHours = a.hours.length ? a.hours.reduce((s, x) => s + x, 0) / a.hours.length : null;
        // Score: 70% success rate + 30% speed (normalized, faster = better, cap 96h)
        const speedScore = avgHours == null ? 0.5 : Math.max(0, 1 - Math.min(avgHours, 96) / 96);
        const score = rate * 0.7 + speedScore * 0.3;
        return { provider, shipped: a.shipped, delivered: a.delivered, avgHours, score };
      }).sort((a, b) => b.score - a.score);
      setStats(out);
    })();
  }, [open, merchantId]);

  const recommended = useMemo(() => {
    if (!stats || stats.length === 0) return null;
    const top = stats[0];
    if (top.shipped < 3) return null; // need enough signal
    return top;
  }, [stats]);

  useEffect(() => {
    if (recommended && open) setCourier(recommended.provider);
  }, [recommended, open]);


  const pending = items.map((it, idx) => {
    const remaining = Math.max(0, Number(it.qty || 0) - (existingByIdx[idx] || 0));
    return { idx, item: it, remaining };
  }).filter(p => p.remaining > 0);

  const totalRemaining = pending.reduce((s, p) => s + p.remaining, 0);

  const [bookingRef, setBookingRef] = useState("");

  const book = async () => {
    if (!orderId || pending.length === 0) return;
    if (!tracking.trim()) {
      toast({ title: t("qcbErrTracking"), variant: "destructive" });
      return;
    }
    setBusy(true);
    const trk = tracking.trim();
    const ref = bookingRef.trim() || null;
    const rows = pending.map(p => ({
      order_id: orderId,
      order_item_index: p.idx,
      qty_shipped: p.remaining,
      tracking_number: trk,
      courier_provider: courier,
      status: "shipped",
    }));
    const { error } = await (supabase as any).from("order_item_fulfillments").insert(rows);
    if (!error) {
      await (supabase as any)
        .from("orders")
        .update({
          status: "shipped",
          courier_provider: courier,
          tracking_number: trk,
          courier_booking_ref: ref,
          courier_booked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      // Seed first tracking event so live timeline has a starting point
      await (supabase as any).from("courier_tracking_events").insert({
        order_id: orderId,
        courier_provider: courier,
        tracking_number: trk,
        status: "booked",
        status_label: t("qcbCourierBookedEvent"),
        note: ref ? t("qcbBookingRefNote").replace("{ref}", ref) : t("qcbAwaitingScan"),
      });
    }
    setBusy(false);
    if (error) {
      toast({ title: t("qcbErrFailed"), description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: t("qcbToastBooked").replace("{courier}", courier),
      description: t("qcbToastShipped").replace("{n}", fmt(totalRemaining)),
    });
    onOpenChange(false);
    onBooked?.();
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-4 pt-5 pb-6 max-h-[90svh] overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="flex items-center gap-2 text-[16px]">
            <Truck size={17} className="text-primary" />
            {t("qcbBookCourier")} {orderNum && <span className="font-mono text-[12px] text-muted-foreground">· {orderNum}</span>}
          </SheetTitle>
          <p className="text-[11.5px] text-muted-foreground">
            {t("qcbSubtitle")}
          </p>
        </SheetHeader>

        <div className="space-y-3">
          <div className="bg-muted/40 rounded-2xl p-3">
            <p className="text-[11px] text-muted-foreground font-semibold">{t("qcbRemaining")}</p>
            <p className="text-[15px] font-bold text-foreground">
              {t("qcbItemsProducts").replace("{items}", fmt(totalRemaining)).replace("{products}", fmt(pending.length))}
            </p>
          </div>

          {recommended && (
            <div className="rounded-2xl p-3 bg-gradient-to-br from-primary/10 via-background to-accent/10 border border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={12} className="text-primary" />
                <span className="text-[11px] font-bold text-primary uppercase tracking-wide">{t("qcbSmartPick")}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {t("qcbDelivered").replace("{n}", fmt(Math.round((recommended.delivered / recommended.shipped) * 100)))}
                </Badge>
              </div>
              <p className="text-[12px] text-foreground">
                <b>{recommended.provider}</b> {t("qcbBestFor")}
                {recommended.avgHours != null && <> · {t("qcbAvgDelivery").replace("{n}", fmt(Math.round(recommended.avgHours)))}</>}
                {" "}({t("qcbPastShipments").replace("{n}", fmt(recommended.shipped))})
              </p>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">{t("qcbCourier")}</label>
            <select value={courier} onChange={(e) => setCourier(e.target.value)}
              className="mt-1 w-full h-10 text-[13px] rounded-md border border-input bg-background px-2">
              {COURIERS.map(c => {
                const s = stats?.find(x => x.provider === c);
                const label = s && s.shipped >= 3
                  ? `${c} · ${t("qcbSuccess").replace("{n}", fmt(Math.round((s.delivered / s.shipped) * 100)))}`
                  : c;
                return <option key={c} value={c}>{label}</option>;
              })}
            </select>
          </div>


          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">{t("qcbTrackingLabel")}</label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)}
              placeholder={t("qcbTrackingPh")} className="mt-1 h-10 text-[13px]" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">{t("qcbBookingRefLabel")}</label>
            <Input value={bookingRef} onChange={(e) => setBookingRef(e.target.value)}
              placeholder={t("qcbBookingRefPh")} className="mt-1 h-10 text-[13px]" />
          </div>

          <Button onClick={book} disabled={busy || totalRemaining === 0}
            className="w-full rounded-xl h-11 gap-1.5 text-[13px] font-bold">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
            {totalRemaining === 0
              ? t("qcbNothingLeft")
              : t("qcbBookShip").replace("{courier}", courier).replace("{n}", fmt(totalRemaining))}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
