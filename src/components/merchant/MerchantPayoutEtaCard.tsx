import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Landmark, CalendarClock } from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

function computeNextPayout(
  freq: string | null | undefined,
  lang: string,
  t: (k: TranslationKey) => string,
): { label: string; date: Date } {
  const now = new Date();
  const d = new Date(now);
  const locale = lang === "bn" ? "bn-BD" : "en-BD";
  const f = (freq || "T+1").toUpperCase();
  if (f === "T+0" || f === "SAME_DAY") return { label: t("mpeToday"), date: d };
  if (f === "T+1" || f === "DAILY") { d.setDate(d.getDate() + 1); return { label: t("mpeTomorrow"), date: d }; }
  if (f === "WEEKLY" || f === "T+7") {
    const daysUntilSun = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSun);
    return { label: d.toLocaleDateString(locale, { weekday: "long" }), date: d };
  }
  if (f === "MONTHLY") {
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { label: end.toLocaleDateString(locale, { day: "numeric", month: "short" }), date: end };
  }
  d.setDate(d.getDate() + 1);
  return { label: t("mpeTomorrow"), date: d };
}

export default function MerchantPayoutEtaCard({ merchantId, frequency }: { merchantId: string; frequency: string | null }) {
  const { t, lang } = useI18n();
  const fmt = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-BD").format(Math.round(n));
  const [pending, setPending] = useState(0);
  const [available, setAvailable] = useState(0);

  const load = useCallback(async () => {
    const [walletRes, pendingRes] = await Promise.all([
      supabase.from("vendor_wallets").select("available_balance,pending_balance").eq("merchant_id", merchantId).maybeSingle(),
      supabase.from("vendor_earnings_ledger").select("net_amount").eq("merchant_id", merchantId).eq("status", "pending"),
    ]);
    const w = (walletRes.data || {}) as any;
    setAvailable(Number(w.available_balance || 0));
    const pend = Number(w.pending_balance || 0) || ((pendingRes.data || []).reduce((s: number, r: any) => s + Number(r.net_amount || 0), 0));
    setPending(pend);
  }, [merchantId]);

  useEffect(() => {
    load();
    const ch = supabase.channel(`payout-eta-${merchantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_wallets", filter: `merchant_id=eq.${merchantId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_earnings_ledger", filter: `merchant_id=eq.${merchantId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, load]);

  const next = computeNextPayout(frequency, lang, t);

  return (
    <Card className="p-3 border-0 shadow-elevated bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Landmark size={18} className="text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
            <CalendarClock size={11} /> {t("mpeNextPayout")} · {next.label}
          </div>
          <p className="text-base font-extrabold text-foreground truncate">৳{fmt(available + pending)}</p>
          <p className="text-[10px] text-muted-foreground">
            ৳{fmt(available)} {t("mpeAvailable")} · ৳{fmt(pending)} {t("mpePending")}
          </p>
        </div>
      </div>
    </Card>
  );
}
