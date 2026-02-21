import { useState, useRef, useEffect } from "react";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { recordTransaction } from "@/lib/balanceStore";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";
import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import {
  ChevronLeft,
  CheckCircle2,
  Smartphone,
  AlertCircle,
  Wifi,
  Phone,
  Package,
  PhoneCall,
  Clock,
  ChevronRight,
  Flame,
  Coins,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "number" | "packs" | "amount" | "pin" | "success";
type OfferType = "drive" | "regular";
type SubCategory = "internet" | "minutes" | "bundles" | "callrates";

interface OperatorDef {
  name: string;
  short: string;
  brandColor: string;
  brandColorDark: string;
  prefixes: string[];
}

interface Pack {
  id: string;
  name: string;
  details: string;
  validity: string;
  price: number;
  badge?: string;
  tag?: "Hot" | "New" | "Limited" | "Popular";
  highlight?: boolean;
  type: OfferType;
  subCategory?: SubCategory;
  cashback?: number; // only Drive packs — commission amount in ৳
}

// ─── Operator definitions ────────────────────────────────────────────────────
const OPERATORS: OperatorDef[] = [
  { name: "Grameenphone", short: "GP", brandColor: "#00A651", brandColorDark: "#007A3C", prefixes: ["017", "013"] },
  { name: "Robi",         short: "RB", brandColor: "#E40046", brandColorDark: "#A8003A", prefixes: ["018"] },
  { name: "Banglalink",   short: "BL", brandColor: "#F47920", brandColorDark: "#C05A10", prefixes: ["019", "014"] },
  { name: "Teletalk",     short: "TT", brandColor: "#004B98", brandColorDark: "#003674", prefixes: ["015"] },
  { name: "Airtel",       short: "AT", brandColor: "#E40073", brandColorDark: "#A80055", prefixes: ["016"] },
];

const detectOperator = (phone: string): OperatorDef | null => {
  const digits = phone.replace(/\D/g, "");
  return OPERATORS.find((op) => op.prefixes.includes(digits.slice(0, 3))) ?? null;
};

// ─── Operator Logo Component ──────────────────────────────────────────────────
const OperatorLogo = ({ op, size = "md" }: { op: OperatorDef; size?: "xs" | "sm" | "md" | "lg" | "xl" }) => {
  const sizes = {
    xs: "w-8 h-8",
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-20 h-20",
  };
  const textSizes: Record<string, string> = {
    xs: "text-[8px]",
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm",
  };

  const logos: Record<string, string> = {
    GP: "/operators/gp.png",
    RB: "/operators/robi.png",
    BL: "/operators/bl.png",
    TT: "/operators/tt.png",
    AT: "/operators/airtel.png",
  };

  return (
    <div
      className={`${sizes[size]} rounded-2xl flex flex-col items-center justify-center font-black shadow-lg overflow-hidden shrink-0`}
      style={{ background: `linear-gradient(135deg, ${op.brandColor}, ${op.brandColorDark})` }}
    >
      <img
        src={logos[op.short]}
        alt={op.name}
        className="w-[65%] h-[65%] object-contain drop-shadow-md"
        onError={(e) => {
          // Fallback to text if image fails
          const parent = (e.target as HTMLElement).parentElement;
          if (parent) {
            (e.target as HTMLElement).style.display = "none";
            const span = document.createElement("span");
            span.className = "text-white font-black";
            span.textContent = op.short;
            parent.appendChild(span);
          }
        }}
      />
    </div>
  );
};

// ─── Pack Data ────────────────────────────────────────────────────────────────
const PACKS: Record<string, Pack[]> = {
  Grameenphone: [
    // ── Drive (earn cashback) ──
    { id: "gp-d1", name: "MyPlan Unlimited",  details: "Unlimited calls + 10GB data + 200 SMS", validity: "30 days", price: 399, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive", cashback: 20 },
    { id: "gp-d2", name: "Weekend Blast",      details: "5GB weekend + 100 min any net",         validity: "3 days",  price: 79,  badge: "Limited",   tag: "Limited", highlight: true,  type: "drive", cashback: 5  },
    { id: "gp-d3", name: "GP Exclusive Deal",  details: "3GB + 200 min + 1GB night bonus",       validity: "10 days", price: 149, badge: "New",       tag: "New",     highlight: false, type: "drive", cashback: 8  },
    { id: "gp-d4", name: "Super Saver 7",      details: "7GB high-speed + 120 min + 80 SMS",     validity: "7 days",  price: 189, badge: "Popular",   tag: "Popular", highlight: false, type: "drive", cashback: 10 },
    // ── Regular – Internet ──
    { id: "gp-i1", name: "1GB Starter",   details: "1GB 4G data",               validity: "3 days",  price: 29,  type: "regular", subCategory: "internet" },
    { id: "gp-i2", name: "3GB Weekly",    details: "3GB 4G data",               validity: "7 days",  price: 69,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "gp-i3", name: "10GB Monthly",  details: "10GB 4G data",              validity: "30 days", price: 189, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "gp-i4", name: "20GB+ Monthly", details: "20GB 4G + 10GB night data", validity: "30 days", price: 329, type: "regular", subCategory: "internet" },
    { id: "gp-i5", name: "50GB Max",      details: "50GB 4G data, no throttle", validity: "30 days", price: 699, type: "regular", subCategory: "internet" },
    // ── Regular – Minutes ──
    { id: "gp-m1", name: "100 Min",  details: "100 min GP-GP calls",       validity: "7 days",  price: 35,  type: "regular", subCategory: "minutes" },
    { id: "gp-m2", name: "200 Min",  details: "200 min any network",       validity: "14 days", price: 89,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "gp-m3", name: "500 Min",  details: "500 min any net + 50 SMS",  validity: "30 days", price: 179, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "gp-m4", name: "1000 Min", details: "1000 min GP-GP",            validity: "30 days", price: 299, type: "regular", subCategory: "minutes" },
    // ── Regular – Bundles ──
    { id: "gp-b1", name: "Starter Bundle",  details: "500MB + 100 min + 50 SMS",   validity: "7 days",  price: 89,  type: "regular", subCategory: "bundles" },
    { id: "gp-b2", name: "Smart Bundle",    details: "2GB + 300 min + 100 SMS",    validity: "30 days", price: 249, type: "regular", subCategory: "bundles", badge: "Popular", highlight: true },
    { id: "gp-b3", name: "Premium Bundle",  details: "5GB + 600 min + 200 SMS",    validity: "30 days", price: 449, type: "regular", subCategory: "bundles" },
    { id: "gp-b4", name: "Ultimate Bundle", details: "15GB + Unlimited min & SMS", validity: "30 days", price: 799, type: "regular", subCategory: "bundles", badge: "Top Tier" },
    // ── Regular – Call Rates ──
    { id: "gp-cr1", name: "GP-GP Rate",   details: "0.25 paisa/sec on-net",     validity: "Ongoing", price: 20, type: "regular", subCategory: "callrates" },
    { id: "gp-cr2", name: "Any Net Rate", details: "0.60 paisa/sec off-net",    validity: "Ongoing", price: 30, type: "regular", subCategory: "callrates" },
    { id: "gp-cr3", name: "FnF Pack",     details: "10 FnF at 0.10 paisa/sec", validity: "30 days", price: 25, type: "regular", subCategory: "callrates", highlight: true },
  ],
  Robi: [
    { id: "rb-d1", name: "Robi Unlimited",  details: "Unlimited calls + 8GB data + 150 SMS", validity: "30 days", price: 349, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive", cashback: 18 },
    { id: "rb-d2", name: "Robi Weekend",    details: "3GB weekend + 80 min any net",          validity: "3 days",  price: 65,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive", cashback: 4  },
    { id: "rb-d3", name: "Robi Smart Deal", details: "2GB + 180 min + 1GB night bonus",       validity: "10 days", price: 129, badge: "New",       tag: "New",     highlight: false, type: "drive", cashback: 7  },
    { id: "rb-d4", name: "Robi Weekly Pro", details: "5GB + 100 min + 60 SMS",                validity: "7 days",  price: 159, badge: "Popular",   tag: "Popular", highlight: true,  type: "drive", cashback: 9  },
    { id: "rb-i1", name: "500MB Pack",    details: "500MB 4G data",          validity: "3 days",  price: 24,  type: "regular", subCategory: "internet" },
    { id: "rb-i2", name: "2GB Weekly",    details: "2GB 4G data",            validity: "7 days",  price: 59,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "rb-i3", name: "8GB Monthly",   details: "8GB 4G data",            validity: "30 days", price: 169, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "rb-i4", name: "15GB+ Monthly", details: "15GB 4G + 5GB night",    validity: "30 days", price: 299, type: "regular", subCategory: "internet" },
    { id: "rb-m1", name: "50 Min",  details: "50 min Robi-Robi",  validity: "3 days",  price: 20,  type: "regular", subCategory: "minutes" },
    { id: "rb-m2", name: "150 Min", details: "150 min any net",   validity: "7 days",  price: 59,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "rb-m3", name: "400 Min", details: "400 min any net",   validity: "28 days", price: 149, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "rb-m4", name: "800 Min", details: "800 min Robi-Robi", validity: "30 days", price: 259, type: "regular", subCategory: "minutes" },
    { id: "rb-b1", name: "Mini Bundle",  details: "300MB + 60 min + 30 SMS",  validity: "7 days",  price: 69,  type: "regular", subCategory: "bundles" },
    { id: "rb-b2", name: "Value Bundle", details: "1.5GB + 250 min + 80 SMS", validity: "30 days", price: 199, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    { id: "rb-b3", name: "Super Bundle", details: "4GB + 500 min + 150 SMS",  validity: "30 days", price: 399, type: "regular", subCategory: "bundles" },
    { id: "rb-cr1", name: "Robi-Robi",   details: "0.20 paisa/sec on-net",    validity: "Ongoing", price: 18, type: "regular", subCategory: "callrates" },
    { id: "rb-cr2", name: "Any Network", details: "0.55 paisa/sec off-net",   validity: "Ongoing", price: 28, type: "regular", subCategory: "callrates", highlight: true },
    { id: "rb-cr3", name: "FnF 5",       details: "5 FnF at 0.15 paisa/sec", validity: "30 days", price: 20, type: "regular", subCategory: "callrates" },
  ],
  Banglalink: [
    { id: "bl-d1", name: "BL Freedom Pack", details: "Unlimited calls + 9GB data + 200 SMS", validity: "30 days", price: 379, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive", cashback: 19 },
    { id: "bl-d2", name: "BL Weekly Star",  details: "4GB weekend + 120 min any net",         validity: "3 days",  price: 75,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive", cashback: 5  },
    { id: "bl-d3", name: "BL Flash Offer",  details: "2.5GB + 200 min + 80 SMS",              validity: "10 days", price: 139, badge: "New",       tag: "New",     highlight: false, type: "drive", cashback: 7  },
    { id: "bl-d4", name: "BL Social Pack",  details: "5GB social media + 100 min",            validity: "7 days",  price: 169, badge: "Popular",   tag: "Popular", highlight: true,  type: "drive", cashback: 9  },
    { id: "bl-i1", name: "500MB Starter", details: "500MB 4G data",       validity: "3 days",  price: 22,  type: "regular", subCategory: "internet" },
    { id: "bl-i2", name: "2.5GB Weekly",  details: "2.5GB 4G data",       validity: "7 days",  price: 65,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "bl-i3", name: "9GB Monthly",   details: "9GB 4G data",         validity: "30 days", price: 175, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "bl-i4", name: "18GB+ Monthly", details: "18GB 4G + 8GB night", validity: "30 days", price: 310, type: "regular", subCategory: "internet" },
    { id: "bl-m1", name: "75 Min",  details: "75 min BL-BL calls",  validity: "5 days",  price: 25,  type: "regular", subCategory: "minutes" },
    { id: "bl-m2", name: "180 Min", details: "180 min any network",  validity: "10 days", price: 69,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "bl-m3", name: "450 Min", details: "450 min any net",      validity: "30 days", price: 159, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "bl-m4", name: "900 Min", details: "900 min BL-BL",        validity: "30 days", price: 289, type: "regular", subCategory: "minutes" },
    { id: "bl-b1", name: "Combo Saver", details: "400MB + 80 min + 40 SMS",  validity: "7 days",  price: 79,  type: "regular", subCategory: "bundles" },
    { id: "bl-b2", name: "Combo Plus",  details: "2GB + 280 min + 100 SMS",  validity: "30 days", price: 229, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    { id: "bl-b3", name: "Mega Combo",  details: "5GB + 550 min + 180 SMS",  validity: "30 days", price: 419, type: "regular", subCategory: "bundles" },
    { id: "bl-cr1", name: "BL-BL Rate", details: "0.22 paisa/sec on-net",   validity: "Ongoing", price: 19, type: "regular", subCategory: "callrates" },
    { id: "bl-cr2", name: "Other Net",  details: "0.58 paisa/sec off-net",  validity: "Ongoing", price: 29, type: "regular", subCategory: "callrates", highlight: true },
    { id: "bl-cr3", name: "FnF 8",      details: "8 FnF at 0.12 paisa/sec", validity: "30 days", price: 22, type: "regular", subCategory: "callrates" },
  ],
  Teletalk: [
    { id: "tt-d1", name: "Agami Unlimited", details: "Unlimited calls + 5GB data + 100 SMS", validity: "30 days", price: 299, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive", cashback: 15 },
    { id: "tt-d2", name: "Smart Weekend",   details: "2GB weekend + 80 min",                  validity: "3 days",  price: 55,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive", cashback: 3  },
    { id: "tt-d3", name: "Student Special", details: "1.5GB + 150 min + 50 SMS",              validity: "7 days",  price: 89,  badge: "New",       tag: "New",     highlight: false, type: "drive", cashback: 5  },
    { id: "tt-i1", name: "300MB Starter", details: "300MB 4G data", validity: "3 days",  price: 19,  type: "regular", subCategory: "internet" },
    { id: "tt-i2", name: "1.5GB Weekly",  details: "1.5GB 4G data", validity: "7 days",  price: 49,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "tt-i3", name: "6GB Monthly",   details: "6GB 4G data",   validity: "30 days", price: 149, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "tt-m1", name: "60 Min",  details: "60 min TT-TT calls", validity: "5 days",  price: 22,  type: "regular", subCategory: "minutes" },
    { id: "tt-m2", name: "150 Min", details: "150 min any net",    validity: "10 days", price: 55,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "tt-m3", name: "350 Min", details: "350 min any net",    validity: "30 days", price: 139, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "tt-b1", name: "Basic Bundle", details: "250MB + 50 min + 20 SMS", validity: "7 days",  price: 59,  type: "regular", subCategory: "bundles" },
    { id: "tt-b2", name: "Value Bundle", details: "1GB + 200 min + 60 SMS",  validity: "30 days", price: 179, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    { id: "tt-cr1", name: "TT-TT Rate",  details: "0.18 paisa/sec on-net",  validity: "Ongoing", price: 15, type: "regular", subCategory: "callrates", highlight: true },
    { id: "tt-cr2", name: "Other Net",   details: "0.50 paisa/sec off-net", validity: "Ongoing", price: 25, type: "regular", subCategory: "callrates" },
  ],
  Airtel: [
    { id: "at-d1", name: "Airtel Infinity",  details: "Unlimited calls + 12GB data + 200 SMS", validity: "30 days", price: 429, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive", cashback: 22 },
    { id: "at-d2", name: "Weekly Champ",     details: "4GB + 130 min any net",                  validity: "7 days",  price: 99,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive", cashback: 6  },
    { id: "at-d3", name: "Airtel Exclusive", details: "3GB + 250 min + 1GB social",             validity: "10 days", price: 159, badge: "New",       tag: "New",     highlight: false, type: "drive", cashback: 8  },
    { id: "at-d4", name: "Daily Boost Pro",  details: "2GB + 60 min + unlimited SMS",           validity: "5 days",  price: 89,  badge: "Popular",   tag: "Popular", highlight: true,  type: "drive", cashback: 5  },
    { id: "at-i1", name: "750MB Starter",  details: "750MB 4G data",        validity: "3 days",  price: 27,  type: "regular", subCategory: "internet" },
    { id: "at-i2", name: "3GB Weekly",     details: "3GB 4G data",          validity: "7 days",  price: 69,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "at-i3", name: "12GB Monthly",   details: "12GB 4G data",         validity: "30 days", price: 199, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "at-i4", name: "25GB+ Monthly",  details: "25GB 4G + 12GB night", validity: "30 days", price: 349, type: "regular", subCategory: "internet" },
    { id: "at-m1", name: "80 Min",  details: "80 min Airtel-Airtel", validity: "5 days",  price: 28,  type: "regular", subCategory: "minutes" },
    { id: "at-m2", name: "200 Min", details: "200 min any net",      validity: "14 days", price: 79,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "at-m3", name: "500 Min", details: "500 min any net",      validity: "30 days", price: 169, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "at-b1", name: "Starter Pack", details: "400MB + 90 min + 45 SMS",  validity: "7 days",  price: 79,  type: "regular", subCategory: "bundles" },
    { id: "at-b2", name: "Smart Pack",   details: "2GB + 320 min + 110 SMS",  validity: "30 days", price: 259, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    { id: "at-b3", name: "Pro Pack",     details: "6GB + 650 min + 200 SMS",  validity: "30 days", price: 469, type: "regular", subCategory: "bundles" },
    { id: "at-cr1", name: "Airtel-Airtel", details: "0.23 paisa/sec on-net",   validity: "Ongoing", price: 20, type: "regular", subCategory: "callrates" },
    { id: "at-cr2", name: "Any Network",   details: "0.57 paisa/sec off-net",  validity: "Ongoing", price: 27, type: "regular", subCategory: "callrates", highlight: true },
    { id: "at-cr3", name: "FnF 6",         details: "6 FnF at 0.13 paisa/sec", validity: "30 days", price: 22, type: "regular", subCategory: "callrates" },
  ],
};

// ─── Sub-category config ──────────────────────────────────────────────────────
const SUB_CATEGORIES: { id: SubCategory; label: string; icon: typeof Wifi }[] = [
  { id: "internet",  label: "Internet",   icon: Wifi },
  { id: "minutes",   label: "Minutes",    icon: Phone },
  { id: "bundles",   label: "Bundles",    icon: Package },
  { id: "callrates", label: "Call Rates", icon: PhoneCall },
];

// ─── Tag badge colour map ─────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  Hot:     "bg-red-500 text-white",
  Limited: "bg-amber-500 text-white",
  New:     "bg-blue-500 text-white",
  Popular: "bg-emerald-500 text-white",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STEPS: Step[] = ["number", "amount", "pin"];
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

const generateTxnId = () => {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r = "";
  for (let i = 0; i < 12; i++) r += CHARS[Math.floor(Math.random() * 36)];
  return r;
};

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

// ─── PIN Input ────────────────────────────────────────────────────────────────
interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; accentColor: string; }
const PinInput = ({ pin, onChange, error, accentColor }: PinInputProps) => (
  <div className="space-y-5">
    <div className="flex justify-center gap-5">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          animate={{ scale: pin.length > i ? 1.2 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className={`w-4 h-4 rounded-full border-2 transition-all ${pin.length > i ? "border-transparent shadow-md" : "border-muted-foreground/30 bg-transparent"}`}
          style={pin.length > i ? { background: accentColor } : {}}
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
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
        if (v.length > pin.length) haptics.light();
        onChange(v);
      }}
      autoFocus
      className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none transition-colors placeholder:text-muted-foreground/30"
      placeholder="••••"
    />
  </div>
);

// ─── MobileRechargeFlow ───────────────────────────────────────────────────────
interface MobileRechargeFlowProps { onClose: () => void; }

const MobileRechargeFlow = ({ onClose }: MobileRechargeFlowProps) => {
  const { t } = useI18n();
  const [step, setStep]               = useState<Step>("number");
  const [direction, setDirection]     = useState(1);
  const [phone, setPhone]             = useState("");
  const [selectedOp, setSelectedOp]   = useState<OperatorDef | null>(null); // operator for packs screen
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [offerType, setOfferType]     = useState<OfferType>("drive");
  const [subCategory, setSubCategory] = useState<SubCategory>("internet");
  const [pin, setPin]                 = useState("");
  const [error, setError]             = useState("");
  const [showShare, setShowShare]     = useState(false);
  const txnTime = useRef(new Date());
  const txnId   = useRef(generateTxnId());

  useEffect(() => { if (step === "success") { fireSuccessConfetti(); addTxnNotif(); } }, [step]);

  const stepIndex = STEPS.indexOf(step);
  // The operator used throughout - either detected from phone or explicitly chosen
  const detectedOp = detectOperator(phone);
  const operator   = selectedOp ?? detectedOp;
  const allPacks   = operator ? (PACKS[operator.name] ?? []) : [];
  const drivePacks = allPacks.filter((p) => p.type === "drive");
  const regularPacks = allPacks.filter((p) => p.type === "regular" && p.subCategory === subCategory);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "number") { onClose(); return; }
    if (step === "packs")  { setSelectedPack(null); setCustomAmount(""); goTo("number"); return; }
    if (step === "amount") { goTo("number"); return; }
    if (step === "pin")    { goTo("amount"); return; }
  };

  // Step 1 → Step 2: Continue goes straight to amount (skip packs)
  const handleNumberContinue = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) { setError("Enter an 11-digit mobile number."); return; }
    if (!detectedOp) { setError("Unable to detect operator. Check the number."); return; }
    setSelectedOp(detectedOp);
    setCustomAmount("");
    goTo("amount");
  };

  // Tap an operator card → go to packs (browse offers)
  const handleOperatorTap = (op: OperatorDef) => {
    setSelectedOp(op);
    if (detectedOp?.short !== op.short) {
      setPhone(op.prefixes[0] + "00000000");
    }
    setSelectedPack(null);
    setCustomAmount("");
    setOfferType("drive");
    setSubCategory("internet");
    setError("");
    haptics.medium();
    setDirection(1);
    setStep("packs");
  };

  const handlePackSelect = (pack: Pack) => {
    setSelectedPack(pack);
    setCustomAmount(String(pack.price));
    setError("");
    haptics.light();
  };

  // Packs → Amount (only when browsing via operator card tap)
  const handlePackContinue = () => {
    if (!selectedPack) { setError("Please select a pack to continue."); return; }
    goTo("amount");
  };

  const customAmountNum = customAmount ? parseInt(customAmount, 10) : 0;
  const effectivePrice  = customAmountNum > 0 ? customAmountNum : 0;
  const effectiveName   = selectedPack ? selectedPack.name : "Custom Recharge";

  // Amount → PIN
  const handleAmountContinue = () => {
    if (!customAmount || customAmountNum < 20) { setError("Enter a valid amount (min ৳20)."); return; }
    if (customAmountNum > 1000) { setError("Maximum amount is ৳1,000."); return; }
    goTo("pin");
  };

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    if (processing) return;
    setProcessing(true);
    haptics.success();
    txnTime.current = new Date();
    txnId.current   = generateTxnId();
    await recordTransaction({
      type: "recharge",
      amount: effectivePrice,
      fee: 0,
      recipientPhone: phone,
      recipientName: detectedOp?.name,
      reference: txnId.current,
      description: selectedPack ? selectedPack.name : `Recharge ৳${effectivePrice}`,
    });
    showTxnToast({ type: "Mobile Recharge", amount: `৳${effectivePrice.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-accent" });
    setDirection(1);
    setStep("success");
  };

  const headerBg = operator
    ? `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})`
    : "linear-gradient(135deg, hsl(0 74% 50%), hsl(0 74% 38%))";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      {step !== "success" && (
        <motion.div
          className="px-4 pt-3 pb-3 text-white shrink-0"
          style={{ background: headerBg }}
          layout
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-white/20 ring-1 ring-white/30 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight">{t("flowRecharge")}</h1>
              <p className="text-xs text-white/70 mt-0.5">
                {operator && step !== "number" ? `${operator.name} · ${t("instantTopUp")}` : t("selectOperatorOrNumber")}
              </p>
            </div>
            {operator && step !== "number" && (
              <OperatorLogo op={operator} size="sm" />
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 28 }}
            />
          </div>
        </motion.div>
      )}

      {/* ── Animated step content ── */}
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
            className="absolute inset-0 overflow-y-auto scrollbar-none"
          >

            {/* ══════════════════════════════════════════════
                STEP 1 — NUMBER ENTRY
            ══════════════════════════════════════════════ */}
            {step === "number" && (
              <div className="px-4 pt-5 pb-10 space-y-5">

                {/* Phone input + continue */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Mobile Number</label>
                  <div className="relative">
                    <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="017X-XXXX-XXXX"
                      value={formatPhone(phone)}
                      onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); setError(""); }}
                      className="pl-9 h-12 text-base bg-card border-border tracking-wide"
                    />
                  </div>

                  {/* Live operator detection badge */}
                  <AnimatePresence>
                    {phone.length >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-sm"
                      >
                        {detectedOp ? (
                          <>
                            <OperatorLogo op={detectedOp} size="xs" />
                            <div className="flex-1">
                              <p className="text-[10px] text-muted-foreground leading-none">Detected operator</p>
                              <p className="text-sm font-bold text-foreground">{detectedOp.name}</p>
                            </div>
                            <CheckCircle2 size={18} className="text-primary shrink-0" />
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <Smartphone size={16} className="text-muted-foreground" />
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

                  {/* Primary Continue CTA */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleNumberContinue}
                    className="w-full h-13 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all"
                    style={{ background: "linear-gradient(135deg, hsl(0 74% 50%), hsl(0 74% 38%))", minHeight: 52 }}
                  >
                    Continue
                    <ChevronRight size={18} />
                  </motion.button>
                </div>

                {/* Operator cards */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Browse by operator</p>
                  <div className="space-y-2">
                    {OPERATORS.map((op) => (
                      <motion.button
                        key={op.name}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleOperatorTap(op)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border shadow-sm active:border-primary/30 transition-all text-left"
                      >
                        <OperatorLogo op={op} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{op.name}</p>
                          <p className="text-xs text-muted-foreground">{op.prefixes.join(", ")}</p>
                        </div>
                        {/* Drive cashback hint on operator card */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
                            <Coins size={9} />
                            Drive
                          </div>
                          <ChevronRight size={14} className="text-muted-foreground" />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 2 — PACKS (offers under operator)
            ══════════════════════════════════════════════ */}
            {step === "packs" && operator && (
              <div className="flex flex-col h-full">

                {/* Recharging info strip */}
                <div className="px-4 pt-2 pb-2 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-none">Recharging</p>
                      <p className="text-sm font-bold text-foreground truncate">{formatPhone(phone)}</p>
                    </div>
                  </div>
                  <AvailableBalanceBadge />
                </div>

                {/* Drive / Regular tabs */}
                <div className="px-4 pb-3 shrink-0">
                  <div className="flex bg-muted rounded-2xl p-1 gap-1">
                    <button
                      onClick={() => { setOfferType("drive"); setError(""); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        offerType === "drive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      <Flame size={14} className={offerType === "drive" ? "text-amber-500" : ""} />
                      ⚡ Drive
                    </button>
                    <button
                      onClick={() => { setOfferType("regular"); setError(""); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        offerType === "regular" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      <Package size={14} className={offerType === "regular" ? "text-primary" : ""} />
                      Regular
                    </button>
                  </div>

                  {/* Drive explanation badge */}
                  <AnimatePresence>
                    {offerType === "drive" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2">
                          <Coins size={14} className="text-amber-600 shrink-0" />
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                            Drive packs earn you cashback commission credited to your wallet.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sub-category pills — Regular only */}
                <AnimatePresence>
                  {offerType === "regular" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-3 overflow-hidden shrink-0"
                    >
                      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {SUB_CATEGORIES.map((cat) => {
                          const Icon = cat.icon;
                          const active = subCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => { setSubCategory(cat.id); setError(""); }}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 border ${
                                active ? "text-white border-transparent shadow-md" : "bg-card border-border text-muted-foreground"
                              }`}
                              style={active ? { background: operator.brandColor } : {}}
                            >
                              <Icon size={11} />
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pack list — scrollable */}
                <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-36">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={offerType + subCategory}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.14 }}
                      className="space-y-3 pt-1"
                    >
                      {/* ── Drive Packs ── */}
                      {offerType === "drive" && drivePacks.map((pack) => {
                        const sel = selectedPack?.id === pack.id;
                        return (
                          <motion.button
                            key={pack.id}
                            onClick={() => handlePackSelect(pack)}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left rounded-2xl overflow-hidden border-2 transition-all ${
                              sel ? "shadow-lg" : "border-border shadow-sm"
                            }`}
                            style={sel ? { borderColor: operator.brandColor } : {}}
                          >
                            {/* Accent bar */}
                            <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${operator.brandColor}, ${operator.brandColorDark})` }} />
                            <div className="p-4 bg-card">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <p className="text-sm font-extrabold text-foreground">{pack.name}</p>
                                    {pack.tag && (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TAG_COLORS[pack.tag]}`}>
                                        {pack.tag}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">{pack.details}</p>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <Clock size={10} /> {pack.validity}
                                    </span>
                                    {/* Cashback badge — Drive only */}
                                    {pack.cashback && (
                                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                                        <Coins size={9} />
                                        Earn ৳{pack.cashback} cashback
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <p className="text-xl font-extrabold text-foreground">৳{pack.price}</p>
                                  <div
                                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                                    style={sel
                                      ? { borderColor: operator.brandColor, background: operator.brandColor }
                                      : { borderColor: "hsl(var(--muted-foreground)/0.3)" }
                                    }
                                  >
                                    {sel && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}

                      {/* ── Regular Packs ── */}
                      {offerType === "regular" && regularPacks.map((pack) => {
                        const sel = selectedPack?.id === pack.id;
                        return (
                          <motion.button
                            key={pack.id}
                            onClick={() => handlePackSelect(pack)}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                              sel ? "shadow-lg" : "border-border bg-card shadow-sm"
                            }`}
                            style={sel ? { borderColor: operator.brandColor, background: `${operator.brandColor}10` } : {}}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-foreground">{pack.name}</p>
                                  {pack.badge && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      pack.highlight ? "text-white" : "bg-muted text-muted-foreground"
                                    }`}
                                      style={pack.highlight ? { background: operator.brandColor } : {}}
                                    >
                                      {pack.badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{pack.details}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Clock size={9} /> {pack.validity}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <p className="text-lg font-extrabold text-foreground">৳{pack.price}</p>
                                <div
                                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                                  style={sel
                                    ? { borderColor: operator.brandColor, background: operator.brandColor }
                                    : { borderColor: "hsl(var(--muted-foreground)/0.3)" }
                                  }
                                >
                                  {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}

                      {offerType === "regular" && regularPacks.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                          No packs available in this category.
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Sticky bottom — Continue */}
                <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border px-4 py-4 space-y-2 shrink-0">
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1 px-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  {selectedPack && (
                    <div className="flex items-center justify-between text-sm px-1 pb-1">
                      <span className="text-muted-foreground font-medium truncate max-w-[65%]">{selectedPack.name}</span>
                      <div className="flex items-center gap-2">
                        {selectedPack.cashback && (
                          <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5">
                            <Coins size={10} />+৳{selectedPack.cashback}
                          </span>
                        )}
                        <span className="font-extrabold text-foreground">৳{selectedPack.price}</span>
                      </div>
                    </div>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePackContinue}
                    className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all"
                    style={{ background: selectedPack
                      ? `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})`
                      : "hsl(var(--muted))",
                      color: selectedPack ? "white" : "hsl(var(--muted-foreground))"
                    }}
                  >
                    {selectedPack ? `Continue · ৳${selectedPack.price}` : "Select a Pack"}
                    {selectedPack && <ChevronRight size={18} />}
                  </motion.button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 3 — AMOUNT
            ══════════════════════════════════════════════ */}
            {step === "amount" && operator && (
              <div className="px-4 pt-6 pb-10 space-y-5">

                {/* Operator + phone summary */}
                <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${operator.brandColor}, ${operator.brandColorDark})` }} />
                  <div className="bg-card p-4">
                    <div className="flex items-center gap-3">
                      <OperatorLogo op={operator} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-foreground">{operator.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPhone(phone)}</p>
                        {selectedPack && (
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-[11px] text-foreground font-semibold">{selectedPack.name}</span>
                            {selectedPack.cashback && (
                              <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                <Coins size={9} /> Earn ৳{selectedPack.cashback}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Recharge Amount</label>
                  <p className="text-xs text-muted-foreground">Enter any amount between ৳10 and ৳2,000</p>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">৳</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="0"
                      autoFocus
                      value={customAmount}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCustomAmount(v);
                        setError("");
                      }}
                      className="w-full h-16 pl-9 pr-4 text-2xl font-extrabold bg-card border-2 border-border rounded-2xl focus:outline-none transition-colors text-foreground"
                      style={{ borderColor: customAmountNum >= 10 ? operator.brandColor : undefined }}
                    />
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Min ৳10 · Max ৳2,000</p>

                  {/* Quick amount pills */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {[50, 100, 199, 299, 399, 499].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => { setCustomAmount(String(amt)); setError(""); haptics.light(); }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-card text-foreground hover:border-primary/40 active:scale-95 transition-all"
                        style={customAmountNum === amt ? { borderColor: operator.brandColor, color: operator.brandColor } : {}}
                      >
                        ৳{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balance */}
                <div className="flex justify-center">
                  <AvailableBalanceBadge />
                </div>

                {/* Continue to PIN */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAmountContinue}
                  className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` }}
                >
                  Continue · ৳{customAmountNum > 0 ? customAmountNum : "—"}
                  <ChevronRight size={18} />
                </motion.button>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 4 — PIN
            ══════════════════════════════════════════════ */}
            {step === "pin" && operator && (
              <div className="px-4 pt-8 pb-10 space-y-6">
                {/* Summary card */}
                <div className="rounded-2xl overflow-hidden shadow-sm border border-border">
                  <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${operator.brandColor}, ${operator.brandColorDark})` }} />
                  <div className="bg-card p-4 space-y-3 text-sm">
                    <div className="flex items-center gap-3 pb-3 border-b border-border">
                      <OperatorLogo op={operator} size="xs" />
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-foreground">{effectiveName}</p>
                        <p className="text-xs text-muted-foreground">{operator.name} · {formatPhone(phone)}</p>
                      </div>
                      <p className="text-xl font-extrabold text-foreground">৳{effectivePrice}</p>
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
                        {selectedPack.cashback && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Drive Cashback</span>
                            <span className="font-bold text-amber-600 flex items-center gap-1">
                              <Coins size={11} /> +৳{selectedPack.cashback}
                            </span>
                          </div>
                        )}
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
                </div>

                {/* PIN entry */}
                <div className="space-y-1 text-center">
                  <p className="text-sm font-semibold text-foreground">Enter your 4-digit PIN</p>
                  <p className="text-xs text-muted-foreground">Authorize this recharge</p>
                </div>
                <PinInput
                  pin={pin}
                  onChange={(p) => { setPin(p); setError(""); }}
                  error={error}
                  accentColor={operator.brandColor}
                />
                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label="Slide to Recharge"
                  gradient="gradient-accent"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                />
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 5 — SUCCESS
            ══════════════════════════════════════════════ */}
            {step === "success" && operator && (
              <div className="min-h-screen flex flex-col">
                {/* Hero */}
                <div className="px-4 pt-10 pb-12 text-white text-center" style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` }}>
                  <div className="flex justify-center mb-5">
                    <OperatorLogo op={operator} size="xl" />
                  </div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
                  >
                    <p className="text-sm font-semibold text-white/80 mb-1">Recharge Successful!</p>
                    <p className="text-5xl font-extrabold">৳{effectivePrice}</p>
                    <p className="text-white/70 text-sm mt-2">{operator.name} · {formatPhone(phone)}</p>
                    {selectedPack?.cashback && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mt-3 inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5"
                      >
                        <Coins size={14} className="text-amber-300" />
                        <span className="text-sm font-bold">৳{selectedPack.cashback} cashback earned!</span>
                      </motion.div>
                    )}
                  </motion.div>
                </div>

                {/* Receipt */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="flex-1 px-4 py-6 space-y-4"
                >
                  <div className="rounded-2xl bg-card border border-border shadow-sm p-4 space-y-3 text-sm">
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
                      <span className="font-semibold text-foreground">{operator.name}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Pack</span>
                      <span className="font-semibold text-foreground">{selectedPack ? selectedPack.name : "Custom"}</span>
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
                        {selectedPack.cashback && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Drive Cashback</span>
                            <span className="font-bold text-amber-600">+৳{selectedPack.cashback}</span>
                          </div>
                        )}
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

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={onClose}
                    className="w-full h-12 rounded-2xl text-white font-bold shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` }}
                  >
                    Done
                  </motion.button>
                  <button
                    onClick={() => setShowShare(true)}
                    className="w-full h-12 rounded-2xl border border-border bg-card text-foreground font-semibold text-sm"
                  >
                    Share Receipt
                  </button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Share Receipt */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Recharge Successful",
          amount: `৳${effectivePrice}`,
          gradient: "gradient-accent",
          txnId: txnId.current,
          rows: [
            { label: "Number",   value: formatPhone(phone) },
            { label: "Operator", value: operator?.name ?? "" },
            { label: "Pack",     value: selectedPack ? selectedPack.name : "Custom" },
            ...(selectedPack ? [
              { label: "Details",  value: selectedPack.details },
              { label: "Validity", value: selectedPack.validity },
              ...(selectedPack.cashback ? [{ label: "Cashback", value: `+৳${selectedPack.cashback}` }] : []),
            ] : []),
            { label: "Fee",      value: "Free" },
            { label: "Date",     value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time",     value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </div>
  );
};

export default MobileRechargeFlow;
