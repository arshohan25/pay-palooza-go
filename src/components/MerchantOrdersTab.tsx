import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Package, Clock, CheckCircle2, Truck, CircleCheck, X, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import FulfillmentSheet from "@/components/merchant/FulfillmentSheet";

interface MerchantOrder {
  id: string;
  order_num: string;
  status: string;
  total: number;
  items: any[];
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  payment_method: string;
  created_at: string;
}

const STATUS_FLOW = ["processing", "confirmed", "shipped", "out_for_delivery", "delivered"];
const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  processing: { label: "Processing", color: "#FF9800", icon: Clock },
  confirmed: { label: "Confirmed", color: "#9C27B0", icon: CheckCircle2 },
  partially_shipped: { label: "Partially Shipped", color: "#0288D1", icon: Truck },
  shipped: { label: "Shipped", color: "#2196F3", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "#FF5722", icon: Package },
  delivered: { label: "Delivered", color: "#43A047", icon: CircleCheck },
  cancelled: { label: "Cancelled", color: "#9E9E9E", icon: X },
};

interface Props { merchantId: string; }

const MerchantOrdersTab = ({ merchantId }: Props) => {
  const { toast } = useToast();
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fulfillOrder, setFulfillOrder] = useState<MerchantOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("orders")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(100);
    setOrders(data ?? []);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("merchant-orders-rt")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `merchant_id=eq.${merchantId}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId, load]);

  const advanceStatus = async (order: MerchantOrder) => {
    const idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const next = STATUS_FLOW[idx + 1];
    const { error } = await (supabase as any)
      .from("orders")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) toast({ title: "Update failed", variant: "destructive" });
    else { toast({ title: `Order → ${STATUS_META[next]?.label}` }); load(); }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;

  if (orders.length === 0) return (
    <div className="text-center py-16 space-y-3">
      <p className="text-5xl">📋</p>
      <p className="text-[15px] font-bold text-foreground">No orders yet</p>
      <p className="text-[13px] text-muted-foreground">Orders from your shop will appear here</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Summary chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FLOW.map(s => {
          const count = orders.filter(o => o.status === s).length;
          if (!count) return null;
          const meta = STATUS_META[s];
          return (
            <div key={s} className="shrink-0 flex items-center gap-1.5 bg-card border border-border/60 rounded-xl px-3 py-1.5">
              <meta.icon size={12} style={{ color: meta.color }} />
              <span className="text-[11px] font-semibold text-foreground">{meta.label}</span>
              <span className="text-[11px] font-bold" style={{ color: meta.color }}>{count}</span>
            </div>
          );
        })}
      </div>

      {orders.map((order, i) => {
        const meta = STATUS_META[order.status] || STATUS_META.processing;
        const Icon = meta.icon;
        const expanded = expandedId === order.id;
        const canAdvance = STATUS_FLOW.indexOf(order.status) >= 0 && STATUS_FLOW.indexOf(order.status) < STATUS_FLOW.length - 1 && order.status !== "cancelled";
        const items = Array.isArray(order.items) ? order.items : [];

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="bg-card border border-border/60 rounded-2xl overflow-hidden"
          >
            <button className="w-full p-3.5 flex items-center gap-3 text-left"
              onClick={() => setExpandedId(expanded ? null : order.id)}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${meta.color}18` }}>
                <Icon size={17} style={{ color: meta.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-foreground font-mono">{order.order_num}</p>
                <p className="text-[10.5px] text-muted-foreground mt-0.5">
                  {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {items.length} item{items.length !== 1 ? "s" : ""} · ৳{Number(order.total).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full"
                  style={{ background: meta.color }}>{meta.label}</span>
                {expanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
              </div>
            </button>

            {expanded && (
              <div className="px-3.5 pb-3.5 space-y-3 border-t border-border/50 pt-3">
                {/* Items */}
                {items.map((item: any, j: number) => (
                  <div key={j} className="flex items-center gap-2">
                    <span className="text-lg">{item.emoji || "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">Qty: {item.qty} · ৳{Number(item.price).toLocaleString()}</p>
                    </div>
                  </div>
                ))}

                {/* Shipping */}
                {order.shipping_name && (
                  <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border/40">
                    <p><span className="font-semibold text-foreground">{order.shipping_name}</span> · {order.shipping_phone}</p>
                    <p>{order.shipping_address}, {order.shipping_city}</p>
                  </div>
                )}

                {/* Advance button */}
                {canAdvance && (
                  <button
                    onClick={() => advanceStatus(order)}
                    className="w-full py-2.5 rounded-xl text-white text-[12px] font-bold"
                    style={{ background: STATUS_META[STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1]]?.color || "#FF7043" }}
                  >
                    Mark as {STATUS_META[STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1]]?.label}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default MerchantOrdersTab;
