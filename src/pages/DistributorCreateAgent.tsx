import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { signUpWithPhonePassword } from "@/lib/auth";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, Home, Building2, MapPin, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePhoneValidation } from "@/hooks/use-phone-validation";

const DistributorCreateAgent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [nid, setNid] = useState("");
  const [territory, setTerritory] = useState("");
  const [tradeLicense, setTradeLicense] = useState("");
  const [maxFloat, setMaxFloat] = useState("500000");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const phoneValidation = usePhoneValidation(phone);

  const handleCreate = async () => {
    if (phoneValidation.triggerShake()) return;
    if (processing || !user) return;
    setProcessing(true);
    try {
      // 1. Get distributor record
      const { data: distData } = await supabase
        .from("distributors")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!distData) throw new Error("Distributor record not found");

      // 2. Create auth account for agent
      const email = `${phone}@easypay.app`;
      const randomPin = String(Math.floor(1000 + Math.random() * 9000));
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: `${randomPin}EP`,
        options: { data: { phone, name: name || businessName } },
      });
      if (signUpError) throw signUpError;
      const newUserId = signUpData.user?.id;
      if (!newUserId) throw new Error("Failed to create user account");

      // 3. Assign agent role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: newUserId,
        role: "agent" as any,
      });
      if (roleError) throw roleError;

      // 4. Create agent record linked to this distributor
      const { error: agentError } = await supabase.from("agents").insert({
        user_id: newUserId,
        distributor_id: distData.id,
        business_name: businessName || name || phone,
        nid_number: nid || null,
        territory_code: territory || null,
        trade_license: tradeLicense || null,
        max_float: Number(maxFloat) || 500000,
        status: "active" as any,
      });
      if (agentError) throw agentError;

      // 5. Update profile with name
      if (name) {
        await supabase.from("profiles").update({ name }).eq("user_id", newUserId);
      }

      setDone(true);
      toast({ title: "Agent Created", description: `${businessName || name || phone} has been registered as an agent` });
    } catch (err: any) {
      toast({ title: "Creation Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setDone(false);
    setPhone("");
    setName("");
    setBusinessName("");
    setNid("");
    setTerritory("");
    setTradeLicense("");
    setMaxFloat("500000");
  };

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="px-4 pt-3 pb-3 sticky top-0 z-30"
        style={{ background: "linear-gradient(150deg, hsl(217 80% 50%) 0%, hsl(226 75% 40%) 100%)" }}
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/distributor")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <UserPlus size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Create Agent Account</h1>
              <p className="text-[9px] text-primary-foreground/60">Register new agent in your network</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        {done ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg, hsl(217 80% 50%), hsl(226 75% 40%))" }}>
                <UserPlus size={32} className="text-primary-foreground" />
              </motion.div>
              <p className="text-lg font-extrabold text-foreground">Agent Created!</p>
              <p className="text-sm text-muted-foreground">{businessName || name || phone} is now part of your network</p>
              <div className="p-3 rounded-xl bg-muted/50 text-left space-y-1">
                <p className="text-[10px] text-muted-foreground">Account Created</p>
                <p className="text-xs text-foreground">A random PIN has been generated. The agent must use "Forgot PIN" to set their own PIN.</p>
              </div>
              <Button onClick={resetForm} className="w-full rounded-xl h-11 text-sm font-bold" style={{ background: "linear-gradient(135deg, hsl(217 80% 50%), hsl(226 75% 40%))" }}>
                <UserPlus size={16} className="mr-2 text-primary-foreground" />
                <span className="text-primary-foreground">Create Another Agent</span>
              </Button>
              <Button onClick={() => navigate("/distributor")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2">
                <Home size={16} /> Back to Dashboard
              </Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} className="text-primary" />
                <p className="text-xs font-semibold text-foreground">Agent Registration</p>
              </div>

              <div>
                <Label className="text-xs font-semibold">Phone Number *</Label>
                <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} onBlur={() => phoneValidation.setTouched(true)} maxLength={11} className={`rounded-xl h-11 mt-1 ${phoneValidation.inputClassName}`} />
                {phoneValidation.showError && <p className="text-[10px] text-destructive font-medium mt-1 animate-fade-in">{phoneValidation.errorMessage}</p>}
              </div>

              <div>
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input placeholder="Agent's full name" value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-11 mt-1" />
              </div>

              <div>
                <Label className="text-xs font-semibold">Business Name</Label>
                <Input placeholder="Shop or business name" value={businessName} onChange={e => setBusinessName(e.target.value)} className="rounded-xl h-11 mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">NID Number</Label>
                  <Input type="text" inputMode="numeric" placeholder="NID" value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Territory Code</Label>
                  <Input placeholder="e.g. DHK-N" value={territory} onChange={e => setTerritory(e.target.value)} className="rounded-xl h-11 mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Trade License</Label>
                  <Input placeholder="License #" value={tradeLicense} onChange={e => setTradeLicense(e.target.value)} className="rounded-xl h-11 mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Max Float (৳)</Label>
                  <Input type="text" inputMode="numeric" placeholder="500000" value={maxFloat} onChange={e => setMaxFloat(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
                </div>
              </div>

              <Button onClick={handleCreate} disabled={!phoneValidation.isValid || !name || processing} className="w-full rounded-xl h-11 text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(217 80% 50%), hsl(226 75% 40%))" }}>
                {processing ? "Creating Agent…" : "Create Agent Account"}
              </Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DistributorCreateAgent;
