import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Loader2, CheckCircle2, AlertCircle, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type Category = {
  key: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
};

const MERCHANT_CATEGORIES: Category[] = [
  { key: "merchant_new_order", labelKey: "npCatMerchantNewOrder", descKey: "npCatMerchantNewOrderDesc" },
  { key: "merchant_payout", labelKey: "npCatMerchantPayout", descKey: "npCatMerchantPayoutDesc" },
  { key: "merchant_refund", labelKey: "npCatMerchantRefund", descKey: "npCatMerchantRefundDesc" },
  { key: "merchant_low_stock", labelKey: "npCatMerchantLowStock", descKey: "npCatMerchantLowStockDesc" },
  { key: "merchant_inquiry", labelKey: "npCatMerchantInquiry", descKey: "npCatMerchantInquiryDesc" },
  { key: "merchant_api", labelKey: "npCatMerchantApi", descKey: "npCatMerchantApiDesc" },
];

const AGENT_CATEGORIES: Category[] = [
  { key: "agent_float_low", labelKey: "npCatAgentFloatLow", descKey: "npCatAgentFloatLowDesc" },
  { key: "agent_commission", labelKey: "npCatAgentCommission", descKey: "npCatAgentCommissionDesc" },
  { key: "agent_fund_request", labelKey: "npCatAgentFundRequest", descKey: "npCatAgentFundRequestDesc" },
  { key: "agent_cash_in_out", labelKey: "npCatAgentCashInOut", descKey: "npCatAgentCashInOutDesc" },
];

const SAVINGS_CATEGORIES: Category[] = [
  { key: "savings_collected", labelKey: "npCatSavingsCollected", descKey: "npCatSavingsCollectedDesc" },
  { key: "savings_missed", labelKey: "npCatSavingsMissed", descKey: "npCatSavingsMissedDesc" },
];

const COMMON_CATEGORIES: Category[] = [
  { key: "monthly_summary", labelKey: "npCatMonthlySummary", descKey: "npCatMonthlySummaryDesc" },
  { key: "marketing", labelKey: "npCatMarketing", descKey: "npCatMarketingDesc" },
];

interface Props {
  scope: "merchant" | "agent" | "distributor" | "customer";
}

