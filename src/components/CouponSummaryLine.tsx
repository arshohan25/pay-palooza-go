import { Ticket } from "lucide-react";

interface CouponSummaryLineProps {
  code: string;
  discount: number;
}

const CouponSummaryLine = ({ code, discount }: CouponSummaryLineProps) => (
  <div className="flex justify-between items-center">
    <span className="flex items-center gap-1.5 text-muted-foreground text-[13px]">
      <Ticket size={12} className="text-primary/70" />
      {code}
    </span>
    <span className="text-primary font-semibold text-[13px]">−৳{discount.toFixed(2)}</span>
  </div>
);

export default CouponSummaryLine;
