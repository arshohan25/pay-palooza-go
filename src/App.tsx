import { lazy, Suspense, forwardRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";
import { FestivalThemeProvider } from "@/contexts/FestivalThemeContext";
import FestivalBodyEffect from "@/components/FestivalBodyEffect";
import AppLayout from "@/components/AppLayout";
import RoleGuardLayout from "@/components/RoleGuardLayout";
import RoleGuard from "@/components/RoleGuard";
import MerchantSessionWatchdog from "@/components/MerchantSessionWatchdog";
import AppRoleEnforcer from "@/components/AppRoleEnforcer";
import ElevatedRoleBlockOverlay from "@/components/ElevatedRoleBlockOverlay";

import LazyLoadErrorBoundary from "@/components/LazyLoadErrorBoundary";


import MissingTranslationsBanner from "@/components/MissingTranslationsBanner";
import IncidentBanner from "@/components/IncidentBanner";
import { retryLazyImport } from "@/lib/cacheReset";

const Index = lazy(() => retryLazyImport(() => import("./pages/Index")));
const AdminDashboard = lazy(() => retryLazyImport(() => import("./pages/AdminDashboard")));
const AdminUserProfilePage = lazy(() => import("./pages/AdminUserProfilePage"));
const AdminBlockedPhonesPage = lazy(() => import("./pages/AdminBlockedPhonesPage"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const AgentCashIn = lazy(() => import("./pages/AgentCashIn"));
const AgentCashOut = lazy(() => import("./pages/AgentCashOut"));
const AgentB2B = lazy(() => import("./pages/AgentB2B"));
const AgentRegister = lazy(() => import("./pages/AgentRegister"));
const AgentBillPay = lazy(() => import("./pages/AgentBillPay"));
const AgentTransactionHistory = lazy(() => import("./pages/AgentTransactionHistory"));
const AgentBankTransfer = lazy(() => import("./pages/AgentBankTransfer"));
const AgentAnalyticsPage = lazy(() => import("./pages/AgentAnalyticsPage"));
const AgentStatement = lazy(() => import("./pages/AgentStatement"));
const AgentSecurity = lazy(() => import("./pages/AgentSecurity"));
const AgentDisputes = lazy(() => import("./pages/AgentDisputes"));
const AgentLeaderboard = lazy(() => import("./pages/AgentLeaderboard"));
const NearbyAgentsPage = lazy(() => import("./pages/NearbyAgentsPage"));
const DistributorDashboard = lazy(() => import("./pages/DistributorDashboard"));
const DistributorCreateAgent = lazy(() => import("./pages/DistributorCreateAgent"));
const SuperDistributorDashboard = lazy(() => import("./pages/SuperDistributorDashboard"));
const SuperDistributorCreateDistributor = lazy(() => import("./pages/SuperDistributorCreateDistributor"));
const MerchantDashboard = lazy(() => retryLazyImport(() => import("./pages/MerchantDashboard")));
const MerchantApplyVendor = lazy(() => retryLazyImport(() => import("./pages/MerchantApplyVendor")));
const MerchantApplyPage = lazy(() => retryLazyImport(() => import("./pages/MerchantApplyPage")));

const AdminMerchantCategoriesPage = lazy(() => retryLazyImport(() => import("./pages/AdminMerchantCategoriesPage")));
const AdminSeedHealthPage = lazy(() => retryLazyImport(() => import("./pages/AdminSeedHealthPage")));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const DynamicQrPage = lazy(() => import("./pages/DynamicQrPage"));
const PayPage = lazy(() => import("./pages/PayPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TeamLoginPage = lazy(() => import("./pages/TeamLoginPage"));
const MerchantLoginPage = lazy(() => retryLazyImport(() => import("./pages/MerchantLoginPage")));
const MerchantManagerLoginPage = lazy(() => retryLazyImport(() => import("./pages/MerchantManagerLoginPage")));
const MerchantSupportPage = lazy(() => retryLazyImport(() => import("./pages/MerchantSupportPage")));
const RoleInstallPage = lazy(() => import("./pages/RoleInstallPage"));
const InstallLandingPage = lazy(() => import("./pages/InstallLandingPage"));
const InstallStatusPage = lazy(() => import("./pages/InstallStatusPage"));
const InstallAllRolesWizard = lazy(() => import("./pages/InstallAllRolesWizard"));
const RoleLoginPage = lazy(() => import("./pages/RoleLoginPage"));

const ShopPage = lazy(() => import("./pages/ShopPage"));
const ShopCheckoutPage = lazy(() => import("./pages/ShopCheckoutPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const VendorStorePage = lazy(() => import("./pages/VendorStorePage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const CustomerOrdersPage = lazy(() => import("./pages/CustomerOrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const CouponsPage = lazy(() => import("./pages/CouponsPage"));
const CouponDetailPage = lazy(() => import("./pages/CouponDetailPage"));
const DonationsPage = lazy(() => import("./pages/DonationsPage"));
const LoanPage = lazy(() => import("./pages/LoanPage"));
const InsurancePage = lazy(() => retryLazyImport(() => import("./pages/InsurancePage")));
const GiftCardsPage = lazy(() => import("./pages/GiftCardsPage"));
const DeveloperPortal = lazy(() => import("./pages/DeveloperPortal"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const LoyaltyProgressPage = lazy(() => import("./pages/LoyaltyProgressPage"));
const SavingsPage = lazy(() => import("./pages/SavingsPage"));
const InstallmentJourneyPage = lazy(() => import("./pages/InstallmentJourneyPage"));
const RecipientHarness = lazy(() => import("./pages/RecipientHarness"));
const CashOutHarness = lazy(() => import("./pages/CashOutHarness"));
const WalletSetupHarness = lazy(() => import("./pages/WalletSetupHarness"));
const AgentKycHarness = lazy(() => import("./pages/AgentKycHarness"));
const KycOcrRescanHarness = lazy(() => import("./pages/KycOcrRescanHarness"));
const QrScanRouterHarness = lazy(() => import("./pages/QrScanRouterHarness"));
const CashOutQrErrorHarness = lazy(() => import("./pages/CashOutQrErrorHarness"));
const BankPickerHarness = lazy(() => import("./pages/BankPickerHarness"));
const AgentBankTransferHarness = lazy(() => import("./pages/AgentBankTransferHarness"));
const PaymentRequestsPage = lazy(() => import("./pages/PaymentRequestsPage"));
const PayLinkPage = lazy(() => import("./pages/PayLinkPage"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const AdminMcpActivityLog = lazy(() => import("./pages/AdminMcpActivityLog"));
const PaymentPopupPage = lazy(() => import("./pages/PaymentPopupPage"));
const PaymentReturnPage = lazy(() => import("./pages/PaymentReturnPage"));
const AddMoneyStatusPage = lazy(() => import("./pages/AddMoneyStatusPage"));
const ForgotPinPage = lazy(() => import("./pages/ForgotPinPage"));
const AdminAuthDiagnosticsPage = lazy(() => import("./pages/AdminAuthDiagnosticsPage"));
const MultiCurrencyPage = lazy(() => import("./pages/MultiCurrencyPage"));
const MySubscriptionsPage = lazy(() => import("./pages/MySubscriptionsPage"));
const SubscribePlanPage = lazy(() => import("./pages/SubscribePlanPage"));
const MerchantPlansPage = lazy(() => retryLazyImport(() => import("./pages/MerchantPlansPage")));
const AdminFxRatesPage = lazy(() => retryLazyImport(() => import("./pages/AdminFxRatesPage")));



const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 1,
    },
  },
});


const LazyFallback = forwardRef<HTMLDivElement>((_, ref) => (
  <div ref={ref} className="fixed inset-0 z-50 flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
));

LazyFallback.displayName = "LazyFallback";

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="mfs-theme">
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <FestivalThemeProvider>
            <FestivalBodyEffect />
            <Toaster />
            <Sonner />
            <MissingTranslationsBanner />
            <IncidentBanner />
            <BrowserRouter>
              <MerchantSessionWatchdog />
              <AppRoleEnforcer />
              <ElevatedRoleBlockOverlay />


              <LazyLoadErrorBoundary>
                <Suspense fallback={<LazyFallback />}>
                  <Routes>
                    <Route path="/" element={<AppLayout />}>
                      <Route index element={<Index />} />
                      <Route path="shop" element={<ShopPage />} />
                      <Route path="shop/checkout" element={<ShopCheckoutPage />} />
                      <Route path="shop/:slug" element={<VendorStorePage />} />
                      <Route path="product/:id" element={<ProductDetailPage />} />
                      <Route path="wishlist" element={<WishlistPage />} />
                      <Route path="orders" element={<CustomerOrdersPage />} />
                      <Route path="orders/:id" element={<OrderDetailPage />} />
                      <Route path="checkout/:sessionId" element={<CheckoutPage />} />
                      <Route path="pay/qr/:sessionId" element={<DynamicQrPage />} />
                      <Route path="pay" element={<PayPage />} />
                      <Route path="careers" element={<CareersPage />} />
                      <Route path="coupons" element={<CouponsPage />} />
                      <Route path="coupons/:id" element={<CouponDetailPage />} />
                      <Route path="donations" element={<DonationsPage />} />
                      <Route path="loan" element={<LoanPage />} />
                      <Route path="insurance" element={<InsurancePage />} />
                      <Route path="giftcards" element={<GiftCardsPage />} />
                      <Route path="account" element={<AccountPage />} />
                      <Route path="loyalty" element={<LoyaltyProgressPage />} />
                      <Route path="savings" element={<SavingsPage />} />
                      <Route path="savings/journey" element={<InstallmentJourneyPage />} />
                      <Route path="payment-requests" element={<PaymentRequestsPage />} />
                      <Route path="currencies" element={<MultiCurrencyPage />} />
                      <Route path="subscriptions" element={<MySubscriptionsPage />} />
                    </Route>

                    <Route path="/r/:shortCode" element={<PayLinkPage />} />
                    <Route path="/payment-popup" element={<PaymentPopupPage />} />
                    <Route path="/payment-return" element={<PaymentReturnPage />} />
                    <Route path="/addmoney/status" element={<AddMoneyStatusPage />} />
                    <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                    <Route path="/forgot-pin" element={<ForgotPinPage />} />
                    <Route path="/register/agent" element={<AgentRegister />} />
                    <Route path="/subscribe/:planId" element={<SubscribePlanPage />} />

                    <Route path="/customer" element={<AppLayout />}>
                      <Route index element={<Index />} />
                    </Route>

                    <Route path="/:role/install" element={<RoleInstallPage />} />
                    <Route path="/:role/login" element={<RoleLoginPage />} />

                    <Route path="/admin" element={<RoleGuard roles={["admin", "compliance", "finance", "support", "operations", "marketing", "hr", "audit", "risk", "developer", "manager"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminDashboard /></RoleGuard>} />
                    <Route path="/admin/users/:uid" element={<RoleGuard roles={["admin", "compliance"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminUserProfilePage /></RoleGuard>} />
                    <Route path="/admin/blocked-phones" element={<RoleGuard roles={["admin", "compliance"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminBlockedPhonesPage /></RoleGuard>} />
                    <Route path="/admin/mcp-activity" element={<RoleGuard roles={["admin", "developer", "audit"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminMcpActivityLog /></RoleGuard>} />
                    <Route path="/admin/auth-diagnostics" element={<RoleGuard roles={["admin", "developer"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminAuthDiagnosticsPage /></RoleGuard>} />
                    <Route path="/admin/fx-rates" element={<RoleGuard roles={["admin", "finance"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminFxRatesPage /></RoleGuard>} />


                    <Route path="/agent" element={<RoleGuardLayout themeClass="agent-theme" roles={["agent", "admin"]} unauthenticatedRedirect="/agent/login" unauthorizedRedirect="/agent/login" />}>
                      <Route index element={<AgentDashboard />} />
                      <Route path="cashin" element={<AgentCashIn />} />
                      <Route path="cashout" element={<AgentCashOut />} />
                      <Route path="b2b" element={<AgentB2B />} />
                      <Route path="register" element={<AgentRegister />} />
                      <Route path="billpay" element={<AgentBillPay />} />
                      <Route path="history" element={<AgentTransactionHistory />} />
                      <Route path="bank" element={<AgentBankTransfer />} />
                      <Route path="analytics" element={<AgentAnalyticsPage />} />
                      <Route path="statement" element={<AgentStatement />} />
                      <Route path="security" element={<AgentSecurity />} />
                      <Route path="disputes" element={<AgentDisputes />} />
                      <Route path="leaderboard" element={<AgentLeaderboard />} />
                    </Route>

                    <Route path="/agents/nearby" element={<NearbyAgentsPage />} />
                    <Route path="/distributor" element={<RoleGuardLayout roles={["distributor", "admin"]} unauthenticatedRedirect="/distributor/login" unauthorizedRedirect="/distributor/login" />}>
                      <Route index element={<DistributorDashboard />} />
                      <Route path="create-agent" element={<DistributorCreateAgent />} />
                    </Route>

                    <Route path="/super-distributor" element={<RoleGuardLayout roles={["super_distributor", "admin"]} unauthenticatedRedirect="/super-distributor/login" unauthorizedRedirect="/super-distributor/login" />}>
                      <Route index element={<SuperDistributorDashboard />} />
                      <Route path="create-distributor" element={<SuperDistributorCreateDistributor />} />
                    </Route>

                    <Route path="/merchant" element={<RoleGuard roles={["merchant", "admin"]} allowStaff unauthenticatedRedirect="/merchant/login" unauthorizedRedirect="/merchant/login"><MerchantDashboard /></RoleGuard>} />
                    <Route path="/merchant/apply-vendor" element={<RoleGuard roles={["merchant", "admin"]} unauthenticatedRedirect="/merchant/login" unauthorizedRedirect="/merchant/login"><MerchantApplyVendor /></RoleGuard>} />
                    <Route path="/merchant/plans" element={<RoleGuard roles={["merchant", "admin"]} allowStaff unauthenticatedRedirect="/merchant/login" unauthorizedRedirect="/merchant/login"><MerchantPlansPage /></RoleGuard>} />
                    <Route path="/merchant/apply" element={<MerchantApplyPage />} />
                    <Route path="/admin/merchant-categories" element={<RoleGuard roles={["admin"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminMerchantCategoriesPage /></RoleGuard>} />
                    <Route path="/admin/seed-health" element={<RoleGuard roles={["admin"]} unauthenticatedRedirect="/admin/login" unauthorizedRedirect="/admin/login"><AdminSeedHealthPage /></RoleGuard>} />






                    <Route path="/login/:role" element={<RoleLoginPage />} />


                    <Route path="/team-login" element={<TeamLoginPage />} />
                    <Route path="/merchant-login" element={<MerchantLoginPage />} />
                    <Route path="/merchant-manager-login" element={<MerchantManagerLoginPage />} />
                    <Route path="/merchant-support" element={<MerchantSupportPage />} />
                    <Route path="/install" element={<InstallLandingPage />} />
                    <Route path="/install/status" element={<InstallStatusPage />} />
                    <Route path="/install/all" element={<InstallAllRolesWizard />} />
                    <Route path="/install/:role" element={<RoleInstallPage />} />
                    <Route path="/developers" element={<DeveloperPortal />} />
                    {import.meta.env.DEV && (
                      <>
                        <Route
                          path="/__test/recipient-harness"
                          element={<RecipientHarness />}
                        />
                        <Route
                          path="/__test/cashout-harness"
                          element={<CashOutHarness />}
                        />
                        <Route
                          path="/__test/wallet-setup-harness"
                          element={<WalletSetupHarness />}
                        />
                        <Route
                          path="/__test/agent-kyc-harness"
                          element={<AgentKycHarness />}
                        />
                        <Route
                          path="/__test/kyc-ocr-rescan-harness"
                          element={<KycOcrRescanHarness />}
                        />
                        <Route
                          path="/__test/qr-scan-router-harness"
                          element={<QrScanRouterHarness />}
                        />
                        <Route
                          path="/__test/cashout-qr-error-harness"
                          element={<CashOutQrErrorHarness />}
                        />
                        <Route
                          path="/__test/bank-picker-harness"
                          element={<BankPickerHarness />}
                        />
                        <Route
                          path="/__test/agent-bank-transfer-harness"
                          element={<AgentBankTransferHarness />}
                        />
                      </>
                    )}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </LazyLoadErrorBoundary>
            </BrowserRouter>
          </FestivalThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
