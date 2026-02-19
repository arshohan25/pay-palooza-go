import { useState, useRef, useEffect } from "react";
import { fireSuccessConfetti } from "@/lib/confetti";
import { haptics } from "@/lib/haptics";
import { deductBalance } from "@/lib/balanceStore";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";
import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import {
  ChevronLeft,
  CheckCircle2,
  Smartphone,
  AlertCircle,
  Zap,
  Wifi,
  Phone,
  Package,
  PhoneCall,
  Clock,
  ChevronRight,
  Flame,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "number" | "packs" | "pin" | "success";
type OfferType = "drive" | "regular";
type SubCategory = "internet" | "minutes" | "bundles" | "callrates";

interface OperatorDef {
  name: string;
  short: string;
  logoText: string;
  brandColor: string;
  brandColorDark: string;
  textColor: string;
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
}

// ─── Operator definitions ────────────────────────────────────────────────────
const OPERATORS: OperatorDef[] = [
  { name: "Grameenphone", short: "GP", logoText: "GP", brandColor: "#00A651", brandColorDark: "#007A3C", textColor: "#fff", prefixes: ["017", "013"] },
  { name: "Robi",         short: "RB", logoText: "Robi", brandColor: "#E40046", brandColorDark: "#A8003A", textColor: "#fff", prefixes: ["018"] },
  { name: "Banglalink",   short: "BL", logoText: "BL",   brandColor: "#F47920", brandColorDark: "#C05A10", textColor: "#fff", prefixes: ["019", "014"] },
  { name: "Teletalk",     short: "TT", logoText: "TT",   brandColor: "#004B98", brandColorDark: "#003674", textColor: "#fff", prefixes: ["015"] },
  { name: "Airtel",       short: "AT", logoText: "AT",   brandColor: "#E40073", brandColorDark: "#A80055", textColor: "#fff", prefixes: ["016"] },
];

const detectOperator = (phone: string): OperatorDef | null => {
  const digits = phone.replace(/\D/g, "");
  return OPERATORS.find((op) => op.prefixes.includes(digits.slice(0, 3))) ?? null;
};

// ─── Operator Logo Component ──────────────────────────────────────────────────
const OperatorLogo = ({ op, size = "md" }: { op: OperatorDef; size?: "xs" | "sm" | "md" | "lg" | "xl" }) => {
  const sizes = {
    xs: "w-8 h-8 text-[10px]",
    sm: "w-10 h-10 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base",
    xl: "w-20 h-20 text-lg",
  };

  // Operator-specific SVG logos
  if (op.short === "GP") {
    return (
      <div className={`${sizes[size]} rounded-2xl flex items-center justify-center font-black shadow-lg overflow-hidden shrink-0`}
        style={{ background: `linear-gradient(135deg, ${op.brandColor}, ${op.brandColorDark})` }}>
        <svg viewBox="0 0 40 40" className="w-full h-full p-1.5" fill="none">
          <circle cx="20" cy="20" r="13" stroke="white" strokeWidth="3.5" fill="none" />
          <path d="M20 13 L20 20 L26 20" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="20" r="2.5" fill="white" />
        </svg>
      </div>
    );
  }

  if (op.short === "RB") {
    return (
      <div className={`${sizes[size]} rounded-2xl flex items-center justify-center font-black shadow-lg overflow-hidden shrink-0`}
        style={{ background: `linear-gradient(135deg, ${op.brandColor}, ${op.brandColorDark})` }}>
        <svg viewBox="0 0 40 40" className="w-full h-full p-2" fill="none">
          <text x="20" y="27" textAnchor="middle" fill="white" fontSize="16" fontWeight="900" fontFamily="Arial">Robi</text>
        </svg>
      </div>
    );
  }

  if (op.short === "BL") {
    return (
      <div className={`${sizes[size]} rounded-2xl flex items-center justify-center font-black shadow-lg overflow-hidden shrink-0`}
        style={{ background: `linear-gradient(135deg, ${op.brandColor}, ${op.brandColorDark})` }}>
        <svg viewBox="0 0 40 40" className="w-full h-full p-1.5" fill="none">
          <path d="M10 30 L20 10 L30 30" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M14 24 L26 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (op.short === "TT") {
    return (
      <div className={`${sizes[size]} rounded-2xl flex items-center justify-center font-black shadow-lg overflow-hidden shrink-0`}
        style={{ background: `linear-gradient(135deg, ${op.brandColor}, ${op.brandColorDark})` }}>
        <svg viewBox="0 0 40 40" className="w-full h-full p-1.5" fill="none">
          <rect x="8" y="11" width="24" height="4" rx="2" fill="white" />
          <rect x="17" y="11" width="6" height="19" rx="2" fill="white" />
          <rect x="8" y="25" width="11" height="4" rx="2" fill="white" />
          <rect x="21" y="25" width="11" height="4" rx="2" fill="white" />
        </svg>
      </div>
    );
  }

  // Airtel
  return (
    <div className={`${sizes[size]} rounded-2xl flex items-center justify-center font-black shadow-lg overflow-hidden shrink-0`}
      style={{ background: `linear-gradient(135deg, ${op.brandColor}, ${op.brandColorDark})` }}>
      <svg viewBox="0 0 40 40" className="w-full h-full p-2" fill="none">
        <path d="M8 28 Q20 10 32 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M12 28 Q20 16 28 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <circle cx="20" cy="27" r="2.5" fill="white" />
      </svg>
    </div>
  );
};

// ─── Pack Data ────────────────────────────────────────────────────────────────
const PACKS: Record<string, Pack[]> = {
  Grameenphone: [
    // Drive (Special Offers)
    { id: "gp-d1", name: "MyPlan Unlimited",    details: "Unlimited calls + 10GB data + 200 SMS", validity: "30 days", price: 399, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive" },
    { id: "gp-d2", name: "Weekend Blast",        details: "5GB weekend + 100 min any net",         validity: "3 days",  price: 79,  badge: "Limited",   tag: "Limited", highlight: true,  type: "drive" },
    { id: "gp-d3", name: "GP Exclusive Deal",    details: "3GB + 200 min + bonus 1GB night",       validity: "10 days", price: 149, badge: "New",       tag: "New",     highlight: false, type: "drive" },
    { id: "gp-d4", name: "Super Saver 7",        details: "7GB high-speed + 120 min + 80 SMS",     validity: "7 days",  price: 189, badge: "Popular",   tag: "Popular", highlight: false, type: "drive" },
    // Regular – Internet
    { id: "gp-i1", name: "1GB Starter",    details: "1GB 4G data",                 validity: "3 days",  price: 29,  type: "regular", subCategory: "internet" },
    { id: "gp-i2", name: "3GB Weekly",     details: "3GB 4G data",                 validity: "7 days",  price: 69,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "gp-i3", name: "10GB Monthly",   details: "10GB 4G data",                validity: "30 days", price: 189, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "gp-i4", name: "20GB+ Monthly",  details: "20GB 4G + 10GB night data",   validity: "30 days", price: 329, type: "regular", subCategory: "internet" },
    { id: "gp-i5", name: "50GB Max",       details: "50GB 4G data, no throttle",   validity: "30 days", price: 699, type: "regular", subCategory: "internet" },
    // Regular – Minutes
    { id: "gp-m1", name: "100 Min",   details: "100 min GP-GP calls",        validity: "7 days",  price: 35,  type: "regular", subCategory: "minutes" },
    { id: "gp-m2", name: "200 Min",   details: "200 min any network",        validity: "14 days", price: 89,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "gp-m3", name: "500 Min",   details: "500 min any net + 50 SMS",   validity: "30 days", price: 179, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "gp-m4", name: "1000 Min",  details: "1000 min GP-GP",             validity: "30 days", price: 299, type: "regular", subCategory: "minutes" },
    // Regular – Bundles
    { id: "gp-b1", name: "Starter Bundle",  details: "500MB + 100 min + 50 SMS",      validity: "7 days",  price: 89,  type: "regular", subCategory: "bundles" },
    { id: "gp-b2", name: "Smart Bundle",    details: "2GB + 300 min + 100 SMS",       validity: "30 days", price: 249, type: "regular", subCategory: "bundles", badge: "Popular", highlight: true },
    { id: "gp-b3", name: "Premium Bundle",  details: "5GB + 600 min + 200 SMS",       validity: "30 days", price: 449, type: "regular", subCategory: "bundles" },
    { id: "gp-b4", name: "Ultimate Bundle", details: "15GB + Unlimited min & SMS",    validity: "30 days", price: 799, type: "regular", subCategory: "bundles", badge: "Top Tier" },
    // Regular – Call Rates
    { id: "gp-cr1", name: "GP-GP Rate",   details: "0.25 paisa/sec on-net",     validity: "Ongoing", price: 20, type: "regular", subCategory: "callrates" },
    { id: "gp-cr2", name: "Any Net Rate", details: "0.60 paisa/sec off-net",    validity: "Ongoing", price: 30, type: "regular", subCategory: "callrates" },
    { id: "gp-cr3", name: "FnF Pack",     details: "10 FnF at 0.10 paisa/sec", validity: "30 days", price: 25, type: "regular", subCategory: "callrates", highlight: true },
  ],
  Robi: [
    // Drive
    { id: "rb-d1", name: "Robi Unlimited",   details: "Unlimited calls + 8GB data + 150 SMS", validity: "30 days", price: 349, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive" },
    { id: "rb-d2", name: "Robi Weekend",      details: "3GB weekend + 80 min any net",         validity: "3 days",  price: 65,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive" },
    { id: "rb-d3", name: "Robi Smart Deal",   details: "2GB + 180 min + 1GB night bonus",      validity: "10 days", price: 129, badge: "New",       tag: "New",     highlight: false, type: "drive" },
    { id: "rb-d4", name: "Robi Weekly Pro",   details: "5GB + 100 min + 60 SMS",               validity: "7 days",  price: 159, badge: "Popular",   tag: "Popular", highlight: true,  type: "drive" },
    // Internet
    { id: "rb-i1", name: "500MB Pack",  details: "500MB 4G data",         validity: "3 days",  price: 24, type: "regular", subCategory: "internet" },
    { id: "rb-i2", name: "2GB Weekly",  details: "2GB 4G data",           validity: "7 days",  price: 59, type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "rb-i3", name: "8GB Monthly", details: "8GB 4G data",           validity: "30 days", price: 169, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "rb-i4", name: "15GB+ Monthly",details: "15GB 4G + 5GB night", validity: "30 days", price: 299, type: "regular", subCategory: "internet" },
    // Minutes
    { id: "rb-m1", name: "50 Min",   details: "50 min Robi-Robi",   validity: "3 days",  price: 20,  type: "regular", subCategory: "minutes" },
    { id: "rb-m2", name: "150 Min",  details: "150 min any net",    validity: "7 days",  price: 59,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "rb-m3", name: "400 Min",  details: "400 min any net",    validity: "28 days", price: 149, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "rb-m4", name: "800 Min",  details: "800 min Robi-Robi",  validity: "30 days", price: 259, type: "regular", subCategory: "minutes" },
    // Bundles
    { id: "rb-b1", name: "Mini Bundle",   details: "300MB + 60 min + 30 SMS",   validity: "7 days",  price: 69,  type: "regular", subCategory: "bundles" },
    { id: "rb-b2", name: "Value Bundle",  details: "1.5GB + 250 min + 80 SMS",  validity: "30 days", price: 199, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    { id: "rb-b3", name: "Super Bundle",  details: "4GB + 500 min + 150 SMS",   validity: "30 days", price: 399, type: "regular", subCategory: "bundles" },
    // Call Rates
    { id: "rb-cr1", name: "Robi-Robi",   details: "0.20 paisa/sec on-net",   validity: "Ongoing", price: 18, type: "regular", subCategory: "callrates" },
    { id: "rb-cr2", name: "Any Network", details: "0.55 paisa/sec off-net",  validity: "Ongoing", price: 28, type: "regular", subCategory: "callrates", highlight: true },
    { id: "rb-cr3", name: "FnF 5",       details: "5 FnF at 0.15 paisa/sec",validity: "30 days", price: 20, type: "regular", subCategory: "callrates" },
  ],
  Banglalink: [
    // Drive
    { id: "bl-d1", name: "BL Freedom Pack",  details: "Unlimited calls + 9GB data + 200 SMS", validity: "30 days", price: 379, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive" },
    { id: "bl-d2", name: "BL Weekly Star",   details: "4GB weekend + 120 min any net",         validity: "3 days",  price: 75,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive" },
    { id: "bl-d3", name: "BL Flash Offer",   details: "2.5GB + 200 min + 80 SMS",              validity: "10 days", price: 139, badge: "New",       tag: "New",     highlight: false, type: "drive" },
    { id: "bl-d4", name: "BL Social Pack",   details: "5GB social media + 100 min",            validity: "7 days",  price: 169, badge: "Popular",   tag: "Popular", highlight: true,  type: "drive" },
    // Internet
    { id: "bl-i1", name: "500MB Starter", details: "500MB 4G data",        validity: "3 days",  price: 22,  type: "regular", subCategory: "internet" },
    { id: "bl-i2", name: "2.5GB Weekly",  details: "2.5GB 4G data",        validity: "7 days",  price: 65,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "bl-i3", name: "9GB Monthly",   details: "9GB 4G data",          validity: "30 days", price: 175, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "bl-i4", name: "18GB+ Monthly", details: "18GB 4G + 8GB night",  validity: "30 days", price: 310, type: "regular", subCategory: "internet" },
    // Minutes
    { id: "bl-m1", name: "75 Min",   details: "75 min BL-BL calls",  validity: "5 days",  price: 25,  type: "regular", subCategory: "minutes" },
    { id: "bl-m2", name: "180 Min",  details: "180 min any network", validity: "10 days", price: 69,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "bl-m3", name: "450 Min",  details: "450 min any net",     validity: "30 days", price: 159, type: "regular", subCategory: "minutes", badge: "Popular" },
    { id: "bl-m4", name: "900 Min",  details: "900 min BL-BL",       validity: "30 days", price: 289, type: "regular", subCategory: "minutes" },
    // Bundles
    { id: "bl-b1", name: "Combo Saver",  details: "400MB + 80 min + 40 SMS",   validity: "7 days",  price: 79,  type: "regular", subCategory: "bundles" },
    { id: "bl-b2", name: "Combo Plus",   details: "2GB + 280 min + 100 SMS",   validity: "30 days", price: 229, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    { id: "bl-b3", name: "Mega Combo",   details: "5GB + 550 min + 180 SMS",   validity: "30 days", price: 419, type: "regular", subCategory: "bundles" },
    // Call Rates
    { id: "bl-cr1", name: "BL-BL Rate",  details: "0.22 paisa/sec on-net",   validity: "Ongoing", price: 19, type: "regular", subCategory: "callrates" },
    { id: "bl-cr2", name: "Other Net",   details: "0.58 paisa/sec off-net",  validity: "Ongoing", price: 29, type: "regular", subCategory: "callrates", highlight: true },
    { id: "bl-cr3", name: "FnF 8",       details: "8 FnF at 0.12 paisa/sec", validity: "30 days", price: 22, type: "regular", subCategory: "callrates" },
  ],
  Teletalk: [
    // Drive
    { id: "tt-d1", name: "Agami Unlimited", details: "Unlimited calls + 5GB data + 100 SMS", validity: "30 days", price: 299, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive" },
    { id: "tt-d2", name: "Smart Weekend",   details: "2GB weekend + 80 min",                  validity: "3 days",  price: 55,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive" },
    { id: "tt-d3", name: "Student Special", details: "1.5GB + 150 min + 50 SMS",              validity: "7 days",  price: 89,  badge: "New",       tag: "New",     highlight: false, type: "drive" },
    // Internet
    { id: "tt-i1", name: "300MB Starter", details: "300MB 4G data",  validity: "3 days",  price: 19,  type: "regular", subCategory: "internet" },
    { id: "tt-i2", name: "1.5GB Weekly",  details: "1.5GB 4G data",  validity: "7 days",  price: 49,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "tt-i3", name: "6GB Monthly",   details: "6GB 4G data",    validity: "30 days", price: 149, type: "regular", subCategory: "internet", badge: "Best Deal" },
    // Minutes
    { id: "tt-m1", name: "60 Min",   details: "60 min TT-TT calls", validity: "5 days",  price: 22,  type: "regular", subCategory: "minutes" },
    { id: "tt-m2", name: "150 Min",  details: "150 min any net",    validity: "10 days", price: 55,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "tt-m3", name: "350 Min",  details: "350 min any net",    validity: "30 days", price: 139, type: "regular", subCategory: "minutes", badge: "Popular" },
    // Bundles
    { id: "tt-b1", name: "Basic Bundle",  details: "250MB + 50 min + 20 SMS",  validity: "7 days",  price: 59,  type: "regular", subCategory: "bundles" },
    { id: "tt-b2", name: "Value Bundle",  details: "1GB + 200 min + 60 SMS",   validity: "30 days", price: 179, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    // Call Rates
    { id: "tt-cr1", name: "TT-TT Rate",  details: "0.18 paisa/sec on-net",   validity: "Ongoing", price: 15, type: "regular", subCategory: "callrates", highlight: true },
    { id: "tt-cr2", name: "Other Net",   details: "0.50 paisa/sec off-net",  validity: "Ongoing", price: 25, type: "regular", subCategory: "callrates" },
  ],
  Airtel: [
    // Drive
    { id: "at-d1", name: "Airtel Infinity",  details: "Unlimited calls + 12GB data + 200 SMS", validity: "30 days", price: 429, badge: "Best Value", tag: "Hot",     highlight: true,  type: "drive" },
    { id: "at-d2", name: "Weekly Champ",     details: "4GB + 130 min any net",                  validity: "7 days",  price: 99,  badge: "Limited",   tag: "Limited", highlight: false, type: "drive" },
    { id: "at-d3", name: "Airtel Exclusive", details: "3GB + 250 min + 1GB social",             validity: "10 days", price: 159, badge: "New",       tag: "New",     highlight: false, type: "drive" },
    { id: "at-d4", name: "Daily Boost Pro",  details: "2GB + 60 min + unlimited SMS",           validity: "5 days",  price: 89,  badge: "Popular",   tag: "Popular", highlight: true,  type: "drive" },
    // Internet
    { id: "at-i1", name: "750MB Starter",  details: "750MB 4G data",         validity: "3 days",  price: 27,  type: "regular", subCategory: "internet" },
    { id: "at-i2", name: "3GB Weekly",     details: "3GB 4G data",           validity: "7 days",  price: 69,  type: "regular", subCategory: "internet", highlight: true, badge: "Popular" },
    { id: "at-i3", name: "12GB Monthly",   details: "12GB 4G data",          validity: "30 days", price: 199, type: "regular", subCategory: "internet", badge: "Best Deal" },
    { id: "at-i4", name: "25GB+ Monthly",  details: "25GB 4G + 12GB night",  validity: "30 days", price: 349, type: "regular", subCategory: "internet" },
    // Minutes
    { id: "at-m1", name: "80 Min",   details: "80 min Airtel-Airtel",  validity: "5 days",  price: 28,  type: "regular", subCategory: "minutes" },
    { id: "at-m2", name: "200 Min",  details: "200 min any net",       validity: "14 days", price: 79,  type: "regular", subCategory: "minutes", highlight: true },
    { id: "at-m3", name: "500 Min",  details: "500 min any net",       validity: "30 days", price: 169, type: "regular", subCategory: "minutes", badge: "Popular" },
    // Bundles
    { id: "at-b1", name: "Starter Pack",  details: "400MB + 90 min + 45 SMS",   validity: "7 days",  price: 79,  type: "regular", subCategory: "bundles" },
    { id: "at-b2", name: "Smart Pack",    details: "2GB + 320 min + 110 SMS",   validity: "30 days", price: 259, type: "regular", subCategory: "bundles", highlight: true, badge: "Popular" },
    { id: "at-b3", name: "Pro Pack",      details: "6GB + 650 min + 200 SMS",   validity: "30 days", price: 469, type: "regular", subCategory: "bundles" },
    // Call Rates
    { id: "at-cr1", name: "Airtel-Airtel", details: "0.23 paisa/sec on-net",   validity: "Ongoing", price: 20, type: "regular", subCategory: "callrates" },
    { id: "at-cr2", name: "Any Network",   details: "0.57 paisa/sec off-net",  validity: "Ongoing", price: 27, type: "regular", subCategory: "callrates", highlight: true },
    { id: "at-cr3", name: "FnF 6",         details: "6 FnF at 0.13 paisa/sec", validity: "30 days", price: 22, type: "regular", subCategory: "callrates" },
  ],
};

// ─── Sub-category config ──────────────────────────────────────────────────────
const SUB_CATEGORIES: { id: SubCategory; label: string; icon: typeof Wifi }[] = [
  { id: "internet",  label: "Internet",    icon: Wifi },
  { id: "minutes",   label: "Minutes",     icon: Phone },
  { id: "bundles",   label: "Bundles",     icon: Package },
  { id: "callrates", label: "Call Rates",  icon: PhoneCall },
];

// ─── Tag badge colour map ─────────────────────────────────────────────────────
const TAG_COLORS: Record<string, string> = {
  Hot:     "bg-red-500 text-white",
  Limited: "bg-amber-500 text-white",
  New:     "bg-blue-500 text-white",
  Popular: "bg-emerald-500 text-white",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STEPS: Step[] = ["number", "packs", "pin"];
const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

const generateTxnId = () =>
  "RCH" + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).toUpperCase().slice(2, 5);

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
  const [step, setStep]             = useState<Step>("number");
  const [direction, setDirection]   = useState(1);
  const [phone, setPhone]           = useState("");
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [offerType, setOfferType]   = useState<OfferType>("drive");
  const [subCategory, setSubCategory] = useState<SubCategory>("internet");
  const [pin, setPin]               = useState("");
  const [error, setError]           = useState("");
  const [showShare, setShowShare]   = useState(false);
  const txnTime = useRef(new Date());
  const txnId   = useRef(generateTxnId());

  useEffect(() => { if (step === "success") { fireSuccessConfetti(); addTxnNotif(); } }, [step]);

  const stepIndex  = STEPS.indexOf(step);
  const operator   = detectOperator(phone);
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
    if (step === "packs")  { goTo("number"); return; }
    if (step === "pin")    { goTo("packs"); return; }
  };

  const handleNumberContinue = () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 11) { setError("Enter an 11-digit mobile number."); return; }
    if (!operator) { setError("Unable to detect operator. Check the number."); return; }
    setSelectedPack(null);
    setCustomAmount("");
    setOfferType("drive");
    setSubCategory("internet");
    goTo("packs");
  };

  const handlePackSelect = (pack: Pack) => {
    setSelectedPack(pack);
    setCustomAmount("");
    setError("");
    haptics.light();
  };

  const handleCustomAmountChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    setCustomAmount(digits);
    if (digits) setSelectedPack(null);
    setError("");
  };

  const customAmountNum = customAmount ? parseInt(customAmount, 10) : 0;
  const effectivePrice  = selectedPack ? selectedPack.price : customAmountNum;
  const effectiveName   = selectedPack ? selectedPack.name : `Custom Recharge · ৳${customAmountNum}`;
  const isCustomValid   = !selectedPack && !!customAmount && customAmountNum >= 20 && customAmountNum <= 1000;

  const handlePackContinue = () => {
    if (!selectedPack && !customAmount) { setError("Please select a pack or enter a custom amount."); return; }
    if (!selectedPack && customAmount) {
      if (customAmountNum < 20)   { setError("Minimum recharge amount is ৳20."); return; }
      if (customAmountNum > 1000) { setError("Maximum recharge amount is ৳1,000."); return; }
    }
    goTo("pin");
  };

  const handlePinConfirm = () => {
    if (pin.length < 4) { setError("Enter your 4-digit PIN."); return; }
    haptics.success();
    txnTime.current = new Date();
    txnId.current   = generateTxnId();
    deductBalance(selectedPack ? selectedPack.price : customAmountNum);
    setDirection(1);
    setStep("success");
  };

  // Header gradient using operator brand color
  const headerBg = operator
    ? `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})`
    : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.75))";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col max-w-md mx-auto">

      {/* ── Header ── */}
      {step !== "success" && (
        <motion.div
          className="px-4 pt-3 pb-3 text-white"
          style={{ background: headerBg }}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
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
              <h1 className="text-xl font-extrabold tracking-tight">Mobile Recharge</h1>
              <p className="text-xs text-white/70 mt-0.5">
                {operator ? `${operator.name} · Instant` : "All Operators · Instant"}
              </p>
            </div>
            {operator && step === "packs" && (
              <OperatorLogo op={operator} size="sm" />
            )}
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.5)]"
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
                STEP 1 — NUMBER
            ══════════════════════════════════════════════ */}
            {step === "number" && (
              <div className="px-4 pt-6 pb-10 space-y-6">

                {/* Phone input */}
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

                  {/* Live operator badge */}
                  <AnimatePresence>
                    {phone.length >= 3 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card"
                      >
                        {operator ? (
                          <>
                            <OperatorLogo op={operator} size="sm" />
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

                  {/* Main CTA */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleNumberContinue}
                    className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-elevated flex items-center justify-center gap-2.5 transition-all"
                    style={{ background: "linear-gradient(135deg, hsl(0 74% 55%), hsl(0 74% 42%))" }}
                  >
                    <Zap size={18} className="fill-white" />
                    Continue — See Offers &amp; Packs
                  </motion.button>
                </div>

                {/* Operator cards — tap to browse */}
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Browse by operator</p>
                  <div className="grid grid-cols-1 gap-2">
                    {OPERATORS.map((op) => (
                      <motion.button
                        key={op.name}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          const fakePhone = op.prefixes[0] + "00000000";
                          setPhone(fakePhone);
                          setError("");
                          setSelectedPack(null);
                          setCustomAmount("");
                          setOfferType("drive");
                          setSubCategory("internet");
                          goTo("packs");
                        }}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-card border border-border shadow-card active:border-primary/50 transition-all text-left"
                      >
                        <OperatorLogo op={op} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">{op.name}</p>
                          <p className="text-xs text-muted-foreground">{op.prefixes.join(", ")}</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 2 — PACKS
            ══════════════════════════════════════════════ */}
            {step === "packs" && operator && (
              <div className="flex flex-col h-full">

                {/* Top strip: balance + number */}
                <div className="px-4 pt-2 pb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <OperatorLogo op={operator} size="xs" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground leading-none">Recharging</p>
                      <p className="text-sm font-bold text-foreground truncate">{formatPhone(phone)}</p>
                    </div>
                  </div>
                  <AvailableBalanceBadge />
                </div>

                {/* ── Drive / Regular top tabs ── */}
                <div className="px-4 pb-3">
                  <div className="flex bg-muted rounded-2xl p-1 gap-1">
                    {/* Drive tab */}
                    <button
                      onClick={() => { setOfferType("drive"); setError(""); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        offerType === "drive"
                          ? "bg-card text-foreground shadow-card"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Flame size={15} className={offerType === "drive" ? "text-red-500" : ""} />
                      ⚡ Drive
                    </button>
                    {/* Regular tab */}
                    <button
                      onClick={() => { setOfferType("regular"); setError(""); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        offerType === "regular"
                          ? "bg-card text-foreground shadow-card"
                          : "text-muted-foreground"
                      }`}
                    >
                      <Package size={15} className={offerType === "regular" ? "text-primary" : ""} />
                      📦 Regular
                    </button>
                  </div>
                </div>

                {/* Sub-category pills — only for Regular */}
                <AnimatePresence>
                  {offerType === "regular" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 pb-3 overflow-hidden"
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
                                active
                                  ? "text-white border-transparent shadow-md"
                                  : "bg-card border-border text-muted-foreground"
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
                <div className="flex-1 overflow-y-auto scrollbar-none px-4 pb-40">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={offerType + subCategory}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-3 pt-1"
                    >
                      {/* ── Drive Packs — large feature cards ── */}
                      {offerType === "drive" && drivePacks.map((pack) => {
                        const selected = selectedPack?.id === pack.id;
                        return (
                          <motion.button
                            key={pack.id}
                            onClick={() => handlePackSelect(pack)}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left rounded-2xl transition-all overflow-hidden border-2 ${
                              selected ? "shadow-elevated" : "shadow-card border-border"
                            }`}
                            style={selected ? { borderColor: operator.brandColor } : {}}
                          >
                            {/* Accent top bar */}
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
                                    {pack.highlight && !pack.tag && (
                                      <Sparkles size={12} style={{ color: operator.brandColor }} />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-2">{pack.details}</p>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Clock size={10} />
                                    <span>Valid {pack.validity}</span>
                                  </div>
                                  {pack.badge && (
                                    <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                      style={{ borderColor: operator.brandColor, color: operator.brandColor }}>
                                      {pack.badge}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <p className="text-xl font-extrabold text-foreground">৳{pack.price}</p>
                                  <div
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all`}
                                    style={selected
                                      ? { borderColor: operator.brandColor, background: operator.brandColor }
                                      : { borderColor: "hsl(var(--muted-foreground)/0.3)" }
                                    }
                                  >
                                    {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}

                      {/* ── Regular Packs — standard cards ── */}
                      {offerType === "regular" && regularPacks.map((pack) => {
                        const selected = selectedPack?.id === pack.id;
                        return (
                          <motion.button
                            key={pack.id}
                            onClick={() => handlePackSelect(pack)}
                            whileTap={{ scale: 0.98 }}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                              selected ? "shadow-elevated" : "border-border bg-card shadow-card"
                            }`}
                            style={selected ? { borderColor: operator.brandColor, background: `${operator.brandColor}0A` } : {}}
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
                                  <Clock size={9} />
                                  Valid {pack.validity}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <p className="text-lg font-extrabold text-foreground">৳{pack.price}</p>
                                <div
                                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                                  style={selected
                                    ? { borderColor: operator.brandColor, background: operator.brandColor }
                                    : { borderColor: "hsl(var(--muted-foreground)/0.3)" }
                                  }
                                >
                                  {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}

                      {/* Empty state */}
                      {offerType === "regular" && regularPacks.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                          No packs available in this category.
                        </div>
                      )}

                      {/* Custom amount card */}
                      <div className={`rounded-2xl border-2 transition-all p-4 space-y-3 ${
                        isCustomValid ? "bg-card" : "border-dashed border-border bg-card"
                      }`}
                        style={isCustomValid ? { borderColor: operator.brandColor } : {}}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 border-muted-foreground/30">
                            {isCustomValid && <div className="w-2.5 h-2.5 rounded-full" style={{ background: operator.brandColor }} />}
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
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Sticky bottom — Continue */}
                <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border px-4 py-4 space-y-2">
                  {(selectedPack || isCustomValid) && (
                    <div className="flex items-center justify-between text-sm px-1 pb-1">
                      <span className="text-muted-foreground font-medium truncate max-w-[60%]">
                        {selectedPack ? selectedPack.name : "Custom Recharge"}
                      </span>
                      <span className="font-extrabold text-foreground">৳{effectivePrice}</span>
                    </div>
                  )}
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1 px-1">
                      <AlertCircle size={12} /> {error}
                    </p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePackContinue}
                    className="w-full h-14 rounded-2xl text-white font-bold text-base shadow-elevated flex items-center justify-center gap-2 transition-all"
                    style={{ background: `linear-gradient(135deg, ${operator.brandColor}, ${operator.brandColorDark})` }}
                  >
                    {selectedPack
                      ? `Continue · ৳${selectedPack.price}`
                      : isCustomValid
                      ? `Continue · ৳${customAmountNum}`
                      : "Select a Pack or Enter Amount"}
                    <ChevronRight size={18} className="opacity-80" />
                  </motion.button>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 3 — PIN
            ══════════════════════════════════════════════ */}
            {step === "pin" && (selectedPack || isCustomValid) && (
              <div className="px-4 pt-8 pb-10 space-y-6">
                {/* Summary card */}
                <div className="rounded-2xl overflow-hidden shadow-elevated border border-border">
                  <div className="h-2" style={{ background: `linear-gradient(90deg, ${operator?.brandColor ?? "#000"}, ${operator?.brandColorDark ?? "#000"})` }} />
                  <div className="bg-card p-4 space-y-3 text-sm">
                    <div className="flex items-center gap-3 pb-2 border-b border-border">
                      {operator && <OperatorLogo op={operator} size="xs" />}
                      <div>
                        <p className="font-extrabold text-foreground text-base">{effectiveName}</p>
                        <p className="text-xs text-muted-foreground">{operator?.name} · {formatPhone(phone)}</p>
                      </div>
                      <p className="ml-auto text-xl font-extrabold text-foreground">৳{effectivePrice}</p>
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
                </div>

                {/* PIN entry */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-center text-foreground">Enter your PIN</p>
                  <p className="text-xs text-muted-foreground text-center">Authorize this recharge</p>
                </div>
                <PinInput
                  pin={pin}
                  onChange={(p) => { setPin(p); setError(""); }}
                  error={error}
                  accentColor={operator?.brandColor ?? "hsl(var(--primary))"}
                />

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label="Slide to Recharge"
                  gradient="gradient-accent"
                  disabled={pin.length < 4}
                  pinComplete={pin.length === 4}
                />
              </div>
            )}

            {/* ══════════════════════════════════════════════
                STEP 4 — SUCCESS
            ══════════════════════════════════════════════ */}
            {step === "success" && (selectedPack || isCustomValid) && (
              <div className="min-h-screen flex flex-col">
                {/* Hero */}
                <div className="px-4 pt-8 pb-10 text-white text-center" style={{ background: `linear-gradient(135deg, ${operator?.brandColor}, ${operator?.brandColorDark})` }}>
                  {operator && (
                    <div className="flex justify-center mb-4">
                      <OperatorLogo op={operator} size="xl" />
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
                  >
                    <p className="text-sm font-semibold text-white/80 mb-1">Recharge Successful!</p>
                    <p className="text-5xl font-extrabold">৳{effectivePrice}</p>
                    <p className="text-white/70 text-sm mt-2">{operator?.name} · {formatPhone(phone)}</p>
                  </motion.div>
                </div>

                {/* Receipt */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
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
                      <span>Pack</span>
                      <span className="font-semibold text-foreground">{selectedPack ? selectedPack.name : "Custom Recharge"}</span>
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

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={onClose}
                    className="w-full h-12 rounded-2xl text-white font-bold shadow-elevated"
                    style={{ background: `linear-gradient(135deg, ${operator?.brandColor}, ${operator?.brandColorDark})` }}
                  >
                    Done
                  </motion.button>
                  <button
                    onClick={() => setShowShare(true)}
                    className="w-full h-12 rounded-2xl border-2 border-border bg-card text-foreground font-semibold text-sm"
                  >
                    Share Receipt
                  </button>
                </motion.div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Recharge Successful",
          amount: `৳${effectivePrice}`,
          gradient: "gradient-accent",
          txnId: txnId.current,
          rows: [
            { label: "Number", value: formatPhone(phone) },
            { label: "Operator", value: operator?.name ?? "" },
            { label: "Pack", value: selectedPack ? selectedPack.name : "Custom Recharge" },
            ...(selectedPack ? [{ label: "Details", value: selectedPack.details }, { label: "Validity", value: selectedPack.validity }] : []),
            { label: "Fee", value: "Free" },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </div>
  );
};

export default MobileRechargeFlow;
