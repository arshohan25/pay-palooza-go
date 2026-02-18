import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  CheckCircle2,
  Smartphone,
  AlertCircle,
  Zap,
  Wifi,
  Phone,
  Gift,
  Package,
  PhoneCall,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "number" | "packs" | "pin" | "success";
type PackCategory = "offers" | "minutes" | "internet" | "bundles" | "callrates";

interface Operator {
  name: string;
  short: string;
  gradient: string;
  prefixes: string[];
}

interface Pack {
  id: string;
  name: string;
  details: string;
  validity: string;
  price: number;
  badge?: string;
  highlight?: boolean;
}

// ─── Operator detection ──────────────────────────────────────────────────────
const OPERATORS: Operator[] = [
  { name: "Grameenphone", short: "GP", gradient: "gradient-accent",  prefixes: ["017", "013"] },
  { name: "Robi",         short: "RB", gradient: "gradient-payment", prefixes: ["018"] },
  { name: "Banglalink",   short: "BL", gradient: "gradient-cashout", prefixes: ["019", "014"] },
  { name: "Teletalk",     short: "TT", gradient: "gradient-addmoney",prefixes: ["015"] },
  { name: "Airtel",       short: "AT", gradient: "gradient-send",    prefixes: ["016"] },
];

const detectOperator = (phone: string): Operator | null => {
  const digits = phone.replace(/\D/g, "");
  return OPERATORS.find((op) => op.prefixes.includes(digits.slice(0, 3))) ?? null;
};

