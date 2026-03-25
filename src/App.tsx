import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";
import { FestivalThemeProvider } from "@/contexts/FestivalThemeContext";
import FestivalBodyEffect from "@/components/FestivalBodyEffect";
import RoleGuard from "@/components/RoleGuard";

// Lazy load the home page (was eager — now split for smaller initial bundle)
const Index = lazy(() => import("./pages/Index"));

// Lazy load all other routes
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
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
const MerchantDashboard = lazy(() => import("./pages/MerchantDashboard"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const DynamicQrPage = lazy(() => import("./pages/DynamicQrPage"));
const PayPage = lazy(() => import("./pages/PayPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TeamLoginPage = lazy(() => import("./pages/TeamLoginPage"));
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
const InsurancePage = lazy(() => import("./pages/InsurancePage"));
const GiftCardsPage = lazy(() => import("./pages/GiftCardsPage"));
const DeveloperPortal = lazy(() => import("./pages/DeveloperPortal"));

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
              <Suspense fallback={<LazyFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/admin" element={<RoleGuard roles={["admin", "compliance", "finance", "support", "operations", "marketing", "hr", "audit", "risk", "developer", "manager"]}><AdminDashboard /></RoleGuard>} />
                  <Route path="/agent" element={<RoleGuard roles={["agent", "admin"]}><AgentDashboard /></RoleGuard>} />
                  <Route path="/agent/cashin" element={<RoleGuard roles={["agent", "admin"]}><AgentCashIn /></RoleGuard>} />
                  <Route path="/agent/b2b" element={<RoleGuard roles={["agent", "admin"]}><AgentB2B /></RoleGuard>} />
                  <Route path="/agent/register" element={<RoleGuard roles={["agent", "admin"]}><AgentRegister /></RoleGuard>} />
                  <Route path="/agent/billpay" element={<RoleGuard roles={["agent", "admin"]}><AgentBillPay /></RoleGuard>} />
                  <Route path="/agent/history" element={<RoleGuard roles={["agent", "admin"]}><AgentTransactionHistory /></RoleGuard>} />
                  <Route path="/agent/bank" element={<RoleGuard roles={["agent", "admin"]}><AgentBankTransfer /></RoleGuard>} />
                  <Route path="/agent/analytics" element={<RoleGuard roles={["agent", "admin"]}><AgentAnalyticsPage /></RoleGuard>} />
                  <Route path="/distributor" element={<RoleGuard roles={["distributor", "admin"]}><DistributorDashboard /></RoleGuard>} />
                  <Route path="/distributor/create-agent" element={<RoleGuard roles={["distributor", "admin"]}><DistributorCreateAgent /></RoleGuard>} />
                  <Route path="/super-distributor" element={<RoleGuard roles={["super_distributor", "admin"]}><SuperDistributorDashboard /></RoleGuard>} />
                  <Route path="/super-distributor/create-distributor" element={<RoleGuard roles={["super_distributor", "admin"]}><SuperDistributorCreateDistributor /></RoleGuard>} />
                  <Route path="/merchant" element={<RoleGuard roles={["merchant", "admin"]} allowStaff><MerchantDashboard /></RoleGuard>} />
                  <Route path="/checkout/:sessionId" element={<CheckoutPage />} />
                  <Route path="/pay/qr/:sessionId" element={<DynamicQrPage />} />
                  <Route path="/pay" element={<PayPage />} />
                  <Route path="/team-login" element={<TeamLoginPage />} />
                  <Route path="/install" element={<RoleInstallPage />} />
                  <Route path="/install/:role" element={<RoleInstallPage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/shop/checkout" element={<ShopCheckoutPage />} />
                  <Route path="/shop/:slug" element={<VendorStorePage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/orders" element={<CustomerOrdersPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/careers" element={<CareersPage />} />
                  <Route path="/coupons" element={<CouponsPage />} />
                  <Route path="/donations" element={<DonationsPage />} />
                  <Route path="/loan" element={<LoanPage />} />
                  <Route path="/insurance" element={<InsurancePage />} />
                  <Route path="/giftcards" element={<GiftCardsPage />} />
                  <Route path="/developers" element={<DeveloperPortal />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
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
