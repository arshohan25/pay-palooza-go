import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Landmark, ArrowUpRight, Clock, CheckCircle2, XCircle, Wallet,
  TrendingUp, Eye, EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const statusConfig: Record<string, { color: string; icon: typeof Clock; labelKey: TranslationKey }> = {
  pending:  { color: "bg-amber-500/10 text-amber-700 border-amber-200",       icon: Clock,        labelKey: "mptStatusPending"  },
  paid:     { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2, labelKey: "mptStatusPaid"     },
  completed:{ color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: CheckCircle2, labelKey: "mptStatusPaid"     },
  rejected: { color: "bg-red-500/10 text-red-700 border-red-200",             icon: XCircle,      labelKey: "mptStatusRejected" },
};

interface Wallet {
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  lifetime_withdrawn: number;
}

interface Props { merchantId: string; }

export default function MerchantPayoutsTab({ merchantId }: Props) {
  const { t, lang } = useI18n();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [amount, setAmount] = useState("");
  const [showBalance, setShowBalance] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [{ data: p }, { data: w }, { data: e }] = await Promise.all([
      supabase.from("merchant_payouts").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(50),
      supabase.from("vendor_wallets").select("*").eq("merchant_id", merchantId).maybeSingle(),
      supabase.from("vendor_earnings_ledger").select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(20),
    ]);
    setPayouts(p ?? []);
    setWallet((w as Wallet) ?? { available_balance: 0, pending_balance: 0, lifetime_earnings: 0, lifetime_withdrawn: 0 });
    setEarnings(e ?? []);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`vendor_wallet_${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_payouts", filter: `merchant_id=eq.${merchantId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_wallets", filter: `merchant_id=eq.${merchantId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_earnings_ledger", filter: `merchant_id=eq.${merchantId}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, refresh]);

  const handleRequest = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { toast.error(t("mptErrInvalidAmount")); return; }
    if (wallet && val > wallet.available_balance) { toast.error(t("mptErrExceedsBalance")); return; }
    setSaving(true);
    const { error } = await supabase.rpc("request_vendor_payout", { p_amount: val });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("mptToastSubmitted"));
    setShowRequest(false);
    setAmount("");
  };

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;

  const w = wallet ?? { available_balance: 0, pending_balance: 0, lifetime_earnings: 0, lifetime_withdrawn: 0 };
  const locale = lang === "bn" ? "bn-BD" : "en-BD";
  const fmt = (n: number) => `৳${Number(n).toLocaleString(locale, { maximumFractionDigits: 2 })}`;
  const fmtPct = (n: number) => Number(n).toLocaleString(locale);

  return (
    <div className="space-y-4">
      {/* Wallet Hero Card */}
      <Card className="border-0 shadow-elevated bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-primary" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("mptAvailableToWithdraw")}</p>
            </div>
            <button onClick={() => setShowBalance(s => !s)} className="text-muted-foreground">
              {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-3xl font-bold text-foreground">
            {showBalance ? fmt(w.available_balance) : "৳ ••••••"}
          </p>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
            <div><p className="text-[10px] text-muted-foreground">{t("mptPending")}</p><p className="text-xs font-bold text-amber-600">{fmt(w.pending_balance)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">{t("mptLifetimeEarned")}</p><p className="text-xs font-bold text-emerald-600">{fmt(w.lifetime_earnings)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">{t("mptWithdrawn")}</p><p className="text-xs font-bold text-foreground">{fmt(w.lifetime_withdrawn)}</p></div>
          </div>
          <Button className="w-full h-10" disabled={w.available_balance <= 0} onClick={() => setShowRequest(true)}>
            <ArrowUpRight size={14} className="mr-1.5" />
            {t("mptWithdrawToWallet")}
          </Button>
        </CardContent>
      </Card>

      {/* Payout history */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
          <Landmark size={14} className="text-primary" /> {t("mptWithdrawalHistory")}
        </h3>
        {payouts.length === 0 ? (
          <Card className="border-0 shadow-sm"><CardContent className="p-6 text-center text-muted-foreground text-xs">{t("mptNoWithdrawals")}</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {payouts.map(p => {
              const cfg = statusConfig[p.status] || statusConfig.pending;
              return (
                <Card key={p.id} className="border-0 shadow-sm">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">{fmt(p.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), "MMM dd, yyyy · HH:mm")}</p>
                      {p.admin_note && <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{p.admin_note}"</p>}
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                      <cfg.icon size={10} className="mr-0.5" />{t(cfg.labelKey)}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent earnings */}
      {earnings.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-600" /> {t("mptRecentEarnings")}
          </h3>
          <div className="space-y-1.5">
            {earnings.slice(0, 8).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/40">
                <div>
                  <p className="font-medium text-foreground">+{fmt(e.net_amount)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t("mptGrossFee").replace("{gross}", fmt(e.gross_amount)).replace("{rate}", fmtPct(e.commission_rate))}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${e.status === "released" ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"}`}>
                  {e.status === "released" ? t("mptEarningReleased") : t("mptEarningPending")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Sheet open={showRequest} onOpenChange={setShowRequest}>
        <SheetContent side="bottom" className="rounded-t-2xl z-[80]" overlayClassName="z-[80]">
          <SheetHeader><SheetTitle>{t("mptWithdrawToWallet")}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="rounded-xl bg-primary/5 p-3 text-xs space-y-1">
              <p className="text-muted-foreground">{t("mptAvailableBalance")}</p>
              <p className="text-lg font-bold text-foreground">{fmt(w.available_balance)}</p>
            </div>
            <div>
              <Label className="text-xs">{t("mptAmountLabel")}</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" max={w.available_balance} />
              <p className="text-[10px] text-muted-foreground mt-1">{t("mptApprovalNote")}</p>
            </div>
            <Button className="w-full" disabled={saving || !amount} onClick={handleRequest}>
              {saving ? t("mptSubmitting") : t("mptSubmitForReview")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
