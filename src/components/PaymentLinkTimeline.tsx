import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Undo2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

export type LinkPaymentRow = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  transaction_id: string | null;
  payer_name?: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
  refunded_amount?: number | null;
};

interface Props {
  payments: LinkPaymentRow[];
  emptyLabel?: string;
  currency?: string;
  onRefund?: (paymentId: string, reason: string, amount: number) => Promise<void> | void;
  refundingId?: string | null;
}

const PaymentLinkTimeline = ({ payments, emptyLabel, currency = "৳", onRefund, refundingId }: Props) => {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!openId) { setReason(""); setRefundAmount(""); }
  }, [openId]);

  if (!payments.length) {
    return <p className="text-xs text-muted-foreground italic">{emptyLabel ?? t("pltNoPayments")}</p>;
  }

  return (
    <ol className="relative border-l border-border/60 pl-4 space-y-3">
      {payments.map((p) => {
        const refundedAmt = Number(p.refunded_amount ?? 0);
        const refundable = Math.max(Number(p.amount) - refundedAmt, 0);
        const fullyRefunded = p.status === "refunded" || refundable <= 0;
        const partiallyRefunded = !fullyRefunded && refundedAmt > 0;
        const dotCls = fullyRefunded
          ? "bg-amber-500/20 border-amber-500"
          : partiallyRefunded
            ? "bg-amber-400/20 border-amber-400"
            : "bg-emerald-500/20 border-emerald-500";
        return (
          <li key={p.id} className="relative">
            <span className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border flex items-center justify-center ${dotCls}`}>
              {fullyRefunded || partiallyRefunded
                ? <Undo2 className="w-2.5 h-2.5 text-amber-600" />
                : <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />}
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-sm font-semibold ${fullyRefunded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {currency}{Number(p.amount).toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(p.created_at), "d MMM, HH:mm")}
              </span>
            </div>
            {p.payer_name && (
              <p className="text-xs text-muted-foreground">{t("pltFrom").replace("{name}", p.payer_name)}</p>
            )}
            {p.transaction_id && (
              <p className="text-[10px] font-mono text-muted-foreground truncate">
                {t("pltRef").replace("{id}", p.transaction_id.slice(0, 8).toUpperCase())}
              </p>
            )}
            {(fullyRefunded || partiallyRefunded) && (
              <p className="text-[11px] text-amber-600 mt-0.5">
                {fullyRefunded
                  ? t("pltRefunded")
                  : t("pltPartiallyRefunded")
                      .replace("{amount}", `${currency}${refundedAmt.toLocaleString()}`)
                      .replace("{total}", `${currency}${Number(p.amount).toLocaleString()}`)}
                {p.refunded_at && fullyRefunded ? ` · ${format(new Date(p.refunded_at), "d MMM, HH:mm")}` : ""}
                {p.refund_reason ? ` · ${p.refund_reason}` : ""}
              </p>
            )}
            {onRefund && !fullyRefunded && (
              <AlertDialog open={openId === p.id} onOpenChange={(o) => setOpenId(o ? p.id : null)}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 mt-1 px-2 text-[11px] text-muted-foreground hover:text-destructive">
                    <RotateCcw className="w-3 h-3 mr-1" /> {partiallyRefunded ? t("pltRefundMore") : t("pltRefund")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("pltRefundUpTo").replace("{amount}", `${currency}${refundable.toLocaleString()}`)}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("pltRefundDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {(() => {
                    const raw = refundAmount.trim();
                    const parsed = raw ? parseFloat(raw) : refundable;
                    const validNumber = Number.isFinite(parsed) && parsed > 0;
                    const overCap = validNumber && parsed > refundable + 0.00001;
                    const effective = validNumber && !overCap ? parsed : 0;
                    const remainingAfter = Math.max(refundable - effective, 0);
                    const canSubmit = validNumber && !overCap;
                    return (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            {t("pltAmountLabel").replace("{currency}", currency)}
                          </label>
                          <Input
                            type="number" min="1" step="1" inputMode="numeric"
                            max={refundable}
                            placeholder={t("pltFullRefund").replace("{amount}", refundable.toLocaleString())}
                            value={refundAmount}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") return setRefundAmount("");
                              const n = parseFloat(v);
                              if (!Number.isFinite(n)) return setRefundAmount(v);
                              const clamped = Math.min(n, refundable);
                              setRefundAmount(String(clamped));
                            }}
                            aria-invalid={overCap}
                          />
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={overCap ? "text-destructive" : "text-muted-foreground"}>
                              {overCap
                                ? t("pltExceeds").replace("{amount}", `${currency}${refundable.toLocaleString()}`)
                                : t("pltRefundable").replace("{amount}", `${currency}${refundable.toLocaleString()}`)}
                            </span>
                            <span className="text-muted-foreground">
                              {t("pltRemainingAfter")} <span className="font-medium text-foreground">{currency}{remainingAfter.toLocaleString()}</span>
                            </span>
                          </div>
                          <Textarea
                            placeholder={t("pltReasonPh")}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={2}
                            maxLength={500}
                          />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("pltCancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={refundingId === p.id || !canSubmit}
                            onClick={async (e) => {
                              e.preventDefault();
                              if (!canSubmit) return;
                              await onRefund(p.id, reason.trim(), effective);
                              setOpenId(null);
                            }}
                          >
                            {refundingId === p.id ? t("pltRefunding") : t("pltConfirmRefund")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </>
                    );
                  })()}
                </AlertDialogContent>
              </AlertDialog>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default PaymentLinkTimeline;
