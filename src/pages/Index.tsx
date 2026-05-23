import Seo from "@/components/Seo";
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, ShieldCheck, Clock, XCircle } from "lucide-react";
import { clearTxnNotifs } from "@/lib/txnNotifStore";
import { fetchBalance } from "@/lib/balanceStore";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";

import { useUserSessionTimeout } from "@/hooks/use-user-session-timeout";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import InstallPrompt from "@/components/InstallPrompt";
import { hasSeenOnboarding, markOnboardingDone } from "@/lib/onboardingUtils";
import TxnToast from "@/components/TxnToast";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { parseQrData } from "@/lib/qrParser";
import { BalanceCardSkeleton, QuickActionsSkeleton, TransactionListSkeleton } from "@/components/HomeSkeletons";
import { getCachedStatus, requestContacts, requestCamera } from "@/lib/permissions";
import { saveContacts } from "@/lib/contactStore";
import { retryLazyImport } from "@/lib/cacheReset";
import { useFutureFeatures } from "@/hooks/use-future-features";

// ── Critical above-fold: eagerly imported for instant render ──
import AppHeader from "@/components/AppHeader";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import TransactionList from "@/components/TransactionList";

// ── Below-fold / conditional home components ──
const PromoSlider = lazy(() => import("@/components/PromoSlider"));
const SideNav = lazy(() => import("@/components/SideNav"));
const PlatformBanner = lazy(() => import("@/components/PlatformBanner"));
const FestivalOverlay = lazy(() => import("@/components/FestivalOverlay"));
const SplashScreen = lazy(() => import("@/components/SplashScreen"));
const OnboardingSlides = lazy(() => import("@/components/OnboardingSlides"));

// ── Flow overlays: lazy (prefetched during idle) ──
const QrScannerModal = lazy(() => import("@/components/QrScannerModal"));
const SendMoneyFlow = lazy(() => import("@/components/SendMoneyFlow"));
const CashOutFlow = lazy(() => import("@/components/CashOutFlow"));
const PaymentFlow = lazy(() => import("@/components/PaymentFlow"));
const MobileRechargeFlow = lazy(() => import("@/components/MobileRechargeFlow"));
const PayBillFlow = lazy(() => import("@/components/PayBillFlow"));
const AddMoneyFlow = lazy(() => import("@/components/AddMoneyFlow"));
const BankTransferFlow = lazy(() => import("@/components/BankTransferFlow"));
const DynamicQrPaySheet = lazy(() => import("@/components/DynamicQrPaySheet"));

const MerchantApplicationFlow = lazy(() => import("@/components/MerchantApplicationFlow"));
const KycFlow = lazy(() => import("@/components/KycFlow"));

const AuthPage = lazy(() => retryLazyImport(() => import("@/pages/AuthPage")));
const InboxPage = lazy(() => import("@/pages/InboxPage"));

// ── Tab pages: lazy (prefetched during idle) ──
const TransactionHistory = lazy(() => import("@/pages/TransactionHistory"));
const AccountPage = lazy(() => import("@/pages/AccountPage"));
const ReferPage = lazy(() => import("@/pages/ReferPage"));

