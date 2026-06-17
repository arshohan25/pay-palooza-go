import { useState, useRef, useEffect, useMemo } from "react";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { requestLocation, getCachedStatus, requestContacts } from "@/lib/permissions";
import { loadContacts as loadStoredContacts, saveContacts as saveStoredContacts, hasStoredContacts, getContactsWithFallback, type StoredContact } from "@/lib/contactStore";
import { fireSuccessConfetti } from "@/lib/confetti";
import { useFeeConfig } from "@/hooks/use-fee-config";
import { transferMoney, getBalance } from "@/lib/balanceStore";
import { verifyPin } from "@/lib/verifyPin";
import { checkDailyLimit } from "@/lib/dailyLimits";
import { addTxnNotif } from "@/lib/txnNotifStore";
import { showTxnToast } from "@/components/TxnToast";

import { motion, AnimatePresence } from "framer-motion";
import SlideToConfirm from "@/components/SlideToConfirm";

import ShareReceiptSheet from "@/components/ShareReceiptSheet";
import AvailableBalanceBadge from "@/components/AvailableBalanceBadge";
import DailyLimitBadge from "@/components/DailyLimitBadge";
import {
  ChevronLeft,
  Search,
  CheckCircle2,
  Send,
  User,
  Users,
  AlertCircle,
  QrCode,
  Banknote,
  ChevronRight,
  Contact2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import QrScannerModal from "@/components/QrScannerModal";
import { useI18n } from "@/lib/i18n";
import { useFeatureLocks } from "@/hooks/use-feature-locks";
import FeatureGuard from "@/components/FeatureGuard";
import FeatureLockedOverlay from "@/components/FeatureLockedOverlay";
import PermissionGate from "@/components/PermissionGate";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "recipient" | "amount" | "confirm" | "pin" | "success";

interface Contact {
  id: string;
  name: string;
  phone: string;
  initials: string;
  gradient: string;
}

const PASTEL_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-pink-100 text-pink-700",
  "bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

const getContactColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
};

const GRADIENTS = ["gradient-send", "gradient-cashout", "gradient-payment", "gradient-addmoney", "gradient-accent"];

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

// ─── Validation helpers ───────────────────────────────────────────────────────
const WALLET_ID_RE = /^EZP-[A-Z]{4}-[A-Z]{4}$/i;
const BD_PHONE_RE  = /^(?:\+?88)?01[3-9]\d{8}$/;

const normalizePhone = (raw: string) => raw.replace(/[\s\-()]/g, "");

type RecipientType = "phone" | "walletId";

const detectRecipientType = (val: string): RecipientType | null => {
  const v = val.trim();
  if (WALLET_ID_RE.test(v)) return "walletId";
  if (BD_PHONE_RE.test(normalizePhone(v))) return "phone";
  return null;
};

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS: Step[] = ["recipient", "amount", "confirm", "pin"];

// ─── Slide animation ──────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir < 0 ? "100%" : "-100%", opacity: 0 }),
};

interface PinInputProps { pin: string; onChange: (p: string) => void; error: string; }
const PinInput = ({ pin, onChange, error }: PinInputProps) => {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{ scale: pin.length > i ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              pin.length > i ? "gradient-send border-transparent" : "border-muted-foreground/40 bg-transparent"
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
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          if (v.length > pin.length) haptics.light();
          onChange(v);
        }}
        autoFocus
        className="w-full h-14 text-center text-3xl font-bold tracking-[1rem] bg-card border-2 border-border rounded-2xl focus:outline-none focus:border-primary transition-colors"
        placeholder="••••"
      />
      <p className="text-center text-xs text-muted-foreground">{t("enterPin")}</p>
    </div>
  );
};



interface SendMoneyFlowProps { onClose: () => void; prefilledPhone?: string; onSuccess?: (amount: number) => void; }

