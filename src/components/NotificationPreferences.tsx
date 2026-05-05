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

type Category = {
  key: string;
  label: string;
  description: string;
};

const MERCHANT_CATEGORIES: Category[] = [
  { key: "merchant_new_order", label: "New orders", description: "Buzz when a new order arrives." },
  { key: "merchant_payout", label: "Payouts", description: "Settlement and payout confirmations." },
  { key: "merchant_refund", label: "Refunds & returns", description: "Refund requests and return updates." },
  { key: "merchant_low_stock", label: "Low stock alerts", description: "When inventory drops below threshold." },
  { key: "merchant_inquiry", label: "Customer inquiries", description: "Buyer chat messages on your products." },
  { key: "merchant_api", label: "API access updates", description: "When your API access request is approved or denied." },
];

const AGENT_CATEGORIES: Category[] = [
  { key: "agent_float_low", label: "Float low", description: "When your float drops under 10%." },
  { key: "agent_commission", label: "Commission credited", description: "When a commission is paid out." },
  { key: "agent_fund_request", label: "Fund requests", description: "Approval or rejection of fund requests." },
  { key: "agent_cash_in_out", label: "Cash in / out", description: "When customers transact with you." },
];

const COMMON_CATEGORIES: Category[] = [
  { key: "daily_summary", label: "Daily summary", description: "Yesterday's recap at 8:00 PM." },
  { key: "marketing", label: "Promotions & tips", description: "Offers, drops, and platform updates." },
];

interface Props {
  scope: "merchant" | "agent" | "distributor";
}

export default function NotificationPreferences({ scope }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { supported, configured, permission, subscribed, subscribe, unsubscribe, busy } =
    usePushSubscription();

  const categories = useMemo(() => {
    const base = scope === "merchant" ? MERCHANT_CATEGORIES : AGENT_CATEGORIES;
    return [...base, ...COMMON_CATEGORIES];
  }, [scope]);

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("notification_preferences")
        .select("category, push_enabled")
        .eq("user_id", user.id);
      const map: Record<string, boolean> = {};
      for (const c of categories) map[c.key] = true; // default on
      for (const row of data ?? []) map[row.category] = !!row.push_enabled;
      setPrefs(map);
      setLoading(false);
    })();
  }, [user, categories]);

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
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    }
  };

  const handleMaster = async () => {
    if (subscribed) {
      const ok = await unsubscribe();
      if (ok) toast({ title: "Push disabled" });
    } else {
      const r = await subscribe();
      if (r.ok) toast({ title: "Push enabled 🔔" });
      else toast({ title: "Couldn't enable", description: r.error, variant: "destructive" });
    }
  };

  const masterStatus = !supported
    ? { label: "Unsupported on this device", tone: "muted" as const }
    : !configured
    ? { label: "Push not configured", tone: "warn" as const }
    : permission === "denied"
    ? { label: "Permission blocked in browser", tone: "warn" as const }
    : subscribed
    ? { label: "Push active on this device", tone: "ok" as const }
    : { label: "Push not enabled on this device", tone: "muted" as const };

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
            <h3 className="text-[15px] font-bold text-foreground">Notification preferences</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Choose which alerts buzz your device.
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
                {masterStatus.label}
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
          {subscribed ? "Disable" : "Enable"}
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
              const blocked = !subscribed; // if no subscription, switches are informative only
              return (
                <div
                  key={c.key}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {c.label}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground leading-snug">
                      {c.description}
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
                      aria-label={`Toggle ${c.label}`}
                    />
                  </div>
                </div>
              );
            })}
      </div>

      {!subscribed && supported && configured && permission !== "denied" && (
        <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
          Enable push above to start receiving alerts. Your category choices are saved either way.
        </p>
      )}
    </motion.div>
  );
}
