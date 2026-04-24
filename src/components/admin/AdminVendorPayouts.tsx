import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Landmark, RefreshCw, Check, X, Wallet, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

type Filter = "pending" | "paid" | "rejected" | "all";

const statusCfg: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  pending:  { color: "bg-amber-500/10 text-amber-700 border-amber-200",       icon: Clock,        label: "Pending" },
  paid:     { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Paid"    },
  completed:{ color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Paid"    },
  rejected: { color: "bg-red-500/10 text-red-700 border-red-200",             icon: XCircle,      label: "Rejected"},
};

export default function AdminVendorPayouts() {
  const [filter, setFilter] = useState<Filter>("pending");
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("merchant_payouts")
      .select("*, merchants(business_name, user_id), vendor_wallets(available_balance, lifetime_earnings)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setPayouts(data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const approve = async () => {
    if (!selected) return;
    setWorking(true);
    const { error } = await supabase.rpc("approve_vendor_payout", {
      p_payout_id: selected.id,
      p_note: note || null,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payout approved & wallet credited");
    setSelected(null); setNote(""); setReason("");
    load();
  };

  const reject = async () => {
    if (!selected) return;
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setWorking(true);
    const { error } = await supabase.rpc("reject_vendor_payout", {
      p_payout_id: selected.id,
      p_reason: reason,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Payout rejected — funds restored to vendor");
    setSelected(null); setNote(""); setReason("");
    load();
  };

  const totalPending = payouts.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" /> Vendor Payouts
        </h3>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{payouts.filter(p => p.status === "pending").length}</p>
          <p className="text-[10px] text-muted-foreground">Pending Requests</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">৳{totalPending.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">Pending Amount</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["pending", "paid", "rejected", "all"] as Filter[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
              filter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No {filter} payouts</div>
      ) : (
        <div className="space-y-2">
          {payouts.map(p => {
            const cfg = statusCfg[p.status] || statusCfg.pending;
            return (
              <Card key={p.id} className="border shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{(p.merchants as any)?.business_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">৳{Number(p.amount).toLocaleString()} · {format(new Date(p.created_at), "MMM dd HH:mm")}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                    <cfg.icon size={10} className="mr-0.5" />{cfg.label}
                  </Badge>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelected(p); setNote(""); setReason(""); }}>Review</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Payout Review</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <Card className="border bg-primary/5">
                <CardContent className="p-3 space-y-1.5 text-sm">
                  <p className="font-bold text-foreground">{(selected.merchants as any)?.business_name}</p>
                  <p className="text-2xl font-bold text-primary">৳{Number(selected.amount).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">to EasyPay Wallet</p>
                  <p className="text-[10px] text-muted-foreground">Requested {format(new Date(selected.created_at), "PPpp")}</p>
                </CardContent>
              </Card>

              <Card className="border">
                <CardContent className="p-3 text-xs space-y-1">
                  <p><span className="text-muted-foreground">Vendor available balance:</span> <span className="font-semibold text-foreground">৳{Number((selected.vendor_wallets as any)?.available_balance ?? 0).toLocaleString()}</span></p>
                  <p><span className="text-muted-foreground">Vendor lifetime earnings:</span> <span className="font-semibold text-foreground">৳{Number((selected.vendor_wallets as any)?.lifetime_earnings ?? 0).toLocaleString()}</span></p>
                </CardContent>
              </Card>

              {selected.status === "pending" && (
                <>
                  <Card className="border-emerald-200 bg-emerald-50/50">
                    <CardContent className="p-3 space-y-2">
                      <Label className="text-xs">Approval note (optional)</Label>
                      <Input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Verified — approved" />
                      <Button className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={working} onClick={approve}>
                        <Check className="w-3.5 h-3.5 mr-1" />Approve & Credit Wallet
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-3 space-y-2">
                      <Label className="text-xs">Rejection reason</Label>
                      <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this rejected?" rows={2} />
                      <Button variant="destructive" className="w-full" disabled={working} onClick={reject}>
                        <X className="w-3.5 h-3.5 mr-1" />Reject & Refund
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}

              {selected.status !== "pending" && (
                <Card className="border">
                  <CardContent className="p-3 text-xs">
                    <p className="text-muted-foreground">Reviewed {selected.reviewed_at ? format(new Date(selected.reviewed_at), "PPp") : "—"}</p>
                    {selected.admin_note && <p className="mt-1 italic text-foreground">"{selected.admin_note}"</p>}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
