import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, GraduationCap, Stethoscope, Droplets, Wheat, Baby, Check, History, Loader2, Trophy, EyeOff, Share2, RefreshCw, Trash2, CalendarClock, Home, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { verifyPin } from "@/lib/verifyPin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import ShareReceiptSheet, { ReceiptData } from "@/components/ShareReceiptSheet";
import { format } from "date-fns";
import { fireSuccessConfetti } from "@/lib/confetti";
import { springTransition } from "@/lib/transitions";

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

interface LeaderboardEntry {
  donor_name: string;
  total_amount: number;
  donation_count: number;
  cause_name: string;
}

interface RecurringDonation {
  id: string;
  cause_name: string;
  cause_icon: string | null;
  amount: number;
  frequency: string;
  is_active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  message: string | null;
  is_anonymous: boolean;
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
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [history, setHistory] = useState<DonationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("monthly");
  const [recurringList, setRecurringList] = useState<RecurringDonation[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardCause, setLeaderboardCause] = useState<string | null>(null);

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

  const fetchRecurring = async () => {
    if (!user) return;
    setRecurringLoading(true);
    const { data } = await supabase
      .from("recurring_donations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRecurringList((data as RecurringDonation[]) ?? []);
    setRecurringLoading(false);
  };

  const fetchLeaderboard = async (cause?: string | null) => {
    setLeaderboardLoading(true);
    const { data } = await supabase.rpc("donation_leaderboard", {
      p_cause: cause || null,
    });
    setLeaderboard((data as LeaderboardEntry[]) ?? []);
    setLeaderboardLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
      fetchRecurring();
    }
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

      await supabase.from("donations").insert({
        user_id: user!.id,
        cause_name: selectedCause!.name,
        cause_icon: selectedCause!.emoji,
        amount: num,
        message: message || null,
        is_anonymous: isAnonymous,
      });

      if (isRecurring) {
        const nextRun = new Date();
        if (frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
        else nextRun.setMonth(nextRun.getMonth() + 1);

        await supabase.from("recurring_donations").insert({
          user_id: user!.id,
          cause_name: selectedCause!.name,
          cause_icon: selectedCause!.emoji,
          amount: num,
          frequency,
          message: message || null,
          is_anonymous: isAnonymous,
          next_run_at: nextRun.toISOString(),
        });
      }

      const now = new Date();
      setReceiptData({
        title: "Donation Receipt",
        amount: `৳${num.toLocaleString()}`,
        gradient: `bg-gradient-to-r ${selectedCause!.gradient}`,
        rows: [
          { label: "Cause", value: selectedCause!.name },
          { label: "Amount", value: `৳${num.toLocaleString()}` },
          { label: "Date", value: format(now, "dd MMM yyyy, hh:mm a") },
          ...(isAnonymous ? [{ label: "Identity", value: "Anonymous" }] : []),
          ...(isRecurring ? [{ label: "Recurring", value: frequency === "weekly" ? "Weekly" : "Monthly" }] : []),
          ...(message ? [{ label: "Message", value: message }] : []),
        ],
        txnId: `DON-${selectedCause!.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      });

      setStep("success");
      fireSuccessConfetti();
      fetchHistory();
      if (isRecurring) fetchRecurring();
    } catch (e: any) {
      toast.error(e.message || "Donation failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleRecurringActive = async (id: string, currentActive: boolean) => {
    await supabase.from("recurring_donations").update({
      is_active: !currentActive,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    setRecurringList(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentActive } : r));
    toast.success(!currentActive ? "Schedule resumed" : "Schedule paused");
  };

  const deleteRecurring = async (id: string) => {
    await supabase.from("recurring_donations").delete().eq("id", id);
    setRecurringList(prev => prev.filter(r => r.id !== id));
    toast.success("Schedule deleted");
  };

  const resetFlow = () => {
    setStep("cause");
    setSelectedCause(null);
    setAmount("");
    setMessage("");
    setPin("");
    setIsAnonymous(false);
    setIsRecurring(false);
    setFrequency("monthly");
  };

  const causeForIcon = (name: string) => CAUSES.find(c => c.name === name);

  const MEDAL_BG = ["bg-yellow-500/10 border-yellow-500/30", "bg-slate-400/10 border-slate-400/30", "bg-amber-700/10 border-amber-700/30"];
  const MEDAL_TEXT = ["text-yellow-500", "text-slate-400", "text-amber-700"];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3.5 max-w-md mx-auto">
          <button
            onClick={() => step === "cause" ? navigate(-1) : resetFlow()}
            className="w-9 h-9 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground tracking-tight">Donations</h1>
          </div>
          <Sparkles size={18} className="text-primary/60" />
        </div>
        <div className="h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="max-w-md mx-auto px-4 pt-3">
        <Tabs defaultValue="donate">
          <TabsList className="w-full bg-transparent p-0 h-auto gap-1 mb-4">
            <TabsTrigger value="donate" className="flex-1 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md bg-muted/50 text-muted-foreground text-xs py-2 transition-all">
              <Heart size={13} className="mr-1" /> Donate
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex-1 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md bg-muted/50 text-muted-foreground text-xs py-2 transition-all" onClick={() => { if (recurringList.length === 0) fetchRecurring(); }}>
              <RefreshCw size={13} className="mr-1" /> Recurring
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md bg-muted/50 text-muted-foreground text-xs py-2 transition-all">
              <History size={13} className="mr-1" /> History
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md bg-muted/50 text-muted-foreground text-xs py-2 transition-all" onClick={() => { if (leaderboard.length === 0) fetchLeaderboard(leaderboardCause); }}>
              <Trophy size={13} className="mr-1" /> Top
            </TabsTrigger>
          </TabsList>

          {/* ── Donate Tab ── */}
          <TabsContent value="donate" className="mt-0">
            <AnimatePresence mode="wait">
              {/* Step 1: Cause Selection */}
              {step === "cause" && (
                <motion.div key="cause" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
                  <div className="text-center mb-6 mt-2">
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Make a Difference</h2>
                    <p className="text-sm text-muted-foreground mt-1">Choose a cause close to your heart</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {CAUSES.map((cause, i) => (
                      <motion.button
                        key={cause.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 * i, ...springTransition }}
                        onClick={() => handleSelectCause(cause)}
                        className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-card shadow-sm hover:shadow-lg active:scale-[0.96] transition-all duration-200 text-center relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className={`bg-gradient-to-br ${cause.gradient} w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/10`}>
                          <cause.icon size={28} />
                        </div>
                        <p className="text-sm font-semibold text-foreground">{cause.name}</p>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Amount */}
              {step === "amount" && selectedCause && (
                <motion.div key="amount" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="space-y-5">
                  {/* Selected cause banner */}
                  <div className={`bg-gradient-to-r ${selectedCause.gradient} rounded-2xl p-5 text-white relative overflow-hidden`}>
                    <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <selectedCause.icon size={22} />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{selectedCause.name}</p>
                        <p className="text-white/70 text-xs">Your contribution matters</p>
                      </div>
                    </div>
                  </div>

                  {/* Amount display */}
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Donation Amount</p>
                    <div className="text-4xl font-bold text-foreground tracking-tight">
                      ৳{amount || "0"}
                    </div>
                  </div>

                  {/* Preset pills */}
                  <div className="flex gap-2 justify-center">
                    {PRESET_AMOUNTS.map(a => (
                      <button
                        key={a}
                        onClick={() => setAmount(String(a))}
                        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                          amount === String(a)
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                            : "bg-muted/60 text-foreground hover:bg-muted"
                        }`}
                      >
                        ৳{a}
                      </button>
                    ))}
                  </div>

