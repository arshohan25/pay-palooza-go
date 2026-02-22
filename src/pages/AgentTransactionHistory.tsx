import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Shield, Building2 } from "lucide-react";
import TransactionHistory from "./TransactionHistory";

const AgentTransactionHistory = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Login required</p>
        <Button onClick={() => navigate("/")} variant="outline">Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => navigate("/agent")}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
        </motion.button>
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-primary" />
          <h1 className="text-base font-bold text-foreground">Agent Transactions</h1>
        </div>
      </div>

      {/* Reuse existing TransactionHistory component */}
      <div className="max-w-xl mx-auto px-4">
        <TransactionHistory />
      </div>
    </div>
  );
};

export default AgentTransactionHistory;
