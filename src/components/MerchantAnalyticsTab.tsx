import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { TrendingUp, CheckCircle2, XCircle, Clock, DollarSign, Activity, RefreshCw, Package, ShoppingCart } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Session {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface OrderItem {
  id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  total_price: number;
  platform_fee: number;
  vendor_earning: number;
  created_at: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const RANGE_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const STATUS_COLORS: Record<string, string> = {
  completed: "hsl(160 60% 45%)",
  pending: "hsl(40 90% 55%)",
  failed: "hsl(0 70% 55%)",
  expired: "hsl(220 10% 60%)",
};

const MerchantAnalyticsTab = React.forwardRef<HTMLDivElement, { merchantId: string }>(({ merchantId }, ref) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - range * 86400000).toISOString();
    const [sessRes, itemsRes] = await Promise.all([
      supabase
        .from("merchant_payment_sessions")
        .select("id, amount, status, created_at, completed_at")
        .eq("merchant_id", merchantId)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
      (supabase as any)
        .from("order_items")
        .select("id, product_name, qty, unit_price, total_price, platform_fee, vendor_earning, created_at")
        .eq("merchant_id", merchantId)
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
    ]);
    setSessions((sessRes.data || []) as Session[]);
    setOrderItems((itemsRes.data || []) as OrderItem[]);
    setLoading(false);
  }, [merchantId, range]);

  useEffect(() => { load(); }, [load]);

  // Payment session stats
  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter(s => s.status === "completed");
    const revenue = completed.reduce((s, r) => s + r.amount, 0);
    const successRate = total > 0 ? (completed.length / total * 100) : 0;
    const failed = sessions.filter(s => s.status === "failed").length;
    const expired = sessions.filter(s => s.status === "expired").length;
    const pending = sessions.filter(s => s.status === "pending").length;
    return { total, completed: completed.length, revenue, successRate, failed, expired, pending };
  }, [sessions]);

  // Order items stats
  const shopStats = useMemo(() => {
    const grossSales = orderItems.reduce((s, i) => s + i.total_price, 0);
    const totalFees = orderItems.reduce((s, i) => s + (i.platform_fee || 0), 0);
    const netEarnings = orderItems.reduce((s, i) => s + (i.vendor_earning || 0), 0);
    const totalQty = orderItems.reduce((s, i) => s + i.qty, 0);
    return { grossSales, totalFees, netEarnings, totalQty, count: orderItems.length };
  }, [orderItems]);

  // Top products
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    orderItems.forEach(i => {
      if (!map[i.product_name]) map[i.product_name] = { name: i.product_name, qty: 0, revenue: 0 };
      map[i.product_name].qty += i.qty;
      map[i.product_name].revenue += i.total_price;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orderItems]);

  // Daily shop revenue
  const dailyShopData = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach(i => {
      const day = i.created_at.slice(0, 10);
      map[day] = (map[day] || 0) + (i.vendor_earning || 0);
    });
    return Object.entries(map).map(([date, amount]) => ({ date: date.slice(5), earnings: amount }));
  }, [orderItems]);

  // Pie chart data for sessions
  const pieData = useMemo(() => {
    return [
      { name: "Completed", value: stats.completed, color: STATUS_COLORS.completed },
      { name: "Pending", value: stats.pending, color: STATUS_COLORS.pending },
      { name: "Failed", value: stats.failed, color: STATUS_COLORS.failed },
      { name: "Expired", value: stats.expired, color: STATUS_COLORS.expired },
    ].filter(d => d.value > 0);
  }, [stats]);

  // Daily sessions bar chart
  const dailyData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    sessions.forEach(s => {
      const day = s.created_at.slice(0, 10);
      if (!map[day]) map[day] = { completed: 0, failed: 0, expired: 0, pending: 0 };
      const st = s.status as keyof typeof map[string];
      map[day][st] = (map[day][st] || 0) + 1;
    });
    return Object.entries(map).map(([date, counts]) => ({ date: date.slice(5), ...counts }));
  }, [sessions]);

  // Revenue line chart
  const revenueData = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.filter(s => s.status === "completed").forEach(s => {
      const day = s.created_at.slice(0, 10);
      map[day] = (map[day] || 0) + s.amount;
    });
    return Object.entries(map).map(([date, amount]) => ({ date: date.slice(5), revenue: amount }));
  }, [sessions]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div ref={ref} className="space-y-5">
      {/* Range selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Period:</span>
        {RANGE_OPTIONS.map(r => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              range === r.days
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Shop Sales Summary */}
      {shopStats.count > 0 && (
        <>
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5"><ShoppingCart size={13} /> Shop Sales</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Gross Sales", value: `৳${fmt(shopStats.grossSales)}`, icon: DollarSign, color: "text-primary" },
              { label: "Net Earnings", value: `৳${fmt(shopStats.netEarnings)}`, icon: TrendingUp, color: "text-emerald-600" },
              { label: "Platform Fees", value: `৳${fmt(shopStats.totalFees)}`, icon: Activity, color: "text-amber-600" },
              { label: "Items Sold", value: shopStats.totalQty.toString(), icon: Package, color: "text-blue-600" },
            ].map(c => (
              <Card key={c.label} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <c.icon size={14} className={c.color} />
                  <span className="text-[10px] text-muted-foreground font-medium">{c.label}</span>
                </div>
                <p className="text-lg font-extrabold text-foreground">{c.value}</p>
              </Card>
            ))}
          </div>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-bold text-foreground mb-3">Top Products</h4>
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.qty} sold</p>
                    </div>
                    <span className="text-xs font-bold text-foreground">৳{fmt(p.revenue)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Daily Earnings Chart */}
          {dailyShopData.length > 0 && (
            <Card className="p-4">
              <h4 className="text-xs font-bold text-foreground mb-3">Daily Net Earnings</h4>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={dailyShopData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                    formatter={(v: number) => [`৳${fmt(v)}`, "Earnings"]}
                  />
                  <Line type="monotone" dataKey="earnings" stroke="hsl(160 60% 45%)" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* API Payment Summary */}
      {stats.total > 0 && (
        <>
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-2"><Activity size={13} /> API Payments</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Total Revenue", value: `৳${fmt(stats.revenue)}`, icon: DollarSign, color: "text-emerald-600" },
              { label: "Success Rate", value: `${stats.successRate.toFixed(1)}%`, icon: TrendingUp, color: "text-blue-600" },
              { label: "Completed", value: stats.completed.toString(), icon: CheckCircle2, color: "text-emerald-600" },
              { label: "Total Sessions", value: stats.total.toString(), icon: Activity, color: "text-primary" },
            ].map(c => (
              <Card key={c.label} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <c.icon size={14} className={c.color} />
                  <span className="text-[10px] text-muted-foreground font-medium">{c.label}</span>
                </div>
                <p className="text-lg font-extrabold text-foreground">{c.value}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Status distribution pie */}
      {pieData.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold text-foreground mb-3">Session Status</h4>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45} strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-y-1.5 gap-x-3">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[10px] text-muted-foreground">{d.name}</span>
                  <span className="text-[10px] font-bold text-foreground ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Daily sessions bar chart */}
      {dailyData.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold text-foreground mb-3">Daily Sessions</h4>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} className="text-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS.completed} radius={[0, 0, 0, 0]} />
              <Bar dataKey="failed" stackId="a" fill={STATUS_COLORS.failed} />
              <Bar dataKey="expired" stackId="a" fill={STATUS_COLORS.expired} />
              <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.pending} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Revenue line chart */}
      {revenueData.length > 0 && (
        <Card className="p-4">
          <h4 className="text-xs font-bold text-foreground mb-3">Daily API Revenue</h4>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                formatter={(v: number) => [`৳${fmt(v)}`, "Revenue"]}
              />
              <Line type="monotone" dataKey="revenue" stroke={STATUS_COLORS.completed} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {sessions.length === 0 && orderItems.length === 0 && (
        <Card className="p-8 text-center">
          <Activity size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No sales data in this period.</p>
        </Card>
      )}
    </div>
  );
});

MerchantAnalyticsTab.displayName = "MerchantAnalyticsTab";

export default MerchantAnalyticsTab;
