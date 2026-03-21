import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, ShoppingBag, Star } from "lucide-react";

const mockCustomers = [
  { id: "1", name: "Rafiq Ahmed", phone: "01712****78", totalSpent: 12500, orders: 8, lastPurchase: "2 days ago", tier: "Gold" },
  { id: "2", name: "Nusrat Jahan", phone: "01898****32", totalSpent: 8200, orders: 5, lastPurchase: "1 week ago", tier: "Silver" },
  { id: "3", name: "Kamal Hossain", phone: "01556****34", totalSpent: 3400, orders: 2, lastPurchase: "2 weeks ago", tier: "Bronze" },
  { id: "4", name: "Salma Akter", phone: "01345****90", totalSpent: 1500, orders: 1, lastPurchase: "1 month ago", tier: "New" },
];

const tierColors: Record<string, string> = {
  Gold:   "bg-amber-500/10 text-amber-700 border-amber-200",
  Silver: "bg-gray-500/10 text-gray-600 border-gray-200",
  Bronze: "bg-orange-500/10 text-orange-700 border-orange-200",
  New:    "bg-blue-500/10 text-blue-700 border-blue-200",
};

export default function MerchantCustomersTab() {
  const totalRevenue = mockCustomers.reduce((s, c) => s + c.totalSpent, 0);
  const avgOrderValue = totalRevenue / mockCustomers.reduce((s, c) => s + c.orders, 0);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Users size={18} className="text-primary" /> Customer Directory
      </h3>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{mockCustomers.length}</p><p className="text-[10px] text-muted-foreground">Total Customers</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">৳{(totalRevenue / 1000).toFixed(1)}k</p><p className="text-[10px] text-muted-foreground">Lifetime Value</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">৳{Math.round(avgOrderValue)}</p><p className="text-[10px] text-muted-foreground">Avg Order</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {mockCustomers.map(c => (
          <Card key={c.id} className="border-0 shadow-elevated">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.phone} · {c.lastPurchase}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs font-bold text-foreground">৳{c.totalSpent.toLocaleString()}</p>
                  <div className="flex items-center gap-1 justify-end">
                    <ShoppingBag size={10} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{c.orders} orders</span>
                    <Badge variant="outline" className={`text-[8px] ml-1 ${tierColors[c.tier]}`}>{c.tier}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