                  {/* Custom amount */}
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter custom amount"
                      value={amount}
                      onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="w-full text-center text-lg font-semibold py-3 bg-transparent border-b-2 border-border focus:border-primary outline-none transition-colors text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Message */}
                  <Textarea
                    placeholder="Leave a kind note… (optional)"
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 200))}
                    rows={2}
                    className="rounded-xl bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 resize-none"
                  />

                  {/* Toggle rows */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                          <EyeOff size={15} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Donate anonymously</p>
                          <p className="text-[11px] text-muted-foreground">Hidden from leaderboard</p>
                        </div>
                      </div>
                      <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                          <RefreshCw size={15} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Make this recurring</p>
                          <p className="text-[11px] text-muted-foreground">Auto-donate on schedule</p>
                        </div>
                      </div>
                      <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                    </div>
                  </div>

                  {/* Frequency */}
                  <AnimatePresence>
                    {isRecurring && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex gap-2 overflow-hidden">
                        {(["weekly", "monthly"] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setFrequency(f)}
                            className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${
                              frequency === f
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "bg-muted/50 text-foreground"
                            }`}
                          >
                            {f === "weekly" ? "Weekly" : "Monthly"}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Continue button */}
                  <button
                    onClick={handleAmountNext}
                    disabled={!amount || parseFloat(amount) < 10}
                    className={`w-full py-3.5 rounded-2xl font-bold text-base disabled:opacity-40 transition-all active:scale-[0.98] bg-gradient-to-r ${selectedCause.gradient} text-white shadow-lg shadow-primary/20`}
                  >
                    Continue — ৳{amount || "0"}
                  </button>
                </motion.div>
              )}

              {/* Step 3: PIN */}
              {step === "pin" && selectedCause && (
                <motion.div key="pin" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="mt-4 space-y-8 text-center">
                  {/* Cause icon */}
                  <div className="flex flex-col items-center gap-3">
                    <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${selectedCause.gradient} flex items-center justify-center text-white shadow-xl shadow-primary/15`}>
                      <selectedCause.icon size={34} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Donating to</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{selectedCause.name}</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {isAnonymous && <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full"><EyeOff size={11} /> Anonymous</span>}
                      {isRecurring && <span className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded-full"><RefreshCw size={11} /> {frequency === "weekly" ? "Weekly" : "Monthly"}</span>}
                    </div>
                  </div>

                  {/* PIN Entry */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-4">Enter your 4-digit PIN</p>
                    <div className="flex justify-center gap-3">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                            pin.length > i
                              ? "border-primary bg-primary/5 text-foreground"
                              : pin.length === i
                              ? "border-primary/50 bg-muted/30"
                              : "border-border bg-muted/20"
                          }`}
                        >
                          {pin.length > i ? "•" : ""}
                        </div>
                      ))}
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="opacity-0 absolute w-0 h-0"
                      autoFocus
                    />
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handlePinSubmit}
                    disabled={pin.length !== 4 || loading}
                    className={`w-full py-3.5 rounded-2xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-gradient-to-r ${selectedCause.gradient} text-white shadow-lg`}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} />}
                    {loading ? "Processing…" : "Confirm Donation"}
                  </button>
                </motion.div>
              )}

              {/* Step 4: Success */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={springTransition} className="mt-8 text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
                    className={`w-24 h-24 rounded-full bg-gradient-to-br ${selectedCause?.gradient || "from-emerald-500 to-teal-600"} flex items-center justify-center mx-auto shadow-2xl shadow-primary/20`}
                  >
                    <Check size={48} className="text-white" strokeWidth={3} />
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <p className="text-2xl font-bold text-foreground">Thank You!</p>
                    <p className="text-muted-foreground text-sm mt-2">
                      You donated <span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span> to
                    </p>
                    <p className="font-semibold text-foreground">{selectedCause?.name}</p>
                  </motion.div>

                  {(isAnonymous || isRecurring) && (
                    <div className="flex items-center justify-center gap-2">
                      {isAnonymous && (
                        <span className="text-xs bg-muted/60 text-muted-foreground px-3 py-1.5 rounded-full flex items-center gap-1">
                          <EyeOff size={11} /> Anonymous
                        </span>
                      )}
                      {isRecurring && (
                        <span className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full flex items-center gap-1 font-medium">
                          <RefreshCw size={11} /> {frequency === "weekly" ? "Weekly" : "Monthly"}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2.5 justify-center pt-2">
                    <button
                      onClick={resetFlow}
                      className={`px-5 py-2.5 rounded-full font-semibold text-sm bg-gradient-to-r ${selectedCause?.gradient || "from-primary to-primary"} text-white shadow-md active:scale-95 transition-transform flex items-center gap-1.5`}
                    >
                      <Heart size={14} /> Donate Again
                    </button>
                    <button
                      onClick={() => navigate("/")}
                      className="px-5 py-2.5 rounded-full font-semibold text-sm bg-muted/60 text-foreground active:scale-95 transition-transform flex items-center gap-1.5"
                    >
                      <Home size={14} /> Home
                    </button>
                    <button
                      onClick={() => setShareOpen(true)}
                      className="px-5 py-2.5 rounded-full font-semibold text-sm bg-muted/60 text-foreground active:scale-95 transition-transform flex items-center gap-1.5"
                    >
                      <Share2 size={14} /> Share
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* ── Recurring Tab ── */}
          <TabsContent value="recurring" className="mt-0">
            {recurringLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : recurringList.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <RefreshCw size={28} className="opacity-30" />
                </div>
                <p className="text-sm font-medium">No recurring donations</p>
                <p className="text-xs mt-1 text-muted-foreground/70">Set one up in the Donate tab</p>
              </div>
            ) : (
              <div className="space-y-2.5 mt-1">
                {recurringList.map((r, i) => {
                  const cause = causeForIcon(r.cause_name);
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl bg-card shadow-sm ${!r.is_active ? "opacity-50" : ""}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cause ? `bg-gradient-to-br ${cause.gradient} text-white` : "bg-muted"}`}>
                        {cause ? <cause.icon size={18} /> : (r.cause_icon || "❤️")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.cause_name}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarClock size={11} />
                          <span>{r.frequency === "weekly" ? "Weekly" : "Monthly"}</span>
                          <span>· Next: {format(new Date(r.next_run_at), "dd MMM")}</span>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-foreground mr-1">৳{r.amount}</p>
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={() => toggleRecurringActive(r.id, r.is_active)}
                        className="scale-90"
                      />
                      <button onClick={() => deleteRecurring(r.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center active:scale-90 transition-transform">
                        <Trash2 size={14} className="text-destructive" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── History Tab ── */}
          <TabsContent value="history" className="mt-0">
            {historyLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Heart size={28} className="opacity-30" />
                </div>
                <p className="text-sm font-medium">No donations yet</p>
                <p className="text-xs mt-1 text-muted-foreground/70">Your donation history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2.5 mt-1">
                {history.map((d, i) => {
                  const cause = causeForIcon(d.cause_name);
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-card shadow-sm"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cause ? `bg-gradient-to-br ${cause.gradient} text-white` : "bg-muted"}`}>
                        {cause ? <cause.icon size={18} /> : (d.cause_icon || "❤️")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{d.cause_name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy, hh:mm a")}</p>
                      </div>
                      <p className="text-sm font-bold text-foreground">৳{d.amount}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Leaderboard Tab ── */}
          <TabsContent value="leaderboard" className="mt-0">
            <div className="flex gap-2 overflow-x-auto py-3 no-scrollbar">
              <button
                onClick={() => { setLeaderboardCause(null); fetchLeaderboard(null); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${leaderboardCause === null ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-foreground"}`}
              >
                All Causes
              </button>
              {CAUSES.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setLeaderboardCause(c.name); fetchLeaderboard(c.name); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${leaderboardCause === c.name ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-foreground"}`}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>

            {leaderboardLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Trophy size={28} className="opacity-30" />
                </div>
                <p className="text-sm font-medium">No donations recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {leaderboard.map((entry, i) => {
                  const cause = causeForIcon(entry.cause_name);
                  return (
                    <motion.div
                      key={`${entry.donor_name}-${entry.cause_name}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl bg-card shadow-sm ${i < 3 ? `border ${MEDAL_BG[i]}` : ""}`}
                    >
                      <div className="w-8 text-center">
                        {i < 3 ? (
                          <Trophy size={20} className={MEDAL_TEXT[i]} />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>
                        )}
                      </div>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${cause ? `bg-gradient-to-br ${cause.gradient} text-white` : "bg-muted"}`}>
                        {cause ? <cause.icon size={16} /> : "❤️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {entry.donor_name === "Anonymous" ? "🕶️ Anonymous" : entry.donor_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {entry.cause_name} · {entry.donation_count} donation{entry.donation_count > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-primary">৳{entry.total_amount.toLocaleString()}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {receiptData && (
        <ShareReceiptSheet open={shareOpen} onClose={() => setShareOpen(false)} receipt={receiptData} />
      )}
    </div>
  );
};

export default DonationsPage;
