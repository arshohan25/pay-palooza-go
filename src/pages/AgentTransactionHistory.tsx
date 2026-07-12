import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Shield, TrendingUp, Banknote, ArrowDownToLine, ArrowUpFromLine, AlertOctagon } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/use-transactions";
import TransactionHistory from "./TransactionHistory";
import FlowHeader from "@/components/FlowHeader";
import FlagSuspiciousSheet from "@/components/agent/FlagSuspiciousSheet";

const fmt = (n: number) => n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const AgentTransactionHistory = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { transactions } = useTransactions();
  const [flagOpen, setFlagOpen] = useState(false);

  // Compute commission summary from agent-relevant transactions
  const summary = useMemo(() => {
    const agentTxns = transactions.filter((t) =>
      ["cashin", "cashout", "banktransfer", "paybill"].includes(t.type)
    );
    const totalCommission = agentTxns.reduce((sum, t) => sum + (t.commission || 0), 0);
    const cashInCount = agentTxns.filter((t) => t.type === "cashin").length;
    const cashOutCount = agentTxns.filter((t) => t.type === "cashout").length;
    const totalVolume = agentTxns.reduce((sum, t) => sum + t.amount, 0);
    return { totalCommission, cashInCount, cashOutCount, totalVolume, totalTxns: agentTxns.length };
  }, [transactions]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Login required</p>
        <Button onClick={() => navigate("/")} variant="outline">Go to Login</Button>
      </div>
    );
  }

  const statItems = [
    { icon: TrendingUp, label: "Commission", value: `৳${fmt(summary.totalCommission)}`, accent: true },
    { icon: Banknote, label: "Volume", value: `৳${fmt(summary.totalVolume)}`, accent: false },
    { icon: ArrowDownToLine, label: "Cash In", value: String(summary.cashInCount), accent: false },
    { icon: ArrowUpFromLine, label: "Cash Out", value: String(summary.cashOutCount), accent: false },
  ];

  return (
    <div className="min-h-screen bg-background pb-6">
      <FlowHeader
        title="Agent Transactions"
        tagline={`৳${fmt(summary.totalCommission)} earned`}
        icon={Building2}
        onBack={() => navigate("/agent")}
      />

      <div className="max-w-xl mx-auto px-4 pt-4">
        {/* Commission Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border/60 rounded-2xl p-4 mb-4 shadow-card"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Earnings Summary</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {statItems.map(({ icon: Icon, label, value, accent }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent ? "bg-primary/12" : "bg-muted"}`}>
                  <Icon size={16} className={accent ? "text-primary" : "text-muted-foreground"} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                  <p className={`text-[14px] font-bold truncate ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <Button
          variant="outline"
          className="w-full rounded-2xl h-11 mb-4 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
          onClick={() => setFlagOpen(true)}
        >
          <AlertOctagon size={16} className="mr-2" />
          Flag suspicious activity
        </Button>

        {/* Transaction list */}
        <TransactionHistory filterTypes={["cashin", "cashout", "banktransfer", "paybill"]} agentView />
      </div>

      <FlagSuspiciousSheet open={flagOpen} onClose={() => setFlagOpen(false)} />
    </div>
  );
};

export default AgentTransactionHistory;