const Index = () => {
  const navigate = useNavigate();
  useUserSessionTimeout("user");
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, loading: authLoading, signOut, user } = useAuth();
  const futureFeatures = useFutureFeatures();
  void futureFeatures.visibility.future_ai_copilot;
  void futureFeatures.visibility.future_scam_shield;
  const { status: kycStatus, rejectionReason, loading: kycLoading } = useKycStatus();
  const [showKycFlow, setShowKycFlow] = useState(false);
  const [splashDone, setSplashDone]           = useState(() => localStorage.getItem("splashDone") === "1");
  const [onboardingDone, setOnboardingDone]  = useState(() => hasSeenOnboarding());
  const hasAuthenticated = localStorage.getItem("mfs_has_authenticated") === "1";
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  const [activeTab, setActiveTab]         = useState("home");

  // Read ?tab= param to set active tab on navigation
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["home", "history", "account", "refer", "inbox"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Handle ?flow= deep-link from Coupons page
  useEffect(() => {
    const flow = searchParams.get("flow");
    if (!flow) return;
    const flowMap: Record<string, () => void> = {
      send_money: () => setShowSendMoney(true),
      cash_out: () => setShowCashOut(true),
      payment: () => setShowPayment(true),
      recharge: () => setShowRecharge(true),
      bill_pay: () => setShowPayBill(true),
      add_money: () => setShowAddMoney(true),
    };
    if (flowMap[flow]) {
      flowMap[flow]();
      // Clean the param so it doesn't re-trigger
      searchParams.delete("flow");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
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
  const [paymentPrefilledMerchant, setPaymentPrefilledMerchant] = useState<string | undefined>(undefined);
  const [showRecharge, setShowRecharge]   = useState(false);
  const [showPayBill, setShowPayBill]     = useState(false);
  const [showAddMoney, setShowAddMoney]   = useState(false);
  
  
  const [showBankTransfer, setShowBankTransfer] = useState(false);
  
  const [showMerchantApply, setShowMerchantApply] = useState(false);
  const [showScanPay, setShowScanPay]     = useState(false);
  const [dynamicQrSession, setDynamicQrSession] = useState<{ sessionId: string; merchantId?: string; amount?: number; ref?: string | null } | null>(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [isPulling, setIsPulling]         = useState(false);
  const [refreshKey, setRefreshKey]       = useState(0);
  const mainRef = useRef<HTMLElement>(null);

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

  // Listen for "open-feature" events from notification center
  useEffect(() => {
    const handler = (e: Event) => {
      const feature = (e as CustomEvent).detail as string;
      const featureMap: Record<string, () => void> = {
        "send-money": () => setShowSendMoney(true),
        "cash-out": () => setShowCashOut(true),
        "add-money": () => setShowAddMoney(true),
        "mobile-recharge": () => setShowRecharge(true),
        "pay-bill": () => setShowPayBill(true),
        "payment": () => setShowPayment(true),
        "bank-transfer": () => setShowBankTransfer(true),
        "shop": () => navigate("/shop"),
        
        "merchant-apply": () => setShowMerchantApply(true),
        "scan-pay": () => setShowScanPay(true),
        "kyc": () => setShowKycFlow(true),
      };
      if (featureMap[feature]) {
        setActiveTab("home");
        featureMap[feature]();
      }
    };
    window.addEventListener("open-feature", handler);
    return () => window.removeEventListener("open-feature", handler);
  }, []);

  // ── Auto-request permissions after login (deferred to not block interactivity) ──
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const timeoutId = setTimeout(async () => {
      if (getCachedStatus("contacts") !== "granted") {
        try {
          const result = await requestContacts();
          if (result.status === "granted" && result.data) {
            const toStore = result.data.map((entry: any) => ({
              name: entry.name?.[0] || "Unknown",
              phone: (entry.tel?.[0] || "").replace(/[\s\-()]/g, ""),
            })).filter((c: any) => c.phone);
            saveContacts(toStore);
          }
        } catch {}
      }
      if (getCachedStatus("camera") !== "granted") {
        try {
          const camResult = await requestCamera();
          if (camResult.status === "granted" && camResult.data) {
            (camResult.data as MediaStream).getTracks().forEach((t) => t.stop());
          }
        } catch {}
      }
    }, 3000); // Defer 3s so UI is interactive first
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, user]);

  // ── Prefetch all lazy chunks during idle time so everything opens instantly ──
  useEffect(() => {
    if (!isAuthenticated) return;
    const prefetchFlows = () => {
      // Flows
      import("@/components/SendMoneyFlow");
      import("@/components/CashOutFlow");
      import("@/components/PaymentFlow");
      import("@/components/MobileRechargeFlow");
      import("@/components/PayBillFlow");
      import("@/components/AddMoneyFlow");
      import("@/components/BankTransferFlow");
      
      import("@/components/KycFlow");
      import("@/components/QrScannerModal");
      import("@/components/DynamicQrPaySheet");
      import("@/components/MerchantApplicationFlow");
      // Tabs
      import("@/pages/TransactionHistory");
      import("@/pages/AccountPage");
      import("@/pages/ReferPage");
      import("@/pages/InboxPage");
      // Below-fold home
      import("@/components/PromoSlider");
      import("@/components/SideNav");
      import("@/components/PlatformBanner");
    };
    if ("requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(prefetchFlows, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback(id);
    } else {
      const t = setTimeout(prefetchFlows, 1500);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated]);

  const triggerRefresh = useCallback(() => {
    if (isPulling) return;
    setIsPulling(true);
    fetchBalance();
    setRefreshKey((k) => k + 1);
    setTimeout(() => {
      setIsPulling(false);
    }, 600);
  }, [isPulling]);

  usePullToRefresh({ onRefresh: triggerRefresh, threshold: 70 });

  const mainContent = () => {
    const content = (() => {
    if (activeTab === "home") {
      return (
        <div className="space-y-5">
          <AppHeader onSignOut={signOut} />
          <PlatformBanner />
          <FestivalOverlay />

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

          <BalanceCard onAddMoney={() => setShowAddMoney(true)} />

              {/* KYC prompt banner */}
              {!kycLoading && kycStatus !== "verified" && (
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
                onShop={() => navigate("/shop")}
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
                  shop: () => navigate("/shop"),
                  banktransfer: () => setShowBankTransfer(true),
                  savings: () => setShowSavings(true),
                  refer: () => handleTabChange("refer"),
                  kyc: () => setShowKycFlow(true),
                  history: () => handleTabChange("history"),
                };
                map[feature]?.();
              }} />
              <TransactionList onSeeAll={() => handleTabChange("history")} refreshKey={refreshKey} />
        </div>
      );
    }
    if (activeTab === "history") {
      return <TransactionHistory onRefresh={triggerRefresh} filterTypes={["send", "receive", "payment", "recharge", "addmoney", "banktransfer"]} />;
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
    })();

    return content;
  };

  // If user previously authenticated, skip splash/onboarding while auth resolves
  if (hasAuthenticated) {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-background">
          <div className="w-full max-w-xl mx-auto px-4 py-4 space-y-5">
            <BalanceCardSkeleton />
            <QuickActionsSkeleton />
            <TransactionListSkeleton />
          </div>
        </div>
      );
    }
    // Session expired — clear flag so auth page shows
    if (!isAuthenticated) {
      localStorage.removeItem("mfs_has_authenticated");
      localStorage.removeItem("splashDone");
    }
  }

  // Resolve auth state first — before splash/onboarding
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="w-full max-w-xl mx-auto px-4 py-4 space-y-5">
          <BalanceCardSkeleton />
          <QuickActionsSkeleton />
          <TransactionListSkeleton />
        </div>
      </div>
    );
  }

  // Authenticated users skip splash & onboarding entirely
  if (!isAuthenticated) {
    if (!splashDone) {
      return <Suspense fallback={null}><SplashScreen onDone={() => { localStorage.setItem("splashDone", "1"); setSplashDone(true); }} /></Suspense>;
    }

    if (!onboardingDone) {
      return (
        <Suspense fallback={null}>
          <AnimatePresence>
            <OnboardingSlides onDone={() => {
              setOnboardingDone(true);
              setReplayOnboarding(false);
              markOnboardingDone();
            }} />
          </AnimatePresence>
        </Suspense>
      );
    }
  }

  // Allow replay onboarding for authenticated users (from account settings)
  if (replayOnboarding) {
    return (
      <Suspense fallback={null}>
        <AnimatePresence>
          <OnboardingSlides onDone={() => {
            setOnboardingDone(true);
            setReplayOnboarding(false);
            markOnboardingDone();
          }} />
        </AnimatePresence>
      </Suspense>
    );
  }

  return (
    <>
      <Seo
        title="EasyPay – Mobile Financial Services Bangladesh"
        description="Send money, pay bills, cash out, shop and manage your finances securely with EasyPay – Bangladesh's all-in-one digital wallet."
        path="/"
      />
      <AnimatePresence>
        {!isAuthenticated && (
          <Suspense fallback={null}>
            <AuthPage onAuthenticated={() => {
              localStorage.setItem("mfs_has_authenticated", "1");
            }} />
          </Suspense>
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
          <Suspense fallback={<div className="space-y-5"><BalanceCardSkeleton /><QuickActionsSkeleton /><TransactionListSkeleton /></div>}>
            {mainContent()}
          </Suspense>
        </main>
      </div>

      {/* ── Bottom Nav (mobile only) ── */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── Flow overlays ── */}
      <Suspense fallback={null}>
        <AnimatePresence mode="wait" initial={false}>
          {showSendMoney && <SendMoneyFlow key="send-money-flow" prefilledPhone={sendMoneyPrefilledPhone} onSuccess={(amt) => { sendMoneyOnComplete?.(amt); setSendMoneyOnComplete(undefined); }} onClose={() => { setShowSendMoney(false); setSendMoneyPrefilledPhone(undefined); setSendMoneyOnComplete(undefined); }} />}
          {showCashOut   && <CashOutFlow key="cash-out-flow" onClose={() => setShowCashOut(false)} />}
          {showPayment   && <PaymentFlow key="payment-flow" prefilledMerchantId={paymentPrefilledMerchant} onClose={() => { setShowPayment(false); setPaymentPrefilledMerchant(undefined); }} onDynamicQr={(session) => { setShowPayment(false); setPaymentPrefilledMerchant(undefined); setDynamicQrSession(session); }} />}
          {showRecharge  && <MobileRechargeFlow key="recharge-flow" onClose={() => setShowRecharge(false)} />}
          {showPayBill   && <PayBillFlow key="paybill-flow" onClose={() => setShowPayBill(false)} />}
          {showAddMoney  && <AddMoneyFlow key="addmoney-flow" onClose={() => setShowAddMoney(false)} />}
          
          {showBankTransfer && <BankTransferFlow key="bank-transfer-flow" onClose={() => setShowBankTransfer(false)} />}
          {showSavings   && <SavingsFlow key="savings-flow" onClose={() => setShowSavings(false)} />}
          {showKycFlow   && <KycFlow key="kyc-flow" onClose={() => setShowKycFlow(false)} />}
        </AnimatePresence>
        <MerchantApplicationFlow open={showMerchantApply} onOpenChange={setShowMerchantApply} />

        {/* Scan & Pay QR flow */}
        <QrScannerModal
          open={showScanPay}
          onClose={() => setShowScanPay(false)}
          title="Scan & Pay"
          onScan={async (result) => {
            setShowScanPay(false);
            const parsed = parseQrData(result);

            if (parsed.flow === "dynamic_payment" && parsed.sessionId) {
              setDynamicQrSession({
                sessionId: parsed.sessionId,
                merchantId: parsed.identifier,
                amount: parsed.amount,
                ref: parsed.ref,
              });
            } else if (parsed.flow === "payment") {
              setPaymentPrefilledMerchant(parsed.identifier);
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
                    setPaymentPrefilledMerchant(parsed.identifier);
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

        {/* Dynamic QR Payment Sheet */}
        {dynamicQrSession && (
          <DynamicQrPaySheet
            open={!!dynamicQrSession}
            onClose={() => setDynamicQrSession(null)}
            sessionId={dynamicQrSession.sessionId}
            merchantId={dynamicQrSession.merchantId}
            amount={dynamicQrSession.amount}
            ref_={dynamicQrSession.ref}
          />
        )}
      </Suspense>

      {/* PWA install prompt */}
      <InstallPrompt isAuthenticated={isAuthenticated} />

      {/* Transaction toast overlay */}
      <TxnToast />
    </div>
    </>
  );
};

export default Index;
