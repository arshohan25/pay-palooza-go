import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { clearTxnNotifs } from "@/lib/txnNotifStore";
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
import ShopFlow from "@/components/ShopFlow";
import TransactionHistory from "@/pages/TransactionHistory";
import AccountPage from "@/pages/AccountPage";
import ReferPage from "@/pages/ReferPage";
import { BalanceCardSkeleton, QuickActionsSkeleton, TransactionListSkeleton } from "@/components/HomeSkeletons";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import InstallPrompt from "@/components/InstallPrompt";
import AuthPage from "@/pages/AuthPage";
import InboxPage from "@/pages/InboxPage";
import SplashScreen from "@/components/SplashScreen";
import OnboardingSlides, { hasSeenOnboarding, markOnboardingDone } from "@/components/OnboardingSlides";
import TxnToast from "@/components/TxnToast";

const SESSION_KEY = "mfs_authenticated";

const Index = () => {
  const [splashDone, setSplashDone]           = useState(false);
  const [onboardingDone, setOnboardingDone]  = useState(() => hasSeenOnboarding());
  const [authenticated, setAuthenticated]    = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "1",
  );
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  const [activeTab, setActiveTab]         = useState("home");
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    if (tab === "history") clearTxnNotifs();
  }, []);
  const [showSendMoney, setShowSendMoney]         = useState(false);
  const [sendMoneyPrefilledPhone, setSendMoneyPrefilledPhone] = useState<string | undefined>(undefined);
  const [sendMoneyOnComplete, setSendMoneyOnComplete] = useState<((amount: number) => void) | undefined>(undefined);
  const [showCashOut, setShowCashOut]     = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [showRecharge, setShowRecharge]   = useState(false);
  const [showPayBill, setShowPayBill]     = useState(false);
  const [showAddMoney, setShowAddMoney]   = useState(false);
  const [showShop, setShowShop]           = useState(false);
  const [isLoading, setIsLoading]         = useState(true);
  const [isPulling, setIsPulling]         = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(t);
  }, []);

  const triggerRefresh = useCallback(() => {
    if (isLoading) return;
    setIsPulling(true);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsPulling(false);
    }, 1600);
  }, [isLoading]);

  usePullToRefresh({ onRefresh: triggerRefresh, threshold: 70 });

  const mainContent = () => {
    if (activeTab === "home") {
      return (
        <div className="space-y-5">
          <AppHeader onSignOut={() => setAuthenticated(false)} />

          {/* Pull-to-refresh indicator */}
          <AnimatePresence>
            {isPulling && (
              <motion.div
                key="ptr"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 40 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-center gap-2 text-primary text-sm font-semibold"
              >
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
                  <RefreshCw size={16} />
                </motion.div>
                Refreshing…
              </motion.div>
            )}
          </AnimatePresence>

          {isLoading ? (
            <>
              <BalanceCardSkeleton />
              <QuickActionsSkeleton />
              <TransactionListSkeleton />
            </>
          ) : (
            <>
              <BalanceCard onAddMoney={() => setShowAddMoney(true)} />
              <QuickActions
                onSendMoney={() => setShowSendMoney(true)}
                onCashOut={() => setShowCashOut(true)}
                onPayment={() => setShowPayment(true)}
                onRecharge={() => setShowRecharge(true)}
                onPayBill={() => setShowPayBill(true)}
                onAddMoney={() => setShowAddMoney(true)}
                onRefer={() => handleTabChange("refer")}
                onShop={() => setShowShop(true)}
              />
              <PromoCard />
              <TransactionList onSeeAll={() => handleTabChange("history")} />
            </>
          )}
        </div>
      );
    }
    if (activeTab === "history") {
      return <TransactionHistory onRefresh={triggerRefresh} />;
    }
    if (activeTab === "account") {
      return <AccountPage onSignOut={() => setAuthenticated(false)} onReplayOnboarding={() => { setOnboardingDone(false); setReplayOnboarding(true); }} />;
    }
    if (activeTab === "refer") {
      return <ReferPage onBack={() => handleTabChange("home")} />;
    }
    if (activeTab === "inbox") {
      return (
        <InboxPage
          isActive={activeTab === "inbox"}
          onSendMoney={(phone, onComplete) => {
            setSendMoneyPrefilledPhone(phone);
            setSendMoneyOnComplete(() => onComplete);
            setShowSendMoney(true);
          }}
        />
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
        <p className="text-lg font-semibold capitalize">{activeTab}</p>
        <p className="text-sm">Coming soon</p>
      </div>
    );
  };

  // Show splash first, then onboarding (once), then auth/home
  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (!onboardingDone || replayOnboarding) {
    return (
      <AnimatePresence>
        <OnboardingSlides onDone={() => {
          setOnboardingDone(true);
          setReplayOnboarding(false);
          markOnboardingDone();
        }} />
      </AnimatePresence>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!authenticated && (
          <AuthPage onAuthenticated={() => setAuthenticated(true)} />
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-background flex overflow-x-hidden w-full">
      {/* ── Sidebar (md+) ── */}
      <SideNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0 overflow-x-hidden">
        <main
          ref={mainRef}
          className="flex-1 w-full max-w-xl mx-auto px-4 py-4 pb-32 md:pb-12 md:px-8 md:py-8 md:max-w-2xl overflow-x-hidden"
        >
          {mainContent()}
        </main>
      </div>

      {/* ── Bottom Nav (mobile only) ── */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Flow overlays ── */}
      {showSendMoney && <SendMoneyFlow prefilledPhone={sendMoneyPrefilledPhone} onSuccess={(amt) => { sendMoneyOnComplete?.(amt); setSendMoneyOnComplete(undefined); }} onClose={() => { setShowSendMoney(false); setSendMoneyPrefilledPhone(undefined); setSendMoneyOnComplete(undefined); }} />}
      {showCashOut   && <CashOutFlow   onClose={() => setShowCashOut(false)} />}
      {showPayment   && <PaymentFlow   onClose={() => setShowPayment(false)} />}
      {showRecharge  && <MobileRechargeFlow onClose={() => setShowRecharge(false)} />}
      {showPayBill   && <PayBillFlow   onClose={() => setShowPayBill(false)} />}
      {showAddMoney  && <AddMoneyFlow  onClose={() => setShowAddMoney(false)} />}
      {showShop      && <ShopFlow      onClose={() => setShowShop(false)} />}

      {/* PWA install prompt */}
      <InstallPrompt />

      {/* Transaction toast overlay */}
      <TxnToast />
    </div>
    </>
  );
};

export default Index;
