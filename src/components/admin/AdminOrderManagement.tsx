import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import {
  Package, Search, RefreshCw, ChevronDown, ChevronUp,
  Truck, CheckCircle2, XCircle, Clock, MapPin, CreditCard, Wallet,
  Eye, Filter, Ban, Undo2, AlertTriangle, CheckSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STATUS_OPTIONS = [
  "processing",
  "confirmed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  processing: { label: "Processing", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
  shipped: { label: "Shipped", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: Truck },
  delivered: { label: "Delivered", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

interface OrderRow {
  id: string;
  user_id: string;
  order_num: string;
  status: string;
  total: number;
  payment_method: string;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_phone: string | null;
  items: any[];
  notes: string | null;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
  escrow_status?: string | null;
  escrow_released_at?: string | null;
  coupon_discount?: number | null;
  delivery_fee?: number | null;
  total_vendor_commission?: number | null;
  total_platform_fee?: number | null;
  // joined
  profile_name?: string;
  profile_phone?: string;
}

export default function AdminOrderManagement() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const { visible, flash } = useRealtimeIndicator();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Failed to load orders");
      setLoading(false);
      return;
    }

    // Fetch profile data for user names
    const userIds = [...new Set((data ?? []).map((o: any) => o.user_id))];
    let profileMap: Record<string, { name: string; phone: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", userIds);
      (profiles ?? []).forEach((p: any) => {
        profileMap[p.user_id] = { name: p.name ?? "—", phone: p.phone };
      });
    }

    const enriched = (data ?? []).map((o: any) => ({
      ...o,
      items: Array.isArray(o.items) ? o.items : [],
      profile_name: profileMap[o.user_id]?.name ?? "—",
      profile_phone: profileMap[o.user_id]?.phone ?? "—",
    }));

    setOrders(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
        flash();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) {
      toast.error("Failed to update order status");
    } else {
      toast.success(`Order updated to ${STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    }
    setUpdatingId(null);
  };

  const cancelOrderWithRefund = async () => {
    if (!cancelTarget) return;
    setCancelling(true);

    // 1. Update order status to cancelled
    const { error: updateErr } = await supabase
      .from("orders")
      .update({ status: "cancelled", notes: `Admin cancelled: ${cancelReason || "No reason provided"}` })
      .eq("id", cancelTarget.id);

    if (updateErr) {
      toast.error("Failed to cancel order");
      setCancelling(false);
      return;
    }

    // 2. Refund to wallet if paid via wallet
    if (cancelTarget.payment_method === "wallet" && cancelTarget.total > 0) {
      // Use admin_chargeback in reverse: credit via addmoney-style refund
      // We'll directly update balance + insert transaction using service-level RPC
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", cancelTarget.user_id)
        .single();

      if (profile) {
        const newBalance = Number(profile.balance) + cancelTarget.total;
        // Update balance
        await supabase
          .from("profiles")
          .update({ balance: newBalance } as any)
          .eq("user_id", cancelTarget.user_id);

        // Record refund transaction
        await supabase.from("transactions").insert({
          user_id: cancelTarget.user_id,
          type: "addmoney" as any,
          amount: cancelTarget.total,
          fee: 0,
          balance_after: newBalance,
          description: `Refund for order ${cancelTarget.order_num}: ${cancelReason || "Admin cancellation"}`,
          reference: cancelTarget.id,
          status: "completed" as any,
        });

        toast.success(`৳${cancelTarget.total.toLocaleString()} refunded to customer wallet`);
      }
    }

    // 3. Log in audit
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "order_cancellation",
        entity_type: "order",
        entity_id: cancelTarget.id,
        details: {
          order_num: cancelTarget.order_num,
          total: cancelTarget.total,
          reason: cancelReason,
          refunded: cancelTarget.payment_method === "wallet",
        },
      });
    }

    setOrders(prev => prev.map(o => o.id === cancelTarget.id ? { ...o, status: "cancelled" } : o));
    if (selectedOrder?.id === cancelTarget.id) {
      setSelectedOrder(prev => prev ? { ...prev, status: "cancelled" } : null);
    }

    toast.success(`Order ${cancelTarget.order_num} cancelled`);
    setCancelTarget(null);
    setCancelReason("");
    setCancelling(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = orders.filter(o => {
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      o.order_num?.toLowerCase().includes(q) ||
      o.profile_name?.toLowerCase().includes(q) ||
      o.profile_phone?.includes(q) ||
      o.shipping_name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const bulkEligible = filtered.filter(o => o.status !== "delivered" && o.status !== "cancelled");

  const toggleSelectAll = () => {
    const allIds = bulkEligible.map(o => o.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const bulkUpdateStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkUpdating(true);
    const ids = [...selectedIds];
    const { error } = await supabase
      .from("orders")
      .update({ status: bulkStatus })
      .in("id", ids);
    if (error) {
      toast.error("Failed to update orders");
    } else {
      toast.success(`${ids.length} order(s) updated to ${STATUS_CONFIG[bulkStatus]?.label ?? bulkStatus}`);
      setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: bulkStatus } : o));
      setSelectedIds(new Set());
      setBulkStatus("");
    }
    setBulkUpdating(false);
  };

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
      <RealtimeUpdateIndicator visible={visible} />
      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_OPTIONS.map(s => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          return (
            <motion.div key={s} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card
                className={`border-0 shadow-[var(--shadow-card)] cursor-pointer transition-all ${statusFilter === s ? "ring-2 ring-primary" : ""}`}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{statusCounts[s]}</p>
                    <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by order #, customer name, or phone…"
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5 shadow-[var(--shadow-card)]">
            <CardContent className="p-3 flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CheckSquare className="w-4 h-4 text-primary" />
                {selectedIds.size} order{selectedIds.size !== 1 ? "s" : ""} selected
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger className="w-full sm:w-44 h-8 text-xs">
                    <SelectValue placeholder="Select new status…" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.filter(s => s !== "cancelled").map(s => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={!bulkStatus || bulkUpdating}
                  onClick={bulkUpdateStatus}
                >
                  {bulkUpdating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Apply
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => { setSelectedIds(new Set()); setBulkStatus(""); }}
              >
                Clear
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Orders table */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Customer Orders ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-3 w-10">
                    <Checkbox
                      checked={bulkEligible.length > 0 && bulkEligible.every(o => selectedIds.has(o.id))}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Order #</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Items</th>
                  <th className="text-left px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.processing;
                  return (
                    <tr key={order.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${selectedIds.has(order.id) ? "bg-primary/5" : ""}`}>
                      <td className="px-3 py-3">
                        {order.status !== "delivered" && order.status !== "cancelled" ? (
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        ) : <span className="w-4 h-4 block" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-foreground text-xs">{order.order_num}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-xs">{order.profile_name}</p>
                        <p className="text-[10px] text-muted-foreground">{order.profile_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">৳{fmt(order.total)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(order.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setSelectedOrder(order)}>
                            <Eye className="w-3 h-3" /> View
                          </Button>
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <>
                              <Select value={order.status} onValueChange={(v) => updateOrderStatus(order.id, v)} disabled={updatingId === order.id}>
                                <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.filter(s => s !== "cancelled").map(s => (
                                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setCancelTarget(order)}>
                                <Ban className="w-3 h-3" /> Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border/50">
            {filtered.map((order) => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.processing;
              return (
                <div key={order.id} className={`p-3.5 space-y-2.5 ${selectedIds.has(order.id) ? "bg-primary/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                      )}
                      <span className="font-mono font-semibold text-foreground text-xs">{order.order_num}</span>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">{order.profile_name}</p>
                      <p className="text-[10px] text-muted-foreground">{order.profile_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">৳{fmt(order.total)}</p>
                      <p className="text-[10px] text-muted-foreground">{order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(order.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setSelectedOrder(order)}>
                      <Eye className="w-3 h-3" /> View
                    </Button>
                    {order.status !== "delivered" && order.status !== "cancelled" && (
                      <>
                        <Select value={order.status} onValueChange={(v) => updateOrderStatus(order.id, v)} disabled={updatingId === order.id}>
                          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter(s => s !== "cancelled").map(s => (
                              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setCancelTarget(order)}>
                          <Ban className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-12 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <Package className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">{loading ? "Loading orders…" : "No orders found"}</p>
              <p className="text-xs text-muted-foreground mt-1">Orders will appear here</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(o) => { if (!o) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Order {selectedOrder?.order_num}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className={`text-sm px-3 py-1 ${STATUS_CONFIG[selectedOrder.status]?.color}`}>
                  {STATUS_CONFIG[selectedOrder.status]?.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(selectedOrder.created_at).toLocaleString("en-BD")}
                </span>
              </div>

              {/* Customer info */}
              <Card className="border border-border/50">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</p>
                  <p className="font-medium text-foreground">{selectedOrder.profile_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.profile_phone}</p>
                </CardContent>
              </Card>

              {/* Shipping */}
              {selectedOrder.shipping_name && (
                <Card className="border border-border/50">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> Shipping Address
                    </p>
                    <p className="font-medium text-foreground">{selectedOrder.shipping_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.shipping_address}</p>
                    <p className="text-sm text-muted-foreground">{selectedOrder.shipping_city}</p>
                    {selectedOrder.shipping_phone && (
                      <p className="text-sm text-muted-foreground">📞 {selectedOrder.shipping_phone}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Items */}
              <Card className="border border-border/50">
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Items ({selectedOrder.items.length})
                  </p>
                  {selectedOrder.items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.emoji ?? "📦"}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.brand} × {item.qty}</p>
                        </div>
                      </div>
                      <p className="font-semibold text-foreground text-sm">৳{fmt(item.price * item.qty)}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <p className="font-semibold text-foreground">Total</p>
                    <p className="font-bold text-foreground text-lg">৳{fmt(selectedOrder.total)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Payment method */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {selectedOrder.payment_method === "wallet" ? (
                  <><Wallet className="w-4 h-4" /> Paid via MFS Wallet</>
                ) : (
                  <><CreditCard className="w-4 h-4" /> Paid via Card</>
                )}
              </div>

               {/* Status update + Cancel */}
              {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-foreground">Update Status:</p>
                    <Select
                      value={selectedOrder.status}
                      onValueChange={(v) => updateOrderStatus(selectedOrder.id, v)}
                      disabled={updatingId === selectedOrder.id}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.filter(s => s !== "cancelled").map(s => (
                          <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => { setCancelTarget(selectedOrder); setSelectedOrder(null); }}
                  >
                    <Ban className="w-4 h-4" />
                    Cancel Order & Refund
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel + Refund Confirmation Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Cancel Order
            </DialogTitle>
            <DialogDescription>
              This will cancel order <span className="font-mono font-bold">{cancelTarget?.order_num}</span> and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {cancelTarget && (
            <div className="space-y-4">
              {/* Refund info */}
              <Card className="border border-destructive/20 bg-destructive/5">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Customer</span>
                    <span className="text-sm font-medium text-foreground">{cancelTarget.profile_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Order Total</span>
                    <span className="text-sm font-bold text-foreground">৳{fmt(cancelTarget.total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Refund</span>
                    <Badge variant="secondary" className={cancelTarget.payment_method === "wallet"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    }>
                      {cancelTarget.payment_method === "wallet" ? (
                        <><Undo2 className="w-3 h-3 mr-1" /> ৳{fmt(cancelTarget.total)} → Wallet</>
                      ) : (
                        "Manual card refund required"
                      )}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Cancellation Reason</label>
                <Textarea
                  placeholder="Enter reason for cancellation…"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setCancelTarget(null); setCancelReason(""); }} disabled={cancelling}>
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={cancelOrderWithRefund}
              disabled={cancelling}
              className="gap-2"
            >
              {cancelling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
              {cancelling ? "Processing…" : "Cancel & Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
