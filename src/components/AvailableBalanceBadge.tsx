import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { getBalance, onBalanceChange, fetchBalance } from "@/lib/balanceStore";
import { useI18n } from "@/lib/i18n";

/**
 * Small pill that always shows the live available balance.
 * Drop it above any amount-entry input.
 */
export default function AvailableBalanceBadge() {
  const [balance, setBalance] = useState(getBalance());
  const { t } = useI18n();

  useEffect(() => {
    fetchBalance();
    const unsub = onBalanceChange(setBalance);
    return () => { unsub(); };
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 w-fit">
      <Wallet size={12} className="text-primary shrink-0" />
      <span className="text-xs font-semibold text-primary">
        {t("availableLabel")}: ৳{balance.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
