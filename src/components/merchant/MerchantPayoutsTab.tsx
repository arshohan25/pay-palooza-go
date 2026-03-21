import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, ArrowUpRight, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending: { color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: Clock },
  completed: { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { color: "bg-red-500/10 text-red-700 border-red-200", icon: XCircle },
};

interface Props { merchantId: string; }

export default function MerchantPayoutsTab({ merchantId }: Props) {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPayouts = async () => {
    const { data } = await supabase
      .from("merchant_payouts")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    setPayouts(data || []);
    setLoading(false);
  };

  // Pre-fill bank details from merchant record
  useEffect(() => {
    const loadMerchant = async () => {
      const { data } = await supabase
        .from("merchants")
        .select("bank_name, bank_account_number, bank_account_holder")
        .eq("id", merchantId)
        .single();
      if (data) {
        setBankName(data.bank_name || "");
        setAccountNumber(data.bank_account_number || "");
        setAccountHolder(data.bank_account_holder || "");
      }
    };
    loadMerchant();
  }, [merchantId]);

  useEffect(() => {
    fetchPayouts();
    const channel = supabase
      .channel("merchant_payouts_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_payouts", filter: `merchant_id=eq.${merchantId}` }, () => fetchPayouts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId]);

  const handleRequest = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    const { error } = await supabase.from("merchant_payouts").insert({
      merchant_id: merchantId,
      amount: val,
      bank_name: bankName || null,
      account_number: accountNumber || null,
      account_holder: accountHolder || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payout request submitted");
    setShowRequest(false); setAmount("");
  };

  const totalPaid = payouts.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0);
  const pendingCount = payouts.filter(p => p.status === "pending").length;

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Landmark size={18} className="text-primary" /> Payout Requests
        </h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowRequest(true)}>
          <ArrowUpRight size={13} className="mr-1" /> Request Payout
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{payouts.length}</p><p className="text-[10px] text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{pendingCount}</p><p className="text-[10px] text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">৳{totalPaid > 1000 ? (totalPaid / 1000).toFixed(1) + "k" : totalPaid}</p><p className="text-[10px] text-muted-foreground">Paid</p></CardContent></Card>
      </div>

      {payouts.length === 0 ? (
        <Card className="border-0 shadow-elevated"><CardContent className="p-8 text-center text-muted-foreground text-xs">No payout requests yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {payouts.map(p => {
            const cfg = statusConfig[p.status] || statusConfig.pending;
            return (
              <Card key={p.id} className="border-0 shadow-elevated">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">৳{Number(p.amount).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">{p.bank_name || "Bank"} · {p.account_number ? "****" + p.account_number.slice(-4) : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{p.reference} · {format(new Date(p.created_at), "MMM dd, yyyy")}</p>
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
      )}

      <Sheet open={showRequest} onOpenChange={setShowRequest}>
        <SheetContent side="bottom" className="rounded-t-2xl z-[80]" overlayClassName="z-[80]">
          <SheetHeader><SheetTitle>Request Payout</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div><Label className="text-xs">Amount (৳)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div>
            <div><Label className="text-xs">Bank Name</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" /></div>
            <div><Label className="text-xs">Account Number</Label><Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="Account number" /></div>
            <div><Label className="text-xs">Account Holder</Label><Input value={accountHolder} onChange={e => setAccountHolder(e.target.value)} placeholder="Account holder name" /></div>
            <Button className="w-full" disabled={saving} onClick={handleRequest}>{saving ? "Submitting..." : "Submit Request"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
