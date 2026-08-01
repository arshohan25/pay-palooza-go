import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gauge, Save, AlertCircle } from "lucide-react";
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

/** Sensible bounds so a typo can't unlock a ৳100 crore ceiling. */
const MAX_AMOUNT_CAP = 100_000_000; // ৳10 crore
const MAX_COUNT_CAP = 1000;

/** Returns a human-readable problem with a cell value, or null when valid. */
export function validateLimitValue(field: "max_amount" | "max_count", raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "Required";
  if (!/^\d+$/.test(trimmed)) {
    return Number(trimmed) < 0 ? "Cannot be negative" : "Whole numbers only";
  }
  const n = Number(trimmed);
  if (field === "max_amount") {
    if (n < 0) return "Cannot be negative";
    if (n > MAX_AMOUNT_CAP) return `Max ৳${MAX_AMOUNT_CAP.toLocaleString()}`;
  } else {
    if (n < 0) return "Cannot be negative";
    if (n > MAX_COUNT_CAP) return `Max ${MAX_COUNT_CAP} txns`;
  }
  return null;
}

/**
 * Admin matrix editor for `loyalty_tier_limits` — the daily/monthly ceilings
 * each EasyPay Club tier unlocks per transaction type. Values are validated
 * inline and confirmed in a summary dialog before saving.
 */