// ─── Pack data ───────────────────────────────────────────────────────────────
const PACKS: Record<string, Record<PackCategory, Pack[]>> = {
  Grameenphone: {
    offers: [
      { id: "gp-o1", name: "MyPlan Unlimited", details: "Unlimited calls + 3GB internet", validity: "30 days", price: 399, badge: "Best Value", highlight: true },
      { id: "gp-o2", name: "Special Recharge", details: "500MB data + 50 min any net", validity: "7 days", price: 79, badge: "Popular" },
      { id: "gp-o3", name: "Weekend Pack", details: "2GB weekend data + 30 min", validity: "2 days", price: 49 },
    ],
    minutes: [
      { id: "gp-m1", name: "100 Min Pack",  details: "100 min GP-GP calls",        validity: "7 days",  price: 35 },
      { id: "gp-m2", name: "200 Min Pack",  details: "200 min any net calls",      validity: "14 days", price: 89,  highlight: true },
      { id: "gp-m3", name: "500 Min Pack",  details: "500 min any net + 50 SMS",   validity: "30 days", price: 179, badge: "Popular" },
      { id: "gp-m4", name: "1000 Min Pack", details: "1000 min GP-GP calls",       validity: "30 days", price: 299 },
    ],
    internet: [
      { id: "gp-i1", name: "1GB Pack",   details: "1GB 4G data",              validity: "3 days",  price: 29 },
      { id: "gp-i2", name: "3GB Pack",   details: "3GB 4G data",              validity: "7 days",  price: 69,  highlight: true },
      { id: "gp-i3", name: "10GB Pack",  details: "10GB 4G data",             validity: "30 days", price: 189, badge: "Best Deal" },
      { id: "gp-i4", name: "20GB Pack",  details: "20GB 4G + 10GB night",     validity: "30 days", price: 329 },
      { id: "gp-i5", name: "50GB Pack",  details: "50GB 4G data",             validity: "30 days", price: 699 },
    ],
    bundles: [
      { id: "gp-b1", name: "Starter Bundle",  details: "500MB + 100 min + 50 SMS",   validity: "7 days",  price: 89 },
      { id: "gp-b2", name: "Smart Bundle",    details: "2GB + 300 min + 100 SMS",    validity: "30 days", price: 249, badge: "Popular", highlight: true },
      { id: "gp-b3", name: "Premium Bundle",  details: "5GB + 600 min + 200 SMS",    validity: "30 days", price: 449 },
      { id: "gp-b4", name: "Ultimate Bundle", details: "15GB + Unlimited min + SMS", validity: "30 days", price: 799, badge: "Top Tier" },
    ],
    callrates: [
      { id: "gp-cr1", name: "GP-GP Rate",   details: "0.25 paisa/sec on-net",    validity: "Ongoing", price: 20 },
      { id: "gp-cr2", name: "Any Net Rate", details: "0.60 paisa/sec off-net",   validity: "Ongoing", price: 30 },
      { id: "gp-cr3", name: "FnF Pack",     details: "10 FnF at 0.10 paisa/sec", validity: "30 days", price: 25, highlight: true },
    ],
  },
  Robi: {
    offers: [
      { id: "rb-o1", name: "Robi Unlimited", details: "Unlimited calls + 2GB data",  validity: "30 days", price: 349, badge: "Best Value", highlight: true },
      { id: "rb-o2", name: "Robi Weekly",    details: "500MB + 100 min any net",     validity: "7 days",  price: 69,  badge: "Popular" },
      { id: "rb-o3", name: "Robi Daily",     details: "150MB + 30 min",              validity: "1 day",   price: 19 },
    ],
    minutes: [
      { id: "rb-m1", name: "50 Min Pack",   details: "50 min Robi-Robi",      validity: "3 days",  price: 20 },
      { id: "rb-m2", name: "150 Min Pack",  details: "150 min any net",       validity: "7 days",  price: 59,  highlight: true },
      { id: "rb-m3", name: "400 Min Pack",  details: "400 min any net",       validity: "28 days", price: 149, badge: "Popular" },
      { id: "rb-m4", name: "800 Min Pack",  details: "800 min Robi-Robi",     validity: "30 days", price: 259 },
    ],
    internet: [
      { id: "rb-i1", name: "500MB Pack", details: "500MB 4G data",        validity: "3 days",  price: 24 },
      { id: "rb-i2", name: "2GB Pack",   details: "2GB 4G data",          validity: "7 days",  price: 59,  highlight: true },
      { id: "rb-i3", name: "8GB Pack",   details: "8GB 4G data",          validity: "30 days", price: 169, badge: "Best Deal" },
      { id: "rb-i4", name: "15GB Pack",  details: "15GB 4G + 5GB night",  validity: "30 days", price: 299 },
    ],
    bundles: [
      { id: "rb-b1", name: "Mini Bundle",    details: "300MB + 60 min + 30 SMS",  validity: "7 days",  price: 69 },
      { id: "rb-b2", name: "Value Bundle",   details: "1.5GB + 250 min + 80 SMS", validity: "30 days", price: 199, highlight: true, badge: "Popular" },
      { id: "rb-b3", name: "Super Bundle",   details: "4GB + 500 min + 150 SMS",  validity: "30 days", price: 399 },
    ],
    callrates: [
      { id: "rb-cr1", name: "Robi-Robi",   details: "0.20 paisa/sec on-net",  validity: "Ongoing", price: 18 },
      { id: "rb-cr2", name: "Any Network", details: "0.55 paisa/sec off-net", validity: "Ongoing", price: 28, highlight: true },
      { id: "rb-cr3", name: "FnF 5",       details: "5 FnF at 0.15 paisa/sec",validity: "30 days", price: 20 },
    ],
  },
  Banglalink: {
    offers: [
      { id: "bl-o1", name: "BL Freedom Pack", details: "Unlimited calls + 3GB data",  validity: "30 days", price: 379, badge: "Best Value", highlight: true },
      { id: "bl-o2", name: "BL Weekly Star",  details: "500MB + 120 min any net",     validity: "7 days",  price: 75,  badge: "Popular" },
      { id: "bl-o3", name: "BL Daily",        details: "100MB + 20 min",              validity: "1 day",   price: 17 },
    ],
    minutes: [
      { id: "bl-m1", name: "75 Min Pack",   details: "75 min BL-BL calls",    validity: "5 days",  price: 25 },
      { id: "bl-m2", name: "180 Min Pack",  details: "180 min any net",       validity: "10 days", price: 69, highlight: true },
      { id: "bl-m3", name: "450 Min Pack",  details: "450 min any net",       validity: "30 days", price: 159, badge: "Popular" },
      { id: "bl-m4", name: "900 Min Pack",  details: "900 min BL-BL",        validity: "30 days", price: 289 },
    ],
    internet: [
      { id: "bl-i1", name: "500MB Pack",  details: "500MB 4G data",       validity: "3 days",  price: 22 },
      { id: "bl-i2", name: "2.5GB Pack",  details: "2.5GB 4G data",       validity: "7 days",  price: 65, highlight: true },
      { id: "bl-i3", name: "9GB Pack",    details: "9GB 4G data",         validity: "30 days", price: 175, badge: "Best Deal" },
      { id: "bl-i4", name: "18GB Pack",   details: "18GB 4G + 8GB night", validity: "30 days", price: 310 },
    ],
    bundles: [
      { id: "bl-b1", name: "Combo Saver",   details: "400MB + 80 min + 40 SMS",   validity: "7 days",  price: 79 },
      { id: "bl-b2", name: "Combo Plus",    details: "2GB + 280 min + 100 SMS",   validity: "30 days", price: 229, highlight: true, badge: "Popular" },
      { id: "bl-b3", name: "Mega Combo",    details: "5GB + 550 min + 180 SMS",   validity: "30 days", price: 419 },
    ],
    callrates: [
      { id: "bl-cr1", name: "BL-BL Rate",  details: "0.22 paisa/sec on-net",  validity: "Ongoing", price: 19 },
      { id: "bl-cr2", name: "Other Net",   details: "0.58 paisa/sec off-net", validity: "Ongoing", price: 29, highlight: true },
      { id: "bl-cr3", name: "FnF 8",       details: "8 FnF at 0.12 paisa/sec",validity: "30 days", price: 22 },
    ],
  },
  Teletalk: {
    offers: [
      { id: "tt-o1", name: "Agami Pack",     details: "Unlimited calls + 1GB data",  validity: "30 days", price: 299, badge: "Best Value", highlight: true },
      { id: "tt-o2", name: "Smart Weekly",   details: "300MB + 80 min",              validity: "7 days",  price: 55,  badge: "Popular" },
      { id: "tt-o3", name: "Daily Value",    details: "80MB + 15 min",               validity: "1 day",   price: 15 },
    ],
    minutes: [
      { id: "tt-m1", name: "60 Min Pack",   details: "60 min TT-TT calls",    validity: "5 days",  price: 22 },
      { id: "tt-m2", name: "150 Min Pack",  details: "150 min any net",       validity: "10 days", price: 55, highlight: true },
      { id: "tt-m3", name: "350 Min Pack",  details: "350 min any net",       validity: "30 days", price: 139, badge: "Popular" },
    ],
    internet: [
      { id: "tt-i1", name: "300MB Pack",  details: "300MB 4G data",    validity: "3 days",  price: 19 },
      { id: "tt-i2", name: "1.5GB Pack",  details: "1.5GB 4G data",    validity: "7 days",  price: 49, highlight: true },
      { id: "tt-i3", name: "6GB Pack",    details: "6GB 4G data",      validity: "30 days", price: 149, badge: "Best Deal" },
    ],
    bundles: [
      { id: "tt-b1", name: "Basic Bundle",  details: "250MB + 50 min + 20 SMS",  validity: "7 days",  price: 59 },
      { id: "tt-b2", name: "Value Bundle",  details: "1GB + 200 min + 60 SMS",   validity: "30 days", price: 179, highlight: true, badge: "Popular" },
    ],
    callrates: [
      { id: "tt-cr1", name: "TT-TT Rate",  details: "0.18 paisa/sec on-net",  validity: "Ongoing", price: 15, highlight: true },
      { id: "tt-cr2", name: "Other Net",   details: "0.50 paisa/sec off-net", validity: "Ongoing", price: 25 },
    ],
  },
  Airtel: {
    offers: [
      { id: "at-o1", name: "Airtel Infinity", details: "Unlimited calls + 4GB data",  validity: "30 days", price: 429, badge: "Best Value", highlight: true },
      { id: "at-o2", name: "Weekly Champ",    details: "600MB + 130 min any net",     validity: "7 days",  price: 79,  badge: "Popular" },
      { id: "at-o3", name: "Daily Boost",     details: "120MB + 25 min",              validity: "1 day",   price: 18 },
    ],
    minutes: [
      { id: "at-m1", name: "80 Min Pack",   details: "80 min Airtel-Airtel",   validity: "5 days",  price: 28 },
      { id: "at-m2", name: "200 Min Pack",  details: "200 min any net",        validity: "14 days", price: 79, highlight: true },
      { id: "at-m3", name: "500 Min Pack",  details: "500 min any net",        validity: "30 days", price: 169, badge: "Popular" },
    ],
    internet: [
      { id: "at-i1", name: "750MB Pack",  details: "750MB 4G data",       validity: "3 days",  price: 27 },
      { id: "at-i2", name: "3GB Pack",    details: "3GB 4G data",         validity: "7 days",  price: 69, highlight: true },
      { id: "at-i3", name: "12GB Pack",   details: "12GB 4G data",        validity: "30 days", price: 199, badge: "Best Deal" },
      { id: "at-i4", name: "25GB Pack",   details: "25GB 4G + 12GB night",validity: "30 days", price: 349 },
    ],
    bundles: [
      { id: "at-b1", name: "Starter Pack",  details: "400MB + 90 min + 45 SMS",   validity: "7 days",  price: 79 },
      { id: "at-b2", name: "Smart Pack",    details: "2GB + 320 min + 110 SMS",   validity: "30 days", price: 259, highlight: true, badge: "Popular" },
      { id: "at-b3", name: "Pro Pack",      details: "6GB + 650 min + 200 SMS",   validity: "30 days", price: 469 },
    ],
    callrates: [
      { id: "at-cr1", name: "Airtel-Airtel",details: "0.23 paisa/sec on-net",  validity: "Ongoing", price: 20 },
      { id: "at-cr2", name: "Any Network",  details: "0.57 paisa/sec off-net", validity: "Ongoing", price: 27, highlight: true },
      { id: "at-cr3", name: "FnF 6",        details: "6 FnF at 0.13 paisa/sec",validity: "30 days", price: 22 },
    ],
  },
};

