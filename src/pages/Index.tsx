import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import PromoCard from "@/components/PromoCard";
import TransactionList from "@/components/TransactionList";
import BottomNav from "@/components/BottomNav";
import SendMoneyFlow from "@/components/SendMoneyFlow";
import CashOutFlow from "@/components/CashOutFlow";
import PaymentFlow from "@/components/PaymentFlow";
import MobileRechargeFlow from "@/components/MobileRechargeFlow";
import PayBillFlow from "@/components/PayBillFlow";
import TransactionHistory from "@/pages/TransactionHistory";

const Index = () => {
  const [activeTab, setActiveTab]     = useState("home");
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showCashOut, setShowCashOut]     = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [showRecharge, setShowRecharge]   = useState(false);
  const [showPayBill, setShowPayBill]     = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Home screen */}
      {activeTab === "home" && (
        <div className="max-w-md mx-auto px-4 pb-24">
          <AppHeader />
          <div className="space-y-5">
            <BalanceCard />
            <QuickActions
              onSendMoney={() => setShowSendMoney(true)}
              onCashOut={() => setShowCashOut(true)}
              onPayment={() => setShowPayment(true)}
              onRecharge={() => setShowRecharge(true)}
              onPayBill={() => setShowPayBill(true)}
            />
            <PromoCard />
            <TransactionList />
          </div>
        </div>
      )}

      {/* History screen */}
      {activeTab === "history" && (
        <TransactionHistory />
      )}

      {/* Placeholder screens */}
      {(activeTab === "scan" || activeTab === "inbox" || activeTab === "account") && (
        <div className="flex flex-col items-center justify-center min-h-screen gap-3 pb-24 text-muted-foreground">
          <p className="text-lg font-semibold">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
          <p className="text-sm">Coming soon</p>
        </div>
      )}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Flow overlays */}
      {showSendMoney && <SendMoneyFlow onClose={() => setShowSendMoney(false)} />}
      {showCashOut   && <CashOutFlow   onClose={() => setShowCashOut(false)} />}
      {showPayment   && <PaymentFlow   onClose={() => setShowPayment(false)} />}
      {showRecharge  && <MobileRechargeFlow onClose={() => setShowRecharge(false)} />}
      {showPayBill   && <PayBillFlow   onClose={() => setShowPayBill(false)} />}
    </div>
  );
};

export default Index;
