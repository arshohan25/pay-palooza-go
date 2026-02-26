import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Banknote, CreditCard, TrendingDown, Info, Smartphone, FileText, Building2, ArrowDownLeft, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Progress } from "@/components/ui/progress";
import { useUsageStats } from "@/hooks/use-usage-stats";

interface LimitRowProps {
  label: string;
  used: number;
  limit: number;
  maxTxn: number;
  usedTxn: number;
  period: "Daily" | "Monthly";
  fee?: string;
}

const LimitRow = ({ label, used, limit, maxTxn, usedTxn, period, fee }: LimitRowProps) => {
  const { t } = useI18n();
  const isNoLimit = limit <= 0 && maxTxn <= 0;
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const remaining = limit - used;
  const isWarning = pct >= 75;
  const isDanger = pct >= 90;
  const periodLabel = period === "Daily" ? t("daily") : t("monthly");

  if (isNoLimit) {
    return (
      <div className="px-4 py-4 border-b border-border/50 last:border-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">{periodLabel}</span>
          <span className="text-[11.5px] font-bold text-primary">No Limit</span>
        </div>
        <div className="flex justify-between text-[11.5px] text-muted-foreground font-medium">
          <span>{t("used")} ৳{used.toLocaleString()} ({usedTxn} txn)</span>
          <span>{fee}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 border-b border-border/50 last:border-0 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">{periodLabel}</span>
          {fee && (
            <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground font-semibold border border-border/60">
              {t("fee")}: {fee}
            </span>
          )}
        </div>
        <span className={`text-[11.5px] font-bold ${isDanger ? "text-destructive" : isWarning ? "text-accent" : "text-primary"}`}>
          {pct}% {t("pctUsed")}
        </span>
      </div>
      <Progress value={pct} className={`h-2 rounded-full ${isDanger ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-accent" : ""}`} />
      <div className="flex justify-between text-[11.5px] text-muted-foreground font-medium">
        <span>{t("used")} ৳{used.toLocaleString()} ({usedTxn}/{maxTxn} txn)</span>
        <span>৳{remaining.toLocaleString()} {t("left")} ৳{limit.toLocaleString()}</span>
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
    className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden"
  >
    <div className={`${iconClass} px-4 py-3.5 flex items-center gap-3`}>
      <div className="w-8 h-8 rounded-xl glass-hero flex items-center justify-center">
        <Icon size={15} className="text-primary-foreground" strokeWidth={2.2} />
      </div>
      <span className="text-[13.5px] font-bold text-primary-foreground">{title}</span>
    </div>
    {limits.map((l) => (
      <LimitRow key={`${title}-${l.period}`} {...l} />
    ))}
  </motion.div>
);

interface LimitsPageProps {
  onBack: () => void;
}

const LimitsPage = ({ onBack }: LimitsPageProps) => {
  const { t } = useI18n();
  const { daily, monthly, loading } = useUsageStats();

  const SERVICES: ServiceCardProps[] = [
    {
      icon: ArrowUpRight,
      iconClass: "gradient-send",
      title: t("sendMoney"),
      limits: [
        { label: t("sendMoney"), used: daily.send.usedAmount, limit: 50000, maxTxn: 40, usedTxn: daily.send.usedCount, period: "Daily", fee: "Free ≤৳100, ৳3 ≤৳50k, ৳5" },
        { label: t("sendMoney"), used: monthly.send.usedAmount, limit: 400000, maxTxn: 100, usedTxn: monthly.send.usedCount, period: "Monthly", fee: "Free ≤৳100, ৳3 ≤৳50k, ৳5" },
      ],
    },
    {
      icon: ArrowDownLeft,
      iconClass: "gradient-addmoney",
      title: "Cash In",
      limits: [
        { label: "Cash In", used: daily.cashin.usedAmount, limit: 50000, maxTxn: 20, usedTxn: daily.cashin.usedCount, period: "Daily", fee: t("free") },
        { label: "Cash In", used: monthly.cashin.usedAmount, limit: 300000, maxTxn: 100, usedTxn: monthly.cashin.usedCount, period: "Monthly", fee: t("free") },
      ],
    },
    {
      icon: Banknote,
      iconClass: "gradient-cashout",
      title: t("cashOut"),
      limits: [
        { label: t("cashOut"), used: daily.cashout.usedAmount, limit: 35000, maxTxn: 15, usedTxn: daily.cashout.usedCount, period: "Daily", fee: "1.19%" },
        { label: t("cashOut"), used: monthly.cashout.usedAmount, limit: 300000, maxTxn: 100, usedTxn: monthly.cashout.usedCount, period: "Monthly", fee: "1.19%" },
      ],
    },
    {
      icon: CreditCard,
      iconClass: "gradient-addmoney",
      title: t("addMoney"),
      limits: [
        { label: t("addMoney"), used: daily.addmoney.usedAmount, limit: 50000, maxTxn: 20, usedTxn: daily.addmoney.usedCount, period: "Daily", fee: t("free") },
        { label: t("addMoney"), used: monthly.addmoney.usedAmount, limit: 300000, maxTxn: 50, usedTxn: monthly.addmoney.usedCount, period: "Monthly", fee: t("free") },
      ],
    },
    {
      icon: TrendingDown,
      iconClass: "gradient-payment",
      title: t("payment"),
      limits: [
        { label: t("payment"), used: daily.payment.usedAmount, limit: 0, maxTxn: 0, usedTxn: daily.payment.usedCount, period: "Daily", fee: t("free") },
        { label: t("payment"), used: monthly.payment.usedAmount, limit: 0, maxTxn: 0, usedTxn: monthly.payment.usedCount, period: "Monthly", fee: t("free") },
      ],
    },
    {
      icon: Smartphone,
      iconClass: "gradient-send",
      title: "Mobile Recharge",
      limits: [
        { label: "Mobile Recharge", used: daily.recharge.usedAmount, limit: 50000, maxTxn: 200, usedTxn: daily.recharge.usedCount, period: "Daily", fee: t("free") },
        { label: "Mobile Recharge", used: monthly.recharge.usedAmount, limit: 300000, maxTxn: 2000, usedTxn: monthly.recharge.usedCount, period: "Monthly", fee: t("free") },
      ],
    },
    {
      icon: FileText,
      iconClass: "gradient-payment",
      title: "Pay Bill",
      limits: [
        { label: "Pay Bill", used: daily.paybill.usedAmount, limit: 0, maxTxn: 0, usedTxn: daily.paybill.usedCount, period: "Daily", fee: t("free") },
        { label: "Pay Bill", used: monthly.paybill.usedAmount, limit: 0, maxTxn: 0, usedTxn: monthly.paybill.usedCount, period: "Monthly", fee: t("free") },
      ],
    },
    {
      icon: Building2,
      iconClass: "gradient-cashout",
      title: "Bank Transfer",
      limits: [
        { label: "Bank Transfer", used: daily.banktransfer.usedAmount, limit: 50000, maxTxn: 40, usedTxn: daily.banktransfer.usedCount, period: "Daily", fee: "1%" },
        { label: "Bank Transfer", used: monthly.banktransfer.usedAmount, limit: 400000, maxTxn: 100, usedTxn: monthly.banktransfer.usedCount, period: "Monthly", fee: "1%" },
      ],
    },
  ];

  return (
  <motion.div
    initial={{ opacity: 0, x: 32 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 32 }}
    transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
    className="space-y-5 pb-6"
  >
    {/* Top bar */}
    <div className="flex items-center gap-3">
      <motion.button
        whileTap={{ scale: 0.90 }}
        onClick={onBack}
        className="w-10 h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center hover:bg-muted transition-colors tap-target"
      >
        <ArrowLeft size={17} className="text-foreground" strokeWidth={2.2} />
      </motion.button>
      <div>
        <h1 className="text-[17px] font-bold text-foreground">{t("limitsTitle")}</h1>
        <p className="text-[11.5px] text-muted-foreground">{t("limitsSubtitle")}</p>
      </div>
    </div>

    {/* Info banner */}
    <div className="flex gap-3 items-start bg-primary/8 border border-primary/20 rounded-2xl px-4 py-3.5">
      <Info size={15} className="text-primary mt-0.5 shrink-0" />
      <p className="text-[12px] text-primary leading-relaxed font-medium">
        {t("limitsInfoBanner")}
      </p>
    </div>

    {/* Loading state */}
    {loading ? (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    ) : (
      /* Service cards */
      SERVICES.map((s) => (
        <ServiceCard key={s.title} {...s} />
      ))
    )}

    {/* Tariff note */}
    <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2.5 shadow-card">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {t("tariffNote")}
      </p>
      <ul className="space-y-2 text-[12px] text-muted-foreground font-medium">
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />Cash Out (Agent): 1.19% fee</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />ATM Cash Out: Not available</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />Send Money: Free up to ৳100, then ৳3 up to ৳50,000, then ৳5/txn</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />Bank Transfer: 1% fee</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />Add Money: Free</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />Payment & Pay Bill: No limit, Free</li>
      </ul>
    </div>
  </motion.div>
  );
};

export default LimitsPage;
