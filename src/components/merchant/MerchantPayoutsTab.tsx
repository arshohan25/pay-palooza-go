import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Landmark, Plus, Clock, CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";

const mockPayouts = [
  { id: "1", amount: 15000, bankName: "Dutch Bangla Bank", accountNum: "****4521", status: "completed", date: "Mar 18, 2026", ref: "PO-28411" },
  { id: "2", amount: 8500, bankName: "bKash (Merchant)", accountNum: "****5678", status: "pending", date: "Mar 20, 2026", ref: "PO-28455" },
  { id: "3", amount: 22000, bankName: "City Bank", accountNum: "****9012", status: "rejected", date: "Mar 15, 2026", ref: "PO-28390" },
];

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending:   { color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: Clock },
  completed: { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected:  { color: "bg-red-500/10 text-red-700 border-red-200", icon: XCircle },
};

export default function MerchantPayoutsTab() {
  const totalPaid = mockPayouts.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Landmark size={18} className="text-primary" /> Payout Requests
        </h3>
        <Button size="sm" className="h-8 text-xs">
          <ArrowUpRight size={13} className="mr-1" /> Request Payout
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{mockPayouts.length}</p><p className="text-[10px] text-muted-foreground">Total Requests</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{mockPayouts.filter(p => p.status === "pending").length}</p><p className="text-[10px] text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">৳{(totalPaid / 1000).toFixed(1)}k</p><p className="text-[10px] text-muted-foreground">Total Paid</p></CardContent></Card>
      </div>

      <div className="space-y-2">
        {mockPayouts.map(p => {
          const cfg = statusConfig[p.status];
          return (
            <Card key={p.id} className="border-0 shadow-elevated">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-foreground">৳{p.amount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{p.bankName} · {p.accountNum}</p>
                    <p className="text-[10px] text-muted-foreground">{p.ref} · {p.date}</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${cfg.color}`}>
                    <cfg.icon size={10} className="mr-0.5" />{p.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
