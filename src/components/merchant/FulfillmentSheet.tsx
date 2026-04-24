import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Loader2, CheckCircle2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const COURIERS = ["Pathao", "Steadfast", "RedX", "Sundarban", "Paperfly", "eCourier", "Other"];

interface Fulfillment {
  id: string;
  order_item_index: number;
  qty_shipped: number;
  tracking_number: string | null;
  courier_provider: string | null;
  status: string;
  shipped_at: string;
  delivered_at: string | null;
}

interface Props {
  orderId: string | null;
  items: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export default function FulfillmentSheet({ orderId, items, open, onOpenChange, onUpdated }: Props) {
  const { toast } = useToast();
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, { qty: string; tracking: string; courier: string }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("order_item_fulfillments")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    setFulfillments(data ?? []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    if (open) {
      load();
      const init: typeof drafts = {};
      items.forEach((_, i) => { init[i] = { qty: "", tracking: "", courier: "Pathao" }; });
      setDrafts(init);
    }
  }, [open, load, items]);

  const shippedFor = (idx: number) =>
    fulfillments.filter(f => f.order_item_index === idx).reduce((s, f) => s + f.qty_shipped, 0);

  const submitFulfillment = async (idx: number, item: any) => {
    if (!orderId) return;
    const draft = drafts[idx];
    const qty = Number(draft?.qty || 0);
    const remaining = Number(item.qty || 0) - shippedFor(idx);
    if (qty <= 0) { toast({ title: "Enter quantity", variant: "destructive" }); return; }
    if (qty > remaining) { toast({ title: `Max ${remaining} remaining`, variant: "destructive" }); return; }

    setSaving(idx);
    const { error } = await (supabase as any).from("order_item_fulfillments").insert({
      order_id: orderId,
      order_item_index: idx,
      qty_shipped: qty,
      tracking_number: draft.tracking.trim() || null,
      courier_provider: draft.courier || null,
      status: "shipped",
    });
    setSaving(null);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Item shipped" });
    setDrafts(d => ({ ...d, [idx]: { qty: "", tracking: "", courier: draft.courier } }));
    load();
    onUpdated?.();
  };

  const markDelivered = async (id: string) => {
    const { error } = await (supabase as any)
      .from("order_item_fulfillments")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast({ title: "Failed", variant: "destructive" });
    else { toast({ title: "Marked delivered" }); load(); onUpdated?.(); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl px-4 pt-5 pb-6 overflow-y-auto">
        <SheetHeader className="text-left mb-4">
          <SheetTitle className="flex items-center gap-2 text-[16px]">
            <Truck size={17} className="text-primary" />
            Fulfill Order
          </SheetTitle>
          <p className="text-[11.5px] text-muted-foreground">
            Ship items together or in parts. Order status updates automatically.
          </p>
        </SheetHeader>

        {loading ? (
          <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const orderedQty = Number(item.qty || 0);
              const shipped = shippedFor(idx);
              const remaining = orderedQty - shipped;
              const itemFulfillments = fulfillments.filter(f => f.order_item_index === idx);
              const draft = drafts[idx] || { qty: "", tracking: "", courier: "Pathao" };

              return (
                <div key={idx} className="bg-card border border-border/60 rounded-2xl p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.emoji || "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-bold text-foreground truncate">{item.name}</p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {shipped}/{orderedQty} shipped
                        {remaining === 0 && <span className="text-green-600 font-semibold ml-1">· Complete</span>}
                      </p>
                    </div>
                  </div>

                  {itemFulfillments.map(f => (
                    <div key={f.id} className="bg-muted/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground">
                          {f.qty_shipped}× via {f.courier_provider || "courier"}
                          {f.tracking_number && <span className="text-muted-foreground font-mono ml-1">· {f.tracking_number}</span>}
                        </p>
                        <p className="text-[9.5px] text-muted-foreground">
                          {f.status === "delivered" ? "Delivered" : "Shipped"} {new Date(f.shipped_at).toLocaleDateString()}
                        </p>
                      </div>
                      {f.status !== "delivered" && (
                        <button onClick={() => markDelivered(f.id)}
                          className="text-[10px] font-bold text-green-600 px-2 py-1 rounded bg-green-500/10 shrink-0">
                          Mark delivered
                        </button>
                      )}
                      {f.status === "delivered" && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
                    </div>
                  ))}

                  {remaining > 0 && (
                    <div className="space-y-2 border-t border-border/40 pt-2.5">
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="number" placeholder="Qty" value={draft.qty}
                          onChange={(e) => setDrafts(d => ({ ...d, [idx]: { ...draft, qty: e.target.value } }))}
                          className="h-9 text-[12px]" max={remaining} />
                        <select value={draft.courier}
                          onChange={(e) => setDrafts(d => ({ ...d, [idx]: { ...draft, courier: e.target.value } }))}
                          className="h-9 text-[12px] rounded-md border border-input bg-background px-2 col-span-2">
                          {COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <Input placeholder="Tracking number (optional)" value={draft.tracking}
                        onChange={(e) => setDrafts(d => ({ ...d, [idx]: { ...draft, tracking: e.target.value } }))}
                        className="h-9 text-[12px]" />
                      <Button onClick={() => submitFulfillment(idx, item)} disabled={saving === idx}
                        size="sm" className="w-full rounded-xl gap-1.5 h-9 text-[12px]">
                        {saving === idx ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
                        Ship {remaining > 0 && `(${remaining} left)`}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
