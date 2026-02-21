import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Banknote, CreditCard, TrendingDown, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Progress } from "@/components/ui/progress";

interface LimitRowProps {
  label: string;
  used: number;
  limit: number;
  period: "Daily" | "Monthly";
  fee?: string;
}

const LimitRow = ({ label, used, limit, period, fee }: LimitRowProps) => {
  const { t } = useI18n();
  const pct = Math.round((used / limit) * 100);
  const remaining = limit - used;
  const isWarning = pct >= 75;
  const isDanger = pct >= 90;
  const periodLabel = period === "Daily" ? t("daily") : t("monthly");

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
        <span>{t("used")} ৳{used.toLocaleString()}</span>
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

const useServices = (): ServiceCardProps[] => {
  const { t } = useI18n();
  return [
    {
      icon: ArrowUpRight,
      iconClass: "gradient-send",
      title: t("sendMoney"),
      limits: [
        { label: t("sendMoney"), used: 18500, limit: 25000, period: "Daily",   fee: t("free") },
        { label: t("sendMoney"), used: 74000, limit: 200000, period: "Monthly", fee: t("free") },
      ],
    },
    {
      icon: Banknote,
      iconClass: "gradient-cashout",
      title: t("cashOut"),
      limits: [
        { label: t("cashOut"), used: 8000,  limit: 20000,  period: "Daily",   fee: "1.85%" },
        { label: t("cashOut"), used: 35000, limit: 100000, period: "Monthly", fee: "1.85%" },
      ],
    },
    {
      icon: CreditCard,
      iconClass: "gradient-addmoney",
      title: t("addMoney"),
      limits: [
        { label: t("addMoney"), used: 5000,  limit: 30000,  period: "Daily",   fee: t("free") },
        { label: t("addMoney"), used: 22000, limit: 200000, period: "Monthly", fee: t("free") },
      ],
    },
    {
      icon: TrendingDown,
      iconClass: "gradient-payment",
      title: t("payment"),
      limits: [
        { label: t("payment"), used: 2200,  limit: 10000,  period: "Daily",   fee: t("free") },
        { label: t("payment"), used: 11000, limit: 50000,  period: "Monthly", fee: t("free") },
      ],
    },
  ];
};

interface LimitsPageProps {
  onBack: () => void;
}

const LimitsPage = ({ onBack }: LimitsPageProps) => {
  const { t } = useI18n();
  const SERVICES = useServices();
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

    {/* Service cards */}
    {SERVICES.map((s) => (
      <ServiceCard key={s.title} {...s} />
    ))}

    {/* Tariff note */}
    <div className="bg-card rounded-3xl border border-border/60 p-4 space-y-2.5 shadow-card">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {t("tariffNote")}
      </p>
      <ul className="space-y-2 text-[12px] text-muted-foreground font-medium">
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffCashOutAgent")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffCashOutATM")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffSendMoney")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffAddMoney")}</li>
        <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{t("tariffPayment")}</li>
      </ul>
    </div>
  </motion.div>
  );
};

export default LimitsPage;