const CATEGORIES: { id: PackCategory; label: string; icon: typeof Wifi }[] = [
  { id: "offers",    label: "My Offers",  icon: Star },
  { id: "minutes",   label: "Minutes",    icon: Phone },
  { id: "internet",  label: "Internet",   icon: Wifi },
  { id: "bundles",   label: "Bundles",    icon: Package },
  { id: "callrates", label: "Call Rates", icon: PhoneCall },
];

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS: Step[] = ["number", "packs", "pin"];
const STEP_LABELS: Record<Step, string> = {
  number: "Number",
  packs:  "Pack",
  pin:    "PIN",
  success:"Done",
};

// ─── Slide animation ─────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

// ─── Native PIN input ─────────────────────────────────────────────────────────
interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; }
const PinInput = ({ pin, onChange, error }: PinInputProps) => (
  <div className="space-y-5">
    <div className="flex justify-center gap-4">
      {[0,1,2,3].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: pin.length > i ? 1.15 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-5 h-5 rounded-full border-2 transition-colors ${
            pin.length > i ? "gradient-accent border-transparent shadow-md" : "border-muted-foreground/40 bg-transparent"
          }`}
        />
      ))}
    </div>
    {error && (
      <p className="text-xs text-destructive flex items-center justify-center gap-1">
        <AlertCircle size={12} /> {error}
      </p>
    )}
    <input
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      value={pin}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      autoFocus
      className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/30"
      placeholder="••••"
    />
  </div>
);

const generateTxnId = () =>
  "RCH" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).toUpperCase().slice(2, 5);

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
};

// ─── MobileRechargeFlow ──────────────────────────────────────────────────────
interface MobileRechargeFlowProps { onClose: () => void; }

const MobileRechargeFlow = ({ onClose }: MobileRechargeFlowProps) => {
  const [step, setStep]           = useState<Step>("number");
  const [direction, setDirection] = useState(1);
  const [phone, setPhone]         = useState("");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [activeCategory, setActiveCategory] = useState<PackCategory>("offers");
  const [pin, setPin]             = useState("");
  const [error, setError]         = useState("");
  const txnTime = useRef(new Date());
  const txnId   = useRef(generateTxnId());

  const stepIndex = STEPS.indexOf(step);
  const operator  = detectOperator(phone);
  const operatorPacks = operator ? PACKS[operator.name] : null;

  const goTo = (next: Step) => {
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    if (step === "number") { onClose(); return; }
    if (step === "packs")  { goTo("number"); return; }
    if (step === "pin")    { goTo("packs"); return; }
  };

  const handleNumberContinue = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) { setError("Enter an 11-digit mobile number."); return; }
    if (!operator) { setError("Unable to detect operator. Please check the number."); return; }
    setSelectedPack(null);
    setCustomAmount("");
    setActiveCategory("offers");
    goTo("packs");
  };

  const handlePackSelect = (pack: Pack) => {
    setSelectedPack(pack);
    setCustomAmount("");
    setError("");
  };

  const handleCustomAmountChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setCustomAmount(digits);
    if (digits) { setSelectedPack(null); }
    setError("");
  };

  // Derived: effective price for footer/PIN/receipt
  const customAmountNum = customAmount ? parseInt(customAmount, 10) : 0;
  const effectivePrice  = selectedPack ? selectedPack.price : customAmountNum;
  const effectiveName   = selectedPack ? selectedPack.name : `Custom Recharge · ৳${customAmountNum}`;
  const isCustom        = !selectedPack && !!customAmount;

  const handlePackContinue = () => {
    if (!selectedPack && !customAmount) {
      setError("Please select a pack or enter a custom amount.");
      return;
    }
    if (isCustom) {
      if (customAmountNum < 20)   { setError("Minimum recharge amount is ৳20."); return; }
      if (customAmountNum > 1000) { setError("Maximum recharge amount is ৳1,000."); return; }
    }
    goTo("pin");
  };

  const handlePinConfirm = () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    txnTime.current = new Date();
    txnId.current   = generateTxnId();
    setDirection(1);
    setStep("success");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">
      {/* Header */}
      {step !== "success" && (
        <div className="gradient-accent px-4 pt-6 pb-8 text-primary-foreground">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">Mobile Recharge</h1>
              <p className="text-xs text-white/70 mt-0.5">All Operators · Instant</p>
            </div>
          </div>
          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </div>
      )}

      {/* Animated step content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="popLayout">
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-0 overflow-y-auto"
          >

            {/* ── STEP 1: Number ── */}
            {step === "number" && (
              <div className="px-4 pt-6 pb-32 space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Mobile Number</label>
                  <div className="relative">
                    <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="017X-XXXX-XXXX"
                      value={formatPhone(phone)}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
                        setError("");
                      }}
                      className="pl-9 h-12 text-base bg-card border-border tracking-wide"
                    />
                  </div>

                  {/* Live operator badge */}
                  <AnimatePresence>
                    {phone.length >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card"
                      >
                        {operator ? (
                          <>
                            <div className={`${operator.gradient} w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                              {operator.short}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground">Detected operator</p>
                              <p className="text-sm font-bold text-foreground">{operator.name}</p>
                            </div>
                            <CheckCircle2 size={18} className="text-primary shrink-0" />
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Smartphone size={18} className="text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">Unknown operator</p>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  <Button className="w-full h-11 gradient-accent border-0 text-white font-semibold" onClick={handleNumberContinue}>
                    See Offers & Packs
                  </Button>
                </div>

                {/* Operator guide */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Operator prefixes</p>
                  <div className="grid grid-cols-1 gap-2">
                    {OPERATORS.map((op) => (
                      <div key={op.name} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-card border border-border">
                        <div className={`${op.gradient} w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                          {op.short}
                        </div>
                        <span className="text-sm font-semibold text-foreground flex-1">{op.name}</span>
                        <span className="text-xs text-muted-foreground">{op.prefixes.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Packs ── */}
            {step === "packs" && operator && operatorPacks && (
              <div className="flex flex-col h-full">
                {/* Operator pill */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card">
                    <div className={`${operator.gradient} w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {operator.short}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Recharging</p>
                      <p className="text-sm font-bold text-foreground">{formatPhone(phone)} · {operator.name}</p>
                    </div>
                  </div>
                </div>

                {/* Custom amount – above tabs */}
                <div className="px-4 pb-3">
                  <div className={`rounded-2xl border-2 transition-all p-4 space-y-3 ${
                    isCustom ? "border-primary bg-primary/5" : "border-dashed border-border bg-card"
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 border-muted-foreground/30">
                        {isCustom && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                      <p className="text-sm font-semibold text-foreground">Custom Amount</p>
                      <span className="text-[10px] text-muted-foreground ml-auto">৳20 – ৳1,000</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">৳</span>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        placeholder="Enter amount"
                        value={customAmount}
                        onChange={(e) => handleCustomAmountChange(e.target.value)}
                        className="pl-7 h-11 text-base font-bold bg-background border-border"
                      />
                    </div>
                    {customAmount && (customAmountNum < 20 || customAmountNum > 1000) && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle size={11} />
                        {customAmountNum < 20 ? "Minimum is ৳20" : "Maximum is ৳1,000"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category tab bar */}
                <div className="px-4 pb-2">
                  <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-1">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const active = activeCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => { setActiveCategory(cat.id); setError(""); }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                            active
                              ? "gradient-accent text-white shadow-card"
                              : "bg-card border border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon size={12} />
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pack list */}
                <div className="flex-1 overflow-y-auto px-4 pb-40 space-y-3">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeCategory}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-2 pt-1"
                    >
                      {operatorPacks[activeCategory].map((pack) => {
                        const selected = selectedPack?.id === pack.id;
                        return (
                          <motion.button
                            key={pack.id}
                            onClick={() => handlePackSelect(pack)}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left p-4 rounded-2xl border transition-all ${
                              selected
                                ? "border-primary bg-primary/5 shadow-elevated"
                                : "border-border bg-card shadow-card"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-foreground">{pack.name}</p>
                                  {pack.badge && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      pack.highlight ? "gradient-accent text-white" : "bg-muted text-muted-foreground"
                                    }`}>
                                      {pack.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{pack.details}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />
                                  Valid {pack.validity}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <p className="text-lg font-extrabold text-foreground">৳{pack.price}</p>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                                }`}>
                                  {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </AnimatePresence>

                </div>

                {/* Sticky footer */}
                <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-4 space-y-2">
                  {(selectedPack || (isCustom && customAmountNum >= 20 && customAmountNum <= 1000)) && (
                    <div className="flex items-center justify-between text-sm px-1">
                      <span className="text-muted-foreground font-medium">
                        {selectedPack ? selectedPack.name : "Custom Recharge"}
                      </span>
                      <span className="font-bold text-foreground">৳{effectivePrice}</span>
                    </div>
                  )}
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1 px-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  <Button
                    className="w-full h-11 gradient-accent border-0 text-white font-semibold"
                    onClick={handlePackContinue}
                  >
                    {selectedPack
                      ? `Continue · ৳${selectedPack.price}`
                      : isCustom && customAmountNum >= 20 && customAmountNum <= 1000
                      ? `Continue · ৳${customAmountNum}`
                      : "Select a Pack or Enter Amount"}
                  </Button>
                </div>
              </div>
            )}

            {/* ── STEP 3: PIN ── */}
            {step === "pin" && (selectedPack || isCustom) && (
              <div className="px-4 pt-8 pb-32 space-y-8">
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground">Confirm with PIN</p>
                  <p className="text-xs text-muted-foreground">
                    {effectiveName} for{" "}
                    <span className="font-bold text-foreground">{formatPhone(phone)}</span>
                  </p>
                </div>

                <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Number</span>
                    <span className="font-semibold text-foreground">{formatPhone(phone)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Operator</span>
                    <span className="font-semibold text-foreground">{operator?.name}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Type</span>
                    <span className="font-semibold text-foreground">
                      {selectedPack ? selectedPack.name : "Custom Recharge"}
                    </span>
                  </div>
                  {selectedPack && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Details</span>
                        <span className="font-semibold text-foreground text-right max-w-[55%]">{selectedPack.details}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Validity</span>
                        <span className="font-semibold text-foreground">{selectedPack.validity}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service fee</span>
                    <span className="font-semibold text-primary">Free</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>Total from balance</span>
                    <span>৳{effectivePrice}</span>
                  </div>
                </div>

                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <div className="px-4">
                  <Button
                    className="w-full h-11 gradient-accent border-0 text-white font-semibold"
                    onClick={handlePinConfirm}
                    disabled={pin.length < 4}
                  >
                    Confirm Recharge
                  </Button>
                </div>
              </div>
            )}

            {/* ── SUCCESS ── */}
            {step === "success" && (selectedPack || isCustom) && (
              <div className="min-h-screen flex flex-col">
                <div className="gradient-accent px-4 pt-8 pb-10 text-white text-center">
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4"
                  >
                    <Zap size={36} className="text-white" />
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <p className="text-lg font-bold">Recharge Successful!</p>
                    <p className="text-4xl font-extrabold mt-1">৳{effectivePrice}</p>
                    <p className="text-white/80 text-sm mt-1">{operator?.name} · {formatPhone(phone)}</p>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex-1 px-4 py-6 space-y-4"
                >
                  <div className="rounded-2xl bg-card border border-border shadow-card p-4 space-y-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Receipt</p>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Transaction ID</span>
                      <span className="font-mono font-bold text-foreground text-xs">{txnId.current}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Date & Time</span>
                      <span className="font-semibold text-foreground text-xs">
                        {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                        {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between text-muted-foreground">
                      <span>Number</span>
                      <span className="font-semibold text-foreground">{formatPhone(phone)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Operator</span>
                      <span className="font-semibold text-foreground">{operator?.name}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Type</span>
                      <span className="font-semibold text-foreground">
                        {selectedPack ? selectedPack.name : "Custom Recharge"}
                      </span>
                    </div>
                    {selectedPack && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Details</span>
                          <span className="font-semibold text-foreground text-right max-w-[55%]">{selectedPack.details}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Validity</span>
                          <span className="font-semibold text-foreground">{selectedPack.validity}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Service fee</span>
                      <span className="font-semibold text-primary">Free</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Deducted from balance</span>
                      <span>৳{effectivePrice}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full h-11 gradient-accent border-0 text-white font-semibold"
                    onClick={onClose}
                  >
                    Done
                  </Button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MobileRechargeFlow;
