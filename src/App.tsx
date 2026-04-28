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
import { retryLazyImport } from "@/lib/cacheReset";

const Index = lazy(() => retryLazyImport(() => import("./pages/Index")));
const AdminDashboard = lazy(() => retryLazyImport(() => import("./pages/AdminDashboard")));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const AgentCashIn = lazy(() => import("./pages/AgentCashIn"));
const AgentB2B = lazy(() => import("./pages/AgentB2B"));
const AgentRegister = lazy(() => import("./pages/AgentRegister"));
const AgentBillPay = lazy(() => import("./pages/AgentBillPay"));
const AgentTransactionHistory = lazy(() => import("./pages/AgentTransactionHistory"));
const AgentBankTransfer = lazy(() => import("./pages/AgentBankTransfer"));
const AgentAnalyticsPage = lazy(() => import("./pages/AgentAnalyticsPage"));
const DistributorDashboard = lazy(() => import("./pages/DistributorDashboard"));
const DistributorCreateAgent = lazy(() => import("./pages/DistributorCreateAgent"));
const SuperDistributorDashboard = lazy(() => import("./pages/SuperDistributorDashboard"));
const SuperDistributorCreateDistributor = lazy(() => import("./pages/SuperDistributorCreateDistributor"));
const MerchantDashboard = lazy(() => retryLazyImport(() => import("./pages/MerchantDashboard")));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const DynamicQrPage = lazy(() => import("./pages/DynamicQrPage"));
const PayPage = lazy(() => import("./pages/PayPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TeamLoginPage = lazy(() => import("./pages/TeamLoginPage"));
const MerchantLoginPage = lazy(() => retryLazyImport(() => import("./pages/MerchantLoginPage")));
const MerchantManagerLoginPage = lazy(() => retryLazyImport(() => import("./pages/MerchantManagerLoginPage")));
const RoleInstallPage = lazy(() => import("./pages/RoleInstallPage"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const ShopCheckoutPage = lazy(() => import("./pages/ShopCheckoutPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const VendorStorePage = lazy(() => import("./pages/VendorStorePage"));
const WishlistPage = lazy(() => import("./pages/WishlistPage"));
const CustomerOrdersPage = lazy(() => import("./pages/CustomerOrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const CareersPage = lazy(() => import("./pages/CareersPage"));
const CouponsPage = lazy(() => import("./pages/CouponsPage"));
const DonationsPage = lazy(() => import("./pages/DonationsPage"));
const LoanPage = lazy(() => import("./pages/LoanPage"));
const InsurancePage = lazy(() => retryLazyImport(() => import("./pages/InsurancePage")));
const GiftCardsPage = lazy(() => import("./pages/GiftCardsPage"));
const DeveloperPortal = lazy(() => import("./pages/DeveloperPortal"));
const AccountPage = lazy(() => import("./pages/AccountPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
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
            <BrowserRouter>
              <MerchantSessionWatchdog />
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
                    <Route path="donations" element={<DonationsPage />} />
                    <Route path="loan" element={<LoanPage />} />
                    <Route path="insurance" element={<InsurancePage />} />
                    <Route path="giftcards" element={<GiftCardsPage />} />
                    <Route path="account" element={<AccountPage />} />
                  </Route>

                  <Route path="/admin" element={<RoleGuard roles={["admin", "compliance", "finance", "support", "operations", "marketing", "hr", "audit", "risk", "developer", "manager"]}><AdminDashboard /></RoleGuard>} />

                  <Route path="/agent" element={<RoleGuardLayout roles={["agent", "admin"]} />}>
                    <Route index element={<AgentDashboard />} />
                    <Route path="cashin" element={<AgentCashIn />} />
                    <Route path="b2b" element={<AgentB2B />} />
                    <Route path="register" element={<AgentRegister />} />
                    <Route path="billpay" element={<AgentBillPay />} />
                    <Route path="history" element={<AgentTransactionHistory />} />
                    <Route path="bank" element={<AgentBankTransfer />} />
                    <Route path="analytics" element={<AgentAnalyticsPage />} />
                  </Route>

                  <Route path="/distributor" element={<RoleGuardLayout roles={["distributor", "admin"]} />}>
                    <Route index element={<DistributorDashboard />} />
                    <Route path="create-agent" element={<DistributorCreateAgent />} />
                  </Route>

                  <Route path="/super-distributor" element={<RoleGuardLayout roles={["super_distributor", "admin"]} />}>
                    <Route index element={<SuperDistributorDashboard />} />
                    <Route path="create-distributor" element={<SuperDistributorCreateDistributor />} />
                  </Route>

                  <Route path="/merchant" element={<RoleGuard roles={["merchant", "admin"]} allowStaff unauthenticatedRedirect="/merchant-login"><MerchantDashboard /></RoleGuard>} />

                  <Route path="/team-login" element={<TeamLoginPage />} />
                  <Route path="/merchant-login" element={<MerchantLoginPage />} />
                  <Route path="/merchant-manager-login" element={<MerchantManagerLoginPage />} />
                  <Route path="/install" element={<RoleInstallPage />} />
                  <Route path="/install/:role" element={<RoleInstallPage />} />
                  <Route path="/developers" element={<DeveloperPortal />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </FestivalThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
