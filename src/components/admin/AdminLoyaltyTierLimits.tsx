import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gauge, Save } from "lucide-react";
import { useLoyaltyTiers } from "@/hooks/use-loyalty";
import { useLoyaltyTierLimits, TIER_TXN_KEYS, type TierTxnKey } from "@/hooks/use-loyalty-tier-limits";

type Draft = Record<string, { max_amount: number; max_count: number }>;
const key = (tierId: string, txn: string, period: string) => `${tierId}|${txn}|${period}`;

const LABELS: Record<TierTxnKey, string> = {
  send: "Send money",
  cashout: "Cash out",
  cashin: "Cash in",
  addmoney: "Add money",
  payment: "Payment",
  recharge: "Recharge",
  paybill: "Pay bill",
  banktransfer: "Bank transfer",
};

/**
 * Admin matrix editor for `loyalty_tier_limits` — the daily/monthly ceilings
 * each EasyPay Club tier unlocks per transaction type.
 */
export default function AdminLoyaltyTierLimits() {
  const qc = useQueryClient();
  const { data: tiers } = useLoyaltyTiers();
  const { data: rows, isLoading } = useLoyaltyTierLimits();
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [draft, setDraft] = useState<Draft>({});

  const sortedTiers = useMemo(() => (tiers ?? []).slice().sort((a, b) => a.rank - b.rank), [tiers]);

  const value = (tierId: string, txn: TierTxnKey, field: "max_amount" | "max_count") => {
    const k = key(tierId, txn, period);
    if (draft[k]) return draft[k][field];
    const row = rows?.find((r) => r.tier_id === tierId && r.txn_type === txn && r.period === period);
    return Number(row?.[field] ?? 0);
  };

  const setValue = (tierId: string, txn: TierTxnKey, field: "max_amount" | "max_count", v: number) => {
    const k = key(tierId, txn, period);
    setDraft((d) => ({
      ...d,
      [k]: {
        max_amount: field === "max_amount" ? v : value(tierId, txn, "max_amount"),
        max_count: field === "max_count" ? v : value(tierId, txn, "max_count"),
      },
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(draft).map(([k, v]) => {
        const [tier_id, txn_type, p] = k.split("|");
        return { tier_id, txn_type, period: p, max_amount: v.max_amount, max_count: v.max_count };
      });
      if (!payload.length) return;
      const { error } = await supabase
        .from("loyalty_tier_limits" as any)
        .upsert(payload as any, { onConflict: "tier_id,txn_type,period" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tier limits saved");
      setDraft({});
      qc.invalidateQueries({ queryKey: ["loyalty-tier-limits"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const dirty = Object.keys(draft).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Tier transaction limits
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {(["daily", "monthly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium capitalize ${period === p ? "bg-primary text-primary-foreground" : "bg-background"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Saving…" : `Save${dirty ? ` (${dirty})` : ""}`}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          These ceilings override the platform defaults for users in each tier. A personal admin
          override on a user still wins over the tier value.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-2 py-2 text-xs font-medium">Service</th>
                  {sortedTiers.map((t) => (
                    <th key={t.id} className="text-left px-2 py-2 text-xs font-medium whitespace-nowrap">
                      {t.name} <Badge variant="outline" className="text-[9px]">R{t.rank}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIER_TXN_KEYS.map((txn) => (
                  <tr key={txn} className="border-b border-border/50">
                    <td className="px-2 py-2 text-xs font-medium whitespace-nowrap">{LABELS[txn]}</td>
                    {sortedTiers.map((t) => (
                      <td key={t.id} className="px-2 py-2">
                        <div className="flex gap-1">
                          <Input
                            className="h-8 w-28 text-xs"
                            type="number"
                            value={value(t.id, txn, "max_amount")}
                            onChange={(e) => setValue(t.id, txn, "max_amount", +e.target.value)}
                            placeholder="৳ amount"
                          />
                          <Input
                            className="h-8 w-16 text-xs"
                            type="number"
                            value={value(t.id, txn, "max_count")}
                            onChange={(e) => setValue(t.id, txn, "max_count", +e.target.value)}
                            placeholder="txn"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
