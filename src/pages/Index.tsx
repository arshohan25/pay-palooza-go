import { useState, useEffect } from "react";
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
import AddMoneyFlow from "@/components/AddMoneyFlow";
import TransactionHistory from "@/pages/TransactionHistory";
import AccountPage from "@/pages/AccountPage";
import { BalanceCardSkeleton, QuickActionsSkeleton, TransactionListSkeleton } from "@/components/HomeSkeletons";

const Index = () => {
  const [activeTab, setActiveTab]         = useState("home");
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showCashOut, setShowCashOut]     = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [showRecharge, setShowRecharge]   = useState(false);
  const [showPayBill, setShowPayBill]     = useState(false);
  const [showAddMoney, setShowAddMoney]   = useState(false);
  const [isLoading, setIsLoading]         = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(t);
  }, []);

  const mainContent = () => {
    if (activeTab === "home") {
      return (
        <div className="space-y-5">
          <AppHeader />
          {isLoading ? (
            <>
              <BalanceCardSkeleton />
              <QuickActionsSkeleton />
              <TransactionListSkeleton />
            </>
          ) : (
            <>
              <BalanceCard />
              <QuickActions
                onSendMoney={() => setShowSendMoney(true)}
                onCashOut={() => setShowCashOut(true)}
                onPayment={() => setShowPayment(true)}
                onRecharge={() => setShowRecharge(true)}
                onPayBill={() => setShowPayBill(true)}
                onAddMoney={() => setShowAddMoney(true)}
              />
              <PromoCard />
              <TransactionList onSeeAll={() => setActiveTab("history")} />
            </>
          )}
        </div>
      );
    }
    if (activeTab === "history") {
      return <TransactionHistory />;
    }
    if (activeTab === "account") {
      return <AccountPage />;
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <p className="text-lg font-semibold capitalize">{activeTab}</p>
        <p className="text-sm">Coming soon</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden w-full">
      {/* ── Sidebar (md+) ── */}
      <SideNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 overflow-x-hidden">
        <main className="flex-1 w-full max-w-xl mx-auto px-4 py-4 pb-32 md:pb-12 md:px-8 md:py-8 md:max-w-2xl overflow-x-hidden">
          {mainContent()}
        </main>
      </div>

      {/* ── Bottom Nav (mobile only) ── */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Flow overlays ───────────────────────────────────────── */}
      {showSendMoney && <SendMoneyFlow onClose={() => setShowSendMoney(false)} />}
      {showCashOut   && <CashOutFlow   onClose={() => setShowCashOut(false)} />}
      {showPayment   && <PaymentFlow   onClose={() => setShowPayment(false)} />}
      {showRecharge  && <MobileRechargeFlow onClose={() => setShowRecharge(false)} />}
      {showPayBill   && <PayBillFlow   onClose={() => setShowPayBill(false)} />}
      {showAddMoney  && <AddMoneyFlow  onClose={() => setShowAddMoney(false)} />}
    </div>
  );
};

export default Index;
