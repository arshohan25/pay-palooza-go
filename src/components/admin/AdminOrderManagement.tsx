import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Package, Search, RefreshCw, ChevronDown, ChevronUp,
  Truck, CheckCircle2, XCircle, Clock, MapPin, CreditCard, Wallet,
  Eye, Filter,
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
} from "@/components/ui/dialog";
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
  // joined
  profile_name?: string;
  profile_phone?: string;
}

export default function AdminOrderManagement() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-6">
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

      {/* Orders table */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Customer Orders ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Order #</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Items</th>
                  <th className="text-left px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.processing;
                  return (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-foreground text-xs">
                        {order.order_num}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-xs">{order.profile_name}</p>
                        <p className="text-[10px] text-muted-foreground">{order.profile_phone}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">৳{fmt(order.total)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`text-xs ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {new Date(order.created_at).toLocaleString("en-BD", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="w-3 h-3" /> View
                          </Button>
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <Select
                              value={order.status}
                              onValueChange={(v) => updateOrderStatus(order.id, v)}
                              disabled={updatingId === order.id}
                            >
                              <SelectTrigger className="h-7 text-xs w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map(s => (
                                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {loading ? "Loading orders…" : "No orders found"}
              </p>
            </div>
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

              {/* Status update */}
              {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && (
                <div className="flex items-center gap-3 pt-2">
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
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
