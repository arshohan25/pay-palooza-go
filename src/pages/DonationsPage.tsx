import Seo from "@/components/Seo";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, GraduationCap, Stethoscope, Droplets, Wheat, Baby, Check, History, Loader2, Trophy, EyeOff, Share2, RefreshCw, Trash2, CalendarClock, Home } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { verifyPin } from "@/lib/verifyPin";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import ShareReceiptSheet, { ReceiptData } from "@/components/ShareReceiptSheet";
import { format } from "date-fns";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";

const CAUSES = [
  { id: "education", name: "Education", icon: GraduationCap, gradient: "from-blue-500 to-indigo-600", desc: "Support students in need" },
  { id: "disaster", name: "Disaster Relief", icon: Heart, gradient: "from-orange-500 to-red-600", desc: "Help communities rebuild" },
  { id: "healthcare", name: "Healthcare", icon: Stethoscope, gradient: "from-emerald-500 to-teal-600", desc: "Access to medical care" },
  { id: "water", name: "Clean Water", icon: Droplets, gradient: "from-cyan-500 to-blue-600", desc: "Safe drinking water for all" },
  { id: "food", name: "Food Security", icon: Wheat, gradient: "from-amber-500 to-yellow-600", desc: "Fight hunger together" },
  { id: "orphan", name: "Orphan Support", icon: Baby, gradient: "from-pink-500 to-rose-600", desc: "A better future for children" },
];

const CAUSE_EMOJI: Record<string, string> = {
  Education: "📚", "Disaster Relief": "🆘", Healthcare: "🏥",
  "Clean Water": "💧", "Food Security": "🌾", "Orphan Support": "👶",
};

const PRESET_AMOUNTS = [50, 100, 500, 1000];

type Step = "cause" | "amount" | "pin" | "success";

interface DonationRecord { id: string; cause_name: string; cause_icon: string | null; amount: number; message: string | null; created_at: string; }
interface LeaderboardEntry { donor_name: string; total_amount: number; donation_count: number; cause_name: string; }
interface RecurringDonation { id: string; cause_name: string; cause_icon: string | null; amount: number; frequency: string; is_active: boolean; next_run_at: string; last_run_at: string | null; message: string | null; is_anonymous: boolean; }

interface CauseFund { cause_name: string; total_raised: number; donor_count: number; }

const spring = { type: "spring" as const, stiffness: 500, damping: 32 };

const DonationsPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const { status: kycStatus, loading: kycLoading } = useKycStatus();
  const CAUSE_I18N: Record<string, { name: string; desc: string }> = {
    education: { name: t("causeEducation"), desc: t("causeEducationDesc") },
    disaster: { name: t("causeDisaster"), desc: t("causeDisasterDesc") },
    healthcare: { name: t("causeHealthcare"), desc: t("causeHealthcareDesc") },
    water: { name: t("causeWater"), desc: t("causeWaterDesc") },
    food: { name: t("causeFood"), desc: t("causeFoodDesc") },
    orphan: { name: t("causeOrphan"), desc: t("causeOrphanDesc") },
  };
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
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [recurringList, setRecurringList] = useState<RecurringDonation[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardCause, setLeaderboardCause] = useState<string | null>(null);
  const [msgExpanded, setMsgExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("donate");
  const [causeFunds, setCauseFunds] = useState<Record<string, CauseFund>>({});
  const pinRef = useRef<HTMLInputElement>(null);

  const fetchHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await supabase.from("donations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setHistory((data as DonationRecord[]) ?? []);
    setHistoryLoading(false);
  };

  const fetchRecurring = async () => {
    if (!user) return;
    setRecurringLoading(true);
    const { data } = await supabase.from("recurring_donations").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setRecurringList((data as RecurringDonation[]) ?? []);
    setRecurringLoading(false);
  };

  const fetchLeaderboard = async (cause?: string | null) => {
    setLeaderboardLoading(true);
    const { data } = await supabase.rpc("donation_leaderboard", { p_cause: cause || null });
    setLeaderboard((data as LeaderboardEntry[]) ?? []);
    setLeaderboardLoading(false);
  };

  const fetchCauseFunds = async () => {
    const { data } = await supabase.from("donation_cause_funds").select("cause_name, total_raised, donor_count");
    const map: Record<string, CauseFund> = {};
    (data ?? []).forEach((f: any) => { map[f.cause_name] = f; });
    setCauseFunds(map);
  };

  useEffect(() => {
    if (user) { fetchHistory(); fetchRecurring(); }
    fetchCauseFunds();
    // Restore favorite cause
    const favId = localStorage.getItem("mfs_fav_donation_cause");
    if (favId) {
      const fav = CAUSES.find(c => c.id === favId);
      if (fav) { setSelectedCause(fav); }
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "leaderboard" && leaderboard.length === 0) {
      fetchLeaderboard(leaderboardCause);
    }
    if (activeTab === "recurring" && recurringList.length === 0) {
      fetchRecurring();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!kycLoading && kycStatus !== "verified") {
      toast.error("Please complete KYC verification to use this feature.");
      navigate("/");
    }
  }, [kycLoading, kycStatus, navigate]);

  

  const handleSelectCause = (cause: typeof CAUSES[0]) => { setSelectedCause(cause); setStep("amount"); localStorage.setItem("mfs_fav_donation_cause", cause.id); };

  const handleAmountNext = () => {
    const num = parseFloat(amount);
    if (!num || num < 10) { toast.error("Minimum donation is ৳10"); return; }
    if (num > 100000) { toast.error("Maximum donation is ৳100,000"); return; }
    setPin(""); setStep("pin");
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const valid = await verifyPin(pin);
      if (!valid) { toast.error("Incorrect PIN"); setPin(""); setLoading(false); return; }
      const num = parseFloat(amount);
      const desc = `Donation: ${selectedCause!.name}${message ? ` — ${message}` : ""}`;
      const emoji = CAUSE_EMOJI[selectedCause!.name] || "❤️";

      const { error } = await supabase.rpc("process_donation" as any, {
        p_amount: num,
        p_cause_name: selectedCause!.name,
        p_cause_icon: emoji,
        p_message: message || null,
        p_is_anonymous: isAnonymous,
        p_is_recurring: isRecurring,
        p_frequency: frequency,
      });
      if (error) throw error;

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
          ...(isRecurring ? [{ label: "Recurring", value: frequency === "weekly" ? "Weekly" : frequency === "yearly" ? "Yearly" : "Monthly" }] : []),
          ...(message ? [{ label: "Message", value: message }] : []),
        ],
        txnId: `DON-${selectedCause!.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      });

      setStep("success");
      fireSuccessConfetti();
      // Save favorite cause for next time
      if (selectedCause) {
        localStorage.setItem("mfs_fav_donation_cause", selectedCause.id);
      }
      fetchHistory();
      if (isRecurring) fetchRecurring();
    } catch (e: any) {
      toast.error(e.message || "Donation failed");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const toggleRecurringActive = async (id: string, currentActive: boolean) => {
    await supabase.from("recurring_donations").update({ is_active: !currentActive, updated_at: new Date().toISOString() }).eq("id", id);
    setRecurringList(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentActive } : r));
    toast.success(!currentActive ? "Schedule resumed" : "Schedule paused");
  };

  const deleteRecurring = async (id: string) => {
    await supabase.from("recurring_donations").delete().eq("id", id);
    setRecurringList(prev => prev.filter(r => r.id !== id));
    toast.success("Schedule deleted");
  };

  const resetFlow = () => {
    setStep("cause"); setSelectedCause(null); setAmount(""); setMessage("");
    setPin(""); setIsAnonymous(false); setIsRecurring(false); setFrequency("monthly"); setMsgExpanded(false);
  };

  const causeForIcon = (name: string) => CAUSES.find(c => c.name === name);

  const MEDALS = ["🥇", "🥈", "🥉"];
  const MEDAL_BAR = ["from-yellow-400 to-amber-500", "from-slate-300 to-slate-400", "from-amber-600 to-amber-700"];

  return (
    <div className="min-h-screen bg-background pb-20">
      <Seo
        title="Donations – Give Securely with EasyPay"
        description="Donate to verified causes, mosques, charities and disaster relief directly from your EasyPay wallet."
        path="/donations"
      />
      {/* Minimal Header */}
      <div className="sticky top-0 z-30 gradient-hero text-primary-foreground backdrop-blur-xl border-b border-primary/30 shadow-glow">
        <div className="flex items-center gap-3 px-5 py-4 max-w-md mx-auto">
          <button
            onClick={() => step === "cause" ? navigate(-1) : resetFlow()}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft size={16} className="text-primary-foreground" />
          </button>
          <h1 className="text-base font-semibold text-primary-foreground tracking-tight">{t("donations")}</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 pt-1">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* iOS-style segmented control */}
          <TabsList className="w-full bg-muted/40 rounded-xl p-1 h-auto gap-0 mb-5">
            <TabsTrigger value="donate" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-transparent text-muted-foreground text-xs py-2 font-medium transition-all">
              {t("donate")}
            </TabsTrigger>
            <TabsTrigger value="recurring" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-transparent text-muted-foreground text-xs py-2 font-medium transition-all">
              {t("recurringTab")}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-transparent text-muted-foreground text-xs py-2 font-medium transition-all">
              {t("history")}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm bg-transparent text-muted-foreground text-xs py-2 font-medium transition-all">
              {t("topTab")}
            </TabsTrigger>
          </TabsList>

          {/* ── Donate Tab ── */}
          <TabsContent value="donate" className="mt-0">
            <AnimatePresence mode="wait">
              {/* Step 1: Cause Selection */}
              {step === "cause" && (
                <motion.div key="cause" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35 }}>
                  {/* Soft gradient blob */}
                  <div className="relative text-center mb-8 mt-2">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1, ...spring }}>
                      <Heart size={20} className="text-primary mx-auto mb-2 opacity-60" />
                    </motion.div>
                    <h2 className="text-2xl font-extrabold text-foreground tracking-tight relative">{t("chooseCause")}</h2>
                    <p className="text-sm text-muted-foreground mt-1.5 relative">{t("generosityChanges")}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {CAUSES.map((cause, i) => {
                      const i18nCause = CAUSE_I18N[cause.id] ?? { name: cause.name, desc: cause.desc };
                      return (
                      <motion.button
                        key={cause.id}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i, ...spring }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleSelectCause(cause)}
                        className="flex flex-col items-center gap-2.5 p-5 pb-4 rounded-3xl bg-card ring-1 ring-border/50 hover:ring-primary/30 transition-all duration-200 text-center"
                      >
                        <div className={`bg-gradient-to-br ${cause.gradient} w-14 h-14 rounded-2xl flex items-center justify-center text-white`}>
                          <cause.icon size={26} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight">{i18nCause.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{i18nCause.desc}</p>
                          {causeFunds[cause.name] && (
                            <p className="text-[10px] text-primary font-medium mt-1">
                              ৳{Number(causeFunds[cause.name].total_raised).toLocaleString()} {t("raisedSuffix")}
                            </p>
                          )}
                        </div>
                      </motion.button>
                    );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Amount */}
              {step === "amount" && selectedCause && (
                <motion.div key="amount" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="space-y-6">
                  {/* Compact cause pill */}
                   <div className="flex flex-col items-center gap-1">
                     <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${selectedCause.gradient} text-white text-sm font-medium`}>
                       <selectedCause.icon size={16} />
                       {selectedCause.name}
                     </div>
                     <button onClick={() => { setStep("cause"); setSelectedCause(null); }} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">Change cause</button>
                   </div>

                  {/* Single editable amount field */}
                  <div className="text-center py-6">
                    <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mb-3">Amount</p>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-3xl font-medium text-muted-foreground/50">৳</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amount}
                        onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0"
                        autoFocus
                        className="w-full max-w-[220px] text-5xl font-extrabold text-center bg-transparent border-b-2 border-transparent focus:border-primary/40 outline-none transition-all text-foreground placeholder:text-muted-foreground/30 tabular-nums tracking-tight"
                      />
                    </div>
                  </div>

                  {/* Preset pills */}
                  <div className="flex gap-2 justify-center">
                    {PRESET_AMOUNTS.map(a => (
                      <motion.button
                        key={a}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setAmount(String(a))}
                        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                          amount === String(a)
                            ? `bg-gradient-to-r ${selectedCause.gradient} text-white shadow-lg scale-105`
                            : "bg-muted/40 text-foreground ring-1 ring-border/40 hover:ring-border"
                        }`}
                      >
                        ৳{a}
                      </motion.button>
                    ))}
                  </div>

                  {/* Collapsible message */}
                  <div>
                    <button
                      onClick={() => setMsgExpanded(!msgExpanded)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mx-auto"
                    >
                      {msgExpanded ? "Hide message" : "Add a message (optional)"}
                    </button>
                    <AnimatePresence>
                      {msgExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                          <textarea
                            placeholder="Leave a kind note…"
                            value={message}
                            onChange={e => setMessage(e.target.value.slice(0, 200))}
                            rows={2}
                            className="w-full rounded-2xl bg-muted/20 ring-1 ring-border/40 focus:ring-2 focus:ring-primary/30 outline-none px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none transition-all"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Toggle rows */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between py-3 px-1">
                      <div className="flex items-center gap-2.5">
                        <EyeOff size={15} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">Donate anonymously</span>
                      </div>
                      <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                    </div>
                    <div className="h-px bg-border/30" />
                    <div className="flex items-center justify-between py-3 px-1">
                      <div className="flex items-center gap-2.5">
                        <RefreshCw size={15} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">Make this recurring</span>
                      </div>
                      <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
                    </div>
                  </div>

                  {/* Frequency */}
                  <AnimatePresence>
                    {isRecurring && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex gap-2">
                          {(["weekly", "monthly", "yearly"] as const).map(f => (
                            <button
                              key={f}
                              onClick={() => setFrequency(f)}
                              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                frequency === f
                                  ? "bg-primary text-primary-foreground shadow-sm"
                                  : "bg-muted/30 text-muted-foreground ring-1 ring-border/30"
                              }`}
                            >
                              {f === "weekly" ? "Weekly" : f === "monthly" ? "Monthly" : "Yearly"}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CTA */}
                  <button
                    onClick={handleAmountNext}
                    disabled={!amount || parseFloat(amount) < 10}
                    className={`w-full py-4 rounded-2xl font-bold text-base disabled:opacity-30 transition-all active:scale-[0.98] bg-gradient-to-r ${selectedCause.gradient} text-white shadow-xl shadow-black/10`}
                  >
                    Continue — ৳{amount || "0"}
                  </button>
                </motion.div>
              )}

              {/* Step 3: PIN */}
              {step === "pin" && selectedCause && (
                <motion.div key="pin" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3 }} className="mt-6 space-y-8 text-center">
                  {/* Cause pill + amount */}
                  <div className="flex flex-col items-center gap-4">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${selectedCause.gradient} text-white text-sm font-medium`}>
                      <selectedCause.icon size={15} />
                      {selectedCause.name}
                    </div>
                    <p className="text-4xl font-extrabold text-foreground tracking-tight">৳{parseFloat(amount).toLocaleString()}</p>
                    {(isAnonymous || isRecurring) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isAnonymous && <span className="ring-1 ring-border/40 px-2.5 py-1 rounded-full flex items-center gap-1"><EyeOff size={10} /> Anonymous</span>}
                        {isRecurring && <span className="ring-1 ring-border/40 px-2.5 py-1 rounded-full flex items-center gap-1"><RefreshCw size={10} /> {frequency === "weekly" ? "Weekly" : frequency === "yearly" ? "Yearly" : "Monthly"}</span>}
                      </div>
                    )}
                  </div>

                  {/* PIN Entry */}
                  <div onClick={() => pinRef.current?.focus()}>
                    <p className="text-sm text-muted-foreground mb-5">Enter your 4-digit PIN</p>
                    <div className="flex justify-center gap-3">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-200 ${
                            pin.length > i
                              ? `bg-gradient-to-br ${selectedCause.gradient} shadow-md`
                              : pin.length === i
                              ? "ring-2 ring-primary/40 bg-muted/20"
                              : "bg-muted/20 ring-1 ring-border/40"
                          }`}
                        >
                          {pin.length > i && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={spring}
                              className="w-3 h-3 rounded-full bg-white"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <input
                      ref={pinRef}
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="opacity-0 absolute w-0 h-0"
                      autoFocus
                    />
                  </div>

                  {/* Confirm */}
                  <button
                    onClick={handlePinSubmit}
                    disabled={pin.length !== 4 || loading}
                    className={`w-full py-4 rounded-2xl font-bold text-base disabled:opacity-30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-gradient-to-r ${selectedCause.gradient} text-white shadow-xl shadow-black/10`}
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} />}
                    {loading ? "Processing…" : `Confirm ৳${parseFloat(amount).toLocaleString()}`}
                  </button>
                </motion.div>
              )}

              {/* Step 4: Success */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="mt-10 text-center space-y-6">
                  {/* Pulsing ring + check */}
                  <div className="relative w-28 h-28 mx-auto">
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${selectedCause?.gradient || "from-emerald-500 to-teal-600"} opacity-20 animate-ping`} style={{ animationDuration: "2s" }} />
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.15, 1] }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
                      className={`absolute inset-0 rounded-full bg-gradient-to-br ${selectedCause?.gradient || "from-emerald-500 to-teal-600"} flex items-center justify-center shadow-2xl`}
                    >
                      <Check size={52} className="text-white" strokeWidth={3} />
                    </motion.div>
                  </div>

                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="space-y-2">
                    <p className="text-3xl font-extrabold text-foreground">Thank You!</p>
                    <p className="text-muted-foreground text-sm">
                      You donated <span className="font-bold text-foreground">৳{parseFloat(amount).toLocaleString()}</span> to
                    </p>
                    <p className="text-lg font-semibold text-foreground">{selectedCause?.name}</p>
                  </motion.div>

                  {(isAnonymous || isRecurring) && (
                    <div className="flex items-center justify-center gap-2">
                      {isAnonymous && (
                        <span className="text-xs ring-1 ring-border/40 text-muted-foreground px-3 py-1.5 rounded-full flex items-center gap-1">
                          <EyeOff size={11} /> Anonymous
                        </span>
                      )}
                      {isRecurring && (
                        <span className="text-xs ring-1 ring-primary/30 text-primary px-3 py-1.5 rounded-full flex items-center gap-1 font-medium">
                          <RefreshCw size={11} /> {frequency === "weekly" ? "Weekly" : "Monthly"}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2.5 justify-center pt-4">
                    <button
                      onClick={resetFlow}
                      className={`px-6 py-3 rounded-full font-semibold text-sm bg-gradient-to-r ${selectedCause?.gradient || "from-primary to-primary"} text-white shadow-lg active:scale-95 transition-transform flex items-center gap-1.5`}
                    >
                      <Heart size={14} /> Donate Again
                    </button>
                    <button
                      onClick={() => navigate("/")}
                      className="px-5 py-3 rounded-full font-semibold text-sm ring-1 ring-border/40 text-foreground active:scale-95 transition-transform flex items-center gap-1.5 hover:bg-muted/30"
                    >
                      <Home size={14} /> Home
                    </button>
                    <button
                      onClick={() => setShareOpen(true)}
                      className="px-5 py-3 rounded-full font-semibold text-sm ring-1 ring-border/40 text-foreground active:scale-95 transition-transform flex items-center gap-1.5 hover:bg-muted/30"
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
              <div className="text-center py-20 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <RefreshCw size={24} className="opacity-25" />
                </div>
                <p className="text-sm font-medium">No recurring donations</p>
                <p className="text-xs mt-1 text-muted-foreground/60">Set one up in the Donate tab</p>
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {recurringList.map((r, i) => {
                  const cause = causeForIcon(r.cause_name);
                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl bg-card/80 backdrop-blur-sm ring-1 ring-border/40 ${!r.is_active ? "opacity-40" : ""}`}
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
                      <p className="text-sm font-bold text-foreground mr-1 tabular-nums">৳{r.amount}</p>
                      <Switch checked={r.is_active} onCheckedChange={() => toggleRecurringActive(r.id, r.is_active)} className="scale-90" />
                      <button onClick={() => deleteRecurring(r.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center active:scale-90 transition-transform">
                        <Trash2 size={13} className="text-destructive" />
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
              <div className="text-center py-20 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <Heart size={24} className="opacity-25" />
                </div>
                <p className="text-sm font-medium">No donations yet</p>
                <p className="text-xs mt-1 text-muted-foreground/60">Your history will appear here</p>
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                {history.map((d, i) => {
                  const cause = causeForIcon(d.cause_name);
                  return (
                    <motion.div
                      key={d.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/80 backdrop-blur-sm ring-1 ring-border/40"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cause ? `bg-gradient-to-br ${cause.gradient} text-white` : "bg-muted"}`}>
                        {cause ? <cause.icon size={18} /> : (d.cause_icon || "❤️")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{d.cause_name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy, hh:mm a")}</p>
                      </div>
                      <p className="text-sm font-bold text-foreground tabular-nums">৳{d.amount}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Leaderboard Tab ── */}
          <TabsContent value="leaderboard" className="mt-0">
            <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar mb-3">
              <button
                onClick={() => { setLeaderboardCause(null); fetchLeaderboard(null); }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${leaderboardCause === null ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground ring-1 ring-border/30"}`}
              >
                All
              </button>
              {CAUSES.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setLeaderboardCause(c.name); fetchLeaderboard(c.name); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${leaderboardCause === c.name ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground ring-1 ring-border/30"}`}
                >
                  {CAUSE_EMOJI[c.name]} {c.name}
                </button>
              ))}
            </div>

            {leaderboardLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <Trophy size={24} className="opacity-25" />
                </div>
                <p className="text-sm font-medium">No donations recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => {
                  const cause = causeForIcon(entry.cause_name);
                  return (
                    <motion.div
                      key={`${entry.donor_name}-${entry.cause_name}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i }}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-card/80 backdrop-blur-sm ring-1 ring-border/40 relative overflow-hidden"
                    >
                      {/* Top 3 gradient accent bar */}
                      {i < 3 && (
                        <div className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-gradient-to-b ${MEDAL_BAR[i]}`} />
                      )}
                      <div className="w-8 text-center pl-1">
                        {i < 3 ? (
                          <span className="text-lg">{MEDALS[i]}</span>
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                        )}
                      </div>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${cause ? `bg-gradient-to-br ${cause.gradient} text-white` : "bg-muted"}`}>
                        {cause ? <cause.icon size={15} /> : "❤️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {entry.donor_name === "Anonymous" ? "🕶️ Anonymous" : entry.donor_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {entry.cause_name} · {entry.donation_count} donation{entry.donation_count > 1 ? "s" : ""}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-primary tabular-nums">৳{entry.total_amount.toLocaleString()}</p>
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
