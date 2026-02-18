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

const Index = () => {
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showCashOut, setShowCashOut]     = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [showRecharge, setShowRecharge]   = useState(false);
  const [showPayBill, setShowPayBill]     = useState(false);

  return (
    <div className="min-h-screen bg-background">
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
      <BottomNav />
      {showSendMoney && <SendMoneyFlow onClose={() => setShowSendMoney(false)} />}
      {showCashOut   && <CashOutFlow   onClose={() => setShowCashOut(false)} />}
      {showPayment   && <PaymentFlow   onClose={() => setShowPayment(false)} />}
      {showRecharge  && <MobileRechargeFlow onClose={() => setShowRecharge(false)} />}
      {showPayBill   && <PayBillFlow   onClose={() => setShowPayBill(false)} />}
    </div>
  );
};

export default Index;
