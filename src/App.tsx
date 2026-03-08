import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";
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
import DistributorDashboard from "./pages/DistributorDashboard";
import DistributorCreateAgent from "./pages/DistributorCreateAgent";
import SuperDistributorDashboard from "./pages/SuperDistributorDashboard";
import SuperDistributorCreateDistributor from "./pages/SuperDistributorCreateDistributor";
import MerchantDashboard from "./pages/MerchantDashboard";
import CheckoutPage from "./pages/CheckoutPage";
import NotFound from "./pages/NotFound";
import TeamLoginPage from "./pages/TeamLoginPage";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="mfs-theme">
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin" element={<RoleGuard roles={["admin"]}><AdminDashboard /></RoleGuard>} />
              <Route path="/agent" element={<RoleGuard roles={["agent", "admin"]}><AgentDashboard /></RoleGuard>} />
              <Route path="/agent/cashin" element={<RoleGuard roles={["agent", "admin"]}><AgentCashIn /></RoleGuard>} />
              <Route path="/agent/b2b" element={<RoleGuard roles={["agent", "admin"]}><AgentB2B /></RoleGuard>} />
              <Route path="/agent/register" element={<RoleGuard roles={["agent", "admin"]}><AgentRegister /></RoleGuard>} />
              <Route path="/agent/billpay" element={<RoleGuard roles={["agent", "admin"]}><AgentBillPay /></RoleGuard>} />
              <Route path="/agent/history" element={<RoleGuard roles={["agent", "admin"]}><AgentTransactionHistory /></RoleGuard>} />
              <Route path="/agent/bank" element={<RoleGuard roles={["agent", "admin"]}><AgentBankTransfer /></RoleGuard>} />
              <Route path="/distributor" element={<RoleGuard roles={["distributor", "admin"]}><DistributorDashboard /></RoleGuard>} />
              <Route path="/distributor/create-agent" element={<RoleGuard roles={["distributor", "admin"]}><DistributorCreateAgent /></RoleGuard>} />
              <Route path="/super-distributor" element={<RoleGuard roles={["super_distributor", "admin"]}><SuperDistributorDashboard /></RoleGuard>} />
              <Route path="/super-distributor/create-distributor" element={<RoleGuard roles={["super_distributor", "admin"]}><SuperDistributorCreateDistributor /></RoleGuard>} />
              <Route path="/merchant" element={<RoleGuard roles={["merchant", "admin"]}><MerchantDashboard /></RoleGuard>} />
              <Route path="/checkout/:sessionId" element={<CheckoutPage />} />
              <Route path="/team-login" element={<TeamLoginPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
