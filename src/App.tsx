import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";
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
import SuperDistributorDashboard from "./pages/SuperDistributorDashboard";
import MerchantDashboard from "./pages/MerchantDashboard";
import NotFound from "./pages/NotFound";

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
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/agent" element={<AgentDashboard />} />
              <Route path="/agent/cashin" element={<AgentCashIn />} />
              <Route path="/agent/b2b" element={<AgentB2B />} />
              <Route path="/agent/register" element={<AgentRegister />} />
              <Route path="/agent/billpay" element={<AgentBillPay />} />
              <Route path="/agent/history" element={<AgentTransactionHistory />} />
              <Route path="/agent/bank" element={<AgentBankTransfer />} />
              <Route path="/distributor" element={<DistributorDashboard />} />
              <Route path="/super-distributor" element={<SuperDistributorDashboard />} />
              <Route path="/merchant" element={<MerchantDashboard />} />
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
