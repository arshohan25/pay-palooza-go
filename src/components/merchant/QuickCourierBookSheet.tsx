import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Loader2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const COURIERS = ["Pathao", "Steadfast", "RedX", "Sundarban", "Paperfly", "eCourier", "Other"];

interface Props {
  orderId: string | null;
  orderNum?: string;
  items: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBooked?: () => void;
}

/**
 * Quickly book one courier for every remaining item on an order.
 * Creates one fulfillment row per item using the same tracking number,
 * then marks the order as `shipped`.
 */
export default function QuickCourierBookSheet({ orderId, orderNum, items, open, onOpenChange, onBooked }: Props) {
  const { toast } = useToast();
  const [courier, setCourier] = useState("Pathao");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingByIdx, setExistingByIdx] = useState<Record<number, number>>({});

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

  const pending = items.map((it, idx) => {
    const remaining = Math.max(0, Number(it.qty || 0) - (existingByIdx[idx] || 0));
    return { idx, item: it, remaining };
  }).filter(p => p.remaining > 0);

  const totalRemaining = pending.reduce((s, p) => s + p.remaining, 0);

  const [bookingRef, setBookingRef] = useState("");

  const book = async () => {
    if (!orderId || pending.length === 0) return;
    if (!tracking.trim()) {
      toast({ title: "Tracking number required", variant: "destructive" });
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
        status_label: "Courier Booked",
        note: ref ? `Booking Ref: ${ref}` : "Awaiting first scan",
      });
    }
    setBusy(false);
    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Courier booked · ${courier}`, description: `${totalRemaining} item(s) marked shipped` });
    onOpenChange(false);
    onBooked?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-4 pt-5 pb-6 max-h-[90svh] overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="flex items-center gap-2 text-[16px]">
            <Truck size={17} className="text-primary" />
            Book Courier {orderNum && <span className="font-mono text-[12px] text-muted-foreground">· {orderNum}</span>}
          </SheetTitle>
          <p className="text-[11.5px] text-muted-foreground">
            Ship all remaining items under one courier & tracking number.
          </p>
        </SheetHeader>

        <div className="space-y-3">
          <div className="bg-muted/40 rounded-2xl p-3">
            <p className="text-[11px] text-muted-foreground font-semibold">Remaining to ship</p>
            <p className="text-[15px] font-bold text-foreground">
              {totalRemaining} item{totalRemaining !== 1 ? "s" : ""} across {pending.length} product{pending.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Courier</label>
            <select value={courier} onChange={(e) => setCourier(e.target.value)}
              className="mt-1 w-full h-10 text-[13px] rounded-md border border-input bg-background px-2">
              {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">Tracking / Consignment No.</label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. PTH-8842091" className="mt-1 h-10 text-[13px]" />
          </div>

          <Button onClick={book} disabled={busy || totalRemaining === 0}
            className="w-full rounded-xl h-11 gap-1.5 text-[13px] font-bold">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
            {totalRemaining === 0 ? "Nothing left to ship" : `Book ${courier} · Ship ${totalRemaining} item(s)`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
