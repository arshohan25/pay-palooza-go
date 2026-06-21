import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Undo2, Clock, CheckCircle2, XCircle, Search, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface RefundRow {
  id: string;
  order_num: string | null;
  customer_name: string | null;
  amount: number;
  refund_type: string;
  reason: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  order_num: string;
  total: number;
  user_id: string;
  customer_name?: string;
  status: string;
}

const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
  pending:  { color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: Clock },
  approved: { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { color: "bg-red-500/10 text-red-700 border-red-200", icon: XCircle },
};

export default function MerchantRefundsTab({ merchantId }: { merchantId: string }) {
  useAuth();
  const { toast } = useToast();
  const { t, lang } = useI18n();
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const fmtNum = (n: number) => n.toLocaleString(locale);

  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIssue, setShowIssue] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRefunds = useCallback(async () => {
    const { data } = await supabase
      .from("merchant_refunds")
      .select("id, order_num, customer_name, amount, refund_type, reason, status, admin_note, created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    setRefunds((data as RefundRow[]) || []);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  useEffect(() => {
    const channel = supabase
      .channel("merchant-refunds-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_refunds", filter: `merchant_id=eq.${merchantId}` }, () => fetchRefunds())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId, fetchRefunds]);

  const openIssueSheet = async () => {
    setShowIssue(true);
    setOrdersLoading(true);
    setSelectedOrder(null);
    setRefundType("full");
    setPartialAmount("");
    setReason("");
    setOrderSearch("");

    const { data } = await supabase
      .from("orders")
      .select("id, order_num, total, user_id, status")
      .in("status", ["delivered", "completed"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      const orderIds = data.map(o => o.id);
      const { data: items } = await supabase
        .from("order_items")
        .select("order_id")
        .eq("merchant_id", merchantId)
        .in("order_id", orderIds);

      const validOrderIds = new Set((items || []).map(i => i.order_id));
      const filtered = data.filter(o => validOrderIds.has(o.id));

      const userIds = [...new Set(filtered.map(o => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.name]));

      setOrders(filtered.map(o => ({ ...o, customer_name: nameMap.get(o.user_id) || t("mrtUnknown") })) as OrderRow[]);
    } else {
      setOrders([]);
    }
    setOrdersLoading(false);
  };

  const handleSubmitRefund = async () => {
    if (!selectedOrder || !reason.trim()) {
      toast({ title: t("mrtErrSelectAndReason"), variant: "destructive" });
      return;
    }
    const amount = refundType === "full" ? selectedOrder.total : parseFloat(partialAmount);
    if (!amount || amount <= 0 || amount > selectedOrder.total) {
      toast({ title: t("mrtErrInvalidAmount"), variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("merchant_refunds").insert({
      merchant_id: merchantId,
      order_id: selectedOrder.id,
      order_num: selectedOrder.order_num,
      customer_name: selectedOrder.customer_name || null,
      customer_user_id: selectedOrder.user_id,
      amount,
      refund_type: refundType,
      reason: reason.trim(),
    });

    setSubmitting(false);
    if (error) {
      toast({ title: t("mrtErrSubmitFailed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("mrtToastSubmitted"), description: t("mrtToastSubmittedDesc") });
      setShowIssue(false);
      fetchRefunds();
    }
  };

  const filteredRefunds = filter === "all" ? refunds : refunds.filter(r => r.status === filter);
  const pendingCount = refunds.filter(r => r.status === "pending").length;
  const approvedTotal = refunds.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0);
  const searchedOrders = orderSearch
    ? orders.filter(o => o.order_num.toLowerCase().includes(orderSearch.toLowerCase()) || o.customer_name?.toLowerCase().includes(orderSearch.toLowerCase()))
    : orders;

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t("mrtTimeMinAgo").replace("{n}", fmtNum(mins));
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("mrtTimeHourAgo").replace("{n}", fmtNum(hrs));
    return t("mrtTimeDayAgo").replace("{n}", fmtNum(Math.floor(hrs / 24)));
  };

  const filterKey = (f: typeof filter) =>
    f === "all" ? "mrtFilterAll" : f === "pending" ? "mrtFilterPending" : f === "approved" ? "mrtFilterApproved" : "mrtFilterRejected";

  const statusKey = (s: string) =>
    s === "approved" ? "mrtStatusApproved" : s === "rejected" ? "mrtStatusRejected" : "mrtStatusPending";

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-primary" size={28} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Undo2 size={18} className="text-primary" /> {t("mrtTitle")}
        </h3>
        <Button size="sm" className="h-8 text-xs" onClick={openIssueSheet}>
          <Plus size={13} className="mr-1" /> {t("mrtIssueRefund")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{fmtNum(refunds.length)}</p><p className="text-[10px] text-muted-foreground">{t("mrtTotal")}</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{fmtNum(pendingCount)}</p><p className="text-[10px] text-muted-foreground">{t("mrtPending")}</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">৳{fmtNum(approvedTotal)}</p><p className="text-[10px] text-muted-foreground">{t("mrtRefunded")}</p></CardContent></Card>
      </div>

      <div className="flex gap-1.5">
        {(["all", "pending", "approved", "rejected"] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-[10px] px-2.5 capitalize" onClick={() => setFilter(f)}>{t(filterKey(f))}</Button>
        ))}
      </div>

      {filteredRefunds.length === 0 ? (
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-8 text-center">
            <Undo2 size={32} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">
              {filter !== "all" ? t("mrtNoneStatus").replace("{status}", t(filterKey(filter))) : t("mrtNoneYet")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">{t("mrtNoneHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRefunds.map(r => {
            const cfg = statusConfig[r.status] || statusConfig.pending;
            return (
              <Card key={r.id} className="border-0 shadow-elevated">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-foreground">{r.customer_name || t("mrtUnknown")}</p>
                      <p className="text-[10px] text-muted-foreground">{r.order_num || "—"} · {timeAgo(r.created_at)}</p>
                      <p className="text-[10px] text-muted-foreground italic">"{r.reason}"</p>
                      {r.admin_note && <p className="text-[10px] text-primary/80 mt-1">{t("mrtAdminLabel").replace("{note}", r.admin_note)}</p>}
                    </div>
                    <div className="text-right space-y-1.5">
                      <p className="text-sm font-bold text-foreground">৳{fmtNum(r.amount)}</p>
                      <Badge variant="outline" className={`text-[9px] ${cfg.color}`}>
                        <cfg.icon size={10} className="mr-0.5" />{t(statusKey(r.status))}
                      </Badge>
                      <p className="text-[9px] text-muted-foreground capitalize">{r.refund_type === "full" ? t("mrtTypeFull") : t("mrtTypePartial")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={showIssue} onOpenChange={setShowIssue}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto z-[80]" overlayClassName="z-[80]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Undo2 size={18} /> {t("mrtIssueRefund")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">{t("mrtSelectOrder")}</label>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t("mrtSearchOrders")} className="pl-8 h-9 text-xs" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} />
              </div>
              {ordersLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" size={20} /></div>
              ) : searchedOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("mrtNoEligibleOrders")}</p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {searchedOrders.map(o => (
                    <button key={o.id} onClick={() => { setSelectedOrder(o); setPartialAmount(""); }}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${selectedOrder?.id === o.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-foreground">{o.order_num}</span>
                          <span className="text-muted-foreground ml-2">{o.customer_name}</span>
                        </div>
                        <span className="font-bold text-foreground">৳{fmtNum(o.total)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedOrder && (
              <>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">{t("mrtRefundType")}</label>
                  <div className="flex gap-2">
                    <Button size="sm" variant={refundType === "full" ? "default" : "outline"} className="h-8 text-xs flex-1" onClick={() => setRefundType("full")}>
                      {t("mrtFullRefund").replace("{total}", fmtNum(selectedOrder.total))}
                    </Button>
                    <Button size="sm" variant={refundType === "partial" ? "default" : "outline"} className="h-8 text-xs flex-1" onClick={() => setRefundType("partial")}>
                      {t("mrtPartialRefund")}
                    </Button>
                  </div>
                </div>

                {refundType === "partial" && (
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">{t("mrtAmountMax").replace("{total}", fmtNum(selectedOrder.total))}</label>
                    <Input type="number" placeholder={t("mrtEnterAmount")} className="h-9 text-xs" value={partialAmount} onChange={e => setPartialAmount(e.target.value)} max={selectedOrder.total} min={1} />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">{t("mrtReasonLabel")}</label>
                  <Textarea placeholder={t("mrtReasonPlaceholder")} className="text-xs min-h-[60px]" value={reason} onChange={e => setReason(e.target.value)} />
                </div>

                <Button className="w-full" disabled={submitting || !reason.trim()} onClick={handleSubmitRefund}>
                  {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Undo2 size={16} className="mr-2" />}
                  {t("mrtSubmitRefund")}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
