import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Receipt, CheckCircle2, Home, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";

import { supabase } from "@/integrations/supabase/client";
import { verifyPin } from "@/lib/verifyPin";
import QrScannerModal from "@/components/QrScannerModal";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const providers = [
  { name: "DESCO", category: "Electricity", icon: "⚡" },
  { name: "DPDC", category: "Electricity", icon: "⚡" },
  { name: "Titas Gas", category: "Gas", icon: "🔥" },
  { name: "WASA", category: "Water", icon: "💧" },
  { name: "Link3", category: "Internet", icon: "🌐" },
  { name: "Carnival", category: "Internet", icon: "🌐" },
];

const AgentBillPay = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"select" | "form" | "done">("select");
  const [processing, setProcessing] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handlePay = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { toast({ title: "Wrong PIN", description: "Incorrect PIN. Please try again.", variant: "destructive" }); setPin(""); setProcessing(false); return; }
      const { error } = await supabase.rpc("record_transaction", {
        p_type: "paybill" as any,
        p_amount: Number(amount),
        p_fee: 0,
        p_description: `Bill Pay - ${selected}`,
        p_recipient_name: selected,
        p_reference: (() => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; })(),
      });
      if (error) throw error;
      setStep("done");
      toast({ title: "Bill Paid", description: `৳${amount} paid to ${selected}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
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
        className="gradient-send px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/agent")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <Receipt size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Bill Pay</h1>
              <p className="text-[9px] text-primary-foreground/60">Utility bill payments</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        {step === "done" ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-primary" />
              </motion.div>
              <p className="text-lg font-extrabold text-foreground">Bill Paid Successfully</p>
              <p className="text-sm text-muted-foreground">৳{fmt(Number(amount))} paid to {selected}</p>
              <Button onClick={() => { setStep("select"); setSelected(null); setAccountNo(""); setAmount(""); setPin(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">Pay Another Bill</Button>
              <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2"><Home size={16} /> Back to Dashboard</Button>
            </Card>
          </motion.div>
        ) : step === "form" ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{providers.find(p => p.name === selected)?.icon}</span>
                <h3 className="text-base font-extrabold text-foreground">{selected}</h3>
              </div>
              <div>
                <Label className="text-xs font-semibold">Account / Meter No</Label>
                <div className="relative mt-1">
                  <Input placeholder="Enter account number" value={accountNo} onChange={e => setAccountNo(e.target.value)} className="rounded-xl h-11 pr-11" />
                  <button type="button" onClick={() => setShowQr(true)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                    <ScanLine size={16} />
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Amount (৳)</Label>
                <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Enter PIN</Label>
                <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1" />
              </div>
              <SlideToConfirm onConfirm={handlePay} disabled={!accountNo || !amount || pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Pay"} icon={Receipt} />
              <Button variant="ghost" onClick={() => { setPin(""); setStep("select"); }} className="w-full text-muted-foreground">Back</Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-2 gap-3">
              {providers.map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card
                    className="p-4 border-0 shadow-card rounded-2xl cursor-pointer press-effect hover:shadow-elevated transition-shadow"
                    onClick={() => { setSelected(p.name); setStep("form"); }}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <p className="text-xs font-bold text-foreground mt-2">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground">{p.category}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
      <QrScannerModal
        open={showQr}
        onClose={() => setShowQr(false)}
        title="Scan Account QR"
        onScan={(result) => {
          setShowQr(false);
          setAccountNo(result.trim());
        }}
      />
    </div>
  );
};

export default AgentBillPay;
