import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Banknote, CreditCard, TrendingDown, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface LimitRowProps {
  label: string;
  used: number;
  limit: number;
  period: "Daily" | "Monthly";
  fee?: string;
}

const LimitRow = ({ label, used, limit, period, fee }: LimitRowProps) => {
  const pct = Math.round((used / limit) * 100);
  const remaining = limit - used;
  const isWarning = pct >= 75;
  const isDanger = pct >= 90;

  return (
    <div className="px-4 py-4 border-b border-border last:border-0 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{period}</span>
          {fee && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
              Fee: {fee}
            </span>
          )}
        </div>
        <span
          className={`text-xs font-semibold ${
            isDanger ? "text-destructive" : isWarning ? "text-accent" : "text-primary"
          }`}
        >
          {pct}% used
        </span>
      </div>
      <Progress
        value={pct}
        className={`h-2 ${isDanger ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-accent" : ""}`}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Used: ৳{used.toLocaleString()}</span>
        <span>Remaining: ৳{remaining.toLocaleString()} / ৳{limit.toLocaleString()}</span>
      </div>
    </div>
  );
};

interface ServiceCardProps {
  icon: React.ElementType;
  iconClass: string;
  title: string;
  limits: LimitRowProps[];
}

const ServiceCard = ({ icon: Icon, iconClass, title, limits }: ServiceCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
  >
    {/* Header */}
    <div className={`${iconClass} px-4 py-3 flex items-center gap-3`}>
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
        <Icon size={16} className="text-primary-foreground" strokeWidth={2.2} />
      </div>
      <span className="text-sm font-bold text-primary-foreground">{title}</span>
    </div>
    {/* Limit rows */}
    {limits.map((l) => (
      <LimitRow key={`${title}-${l.period}`} {...l} />
    ))}
  </motion.div>
);

const SERVICES: ServiceCardProps[] = [
  {
    icon: ArrowUpRight,
    iconClass: "gradient-send",
    title: "Send Money",
    limits: [
      { label: "Send Money", used: 18500, limit: 25000, period: "Daily",   fee: "Free" },
      { label: "Send Money", used: 74000, limit: 200000, period: "Monthly", fee: "Free" },
    ],
  },
  {
    icon: Banknote,
    iconClass: "gradient-cashout",
    title: "Cash Out",
    limits: [
      { label: "Cash Out", used: 8000,  limit: 20000,  period: "Daily",   fee: "1.85%" },
      { label: "Cash Out", used: 35000, limit: 100000, period: "Monthly", fee: "1.85%" },
    ],
  },
  {
    icon: CreditCard,
    iconClass: "gradient-addmoney",
    title: "Add Money",
    limits: [
      { label: "Add Money", used: 5000,  limit: 30000,  period: "Daily",   fee: "Free" },
      { label: "Add Money", used: 22000, limit: 200000, period: "Monthly", fee: "Free" },
    ],
  },
  {
    icon: TrendingDown,
    iconClass: "gradient-payment",
    title: "Payment",
    limits: [
      { label: "Payment", used: 2200,  limit: 10000,  period: "Daily",   fee: "Free" },
      { label: "Payment", used: 11000, limit: 50000,  period: "Monthly", fee: "Free" },
    ],
  },
];

interface LimitsPageProps {
  onBack: () => void;
}

const LimitsPage = ({ onBack }: LimitsPageProps) => (
  <motion.div
    initial={{ opacity: 0, x: 40 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 40 }}
    transition={{ duration: 0.3 }}
    className="space-y-5 pb-6"
  >
    {/* Top bar */}
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors shadow-card"
      >
        <ArrowLeft size={18} className="text-foreground" />
      </button>
      <div>
        <h1 className="text-lg font-bold text-foreground">Limits & Charges</h1>
        <p className="text-xs text-muted-foreground">Your current usage & transaction limits</p>
      </div>
    </div>

    {/* Info banner */}
    <div className="flex gap-2.5 items-start bg-primary/8 border border-primary/20 rounded-2xl px-4 py-3">
      <Info size={15} className="text-primary mt-0.5 shrink-0" />
      <p className="text-xs text-primary leading-relaxed">
        Limits reset at midnight. Complete KYC verification to unlock higher transaction limits.
      </p>
    </div>

    {/* Service cards */}
    {SERVICES.map((s) => (
      <ServiceCard key={s.title} {...s} />
    ))}

    {/* Tariff note */}
    <div className="bg-card rounded-2xl border border-border p-4 space-y-2 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Tariff Note
      </p>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li>• Cash Out at agent: 1.85% per transaction</li>
        <li>• Cash Out at ATM: ৳15 flat fee per transaction</li>
        <li>• Send Money: Free up to ৳25,000/day</li>
        <li>• Add Money via bank: Free of charge</li>
        <li>• Payment to merchants: Free of charge</li>
      </ul>
    </div>
  </motion.div>
);

export default LimitsPage;
