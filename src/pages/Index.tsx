import { useState, useEffect, useRef, useCallback } from "react";
import QrScannerModal from "@/components/QrScannerModal";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ShieldCheck, Clock, XCircle } from "lucide-react";
import { clearTxnNotifs } from "@/lib/txnNotifStore";
import { fetchBalance } from "@/lib/balanceStore";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import PromoSlider from "@/components/PromoSlider";
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
import BankTransferFlow from "@/components/BankTransferFlow";

import SavingsFlow from "@/components/SavingsFlow";
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
import KycFlow from "@/components/KycFlow";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { parseQrData } from "@/lib/qrParser";

const Index = () => {
  const { isAuthenticated, loading: authLoading, signOut, user } = useAuth();
  const { status: kycStatus, rejectionReason } = useKycStatus();
  const [showKycFlow, setShowKycFlow] = useState(false);
  const [splashDone, setSplashDone]           = useState(false);
  const [onboardingDone, setOnboardingDone]  = useState(() => hasSeenOnboarding());
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  const [activeTab, setActiveTab]         = useState("home");
  const handleTabChange = useCallback((tab: string) => {
    if (tab === "scan") {
      setShowScanPay(true);
      return;
    }
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
  
  const [showBankTransfer, setShowBankTransfer] = useState(false);
  const [showSavings, setShowSavings]     = useState(false);
  const [showScanPay, setShowScanPay]     = useState(false);
  const [isLoading, setIsLoading]         = useState(true);
  const [isPulling, setIsPulling]         = useState(false);
  const [refreshKey, setRefreshKey]       = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 1800);
    return () => clearTimeout(t);
  }, []);

  // ── AsthaPay return redirect handler ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isAsthapay = params.get("asthapay");
    const sessionId = params.get("sessionId");
    const status = params.get("status");

    if (!isAsthapay || !sessionId) return;

    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);

    if (status === "cancel") {
      toast.error("Payment was cancelled.");
      return;
    }

    // Verify with edge function
    const verifyPayment = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const token = authSession?.access_token;
        if (!token) return;

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const transactionId = params.get("transactionId") || params.get("transaction_id");

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/asthapay-payment?action=verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ sessionId, transaction_id: transactionId }),
          }
        );

        const data = await res.json();
        if (data.success) {
          toast.success("Money added successfully via AsthaPay!");
          fetchBalance();
          setRefreshKey((k) => k + 1);
        } else {
          toast.error(data.error || "Payment verification failed.");
        }
      } catch (err) {
        console.error("AsthaPay verify error:", err);
        toast.error("Could not verify payment. Please contact support.");
      }
    };

    verifyPayment();
    // Also clean up localStorage
    localStorage.removeItem("pending_payment_session");
  }, []);

  // Realtime account lock listener — sign out if account gets locked
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    const channel = supabase
      .channel("account-lock-" + user.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "feature_locks",
        filter: `target_user_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new?.feature === "account" && payload.new?.is_active) {
          toast.error("Your account has been locked by an administrator. Contact support.");
          setTimeout(() => signOut(), 1500);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isAuthenticated, signOut]);

  const triggerRefresh = useCallback(() => {
    if (isLoading) return;
    setIsPulling(true);
    setIsLoading(true);
    fetchBalance();
    setRefreshKey((k) => k + 1);
    setTimeout(() => {
      setIsLoading(false);
      setIsPulling(false);
    }, 1200);
  }, [isLoading]);

  usePullToRefresh({ onRefresh: triggerRefresh, threshold: 70 });

  const mainContent = () => {
    if (activeTab === "home") {
      return (
        <div className="space-y-5">
          <AppHeader onSignOut={signOut} />

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

              {/* KYC prompt banner */}
              {kycStatus !== "verified" && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setShowKycFlow(true)}
                  className="w-full flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-left transition-colors hover:bg-primary/10"
                >
                  {kycStatus === "pending" ? (
                    <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                  ) : kycStatus === "rejected" ? (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {kycStatus === "pending"
                        ? "KYC Under Review"
                        : kycStatus === "rejected"
                        ? "KYC Rejected — Resubmit"
                        : "Complete KYC to unlock all features"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {kycStatus === "pending"
                        ? "Your verification is being reviewed"
                        : kycStatus === "rejected"
                        ? (rejectionReason || "Please resubmit your verification documents")
                        : "Verify your identity to send money, cash out & more"}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-primary shrink-0">
                    {kycStatus === "pending" ? "View" : kycStatus === "rejected" ? "Retry" : "Start →"}
                  </span>
                </motion.button>
              )}

              <QuickActions
                onSendMoney={() => setShowSendMoney(true)}
                onCashOut={() => setShowCashOut(true)}
                onPayment={() => setShowPayment(true)}
                onRecharge={() => setShowRecharge(true)}
                onPayBill={() => setShowPayBill(true)}
                onAddMoney={() => setShowAddMoney(true)}
                onRefer={() => handleTabChange("refer")}
                onShop={() => setShowShop(true)}
                onBankTransfer={() => setShowBankTransfer(true)}
                onSavings={() => setShowSavings(true)}
              />
              
              <PromoSlider onFeatureOpen={(feature) => {
                const map: Record<string, () => void> = {
                  sendmoney: () => setShowSendMoney(true),
                  cashout: () => setShowCashOut(true),
                  payment: () => setShowPayment(true),
                  recharge: () => setShowRecharge(true),
                  paybill: () => setShowPayBill(true),
                  addmoney: () => setShowAddMoney(true),
                  shop: () => setShowShop(true),
                  banktransfer: () => setShowBankTransfer(true),
                  savings: () => setShowSavings(true),
                  refer: () => handleTabChange("refer"),
                  kyc: () => setShowKycFlow(true),
                  history: () => handleTabChange("history"),
                };
                map[feature]?.();
              }} />
              <TransactionList onSeeAll={() => handleTabChange("history")} refreshKey={refreshKey} />
            </>
          )}
        </div>
      );
    }
    if (activeTab === "history") {
      return <TransactionHistory onRefresh={triggerRefresh} />;
    }
    if (activeTab === "account") {
      return <AccountPage onSignOut={signOut} onReplayOnboarding={() => { setOnboardingDone(false); setReplayOnboarding(true); }} />;
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

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!isAuthenticated && (
          <AuthPage onAuthenticated={() => {
            // Auth state is now managed by useAuth hook via Supabase session
            // onAuthenticated is called after successful sign-up/sign-in
            // The useAuth hook will automatically pick up the session change
          }} />
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
      {showBankTransfer && <BankTransferFlow onClose={() => setShowBankTransfer(false)} />}
      {showSavings   && <SavingsFlow   onClose={() => setShowSavings(false)} />}
      {showKycFlow   && <KycFlow      onClose={() => setShowKycFlow(false)} />}


      {/* Scan & Pay QR flow */}
      <QrScannerModal
        open={showScanPay}
        onClose={() => setShowScanPay(false)}
        title="Scan & Pay"
        onScan={async (result) => {
          setShowScanPay(false);
          const parsed = parseQrData(result);

          if (parsed.flow === "payment") {
            setShowPayment(true);
          } else if (parsed.flow === "send") {
            setSendMoneyPrefilledPhone(parsed.identifier);
            setShowSendMoney(true);
          } else {
            // Unknown — try RPC fallback
            try {
              const { data } = await supabase.rpc("resolve_transfer_recipient", {
                p_identifier: parsed.identifier,
                p_flow: "send",
              });
              const res = data as any;
              if (res?.found) {
                setSendMoneyPrefilledPhone(res.canonical_phone || parsed.identifier);
                setShowSendMoney(true);
              } else {
                // Try payment flow
                const { data: payData } = await supabase.rpc("resolve_transfer_recipient", {
                  p_identifier: parsed.identifier,
                  p_flow: "payment",
                });
                const payRes = payData as any;
                if (payRes?.found) {
                  setShowPayment(true);
                } else {
                  toast.error("Unrecognized QR code. Please try a valid EasyPay QR.");
                }
              }
            } catch {
              toast.error("Could not process QR code. Please try again.");
            }
          }
        }}
      />

      {/* PWA install prompt */}
      <InstallPrompt />

      {/* Transaction toast overlay */}
      <TxnToast />
    </div>
    </>
  );
};

export default Index;
