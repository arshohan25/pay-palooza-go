import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Ticket, Plus, Percent, CalendarClock } from "lucide-react";

const mockCoupons = [
  { id: "1", code: "SAVE20", type: "percent", value: 20, minOrder: 500, maxDiscount: 200, usedCount: 12, usageLimit: 50, expiresAt: "2026-04-15", active: true },
  { id: "2", code: "FLAT100", type: "flat", value: 100, minOrder: 1000, maxDiscount: null, usedCount: 8, usageLimit: 30, expiresAt: "2026-03-30", active: true },
  { id: "3", code: "WELCOME10", type: "percent", value: 10, minOrder: 200, maxDiscount: 100, usedCount: 45, usageLimit: 100, expiresAt: "2026-05-01", active: false },
];

export default function MerchantCouponsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Ticket size={18} className="text-primary" /> Discount Coupons
        </h3>
        <Button size="sm" className="h-8 text-xs">
          <Plus size={13} className="mr-1" /> Create Coupon
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{mockCoupons.length}</p><p className="text-[10px] text-muted-foreground">Total Coupons</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">{mockCoupons.filter(c => c.active).length}</p><p className="text-[10px] text-muted-foreground">Active</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{mockCoupons.reduce((s, c) => s + c.usedCount, 0)}</p><p className="text-[10px] text-muted-foreground">Total Used</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {mockCoupons.map(c => (
          <Card key={c.id} className="border-0 shadow-elevated">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{c.code}</code>
                    <Badge variant="outline" className="text-[9px]">
                      {c.type === "percent" ? <><Percent size={10} className="mr-0.5" />{c.value}% off</> : <>৳{c.value} off</>}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Min ৳{c.minOrder} {c.maxDiscount ? `· Max ৳${c.maxDiscount}` : ""} · Used {c.usedCount}/{c.usageLimit}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CalendarClock size={10} /> Expires {c.expiresAt}
                  </p>
                </div>
                <Switch checked={c.active} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