export default function AdminLoyaltyTierLimits() {
  const qc = useQueryClient();
  const { data: tiers } = useLoyaltyTiers();
  const { data: rows, isLoading } = useLoyaltyTierLimits();
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [draft, setDraft] = useState<Draft>({});
  // Raw text per cell so we can report typos ("12.5", "-3") rather than silently coercing.
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sortedTiers = useMemo(() => (tiers ?? []).slice().sort((a, b) => a.rank - b.rank), [tiers]);

  const stored = (tierId: string, txn: TierTxnKey, field: "max_amount" | "max_count") => {
    const row = rows?.find((r) => r.tier_id === tierId && r.txn_type === txn && r.period === period);
    return Number(row?.[field] ?? 0);
  };

  const value = (tierId: string, txn: TierTxnKey, field: "max_amount" | "max_count") => {
    const k = key(tierId, txn, period);
    if (draft[k]) return draft[k][field];
    return stored(tierId, txn, field);
  };

  const cellId = (tierId: string, txn: string, field: string) => `${key(tierId, txn, period)}|${field}`;

  const rawValue = (tierId: string, txn: TierTxnKey, field: "max_amount" | "max_count") => {
    const id = cellId(tierId, txn, field);
    return rawInputs[id] ?? String(value(tierId, txn, field));
  };

  const cellError = (tierId: string, txn: TierTxnKey, field: "max_amount" | "max_count") => {
    const id = cellId(tierId, txn, field);
    if (!(id in rawInputs)) return null;
    return validateLimitValue(field, rawInputs[id]);
  };

  const errorCount = Object.entries(rawInputs).filter(([id, raw]) => {
    const field = id.endsWith("max_count") ? "max_count" : "max_amount";
    return validateLimitValue(field as any, raw) !== null;
  }).length;

  const setValue = (
    tierId: string,
    txn: TierTxnKey,
    field: "max_amount" | "max_count",
    raw: string,
  ) => {
    const id = cellId(tierId, txn, field);
    setRawInputs((r) => ({ ...r, [id]: raw }));
    if (validateLimitValue(field, raw) !== null) return;
    const v = Number(raw);
    const k = key(tierId, txn, period);
    setDraft((d) => ({
      ...d,
      [k]: {
        max_amount: field === "max_amount" ? v : value(tierId, txn, "max_amount"),
        max_count: field === "max_count" ? v : value(tierId, txn, "max_count"),
      },
    }));
  };

  /** Human summary of every pending change, for the confirmation dialog. */
  const changes = useMemo(() => {
    return Object.entries(draft)
      .map(([k, v]) => {
        const [tier_id, txn_type, p] = k.split("|");
        const tier = sortedTiers.find((t) => t.id === tier_id);
        const row = rows?.find(
          (r) => r.tier_id === tier_id && r.txn_type === txn_type && r.period === p,
        );
        const prevAmount = Number(row?.max_amount ?? 0);
        const prevCount = Number(row?.max_count ?? 0);
        return {
          k,
          tierName: tier?.name ?? "Tier",
          service: LABELS[txn_type as TierTxnKey] ?? txn_type,
          period: p,
          prevAmount,
          prevCount,
          nextAmount: v.max_amount,
          nextCount: v.max_count,
          amountChanged: prevAmount !== v.max_amount,
          countChanged: prevCount !== v.max_count,
        };
      })
      .filter((c) => c.amountChanged || c.countChanged);
  }, [draft, rows, sortedTiers]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(draft).map(([k, v]) => {
        const [tier_id, txn_type, p] = k.split("|");
        return { tier_id, txn_type, period: p, max_amount: v.max_amount, max_count: v.max_count };
      });
      if (!payload.length) return 0;
      const { error } = await supabase
        .from("loyalty_tier_limits" as any)
        .upsert(payload as any, { onConflict: "tier_id,txn_type,period" });
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      const tierNames = Array.from(new Set(changes.map((c) => c.tierName)));
      toast.success("Tier limits saved successfully", {
        description: count
          ? `${count} limit${count > 1 ? "s" : ""} updated · ${tierNames.join(", ")}`
          : undefined,
      });
      setDraft({});
      setRawInputs({});
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["loyalty-tier-limits"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const dirty = changes.length;
  const fmt = (n: number) => n.toLocaleString("en-US");

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
          <Button
            size="sm"
            disabled={!dirty || !!errorCount || save.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Save className="w-4 h-4 mr-1" /> {save.isPending ? "Saving…" : `Save${dirty ? ` (${dirty})` : ""}`}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          These ceilings override the platform defaults for users in each tier. A personal admin
          override on a user still wins over the tier value. Each cell has two fields:{" "}
          <span className="font-medium text-foreground">Max amount (৳)</span> and{" "}
          <span className="font-medium text-foreground">Max transactions</span> for the selected
          period. Whole numbers only — no decimals or negatives.
        </p>
        {!!errorCount && (
          <p className="text-xs text-destructive flex items-center gap-1 mb-2">
            <AlertCircle className="w-3.5 h-3.5" /> {errorCount} field
            {errorCount > 1 ? "s" : ""} need fixing before you can save.
          </p>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-2 py-2 text-xs font-medium" rowSpan={2}>Service</th>
                  {sortedTiers.map((t) => (
                    <th key={t.id} className="text-left px-2 py-2 text-xs font-medium whitespace-nowrap">
                      {t.name} <Badge variant="outline" className="text-[9px]">R{t.rank}</Badge>
                    </th>
                  ))}
                </tr>
                <tr className="border-b text-muted-foreground">
                  {sortedTiers.map((t) => (
                    <th key={t.id} className="px-2 pb-2 text-left font-normal">
                      <div className="flex gap-1">
                        <span className="w-28 text-[10px] uppercase tracking-wide">Max amount (৳)</span>
                        <span className="w-16 text-[10px] uppercase tracking-wide">Max txns</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIER_TXN_KEYS.map((txn) => (
                  <tr key={txn} className="border-b border-border/50">
                    <td className="px-2 py-2 text-xs font-medium whitespace-nowrap">{LABELS[txn]}</td>
                    {sortedTiers.map((t) => {
                      const amtErr = cellError(t.id, txn, "max_amount");
                      const cntErr = cellError(t.id, txn, "max_count");
                      return (
                        <td key={t.id} className="px-2 py-2 align-top">
                          <div className="flex gap-1">
                            <div className="w-28">
                              <Input
                                className={`h-8 text-xs ${amtErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                type="number"
                                inputMode="numeric"
                                step={1}
                                min={0}
                                aria-invalid={!!amtErr}
                                aria-label={`${t.name} ${LABELS[txn]} max amount (${period})`}
                                title={`Max ${period} amount in ৳ for ${LABELS[txn]} — ${t.name}`}
                                value={rawValue(t.id, txn, "max_amount")}
                                onChange={(e) => setValue(t.id, txn, "max_amount", e.target.value)}
                                placeholder="৳ amount"
                              />
                              {amtErr && <p className="text-[9.5px] text-destructive mt-0.5">{amtErr}</p>}
                            </div>
                            <div className="w-16">
                              <Input
                                className={`h-8 text-xs ${cntErr ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                type="number"
                                inputMode="numeric"
                                step={1}
                                min={0}
                                aria-invalid={!!cntErr}
                                aria-label={`${t.name} ${LABELS[txn]} max transactions (${period})`}
                                title={`Max number of ${LABELS[txn]} transactions per ${period === "daily" ? "day" : "month"} — ${t.name}`}
                                value={rawValue(t.id, txn, "max_count")}
                                onChange={(e) => setValue(t.id, txn, "max_count", e.target.value)}
                                placeholder="txns"
                              />
                              {cntErr && <p className="text-[9.5px] text-destructive mt-0.5">{cntErr}</p>}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm limit changes</DialogTitle>
            <DialogDescription>
              {dirty} limit{dirty > 1 ? "s" : ""} will be updated. Users in these tiers are affected
              immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            {changes.map((c) => (
              <div key={c.k} className="rounded-lg border px-2.5 py-2">
                <p className="font-semibold">
                  {c.tierName} · {c.service} · {c.period}
                </p>
                {c.amountChanged && (
                  <p className="text-muted-foreground">
                    Max amount: ৳{fmt(c.prevAmount)} → <b className="text-foreground">৳{fmt(c.nextAmount)}</b>
                  </p>
                )}
                {c.countChanged && (
                  <p className="text-muted-foreground">
                    Max txns: {fmt(c.prevCount)} → <b className="text-foreground">{fmt(c.nextCount)}</b>
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Confirm & save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
