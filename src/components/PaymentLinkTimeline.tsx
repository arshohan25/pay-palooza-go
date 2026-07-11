import { useState } from "react";
import { CheckCircle2, Clock, Undo2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

export type LinkPaymentRow = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  transaction_id: string | null;
  payer_name?: string | null;
  refunded_at?: string | null;
  refund_reason?: string | null;
};

interface Props {
  payments: LinkPaymentRow[];
  emptyLabel?: string;
  currency?: string;
  onRefund?: (paymentId: string, reason: string) => Promise<void> | void;
  refundingId?: string | null;
}

const PaymentLinkTimeline = ({ payments, emptyLabel = "No payments yet.", currency = "৳", onRefund, refundingId }: Props) => {
  const [reason, setReason] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (!payments.length) {
    return <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>;
  }

  return (
    <ol className="relative border-l border-border/60 pl-4 space-y-3">
      {payments.map((p) => {
        const refunded = p.status === "refunded";
        return (
          <li key={p.id} className="relative">
            <span className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border flex items-center justify-center ${
              refunded ? "bg-amber-500/20 border-amber-500" : "bg-emerald-500/20 border-emerald-500"
            }`}>
              {refunded
                ? <Undo2 className="w-2.5 h-2.5 text-amber-600" />
                : <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />}
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-sm font-semibold ${refunded ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {currency}{Number(p.amount).toLocaleString()}
              </span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(p.created_at), "d MMM, HH:mm")}
              </span>
            </div>
            {p.payer_name && (
              <p className="text-xs text-muted-foreground">from {p.payer_name}</p>
            )}
            {p.transaction_id && (
              <p className="text-[10px] font-mono text-muted-foreground truncate">
                ref: {p.transaction_id.slice(0, 8).toUpperCase()}
              </p>
            )}
            {refunded && (
              <p className="text-[11px] text-amber-600 mt-0.5">
                Refunded{p.refunded_at ? ` · ${format(new Date(p.refunded_at), "d MMM, HH:mm")}` : ""}
                {p.refund_reason ? ` · ${p.refund_reason}` : ""}
              </p>
            )}
            {onRefund && !refunded && (
              <AlertDialog open={openId === p.id} onOpenChange={(o) => setOpenId(o ? p.id : null)}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 mt-1 px-2 text-[11px] text-muted-foreground hover:text-destructive">
                    <RotateCcw className="w-3 h-3 mr-1" /> Refund
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Refund ৳{Number(p.amount).toLocaleString()}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will return the money to the payer from your wallet and adjust the link's remaining balance.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    placeholder="Reason (optional)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={500}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={refundingId === p.id}
                      onClick={async () => {
                        await onRefund(p.id, reason.trim());
                        setReason("");
                        setOpenId(null);
                      }}
                    >
                      {refundingId === p.id ? "Refunding…" : "Confirm refund"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
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
