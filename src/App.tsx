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
import Index from "./pages/Index";
import AdminDashboard from "./pages/AdminDashboard";
import AgentDashboard from "./pages/AgentDashboard";
import AgentCashIn from "./pages/AgentCashIn";
import AgentB2B from "./pages/AgentB2B";
import AgentRegister from "./pages/AgentRegister";
import AgentBillPay from "./pages/AgentBillPay";
import AgentTransactionHistory from "./pages/AgentTransactionHistory";
import AgentBankTransfer from "./pages/AgentBankTransfer";
import AgentAnalyticsPage from "./pages/AgentAnalyticsPage";
import DistributorDashboard from "./pages/DistributorDashboard";
import DistributorCreateAgent from "./pages/DistributorCreateAgent";
import SuperDistributorDashboard from "./pages/SuperDistributorDashboard";
import SuperDistributorCreateDistributor from "./pages/SuperDistributorCreateDistributor";
import MerchantDashboard from "./pages/MerchantDashboard";
import CheckoutPage from "./pages/CheckoutPage";
import DynamicQrPage from "./pages/DynamicQrPage";
import PayPage from "./pages/PayPage";
import NotFound from "./pages/NotFound";
import TeamLoginPage from "./pages/TeamLoginPage";
import RoleInstallPage from "./pages/RoleInstallPage";
import ShopPage from "./pages/ShopPage";
import ShopCheckoutPage from "./pages/ShopCheckoutPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import VendorStorePage from "./pages/VendorStorePage";
import WishlistPage from "./pages/WishlistPage";
import CustomerOrdersPage from "./pages/CustomerOrdersPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import CareersPage from "./pages/CareersPage";
import CouponsPage from "./pages/CouponsPage";
import DonationsPage from "./pages/DonationsPage";
import LoanPage from "./pages/LoanPage";
import InsurancePage from "./pages/InsurancePage";
import GiftCardsPage from "./pages/GiftCardsPage";
import DeveloperPortal from "./pages/DeveloperPortal";

const queryClient = new QueryClient();

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
            </BrowserRouter>
          </FestivalThemeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
