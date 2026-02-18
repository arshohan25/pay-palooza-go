import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import PromoCard from "@/components/PromoCard";
import TransactionList from "@/components/TransactionList";
import BottomNav from "@/components/BottomNav";
import SideNav from "@/components/SideNav";
import SendMoneyFlow from "@/components/SendMoneyFlow";
import CashOutFlow from "@/components/CashOutFlow";
import PaymentFlow from "@/components/PaymentFlow";
import MobileRechargeFlow from "@/components/MobileRechargeFlow";
import PayBillFlow from "@/components/PayBillFlow";
import TransactionHistory from "@/pages/TransactionHistory";

const Index = () => {
  const [activeTab, setActiveTab]         = useState("home");
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showCashOut, setShowCashOut]     = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [showRecharge, setShowRecharge]   = useState(false);
  const [showPayBill, setShowPayBill]     = useState(false);

  const mainContent = () => {
    if (activeTab === "home") {
      return (
        <div className="space-y-5">
          <AppHeader />
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
      );
    }
    if (activeTab === "history") {
      return <TransactionHistory />;
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <p className="text-lg font-semibold capitalize">{activeTab}</p>
        <p className="text-sm">Coming soon</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar (md+) ──────────────────────────────────────── */}
      <SideNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Main content area ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:pl-64">
        {/* On mobile: scrollable padded page, bottom nav offset */}
        {/* On desktop: centered, constrained width */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-4 pb-28 md:pb-10 md:px-8 md:py-8">
          {mainContent()}
        </main>
      </div>

      {/* ── Bottom Nav (mobile only) ────────────────────────────── */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Flow overlays ───────────────────────────────────────── */}
      {showSendMoney && <SendMoneyFlow onClose={() => setShowSendMoney(false)} />}
      {showCashOut   && <CashOutFlow   onClose={() => setShowCashOut(false)} />}
      {showPayment   && <PaymentFlow   onClose={() => setShowPayment(false)} />}
      {showRecharge  && <MobileRechargeFlow onClose={() => setShowRecharge(false)} />}
      {showPayBill   && <PayBillFlow   onClose={() => setShowPayBill(false)} />}
    </div>
  );
};

export default Index;