const SendMoneyFlow = ({ onClose, prefilledPhone, onSuccess }: SendMoneyFlowProps) => {
  const { t } = useI18n();
  const { isLocked } = useFeatureLocks();
  const { calcFee, calcCashOutFee, loading: feeLoading } = useFeeConfig();
  const sendLock = isLocked("send_money");
  const [step, setStep]           = useState<Step>("recipient");
  const [direction, setDirection] = useState(1);
  const [recipient, setRecipient] = useState<Contact | null>(null);
  const [inputVal, setInputVal]   = useState(prefilledPhone ?? "");
  const [inputType, setInputType] = useState<RecipientType | null>(prefilledPhone ? "phone" : null);
  const [amount, setAmount]       = useState("");
  const [note, setNote]           = useState("");
  const [error, setError]         = useState("");
  const [pin, setPin]             = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [addCashOutCharge, setAddCashOutCharge] = useState(false);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [phoneContacts, setPhoneContacts] = useState<Contact[]>([]);
  const txnTime = useRef(new Date());
  const genId = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };
  const txnId   = useRef(genId());
  const formatAmountInput = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "";
    return parseFloat(value.toFixed(2)).toString();
  };

  const getAmountWithCashOutCharge = (baseAmount: number) => {
    if (baseAmount <= 0) return 0;
    return parseFloat((baseAmount + calcCashOutFee(baseAmount)).toFixed(2));
  };

  const getBaseAmountFromTotal = (totalAmount: number) => {
    if (totalAmount <= 0) return 0;
    let low = 0;
    let high = totalAmount;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      const gross = getAmountWithCashOutCharge(mid);
      if (gross > totalAmount) high = mid;
      else low = mid;
    }
    return parseFloat(low.toFixed(2));
  };

  const MIN_CASH_OUT_AMOUNT = 10;

  const handleCashOutChargeToggle = () => {
    const current = parseFloat(amount) || 0;
    const nextEnabled = !addCashOutCharge;
    if (nextEnabled && current < MIN_CASH_OUT_AMOUNT) {
      setError(t("smMinCashoutChargeReq").replace("{amt}", String(MIN_CASH_OUT_AMOUNT)));
      haptics.error?.();
      return;
    }
    if (current > 0) {
      setAmount(formatAmountInput(nextEnabled ? getAmountWithCashOutCharge(current) : getBaseAmountFromTotal(current)));
    }
    setAddCashOutCharge(nextEnabled);
    haptics.light();
    setError("");
  };
  

  useEffect(() => {
    const fetchRecent = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from("transactions")
        .select("recipient_phone, recipient_name")
        .eq("user_id", session.user.id)
        .eq("type", "send")
        .eq("status", "completed")
        .not("recipient_phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data?.length) return;
      const seen = new Set<string>();
      const contacts: Contact[] = [];
      for (const t of data) {
        const phone = t.recipient_phone!;
        if (seen.has(phone) || !/^\d{11}$/.test(phone)) continue;
        seen.add(phone);
        const name = t.recipient_name || phone;
        const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
        contacts.push({
          id: phone,
          name,
          phone,
          initials: initials || phone.slice(0, 2),
          gradient: GRADIENTS[contacts.length % GRADIENTS.length],
        });
        if (contacts.length >= 5) break;
      }
      setRecentContacts(contacts);
    };
    fetchRecent();
  }, []);

  useEffect(() => {
    if (step === "success") {
      fireSuccessConfetti();
      addTxnNotif();
      txnId.current = genId();
    }
  }, [step]);

  // Auto-resolve prefilled phone (from QR scan) and skip to amount
  const prefilledResolved = useRef(false);
  useEffect(() => {
    if (!prefilledPhone || prefilledResolved.current) return;
    prefilledResolved.current = true;
    const autoResolve = async () => {
      setValidating(true);
      setError("");
      const result = await validateRecipientExists(prefilledPhone);
      setValidating(false);
      if (!result.exists) {
        setError(t("smNotRegistered"));
        return;
      }
      setResolvedPhone(result.phone || prefilledPhone);
      const normalizedPhone = normalizePhone(prefilledPhone);
      const found = recentContacts.find((c) => normalizePhone(c.phone) === normalizedPhone);
      if (found) {
        setRecipient({ ...found, name: result.name || found.name });
      } else {
        setRecipient({
          id: "prefilled",
          name: result.name || normalizedPhone,
          phone: result.phone || normalizedPhone,
          initials: normalizedPhone.slice(-2),
          gradient: "gradient-send",
        });
      }
      setInputType("phone");
      goTo("amount");
    };
    autoResolve();
  }, [prefilledPhone]);

  // Load contacts from local store on mount (no native picker)
  useEffect(() => {
    const stored = getContactsWithFallback();
    const mapped: Contact[] = stored.map((c, i) => {
      const initials = c.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || c.phone.slice(-2);
      return {
        id: `contact-${c.phone}`,
        name: c.name,
        phone: c.phone,
        initials,
        gradient: GRADIENTS[i % GRADIENTS.length],
      };
    });
    setPhoneContacts(mapped);
  }, []);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (next: Step) => {
    haptics.medium();
    setDirection(STEPS.indexOf(next) > stepIndex ? 1 : -1);
    setStep(next);
    setError("");
  };

  const goBack = () => {
    haptics.medium();
    if (step === "recipient") { onClose(); return; }
    if (step === "amount")    { goTo("recipient"); return; }
    if (step === "confirm")   { goTo("amount"); return; }
    if (step === "pin")       { setPin(""); goTo("confirm"); return; }
  };

  // Merge recent + phone contacts, deduplicate by phone
  const allContacts = useMemo(() => {
    const seen = new Set<string>();
    const merged: (Contact & { source?: "recent" | "contacts" })[] = [];
    for (const c of recentContacts) {
      const key = normalizePhone(c.phone);
      if (!seen.has(key)) { seen.add(key); merged.push({ ...c, source: "recent" }); }
    }
    for (const c of phoneContacts) {
      const key = normalizePhone(c.phone);
      if (!seen.has(key)) { seen.add(key); merged.push({ ...c, source: "contacts" }); }
    }
    return merged;
  }, [recentContacts, phoneContacts]);

  const filteredContacts = allContacts.filter((c) => {
    if (!inputVal.trim()) return true;
    const q = inputVal.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, ""));
  });

  const recentFiltered = filteredContacts.filter((c) => c.source === "recent");
  const contactsFiltered = filteredContacts.filter((c) => c.source === "contacts").sort((a, b) => a.name.localeCompare(b.name));

  const isNameSearch = inputVal.trim().length >= 2 && !/^\+?\d/.test(inputVal.trim()) && !WALLET_ID_RE.test(inputVal.trim());

  // Check if input is a valid number for the "Send to this number" row
  const manualRecipientType = detectRecipientType(inputVal);

  const handlePhoneContactsPicked = (data: any) => {
    if (!data || !Array.isArray(data)) return;
    const toStore: StoredContact[] = [];
    const newContacts: Contact[] = [];
    for (const entry of data) {
      const name = entry.name?.[0] || "Unknown";
      const tel = entry.tel?.[0];
      if (!tel) continue;
      const phone = normalizePhone(tel);
      if (!phone) continue;
      toStore.push({ name, phone });
      const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || phone.slice(-2);
      newContacts.push({
        id: `contact-${phone}`,
        name,
        phone,
        initials,
        gradient: GRADIENTS[newContacts.length % GRADIENTS.length],
      });
    }
    // Persist to localStorage
    if (toStore.length > 0) saveStoredContacts(toStore);
    if (newContacts.length > 0) {
      setPhoneContacts((prev) => {
        const seen = new Set(prev.map((c) => normalizePhone(c.phone)));
        const merged = [...prev];
        for (const c of newContacts) {
          if (!seen.has(normalizePhone(c.phone))) {
            seen.add(normalizePhone(c.phone));
            merged.push(c);
          }
        }
        return merged;
      });
    }
  };

  const handleSyncContacts = async () => {
    const result = await requestContacts();
    if (result.status === "granted" && result.data) {
      handlePhoneContactsPicked(result.data);
    }
  };

  const [validating, setValidating] = useState(false);
  // Track resolved phone separately from display value (important for wallet IDs)
  const [resolvedPhone, setResolvedPhone] = useState<string>("");
  const [resolvedWalletId, setResolvedWalletId] = useState<string>("");
  const [matchedBy, setMatchedBy] = useState<"phone" | "wallet" | "">("");

  const validateRecipientExists = async (identifier: string): Promise<{ exists: boolean; name?: string; phone?: string; walletId?: string; matchedBy?: string }> => {
    const { data, error } = await supabase.rpc("resolve_transfer_recipient", {
      p_identifier: identifier,
      p_flow: "send",
    });
    if (error) return { exists: false };
    const result = typeof data === "string" ? JSON.parse(data) : data;
    if (result?.found) {
      return { exists: true, name: result.recipient_name || undefined, phone: result.recipient_phone, walletId: result.recipient_wallet_id || "", matchedBy: result.matched_by || "phone" };
    }
    return { exists: false };
  };

  const handleSelectContact = async (c: Contact) => {
    setValidating(true);
    setError("");
    const result = await validateRecipientExists(c.phone);
    setValidating(false);
    if (!result.exists) {
      setError(t("smNotRegistered"));
      return;
    }
    const updated = { ...c, name: result.name || c.name };
    setRecipient(updated);
    setResolvedPhone(result.phone || c.phone);
    setResolvedWalletId(result.walletId || "");
    setMatchedBy((result.matchedBy as "phone" | "wallet") || "phone");
    setInputVal(c.phone);
    setInputType("phone");
    goTo("amount");
  };

  const handleInputChange = (val: string) => {
    // If starts with digit, cap at 11 digits (strip non-digits)
    if (/^\d/.test(val)) {
      const digits = val.replace(/\D/g, "").slice(0, 11);
      setInputVal(digits);
      setInputType(detectRecipientType(digits));
      setError("");
      return;
    }
    // Wallet ID pattern: auto-hyphenate EZP-XXXX-XXXX
    if (/^[A-Za-z]{1,3}$/i.test(val) || val.includes("-")) {
      const upper = val.toUpperCase().replace(/[^A-Z\-]/g, "");
      // Auto-format: after 3 chars add hyphen, after 8 chars add hyphen
      let formatted = upper;
      const letters = upper.replace(/-/g, "");
      if (letters.length <= 3) {
        formatted = letters;
      } else if (letters.length <= 7) {
        formatted = letters.slice(0, 3) + "-" + letters.slice(3);
      } else {
        formatted = letters.slice(0, 3) + "-" + letters.slice(3, 7) + "-" + letters.slice(7, 11);
      }
      if (formatted.replace(/-/g, "").length > 11) return;
      setInputVal(formatted);
      setInputType(detectRecipientType(formatted));
      setError("");
      return;
    }
    // Name search: unlimited
    setInputVal(val);
    setInputType(detectRecipientType(val));
    setError("");
  };

  const handleManualSend = async () => {
    const val = inputVal.trim();
    const type = detectRecipientType(val);
    if (!type) return;

    setValidating(true);
    setError("");

    // Validate recipient exists on EasyPay via secure RPC
    const result = await validateRecipientExists(val);
    setValidating(false);

    if (!result.exists) {
      setError(type === "walletId" ? t("smWalletNotFound") : t("smNotRegistered"));
      return;
    }

    // Store the canonical phone returned by the resolver
    setResolvedPhone(result.phone || "");
    setResolvedWalletId(result.walletId || "");
    setMatchedBy((result.matchedBy as "phone" | "wallet") || (type === "walletId" ? "wallet" : "phone"));

    const found = allContacts.find((c) => {
      if (type === "phone") return normalizePhone(c.phone) === normalizePhone(val);
      return false;
    });
    if (found) {
      setRecipient({ ...found, name: result.name || found.name });
    } else {
      const initials = type === "walletId"
        ? val.slice(4, 6).toUpperCase()
        : normalizePhone(val).slice(-2);
      setRecipient({
        id: "custom",
        name: result.name || (type === "walletId" ? `${t("smWalletPrefix")} ${val}` : normalizePhone(val)),
        phone: result.phone || normalizePhone(val),
        initials,
        gradient: "gradient-send",
      });
    }
    setInputType(type);
    goTo("amount");
  };

  const handleQrScan = async (rawResult: string) => {
    // Extract clean identifier from structured QR payloads (JSON, URL, etc.)
    const { parseQrData } = await import("@/lib/qrParser");
    const parsed = parseQrData(rawResult);
    const result = parsed.flow !== "unknown" ? parsed.identifier : rawResult;
    const type = detectRecipientType(result);
    setInputVal(result);
    setInputType(type);

    setValidating(true);
    setError("");
    const validationResult = await validateRecipientExists(result);
    setValidating(false);

    if (!validationResult.exists) {
      setError(t("smNotRegistered"));
      return;
    }

    setResolvedPhone(validationResult.phone || "");
    setResolvedWalletId(validationResult.walletId || "");
    setMatchedBy((validationResult.matchedBy as "phone" | "wallet") || (type === "walletId" ? "wallet" : "phone"));

    const found = allContacts.find((c) => normalizePhone(c.phone) === normalizePhone(result));
    if (found) {
      setRecipient({ ...found, name: validationResult.name || found.name });
    } else {
      const initials = type === "walletId"
        ? result.slice(4, 6).toUpperCase()
        : result.slice(-2);
      setRecipient({
        id: "qr",
        name: validationResult.name || (type === "walletId" ? `${t("smWalletPrefix")} ${result}` : result),
        phone: validationResult.phone || result,
        initials,
        gradient: "gradient-send",
      });
    }
    goTo("amount");
  };

  const handleAmountContinue = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val <= 0) { setError(t("enterValidAmount")); return; }
    if (val < 0.01)  { setError(t("smMinSendAmount")); return; }
    if (val > 50000) { setError(t("smMaxSendDay")); return; }
    goTo("confirm");
  };

  const handleConfirm = () => goTo("pin");

  const [processing, setProcessing] = useState(false);
  const handlePinConfirm = async () => {
    if (pin.length < 4) { setError(t("enterYour4DigitPin")); return; }
    if (processing) return;
    setProcessing(true);

    const pinValid = await verifyPin(pin);
    if (!pinValid) { setError(t("incorrectPin")); setPin(""); setProcessing(false); return; }

    const amtVal = parseFloat(amount) || 0;
    const limitCheck = await checkDailyLimit("send", amtVal);
    if (!limitCheck.allowed) {
      setError(t("smDailyLimitExceeded").replace("{used}", limitCheck.used.toLocaleString()).replace("{limit}", limitCheck.limit.toLocaleString()));
      setProcessing(false);
      return;
    }

    requestLocation().catch(() => {});
    haptics.success();
    txnTime.current = new Date();
    const actualSendAmount = parseFloat(amtVal.toFixed(2));
    const feeVal = calcFee("send", actualSendAmount);
    try {
      await transferMoney({
        recipientPhone: (resolvedPhone || recipient?.phone) ?? "",
        amount: actualSendAmount,
        fee: feeVal,
        type: "send",
        recipientName: recipient?.name,
        reference: txnId.current,
        description: (addCashOutCharge ? "[+Cash Out Charge] " : "") + (note || "") + (resolvedWalletId ? ` [Wallet: ${resolvedWalletId}]` : ""),
      });
      onSuccess?.(actualSendAmount);
      showTxnToast({ type: t("flowSendMoney"), amount: `৳${actualSendAmount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}`, gradient: "gradient-send" });
      setDirection(1);
      setStep("success");
    } catch (err: any) {
      setError(err?.message || t("smTransactionFailed"));
      setPin("");
      setProcessing(false);
      return;
    }
  };

  const BALANCE = getBalance();
  const amtNum = parseFloat(amount) || 0;
  const cashOutBaseAmount = addCashOutCharge ? getBaseAmountFromTotal(amtNum) : amtNum;
  const cashOutExtra = addCashOutCharge && amtNum > 0 ? parseFloat((amtNum - cashOutBaseAmount).toFixed(2)) : 0;
  const sendAmount = amtNum;
  const fee    = calcFee("send", sendAmount);
  const feeFromBalance = Math.min(fee, BALANCE);
  const feeFromAmount  = parseFloat((fee - feeFromBalance).toFixed(2));
  const totalFromBalance = sendAmount + feeFromBalance;
  const recipientReceives = parseFloat((sendAmount - feeFromAmount).toFixed(2));

  if (sendLock.locked) {
    return (
      <FeatureLockedOverlay
        featureName={t("flowSendMoney")}
        reason={sendLock.reason}
        expiresAt={sendLock.expiresAt}
        onClose={onClose}
      />
    );
  }

  // ─── Contact row component (bKash style) ────────────────────────────────────
  const ContactRow = ({ contact }: { contact: Contact & { source?: string } }) => {
    const colorClass = getContactColor(contact.name);
    return (
      <button
        onClick={() => handleSelectContact(contact)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 active:bg-accent/80 transition-colors"
      >
        <div className={`${colorClass} w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0`}>
          {contact.initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[15px] font-semibold text-foreground truncate leading-tight">{contact.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{contact.phone}</p>
        </div>
      </button>
    );
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className="fixed inset-0 z-50 bg-background flex flex-col max-w-md sm:max-w-xl mx-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-money-title">
      {/* ─── Header ─── */}
      {step !== "success" && (
        <div className="gradient-send px-4 pt-3 pb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              aria-label={t("smGoBack")}
              className="w-10 h-10 rounded-full bg-primary-foreground/15 flex items-center justify-center active:scale-95 transition-transform shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
            >
              <ChevronLeft size={20} className="text-primary-foreground" aria-hidden="true" />
            </button>
            <div className="flex-1 text-center">
              <h1 id="send-money-title" className="text-lg font-bold text-primary-foreground tracking-tight">
                {t("flowSendMoney")}
              </h1>
              {step === "recipient" && (
                <p className="text-xs text-primary-foreground/70 mt-0.5">{t("secureInstantTransfer")}</p>
              )}
            </div>
            {step !== "recipient" && <div className="w-10" />}
            {step === "recipient" && <div className="w-10" />}
          </div>
        </div>
      )}

      {/* ─── Animated step content ─── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence custom={direction} mode="wait">
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

            {/* ── STEP 1: Recipient (bKash-inspired) ── */}
            {step === "recipient" && (
              <div className="flex flex-col pb-20">
                {/* Search */}
                <div className="px-4 pt-4 pb-3">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="text"
                      placeholder="Name or Number or Wallet ID"
                      value={inputVal}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="w-full pl-10 pr-11 h-12 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(330_80%_55%)]/50 placeholder:text-muted-foreground/60 transition-all"
                      autoFocus
                    />
                    <button
                      onClick={() => setShowScanner(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent/50 active:scale-95 transition-all"
                    >
                      <QrCode size={18} className="text-[hsl(330_80%_55%)]" />
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-2"><AlertCircle size={12} /> {error}</p>
                  )}
                </div>


                {/* Send to this number — appears when valid number detected */}
                {manualRecipientType && inputVal.trim() && (
                  <div className="mx-4 mb-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-[hsl(330_80%_55%)]/5 border border-[hsl(330_80%_55%)]/20">
                    <div className="w-10 h-10 rounded-full bg-[hsl(330_80%_55%)]/10 flex items-center justify-center shrink-0">
                      <Send size={16} className="text-[hsl(330_80%_55%)]" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-foreground">Send to {inputVal.trim()}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {manualRecipientType === "phone" ? "Mobile number" : "Wallet ID"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Recent section */}
                {recentFiltered.length > 0 && (
                  <div>
                    <div className="px-4 py-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {recentFiltered.slice(0, 4).map((c) => (
                      <ContactRow key={c.id} contact={c} />
                    ))}
                  </div>
                )}

                {/* All Contacts section (from device) — bKash style */}
                {contactsFiltered.length > 0 && (
                  <div>
                    <div className="px-4 py-2.5 flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">All Contacts</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">{contactsFiltered.length}</span>
                        <button onClick={handleSyncContacts} className="p-1 rounded-full hover:bg-muted transition-colors" title="Sync Contacts">
                          <RefreshCw size={14} className="text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    {contactsFiltered.map((c) => (
                      <ContactRow key={c.id} contact={c} />
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {recentFiltered.length === 0 && contactsFiltered.length === 0 && !manualRecipientType && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center py-8 text-center"
                  >
                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3"
                    >
                      <Users className="w-7 h-7 text-muted-foreground" />
                    </motion.div>
                    <p className="text-sm font-semibold text-foreground">No contacts found</p>
                    <p className="text-xs text-muted-foreground mt-1">Enter a number or import from your phone</p>
                  </motion.div>
                )}


                {/* Continue button — fixed at bottom, shows once a recipient is chosen */}
                {manualRecipientType && (
                  <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 py-4 bg-background/95 backdrop-blur-sm border-t border-border animate-fade-in">
                    <Button
                      className="w-full h-12 text-base font-semibold rounded-xl gradient-send border-0 text-white"
                      onClick={handleManualSend}
                    >
                      Continue
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Amount ── */}
            {step === "amount" && (
              <div className="px-4 pt-5 pb-32 space-y-5">
                {recipient && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                    <div className={`${recipient.gradient} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {recipient.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{t("sendingTo")}</p>
                      <p className="text-sm font-bold text-foreground truncate">{recipient.name}</p>
                      {matchedBy === "wallet" ? (
                        <p className="text-xs text-muted-foreground">{resolvedWalletId}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{recipient.phone}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground">{t("enterAmount")}</label>
                    <div className="flex flex-col items-end gap-0.5">
                      <AvailableBalanceBadge />
                      <DailyLimitBadge txnType="send" />
                    </div>
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-2xl font-bold text-muted-foreground">৳</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => {
                        let v = e.target.value;
                        if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
                        setAmount(v);
                        setError("");
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      autoFocus
                      className="w-full pl-10 pr-4 h-16 text-3xl font-bold text-foreground bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />


                  </div>
                  {addCashOutCharge && amtNum > 0 && cashOutExtra > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Base ৳{cashOutBaseAmount.toLocaleString()} + Cash Out Charge ৳{cashOutExtra.toFixed(2)} = ৳{sendAmount.toLocaleString()}
                    </p>
                  )}
                  {error && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} /> {error}</p>
                  )}
                </div>

                {/* Quick amounts — horizontal scroll */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{t("quickSelect")}</p>
                  <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmount(addCashOutCharge ? formatAmountInput(getAmountWithCashOutCharge(q)) : String(q))}
                        className={`px-4 py-2 rounded-full text-sm font-semibold border whitespace-nowrap transition-all active:scale-95 shrink-0 ${
                          amount === (addCashOutCharge ? formatAmountInput(getAmountWithCashOutCharge(q)) : String(q))
                            ? "gradient-send text-white border-transparent"
                            : "bg-card border-border text-foreground hover:border-primary/50"
                        }`}
                      >
                        ৳{q.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">{t("noteOptional")}</label>
                  <input
                    placeholder="What's it for?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full px-3 h-10 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                  />
                </div>

                {/* Cash Out Charge Toggle — reduced visual weight */}
                <button
                  onClick={handleCashOutChargeToggle}
                  disabled={amtNum > 0 && amtNum < MIN_CASH_OUT_AMOUNT}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${
                    addCashOutCharge
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <Banknote size={16} className={addCashOutCharge ? "text-primary" : "text-muted-foreground"} />
                  <div className="flex-1 text-left">
                    <p className="text-xs font-medium text-foreground">Add Cash Out Charge (1.19%)</p>
                    {amtNum > 0 && amtNum < MIN_CASH_OUT_AMOUNT && (
                      <p className="text-[10px] text-destructive mt-0.5">Minimum ৳{MIN_CASH_OUT_AMOUNT} required</p>
                    )}
                  </div>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${addCashOutCharge ? "bg-primary" : "bg-muted"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${addCashOutCharge ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                </button>




                {amtNum > 0 && totalFromBalance > BALANCE && (
                  <p className="text-center text-sm text-destructive font-medium">Insufficient balance</p>
                )}
                {amtNum > 0 && totalFromBalance <= BALANCE && amtNum > 50000 && (
                  <p className="text-center text-sm text-destructive font-medium">Exceeds daily limit (৳50,000)</p>
                )}
                {amtNum > 0 && totalFromBalance <= BALANCE && amtNum <= 50000 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <Button className="w-full h-12 gradient-send border-0 text-white font-semibold text-base rounded-xl" onClick={handleAmountContinue}>
                      {t("reviewTransfer")}
                    </Button>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── STEP 3: Confirm ── */}
            {step === "confirm" && (
              <div className="px-4 pt-5 pb-32 space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("youreSending")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`${recipient?.gradient} w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
                      {recipient?.initials}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{recipient?.name}</p>
                      {matchedBy === "wallet" ? (
                        <p className="text-sm text-muted-foreground">{resolvedWalletId}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{recipient?.phone}</p>
                      )}
                    </div>
                  </div>
                  {note && (
                    <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{t("note")}: </span>{note}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-card border border-border p-4 space-y-3 text-sm">
                  <p className="font-semibold text-foreground">{t("transferSummary")}</p>
                  <div className="space-y-2 text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("sendAmount")}</span>
                      <span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("serviceFee")}</span>
                      <span className="text-foreground font-medium">
                        {fee === 0 ? <span className="text-primary font-semibold">{t("free")}</span> : `৳${fee}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70">
                      <span>Fee source</span>
                      <span className="text-primary font-medium">
                        {fee === 0
                          ? "—"
                          : feeFromBalance >= fee
                          ? "From your balance"
                          : feeFromBalance > 0
                          ? `৳${feeFromBalance.toFixed(2)} balance + ৳${feeFromAmount} from amount`
                          : "Deducted from amount"}
                      </span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-bold text-foreground text-base">
                      <span>{t("totalFromBalance")}</span>
                      <span>৳{totalFromBalance.toLocaleString()}</span>
                    </div>
                    {feeFromAmount > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground/70">
                        <span>{t("recipientReceives")}</span>
                        <span>৳{recipientReceives.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 text-xs text-muted-foreground">
                  <User size={14} />
                  <span>{t("availableBalance")}: <strong className="text-foreground">৳{BALANCE.toLocaleString("en-BD", { minimumFractionDigits: 2 })}</strong></span>
                </div>

                <Button className="w-full h-12 gradient-send border-0 text-white font-bold text-base rounded-xl" onClick={handleConfirm}>
                  <Send size={18} /> {t("confirmEnterPin")}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => goTo("amount")}>{t("edit")}</Button>
              </div>
            )}

            {/* ── STEP 4: PIN ── */}
            {step === "pin" && (
              <div className="px-4 pt-5 pb-32 space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">{t("sending")}</p>
                  <p className="text-4xl font-extrabold text-foreground">৳{amtNum.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">to <span className="font-semibold text-foreground">{recipient?.name}</span></p>
                </div>

                <div className="rounded-xl bg-muted/40 border border-border p-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("totalFromBalance")}</span>
                  <span className="font-bold text-foreground">৳{totalFromBalance.toLocaleString()}</span>
                </div>

                <PinInput pin={pin} onChange={(p) => { setPin(p); setError(""); }} error={error} />

                <SlideToConfirm
                  onConfirm={handlePinConfirm}
                  label={t("slideToSend")}
                  gradient="gradient-send"
                  disabled={pin.length < 4 || processing}
                  pinComplete={pin.length === 4}
                  icon={Send}
                />
              </div>
            )}

            {/* ── STEP 5: Success ── */}
            {step === "success" && (
              <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                  className="w-24 h-24 gradient-send rounded-full flex items-center justify-center shadow-glow"
                >
                  <CheckCircle2 size={52} className="text-white" />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-foreground">{t("moneySent")}</h2>
                  <p className="text-muted-foreground text-sm">
                    ৳{amtNum.toLocaleString()} sent to{" "}
                    <span className="font-semibold text-foreground">{recipient?.name}</span>
                  </p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="w-full rounded-2xl bg-card border border-border shadow-elevated p-4 text-sm space-y-3"
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("recipient")}</span><span className="text-foreground font-medium">{recipient?.name}</span>
                  </div>
                  {matchedBy === "wallet" ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Wallet ID</span><span className="text-foreground font-medium">{resolvedWalletId}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("mobileWallet")}</span><span className="text-foreground font-medium">{recipient?.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("amount")}</span><span className="text-foreground font-medium">৳{amtNum.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("fee")}</span>
                    <span className="text-foreground font-medium">{fee === 0 ? t("free") : `৳${fee}`}</span>
                  </div>
                  {fee > 0 && (
                    <p className="text-[11px] text-muted-foreground text-right">
                      ৳{amtNum.toLocaleString()} + ৳{fee} fee ({feeFromBalance >= fee ? "from balance" : feeFromBalance > 0 ? "balance + amount" : "from amount"})
                    </p>
                  )}
                  {feeFromAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("recipientReceives")}</span>
                      <span className="font-semibold text-primary">৳{recipientReceives.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("date")}</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("time")}</span>
                    <span className="text-foreground font-medium">
                      {txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between font-bold text-foreground">
                    <span>{t("transactionId")}</span>
                    <span className="text-primary">{txnId.current}</span>
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full space-y-3">
                  <Button className="w-full h-12 gradient-send border-0 text-white font-semibold rounded-xl" onClick={onClose}>
                    {t("backToHome")}
                  </Button>
                  <Button variant="outline" className="w-full h-11 rounded-xl" onClick={() => setShowShare(true)}>
                    {t("shareReceipt")}
                  </Button>
                </motion.div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* QR Scanner */}
      <QrScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQrScan}
        title={t("scanRecipientQr")}
      />

      {/* Share Receipt Sheet */}
      <ShareReceiptSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        receipt={{
          title: "Money Sent",
          amount: `৳${amtNum.toLocaleString()}`,
          gradient: "gradient-send",
          txnId: txnId.current,
          rows: [
            { label: "Recipient", value: recipient?.name ?? "" },
            { label: matchedBy === "wallet" ? "Wallet ID" : "Mobile / Wallet", value: matchedBy === "wallet" ? resolvedWalletId : (recipient?.phone ?? "") },
            { label: "Amount", value: `৳${amtNum.toLocaleString()}` },
            { label: "Fee", value: fee === 0 ? "Free" : `৳${fee}` },
            { label: "Date", value: txnTime.current.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
            { label: "Time", value: txnTime.current.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) },
          ],
        }}
      />
    </motion.div>
  );
};

const SendMoneyFlowGuarded = (props: SendMoneyFlowProps) => (
  <FeatureGuard featureKey="send_money" onClose={props.onClose}>
    <SendMoneyFlow {...props} />
  </FeatureGuard>
);

export default SendMoneyFlowGuarded;
