import { Ticket } from "lucide-react";

interface CouponSummaryLineProps {
  code: string;
  discount: number;
}

const CouponSummaryLine = ({ code, discount }: CouponSummaryLineProps) => (
  <div className="flex justify-between items-center">
    <span className="flex items-center gap-1.5 text-primary font-medium text-sm">
      <Ticket size={13} className="text-primary" />
      Coupon ({code})
    </span>
    <span className="text-primary font-bold text-sm">-৳{discount.toFixed(2)}</span>
  </div>
);

export default CouponSummaryLine;
