import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type Lang = "en" | "bn";
const LANG_KEY = "mfs_ui_lang";

const translations = {
  // AppHeader
  logout: { en: "Logout", bn: "লগআউট" },

  // BalanceCard
  welcomeBack: { en: "Welcome back 👋", bn: "স্বাগতম 👋" },
  availableBalance: { en: "Available Balance", bn: "উপলব্ধ ব্যালেন্স" },
  tapToSeeBalance: { en: "Tap to see balance", bn: "ব্যালেন্স দেখতে ট্যাপ করুন" },
  addMoney: { en: "Add Money", bn: "টাকা যোগ" },
  walletId: { en: "Wallet ID", bn: "ওয়ালেট আইডি" },
  share: { en: "Share", bn: "শেয়ার" },

  // QuickActions
  sendMoney: { en: "Send Money", bn: "টাকা পাঠান" },
  cashOut: { en: "Cash Out", bn: "ক্যাশ আউট" },
  payment: { en: "Payment", bn: "পেমেন্ট" },
  referEarn: { en: "Refer & Earn", bn: "রেফার করুন" },
  recharge: { en: "Recharge", bn: "রিচার্জ" },
  payBill: { en: "Pay Bill", bn: "বিল পে" },
  shop: { en: "Shop", bn: "শপ" },
  more: { en: "More", bn: "আরো" },

  // BottomNav / SideNav
  home: { en: "Home", bn: "হোম" },
  history: { en: "History", bn: "হিস্টরি" },
  scan: { en: "Scan", bn: "স্ক্যান" },
  inbox: { en: "Inbox", bn: "ইনবক্স" },
  account: { en: "Account", bn: "অ্যাকাউন্ট" },

  // TransactionList
  recentTransactions: { en: "Recent Transactions", bn: "সাম্প্রতিক লেনদেন" },
  seeAll: { en: "See All", bn: "সব দেখুন" },
  noTransactions: { en: "No transactions yet", bn: "কোনো লেনদেন নেই" },
  loading: { en: "Loading…", bn: "লোড হচ্ছে…" },
  totalAmount: { en: "Total Amount", bn: "মোট পরিমাণ" },
  transactionId: { en: "Transaction ID", bn: "লেনদেন আইডি" },
  nameParty: { en: "Name / Party", bn: "নাম / পার্টি" },
  type: { en: "Type", bn: "ধরন" },
  description: { en: "Description", bn: "বিবরণ" },
  dateTime: { en: "Date & Time", bn: "তারিখ ও সময়" },
  commission: { en: "Commission", bn: "কমিশন" },

  // Transaction types
  txSend: { en: "Send Money", bn: "টাকা পাঠান" },
  txReceived: { en: "Received", bn: "গৃহীত" },
  txCashOut: { en: "Cash Out", bn: "ক্যাশ আউট" },
  txCashIn: { en: "Cash In", bn: "ক্যাশ ইন" },
  txPayment: { en: "Payment", bn: "পেমেন্ট" },
  txRecharge: { en: "Recharge", bn: "রিচার্জ" },
  txBillPay: { en: "Bill Pay", bn: "বিল পে" },
  txAddMoney: { en: "Add Money", bn: "টাকা যোগ" },
  txBankTransfer: { en: "Bank Transfer", bn: "ব্যাংক ট্রান্সফার" },

  // PromoCard
  limitedOffer: { en: "Limited offer", bn: "সীমিত অফার" },
  promoCashback: { en: "5% Cashback on Mobile Recharge", bn: "মোবাইল রিচার্জে ৫% ক্যাশব্যাক" },
  promoValid: { en: "Valid until Feb 28 · Min ৳100", bn: "ফেব্রুয়ারি ২৮ পর্যন্ত · সর্বনিম্ন ৳১০০" },

  // SideNav
  mobileFinancialService: { en: "Mobile Financial Service", bn: "মোবাইল ফাইন্যান্সিয়াল সার্ভিস" },

  // Language toggle
  langToggle: { en: "বাংলা", bn: "English" },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem(LANG_KEY) as Lang) ?? "en");

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === "en" ? "bn" : "en"));
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[key]?.[lang] ?? key,
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
