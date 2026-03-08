import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Banknote, CreditCard, TrendingDown, Info, Smartphone, FileText, Building2, ArrowDownLeft, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Progress } from "@/components/ui/progress";
import { useUsageStats } from "@/hooks/use-usage-stats";
import { useFeeConfig } from "@/hooks/use-fee-config";

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
          <span className="text-[11.5px] font-bold text-primary">{t("noLimit")}</span>
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
  const { daily, monthly, limits, loading } = useUsageStats();
  const { getFeeLabel, loading: feeLoading } = useFeeConfig();

  const sendFee = getFeeLabel("send");
  const cashinFee = getFeeLabel("cashin");
  const cashoutFee = getFeeLabel("cashout");
  const addmoneyFee = getFeeLabel("addmoney");
  const paymentFee = getFeeLabel("payment");
  const rechargeFee = getFeeLabel("recharge");
  const paybillFee = getFeeLabel("paybill");
  const banktransferFee = getFeeLabel("banktransfer");

  const lim = limits;

  const SERVICES: ServiceCardProps[] = [
    {
      icon: ArrowUpRight,
      iconClass: "gradient-send",
      title: t("sendMoney"),
      limits: [
        { label: t("sendMoney"), used: daily.send.usedAmount, limit: lim.send.dailyAmount, maxTxn: lim.send.dailyCount, usedTxn: daily.send.usedCount, period: "Daily", fee: "Free/৳3/৳5" },
        { label: t("sendMoney"), used: monthly.send.usedAmount, limit: lim.send.monthlyAmount, maxTxn: lim.send.monthlyCount, usedTxn: monthly.send.usedCount, period: "Monthly", fee: "Free/৳3/৳5" },
      ],
    },
    {
      icon: ArrowDownLeft,
      iconClass: "gradient-addmoney",
      title: t("cashIn"),
      limits: [
        { label: t("cashIn"), used: daily.cashin.usedAmount, limit: lim.cashin.dailyAmount, maxTxn: lim.cashin.dailyCount, usedTxn: daily.cashin.usedCount, period: "Daily", fee: cashinFee },
        { label: t("cashIn"), used: monthly.cashin.usedAmount, limit: lim.cashin.monthlyAmount, maxTxn: lim.cashin.monthlyCount, usedTxn: monthly.cashin.usedCount, period: "Monthly", fee: cashinFee },
      ],
    },
    {
      icon: Banknote,
      iconClass: "gradient-cashout",
      title: t("cashOut"),
      limits: [
        { label: t("cashOut"), used: daily.cashout.usedAmount, limit: lim.cashout.dailyAmount, maxTxn: lim.cashout.dailyCount, usedTxn: daily.cashout.usedCount, period: "Daily", fee: cashoutFee },
        { label: t("cashOut"), used: monthly.cashout.usedAmount, limit: lim.cashout.monthlyAmount, maxTxn: lim.cashout.monthlyCount, usedTxn: monthly.cashout.usedCount, period: "Monthly", fee: cashoutFee },
      ],
    },
    {
      icon: CreditCard,
      iconClass: "gradient-addmoney",
      title: t("addMoney"),
      limits: [
        { label: t("addMoney"), used: daily.addmoney.usedAmount, limit: lim.addmoney.dailyAmount, maxTxn: lim.addmoney.dailyCount, usedTxn: daily.addmoney.usedCount, period: "Daily", fee: addmoneyFee },
        { label: t("addMoney"), used: monthly.addmoney.usedAmount, limit: lim.addmoney.monthlyAmount, maxTxn: lim.addmoney.monthlyCount, usedTxn: monthly.addmoney.usedCount, period: "Monthly", fee: addmoneyFee },
      ],
    },
    {
      icon: TrendingDown,
      iconClass: "gradient-payment",
      title: t("payment"),
      limits: [
        { label: t("payment"), used: daily.payment.usedAmount, limit: lim.payment.dailyAmount, maxTxn: lim.payment.dailyCount, usedTxn: daily.payment.usedCount, period: "Daily", fee: paymentFee },
        { label: t("payment"), used: monthly.payment.usedAmount, limit: lim.payment.monthlyAmount, maxTxn: lim.payment.monthlyCount, usedTxn: monthly.payment.usedCount, period: "Monthly", fee: paymentFee },
      ],
    },
    {
      icon: Smartphone,
      iconClass: "gradient-send",
      title: t("mobileRecharge"),
      limits: [
        { label: t("mobileRecharge"), used: daily.recharge.usedAmount, limit: lim.recharge.dailyAmount, maxTxn: lim.recharge.dailyCount, usedTxn: daily.recharge.usedCount, period: "Daily", fee: rechargeFee },
        { label: t("mobileRecharge"), used: monthly.recharge.usedAmount, limit: lim.recharge.monthlyAmount, maxTxn: lim.recharge.monthlyCount, usedTxn: monthly.recharge.usedCount, period: "Monthly", fee: rechargeFee },
      ],
    },
    {
      icon: FileText,
      iconClass: "gradient-payment",
      title: t("payBill"),
      limits: [
        { label: t("payBill"), used: daily.paybill.usedAmount, limit: lim.paybill.dailyAmount, maxTxn: lim.paybill.dailyCount, usedTxn: daily.paybill.usedCount, period: "Daily", fee: paybillFee },
        { label: t("payBill"), used: monthly.paybill.usedAmount, limit: lim.paybill.monthlyAmount, maxTxn: lim.paybill.monthlyCount, usedTxn: monthly.paybill.usedCount, period: "Monthly", fee: paybillFee },
      ],
    },
    {
      icon: Building2,
      iconClass: "gradient-cashout",
      title: t("bankTransfer"),
      limits: [
        { label: t("bankTransfer"), used: daily.banktransfer.usedAmount, limit: lim.banktransfer.dailyAmount, maxTxn: lim.banktransfer.dailyCount, usedTxn: daily.banktransfer.usedCount, period: "Daily", fee: banktransferFee },
        { label: t("bankTransfer"), used: monthly.banktransfer.usedAmount, limit: lim.banktransfer.monthlyAmount, maxTxn: lim.banktransfer.monthlyCount, usedTxn: monthly.banktransfer.usedCount, period: "Monthly", fee: banktransferFee },
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
    {loading || feeLoading ? (
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
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffCashOutAgentNew")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffATM")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffSendMoneyNew")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffBankTransferNew")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffAddMoneyFree")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffPaymentPayBill")}</li>
      </ul>
    </div>
  </motion.div>
  );
};

export default LimitsPage;
