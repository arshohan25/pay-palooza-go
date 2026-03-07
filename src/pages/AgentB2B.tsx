import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRightLeft, CheckCircle2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const AgentB2B = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transferType, setTransferType] = useState<"agent" | "distributor">("agent");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [processing, setProcessing] = useState(false);
  const fee = Number(amount) > 100 ? 3 : 0;

  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const { error } = await supabase.rpc("transfer_money", {
        p_recipient_phone: phone,
        p_amount: Number(amount),
        p_fee: fee,
        p_type: "send" as any,
        p_recipient_type: "receive" as any,
        p_commission: 0,
        p_description: `B2B ${transferType === "agent" ? "Agent" : "Distributor"} Transfer${note ? `: ${note}` : ""}`,
        p_reference: (() => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; })(),
        p_recipient_name: transferType === "agent" ? "Agent" : "Distributor",
      });
      if (error) throw error;
      setStep("done");
      toast({ title: "Transfer Successful", description: `৳${amount} sent to ${transferType}` });
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
        className="gradient-hero px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/agent")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <ArrowRightLeft size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">B2B Transfer</h1>
              <p className="text-[9px] text-primary-foreground/60">Agent or Distributor</p>
            </div>
          </div>
        </div>
        <div className="max-w-xl mx-auto mt-3">
          <div className="h-1.5 bg-primary-foreground/10 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: step === "form" ? "33%" : step === "confirm" ? "66%" : "100%" }}
              className="h-full bg-primary-foreground/40 rounded-full"
              transition={{ duration: 0.4 }}
            />
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
              <div>
                <p className="text-lg font-extrabold text-foreground">Transfer Successful</p>
                <p className="text-sm text-muted-foreground mt-1">৳{fmt(Number(amount))} sent to {transferType === "agent" ? "Agent" : "Distributor"} ({phone})</p>
              </div>
              <div className="space-y-2 bg-muted/50 rounded-xl p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-bold text-foreground">{fee > 0 ? `৳${fmt(fee)}` : "Free"}</span></div>
                {fee > 0 && <p className="text-[11px] text-muted-foreground text-right">৳{fmt(Number(amount))} + ৳{fmt(fee)} fee (from balance)</p>}
                <div className="flex justify-between font-bold border-t border-border/40 pt-2"><span className="text-muted-foreground">Total</span><span className="text-foreground">৳{fmt(Number(amount) + fee)}</span></div>
              </div>
              <Button onClick={() => { setStep("form"); setPhone(""); setAmount(""); setNote(""); setPin(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">New Transfer</Button>
              <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2"><Home size={16} /> Back to Dashboard</Button>
            </Card>
          </motion.div>
        ) : step === "confirm" ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <h3 className="text-base font-extrabold text-foreground text-center">Confirm B2B Transfer</h3>
              <div className="space-y-2.5 bg-muted/50 rounded-xl p-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">To</span><span className="font-bold text-foreground capitalize">{transferType}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Phone</span><span className="font-bold text-foreground">{phone}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee</span><span className="font-bold text-foreground">{fee > 0 ? `৳${fmt(fee)}` : "Free"}</span></div>
                {fee > 0 && <p className="text-[11px] text-muted-foreground text-right">৳{fmt(Number(amount))} + ৳{fmt(fee)} fee (from balance)</p>}
                <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-2"><span className="text-muted-foreground">Total</span><span className="text-foreground">৳{fmt(Number(amount) + fee)}</span></div>
                {note && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Note</span><span className="font-medium text-foreground">{note}</span></div>}
              </div>
              <div>
                <Label className="text-xs font-semibold">Enter PIN</Label>
                <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1" />
              </div>
              <SlideToConfirm onConfirm={handleConfirm} disabled={pin.length < 4 || processing} label={processing ? "Processing…" : "Slide to Transfer"} />
              <Button variant="ghost" onClick={() => setStep("form")} className="w-full text-muted-foreground">Cancel</Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["agent", "distributor"] as const).map(t => (
                  <button key={t} onClick={() => setTransferType(t)} className={`py-3 rounded-xl text-xs font-bold transition-all ${transferType === t ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-muted text-muted-foreground"}`}>
                    {t === "agent" ? "🏪 Agent" : "🏢 Distributor"}
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs font-semibold">{transferType === "agent" ? "Agent" : "Distributor"} Phone</Label>
                <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ""))} maxLength={11} className="rounded-xl h-11 mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">Amount (৳)</Label>
                <Input type="text" inputMode="numeric" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
                {Number(amount) > 100 && <p className="text-[10px] text-muted-foreground mt-1.5">Fee: ৳3</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold">Note (Optional)</Label>
                <Input placeholder="e.g. Float repayment" value={note} onChange={e => setNote(e.target.value)} maxLength={50} className="rounded-xl h-11 mt-1" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[5000, 10000, 25000, 50000].map(a => (
                  <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground press-effect hover:bg-primary/10 hover:text-primary transition-colors">৳{fmt(a)}</button>
                ))}
              </div>
              <Button onClick={() => setStep("confirm")} disabled={phone.length < 11 || !amount || Number(amount) < 10} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold">Continue</Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AgentB2B;
