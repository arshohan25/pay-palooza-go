import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, UserPlus, Home, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import DivisionDistrictUpazilaPicker, { type DivisionDistrictUpazilaValue } from "@/components/DivisionDistrictUpazilaPicker";
import LocationMismatchAlert from "@/components/LocationMismatchAlert";
import { detectLocationMismatch, type LocationMismatch } from "@/lib/detectLocationMismatch";
import { districtToRouteCode } from "@/lib/districtRouteCode";
import { useI18n } from "@/lib/i18n";

const DistributorCreateAgent = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [nid, setNid] = useState("");
  const [location, setLocation] = useState<DivisionDistrictUpazilaValue>({
    division: null, district: null, upazila: null, union_parishad: null, area_type: null,
  });
  const [locError, setLocError] = useState<LocationMismatch | null>(null);
  const [tradeLicense, setTradeLicense] = useState("");
  const [maxFloat, setMaxFloat] = useState("500000");
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const phoneValidation = usePhoneValidation(phone);

  // Clear inline error whenever the user re-picks any location field.
  useEffect(() => { if (locError) setLocError(null); }, [location.division, location.district, location.upazila, location.union_parishad, location.area_type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (phoneValidation.triggerShake()) return;
    if (processing || !user) return;
    if (!location.division || !location.district || !location.upazila) {
      const mismatch = await detectLocationMismatch({ ...location, area_type: (location.area_type as any) ?? null });
      setLocError(mismatch);
      toast({ title: t("distCAToastLocReq"), description: mismatch?.message || t("distCAToastLocReqDesc"), variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      // Auto-derive 2-letter route code from district so wallet-ID prefix stays correct.
      const derivedRoute = await districtToRouteCode(location.district);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-agent-or-distributor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: "agent",
          phone,
          name: name || null,
          business_name: businessName || name || phone,
          nid_number: nid || null,
          territory_code: derivedRoute,
          route_code: derivedRoute,
          division: location.division,
          district: location.district,
          upazila: location.upazila,
          union_parishad: location.union_parishad,
          area_type: location.area_type,
          trade_license: tradeLicense || null,
          max_float: Number(maxFloat) || 500000,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (/Invalid location hierarchy/i.test(result.error || "")) {
          const mismatch = await detectLocationMismatch({ ...location, area_type: (location.area_type as any) ?? null });
          setLocError(mismatch);
          throw new Error(mismatch?.message || "Invalid location hierarchy");
        }
        throw new Error(result.error || "Failed to create agent");
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
    setLocation({ division: null, district: null, upazila: null, union_parishad: null, area_type: null });
    setLocError(null);
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

              <div>
                <Label className="text-xs font-semibold">NID Number</Label>
                <Input type="text" inputMode="numeric" placeholder="NID" value={nid} onChange={e => setNid(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Location *</Label>
                <p className="text-[10px] text-muted-foreground">Division › District › Upazila / Thana › Union / Powrashava</p>
                <DivisionDistrictUpazilaPicker value={location} onChange={setLocation} required showLabels={false} />
                <LocationMismatchAlert mismatch={locError} />
                <p className="text-[10px] text-muted-foreground">Route code (RR) is auto-derived from the district for the agent's wallet ID.</p>
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

              <Button onClick={handleCreate} disabled={!phoneValidation.isValid || !name || processing || !location.division || !location.district || !location.upazila} className="w-full rounded-xl h-11 text-sm font-bold text-primary-foreground" style={{ background: "linear-gradient(135deg, hsl(217 80% 50%), hsl(226 75% 40%))" }}>
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
