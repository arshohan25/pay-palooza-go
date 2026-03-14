import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import { signUpWithPhonePassword } from "@/lib/auth";

const AgentRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [nid, setNid] = useState("");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const phoneValidation = usePhoneValidation(phone);

  const handleRegister = async () => {
    if (phoneValidation.triggerShake()) return;
    if (processing) return;
    setProcessing(true);
    try {
      // Check if phone already registered
      const { data: existing } = await supabase.from("profiles").select("id").eq("phone", phone.replace(/\D/g, "").replace(/^(\+?88)/, "")).maybeSingle();
      if (existing) { toast({ title: "Already Registered", description: "This number already has an account.", variant: "destructive" }); setProcessing(false); return; }
      const email = `${phone}@easypay.app`;
      // Generate random PIN instead of predictable phone-derived one
      const randomPin = String(Math.floor(1000 + Math.random() * 9000));
      const { error } = await supabase.auth.signUp({
        email,
        password: `${randomPin}EP`,
        options: { data: { phone, name } },
      });
      if (error) throw error;
      setDone(true);
      toast({ title: "Customer Registered", description: `${name || phone} successfully onboarded` });
    } catch (err: any) {
      toast({ title: "Registration Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-hero px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/agent")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <UserPlus size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Register Customer</h1>
              <p className="text-[9px] text-primary-foreground/60">Onboard new customer</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        {done ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <UserPlus size={32} className="text-primary" />
              </motion.div>
              <p className="text-lg font-extrabold text-foreground">Registration Complete</p>
              <p className="text-sm text-muted-foreground">{name || phone} has been onboarded</p>
              <Button onClick={() => { setDone(false); setPhone(""); setName(""); setNid(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">Register Another</Button>
              <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2"><Home size={16} /> Back to Dashboard</Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div>
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} onBlur={() => phoneValidation.setTouched(true)} maxLength={11} className={`rounded-xl h-11 mt-1 ${phoneValidation.inputClassName}`} />
                {phoneValidation.showError && <p className="text-[10px] text-destructive font-medium mt-1 animate-fade-in">{phoneValidation.errorMessage}</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold">Full Name</Label>
                <Input placeholder="Customer name" value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-11 mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">NID Number (Optional)</Label>
                <Input type="text" inputMode="numeric" placeholder="NID number" value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
              </div>
              <Button onClick={handleRegister} disabled={!phoneValidation.isValid || processing} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold">
                {processing ? "Registering…" : "Register Customer"}
              </Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AgentRegister;
