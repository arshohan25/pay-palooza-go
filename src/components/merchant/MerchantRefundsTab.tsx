import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Undo2, Search, Clock, CheckCircle2, XCircle } from "lucide-react";

const mockRefunds = [
  { id: "1", orderNum: "ORD-2841", customer: "Rafiq Ahmed", amount: 450, reason: "Defective product", status: "pending", date: "2 hours ago" },
  { id: "2", orderNum: "ORD-2790", customer: "Nusrat Jahan", amount: 1200, reason: "Wrong item delivered", status: "approved", date: "1 day ago" },
  { id: "3", orderNum: "ORD-2685", customer: "Kamal Hossain", amount: 320, reason: "Customer changed mind", status: "rejected", date: "3 days ago" },
];

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending:  { color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: Clock },
  approved: { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { color: "bg-red-500/10 text-red-700 border-red-200", icon: XCircle },
};

export default function MerchantRefundsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Undo2 size={18} className="text-primary" /> Refund Management
        </h3>
        <Button size="sm" className="h-8 text-xs">
          <Undo2 size={13} className="mr-1" /> Issue Refund
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{mockRefunds.length}</p><p className="text-[10px] text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{mockRefunds.filter(r => r.status === "pending").length}</p><p className="text-[10px] text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">৳{mockRefunds.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0)}</p><p className="text-[10px] text-muted-foreground">Refunded</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {mockRefunds.map(r => {
          const cfg = statusConfig[r.status];
          return (
            <Card key={r.id} className="border-0 shadow-elevated">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">{r.customer}</p>
                    <p className="text-[10px] text-muted-foreground">{r.orderNum} · {r.date}</p>
                    <p className="text-[10px] text-muted-foreground italic">"{r.reason}"</p>
                  </div>
                  <div className="text-right space-y-1.5">
                    <p className="text-sm font-bold text-foreground">৳{r.amount}</p>
                    <Badge variant="outline" className={`text-[9px] ${cfg.color}`}>
                      <cfg.icon size={10} className="mr-0.5" />{r.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