export default function NotificationPreferences({ scope }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const { supported, configured, permission, subscribed, subscribe, unsubscribe, busy } =
    usePushSubscription();

  const categories = useMemo(() => {
    const base =
      scope === "merchant" ? MERCHANT_CATEGORIES :
      scope === "agent" ? AGENT_CATEGORIES :
      scope === "customer" ? [] :
      AGENT_CATEGORIES;
    return [...base, ...SAVINGS_CATEGORIES, ...COMMON_CATEGORIES];
  }, [scope]);

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Quiet hours state
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [savingQuiet, setSavingQuiet] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data }, { data: settings }] = await Promise.all([
        (supabase as any)
          .from("notification_preferences")
          .select("category, push_enabled")
          .eq("user_id", user.id),
        (supabase as any)
          .from("user_notification_settings")
          .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const map: Record<string, boolean> = {};
      for (const c of categories) map[c.key] = true; // default on
      for (const row of data ?? []) map[row.category] = !!row.push_enabled;
      setPrefs(map);
      if (settings) {
        setQuietEnabled(!!settings.quiet_hours_enabled);
        setQuietStart((settings.quiet_hours_start ?? "22:00").slice(0, 5));
        setQuietEnd((settings.quiet_hours_end ?? "07:00").slice(0, 5));
      }
      setLoading(false);
    })();
  }, [user, categories]);

  const saveQuiet = async (next: { enabled?: boolean; start?: string; end?: string }) => {
    if (!user) return;
    const enabled = next.enabled ?? quietEnabled;
    const start = next.start ?? quietStart;
    const end = next.end ?? quietEnd;
    setSavingQuiet(true);
    const { error } = await (supabase as any)
      .from("user_notification_settings")
      .upsert(
        {
          user_id: user.id,
          quiet_hours_enabled: enabled,
          quiet_hours_start: start,
          quiet_hours_end: end,
        },
        { onConflict: "user_id" }
      );
    setSavingQuiet(false);
    if (error) {
      toast({ title: t("npCouldNotSaveQuiet"), description: error.message, variant: "destructive" });
    }
  };

  const toggle = async (category: string, next: boolean) => {
    if (!user) return;
    setPrefs((p) => ({ ...p, [category]: next }));
    setSaving(category);
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, category, push_enabled: next },
        { onConflict: "user_id,category" }
      );
    setSaving(null);
    if (error) {
      setPrefs((p) => ({ ...p, [category]: !next }));
      toast({ title: t("npCouldNotSave"), description: error.message, variant: "destructive" });
    }
  };

  const handleMaster = async () => {
    if (subscribed) {
      const ok = await unsubscribe();
      if (ok) toast({ title: t("npPushDisabled") });
    } else {
      const r = await subscribe();
      if (r.ok) toast({ title: t("npPushEnabled") });
      else toast({ title: t("npCouldNotEnable"), description: r.error, variant: "destructive" });
    }
  };

  const masterStatus = !supported
    ? { labelKey: "npStatusUnsupported" as TranslationKey, tone: "muted" as const }
    : !configured
    ? { labelKey: "npStatusNotConfigured" as TranslationKey, tone: "warn" as const }
    : permission === "denied"
    ? { labelKey: "npStatusBlocked" as TranslationKey, tone: "warn" as const }
    : subscribed
    ? { labelKey: "npStatusActive" as TranslationKey, tone: "ok" as const }
    : { labelKey: "npStatusInactive" as TranslationKey, tone: "muted" as const };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl p-4 sm:p-5 shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-border/40">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-foreground">{t("npTitle")}</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {t("npSubtitle")}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {masterStatus.tone === "ok" && (
                <CheckCircle2 size={12} className="text-emerald-500" />
              )}
              {masterStatus.tone === "warn" && (
                <AlertCircle size={12} className="text-amber-500" />
              )}
              <Badge
                variant="outline"
                className={`text-[10.5px] h-5 px-1.5 ${
                  masterStatus.tone === "ok"
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : masterStatus.tone === "warn"
                    ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t(masterStatus.labelKey)}
              </Badge>
            </div>
          </div>
        </div>
        <Button
          onClick={handleMaster}
          disabled={busy || !supported || !configured || permission === "denied"}
          size="sm"
          variant={subscribed ? "outline" : "default"}
          className="rounded-xl h-8 text-[12px] gap-1.5 shrink-0"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : subscribed ? (
            <BellOff size={12} />
          ) : (
            <Bell size={12} />
          )}
          {subscribed ? t("npDisable") : t("npEnable")}
        </Button>
      </div>

      {/* Categories */}
      <div className="mt-3 divide-y divide-border/40">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="py-3 flex items-center justify-between gap-3 animate-pulse">
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-32 bg-muted rounded" />
                  <div className="h-2.5 w-48 bg-muted/60 rounded" />
                </div>
                <div className="h-6 w-11 bg-muted rounded-full" />
              </div>
            ))
          : categories.map((c) => {
              const enabled = prefs[c.key] ?? true;
              const blocked = !subscribed;
              const label = t(c.labelKey);
              return (
                <div
                  key={c.key}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {label}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground leading-snug">
                      {t(c.descKey)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {saving === c.key && (
                      <Loader2 size={12} className="text-muted-foreground animate-spin" />
                    )}
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => toggle(c.key, v)}
                      disabled={blocked || saving === c.key}
                      aria-label={t("npToggleAria").replace("{label}", label)}
                    />
                  </div>
                </div>
              );
            })}
      </div>

      {/* Quiet hours */}
      <div className="mt-4 pt-4 border-t border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Moon size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-foreground">{t("npQuietHours")}</p>
              <p className="text-[11.5px] text-muted-foreground leading-snug">
                {t("npQuietDesc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {savingQuiet && <Loader2 size={12} className="text-muted-foreground animate-spin" />}
            <Switch
              checked={quietEnabled}
              onCheckedChange={(v) => { setQuietEnabled(v); saveQuiet({ enabled: v }); }}
              aria-label={t("npQuietToggleAria")}
            />
          </div>
        </div>
        {quietEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-[11.5px] text-muted-foreground">
              {t("npFrom")}
              <Input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                onBlur={() => saveQuiet({ start: quietStart })}
                className="mt-1 h-9"
              />
            </label>
            <label className="text-[11.5px] text-muted-foreground">
              {t("npTo")}
              <Input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                onBlur={() => saveQuiet({ end: quietEnd })}
                className="mt-1 h-9"
              />
            </label>
          </div>
        )}
      </div>

      {!subscribed && supported && configured && permission !== "denied" && (
        <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
          {t("npEnableHint")}
        </p>
      )}
    </motion.div>
  );
}
