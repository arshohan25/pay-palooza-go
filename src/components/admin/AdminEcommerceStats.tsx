import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, DollarSign, ShoppingCart, Package, TrendingUp } from "lucide-react";

export default function AdminEcommerceStats() {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, products: 0, avgOrder: 0 });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [ordersRes, productsRes] = await Promise.all([
      supabase.from("orders").select("total, status").limit(1000),
      supabase.from("merchant_products").select("id, name, image_url, emoji, price", { count: "exact" }).eq("is_active", true),
    ]);

    const orders = ordersRes.data ?? [];
    const completedOrders = orders.filter((o: any) => o.status !== "cancelled");
    const revenue = completedOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const avgOrder = completedOrders.length > 0 ? revenue / completedOrders.length : 0;

    setStats({
      revenue,
      orders: completedOrders.length,
      products: productsRes.count ?? 0,
      avgOrder,
    });

    // Top products by order_items count
    const { data: topItems } = await supabase
      .from("order_items")
      .select("product_id, quantity, merchant_products(name, image_url, emoji)")
      .limit(500);

    if (topItems) {
      const map = new Map<string, { name: string; qty: number; image?: string; emoji?: string }>();
      topItems.forEach((item: any) => {
        const pid = item.product_id;
        const existing = map.get(pid);
        const prod = item.merchant_products as any;
        if (existing) {
          existing.qty += item.quantity || 1;
        } else {
          map.set(pid, { name: prod?.name || "Unknown", qty: item.quantity || 1, image: prod?.image_url, emoji: prod?.emoji });
        }
      });
      setTopProducts(
        Array.from(map.values())
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10)
      );
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const statCards = [
    { label: "Total Revenue", value: `৳${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-500" },
    { label: "Total Orders", value: stats.orders.toLocaleString(), icon: ShoppingCart, color: "text-primary" },
    { label: "Active Products", value: stats.products.toLocaleString(), icon: Package, color: "text-amber-500" },
    { label: "Avg Order Value", value: `৳${stats.avgOrder.toFixed(0)}`, icon: TrendingUp, color: "text-violet-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Overview</p>
        <Button variant="outline" size="icon" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{loading ? "…" : value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Top Selling Products</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No order data yet</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <span className="text-lg">{p.emoji || "📦"}</span>
                  )}
                  <p className="text-sm text-foreground flex-1 truncate">{p.name}</p>
                  <span className="text-xs font-semibold text-primary">{p.qty} sold</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
