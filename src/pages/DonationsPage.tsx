import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, GraduationCap, Stethoscope, Droplets, Wheat, Baby, Check, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { verifyPin } from "@/lib/verifyPin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const CAUSES = [
  { id: "education", name: "Education", icon: GraduationCap, gradient: "from-blue-500 to-indigo-600", emoji: "📚" },
  { id: "disaster", name: "Disaster Relief", icon: Heart, gradient: "from-orange-500 to-red-600", emoji: "🆘" },
  { id: "healthcare", name: "Healthcare", icon: Stethoscope, gradient: "from-emerald-500 to-teal-600", emoji: "🏥" },
  { id: "water", name: "Clean Water", icon: Droplets, gradient: "from-cyan-500 to-blue-600", emoji: "💧" },
  { id: "food", name: "Food Security", icon: Wheat, gradient: "from-amber-500 to-yellow-600", emoji: "🌾" },
  { id: "orphan", name: "Orphan Support", icon: Baby, gradient: "from-pink-500 to-rose-600", emoji: "👶" },
];

const PRESET_AMOUNTS = [50, 100, 500, 1000];

type Step = "cause" | "amount" | "pin" | "success";

interface DonationRecord {
  id: string;
  cause_name: string;
  cause_icon: string | null;
  amount: number;
  message: string | null;
  created_at: string;
}

const DonationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("cause");
  const [selectedCause, setSelectedCause] = useState<typeof CAUSES[0] | null>(null);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<DonationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("donations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data as DonationRecord[]) ?? []);
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const handleSelectCause = (cause: typeof CAUSES[0]) => {
    setSelectedCause(cause);
    setStep("amount");
  };

  const handleAmountNext = () => {
    const num = parseFloat(amount);
    if (!num || num < 10) { toast.error("Minimum donation is ৳10"); return; }
    if (num > 100000) { toast.error("Maximum donation is ৳100,000"); return; }
    setStep("pin");
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const valid = await verifyPin(pin);
      if (!valid) { toast.error("Incorrect PIN"); setPin(""); setLoading(false); return; }

      const num = parseFloat(amount);
      const desc = `Donation: ${selectedCause!.name}${message ? ` — ${message}` : ""}`;

      const { data, error } = await supabase.rpc("record_transaction", {
        p_type: "payment",
        p_amount: num,
        p_fee: 0,
        p_description: desc,
        p_reference: `DON-${selectedCause!.id.toUpperCase()}`,
        p_recipient_name: selectedCause!.name,
      });

      if (error) throw error;

      // Record in donations table
      await supabase.from("donations").insert({
        user_id: user!.id,
        cause_name: selectedCause!.name,
        cause_icon: selectedCause!.emoji,
        amount: num,
        message: message || null,
      });

      setStep("success");
      fetchHistory();
    } catch (e: any) {
      toast.error(e.message || "Donation failed");
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep("cause");
    setSelectedCause(null);
    setAmount("");
    setMessage("");
    setPin("");
  };

  const causeForIcon = (name: string) => CAUSES.find(c => c.name === name);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-md mx-auto">
          <button onClick={() => step === "cause" ? navigate(-1) : resetFlow()} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Donations</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4">
        <Tabs defaultValue="donate">
          <TabsList className="w-full">
            <TabsTrigger value="donate" className="flex-1">Donate</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History size={14} className="mr-1.5" /> History
            </TabsTrigger>
          </TabsList>

          {/* ── Donate Tab ── */}
          <TabsContent value="donate">
            <AnimatePresence mode="wait">
              {/* Step 1: Cause */}
              {step === "cause" && (
                <motion.div key="cause" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                  <p className="text-sm text-muted-foreground mt-3 mb-4">Choose a cause to support</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CAUSES.map((cause, i) => (
                      <motion.button
                        key={cause.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i }}
                        onClick={() => handleSelectCause(cause)}
                        className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md active:scale-[0.97] transition-all text-center"
                      >
                        <div className={`bg-gradient-to-b ${cause.gradient} w-14 h-14 rounded-2xl flex items-center justify-center text-white`}>
                          <cause.icon size={24} />
                        </div>
                        <p className="text-sm font-bold text-foreground">{cause.name}</p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Amount */}
              {step === "amount" && selectedCause && (
                <motion.div key="amount" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5 mt-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border">
                    <div className={`bg-gradient-to-b ${selectedCause.gradient} w-12 h-12 rounded-xl flex items-center justify-center text-white`}>
                      <selectedCause.icon size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{selectedCause.name}</p>
                      <p className="text-xs text-muted-foreground">Your contribution makes a difference</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Select Amount</p>
                    <div className="grid grid-cols-4 gap-2">
                      {PRESET_AMOUNTS.map(a => (
                        <button
                          key={a}
                          onClick={() => setAmount(String(a))}
                          className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${amount === String(a) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50"}`}
                        >
                          ৳{a}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1.5">Or enter custom amount</p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="৳ Enter amount"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="text-lg font-semibold"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1.5">Message (optional)</p>
                    <Textarea
                      placeholder="Leave a kind note…"
                      value={message}
                      onChange={e => setMessage(e.target.value.slice(0, 200))}
                      rows={2}
                    />
                  </div>

                  <button
                    onClick={handleAmountNext}
                    disabled={!amount || parseFloat(amount) < 10}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-base disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    Continue — ৳{amount || "0"}
                  </button>
                </motion.div>
              )}

              {/* Step 3: PIN */}
              {step === "pin" && (
                <motion.div key="pin" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mt-6 space-y-6 text-center">
                  <div>
                    <p className="text-muted-foreground text-sm">Donating to</p>
                    <p className="text-lg font-bold text-foreground">{selectedCause?.name}</p>
                    <p className="text-2xl font-extrabold text-primary mt-1">৳{parseFloat(amount).toLocaleString()}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Enter 4-digit PIN</p>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="text-center text-2xl tracking-[0.5em] max-w-[200px] mx-auto"
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={handlePinSubmit}
                    disabled={pin.length !== 4 || loading}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} />}
                    {loading ? "Processing…" : "Confirm Donation"}
                  </button>
                </motion.div>
              )}

              {/* Step 4: Success */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 text-center space-y-5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto"
                  >
                    <Check size={40} className="text-emerald-500" />
                  </motion.div>
                  <div>
                    <p className="text-xl font-bold text-foreground">Thank You! 💚</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      ৳{parseFloat(amount).toLocaleString()} donated to <span className="font-semibold text-foreground">{selectedCause?.name}</span>
                    </p>
                  </div>
                  <button onClick={resetFlow} className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold">
                    Donate Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history">
            {historyLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Heart size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No donations yet</p>
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                {history.map(d => {
                  const cause = causeForIcon(d.cause_name);
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${cause ? `bg-gradient-to-b ${cause.gradient} text-white` : "bg-muted"}`}>
                        {cause ? <cause.icon size={18} /> : (d.cause_icon || "❤️")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{d.cause_name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy, hh:mm a")}</p>
                      </div>
                      <p className="text-sm font-bold text-foreground">৳{d.amount}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DonationsPage;
