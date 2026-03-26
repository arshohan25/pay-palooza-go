import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ArrowLeft, Shield, Crown, Network, UserPlus, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { signUpWithPhonePassword } from "@/lib/auth";

const SuperDistributorCreateDistributor = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [territory, setTerritory] = useState("");
  const [maxFloat, setMaxFloat] = useState("10000000");
  const [commissionRate, setCommissionRate] = useState("0.20");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

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

  const handleCreate = async () => {
    if (!phone || !businessName) {
      toast({ title: "Missing fields", description: "Phone and business name are required", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const parsedTerritories = territory.split(",").map(t => t.trim()).filter(Boolean);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-agent-or-distributor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: "distributor",
          phone,
          name: name || null,
          business_name: businessName,
          max_float: Number(maxFloat) || 10000000,
          commission_rate: (Number(commissionRate) || 0.20) / 100,
          territories: parsedTerritories.length > 0 ? parsedTerritories : null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create distributor");

      setSuccess(true);
      toast({ title: "Distributor Created", description: `${businessName} account created successfully` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(156,39,176,0.12)" }}>
            <CheckCircle2 size={40} className="text-primary" />
          </div>
        </motion.div>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">Distributor Created!</h2>
          <p className="text-sm text-muted-foreground mt-1">{businessName} is now active</p>
          <p className="text-xs text-muted-foreground mt-2">A random PIN was generated. They should use "Forgot PIN" to set their own.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setSuccess(false); setPhone(""); setName(""); setBusinessName(""); setTerritory(""); setMaxFloat("10000000"); setCommissionRate("0.20"); }}>
            <UserPlus size={14} className="mr-1.5" /> Create Another
          </Button>
          <Button onClick={() => navigate("/super-distributor")} className="text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 pt-5 pb-4" style={{ background: "linear-gradient(150deg, hsl(270 60% 40%) 0%, hsl(285 55% 30%) 100%)" }}>
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/super-distributor")} className="tap-target text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-primary-foreground" />
            <h1 className="text-base font-bold text-primary-foreground">Create Distributor</h1>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        <Card className="p-5 border-0 shadow-card space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(156,39,176,0.12)" }}>
              <Network size={20} className="text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">New Distributor Account</h2>
              <p className="text-[10px] text-muted-foreground">Create a new distribution hub in your network</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Phone Number *</Label>
              <Input type="tel" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))} />
            </div>
            <div>
              <Label className="text-xs">Full Name</Label>
              <Input placeholder="Owner's full name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Business Name *</Label>
              <Input placeholder="Distribution hub name" value={businessName} onChange={e => setBusinessName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Territories (comma-separated)</Label>
              <Input placeholder="Dhaka North, Dhaka South" value={territory} onChange={e => setTerritory(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Max Float (৳)</Label>
                <Input type="text" inputMode="numeric" value={maxFloat} onChange={e => setMaxFloat(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div>
                <Label className="text-xs">Commission Rate (%)</Label>
                <Input type="text" inputMode="decimal" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} />
              </div>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={processing || !phone || !businessName} className="w-full text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(270 60% 45%), hsl(285 55% 35%))" }}>
            {processing ? "Creating…" : "Create Distributor Account"}
          </Button>
        </Card>

        <p className="text-[10px] text-muted-foreground text-center">
          The distributor will receive a random PIN and can reset it via "Forgot PIN".
        </p>
      </div>
    </div>
  );
};

export default SuperDistributorCreateDistributor;
