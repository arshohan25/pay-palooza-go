import { CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

export type LinkPaymentRow = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  transaction_id: string | null;
  payer_name?: string | null;
};

interface Props {
  payments: LinkPaymentRow[];
  emptyLabel?: string;
  currency?: string;
}

const PaymentLinkTimeline = ({ payments, emptyLabel = "No payments yet.", currency = "৳" }: Props) => {
  if (!payments.length) {
    return <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>;
  }
  return (
    <ol className="relative border-l border-border/60 pl-4 space-y-3">
      {payments.map((p) => (
        <li key={p.id} className="relative">
          <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          </span>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
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
        </li>
      ))}
    </ol>
  );
};

export default PaymentLinkTimeline;
