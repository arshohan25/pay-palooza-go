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

  // ─── Account Page ───
  editProfile: { en: "Edit Profile", bn: "প্রোফাইল সম্পাদনা" },
  updateNamePhoto: { en: "Update your name and profile photo", bn: "নাম ও প্রোফাইল ছবি আপডেট করুন" },
  kycVerification: { en: "KYC Verification", bn: "কেওয়াইসি যাচাই" },
  kycSub: { en: "Full verification unlocks higher limits", bn: "সম্পূর্ণ যাচাই উচ্চ সীমা আনলক করে" },
  changePin: { en: "Change PIN", bn: "পিন পরিবর্তন" },
  changePinSub: { en: "Update your 4-digit transaction PIN", bn: "৪ সংখ্যার লেনদেন পিন আপডেট করুন" },
  referAFriend: { en: "Refer a Friend", bn: "বন্ধুকে রেফার করুন" },
  referSub: { en: "Earn ৳50 for every successful referral", bn: "প্রতিটি সফল রেফারেলে ৳৫০ আয় করুন" },
  viewOnboarding: { en: "View Onboarding Again", bn: "আবার অনবোর্ডিং দেখুন" },
  viewOnboardingSub: { en: "Replay the feature tour from the start", bn: "ফিচার ট্যুর আবার শুরু থেকে দেখুন" },
  spendingInsights: { en: "Spending Insights", bn: "ব্যয় বিশ্লেষণ" },
  insightsSub: { en: "Monthly breakdown & analytics", bn: "মাসিক বিশ্লেষণ ও পরিসংখ্যান" },
  limitsCharges: { en: "Limits & Charges", bn: "সীমা ও চার্জ" },
  limitsSub: { en: "Transaction limits, fees & tariffs", bn: "লেনদেন সীমা, ফি ও ট্যারিফ" },
  pushNotifications: { en: "Push Notifications", bn: "পুশ নোটিফিকেশন" },
  pushSub: { en: "Transaction alerts & updates", bn: "লেনদেন সতর্কতা ও আপডেট" },
  promotionalAlerts: { en: "Promotional Alerts", bn: "প্রমোশনাল সতর্কতা" },
  promoAlertsSub: { en: "Offers, cashbacks & news", bn: "অফার, ক্যাশব্যাক ও খবর" },
  biometricLogin: { en: "Biometric Login", bn: "বায়োমেট্রিক লগইন" },
  biometricSub: { en: "Use fingerprint or face ID", bn: "ফিঙ্গারপ্রিন্ট বা ফেস আইডি ব্যবহার করুন" },
  twoFactorAuth: { en: "Two-Factor Auth", bn: "দ্বি-স্তর যাচাই" },
  twoFactorSub: { en: "Extra OTP step on each login", bn: "প্রতিটি লগইনে অতিরিক্ত OTP ধাপ" },
  signOut: { en: "Sign Out", bn: "সাইন আউট" },
  signedInAs: { en: "Signed in as", bn: "লগইন করা আছে" },
  signOutAccount: { en: "Sign out of your account", bn: "আপনার অ্যাকাউন্ট থেকে সাইন আউট করুন" },
  verified: { en: "Verified", bn: "যাচাইকৃত" },
  unverified: { en: "Unverified", bn: "অযাচাইকৃত" },
  language: { en: "Language", bn: "ভাষা" },
  languageSub: { en: "Switch between English and Bengali", bn: "ইংরেজি ও বাংলার মধ্যে পরিবর্তন করুন" },
  sectionAccount: { en: "Account", bn: "অ্যাকাউন্ট" },
  sectionAppExperience: { en: "App Experience", bn: "অ্যাপ অভিজ্ঞতা" },
  sectionInsightsLimits: { en: "Insights & Limits", bn: "বিশ্লেষণ ও সীমা" },
  sectionNotifications: { en: "Notifications", bn: "নোটিফিকেশন" },
  sectionSecurity: { en: "Security & Privacy", bn: "নিরাপত্তা ও গোপনীয়তা" },
  sectionAccountActions: { en: "Account Actions", bn: "অ্যাকাউন্ট কার্যক্রম" },
  onboardingReset: { en: "Onboarding reset! Restarting tour…", bn: "অনবোর্ডিং রিসেট! ট্যুর পুনরায় শুরু হচ্ছে…" },
  biometricEnabled: { en: "Biometric login enabled", bn: "বায়োমেট্রিক লগইন সক্রিয়" },
  biometricDisabled: { en: "Biometric login disabled", bn: "বায়োমেট্রিক লগইন নিষ্ক্রিয়" },
  twoFaEnabled: { en: "2FA enabled", bn: "দ্বি-স্তর যাচাই সক্রিয়" },
  twoFaDisabled: { en: "2FA disabled", bn: "দ্বি-স্তর যাচাই নিষ্ক্রিয়" },

  // ─── Transaction History Page ───
  transactionHistory: { en: "Transaction History", bn: "লেনদেন ইতিহাস" },
  moneyIn: { en: "Money In", bn: "আয়" },
  moneyOut: { en: "Money Out", bn: "ব্যয়" },
  count: { en: "Count", bn: "সংখ্যা" },
  searchTransactions: { en: "Search transactions…", bn: "লেনদেন অনুসন্ধান…" },
  from: { en: "From", bn: "থেকে" },
  to: { en: "To", bn: "পর্যন্ত" },
  clearAll: { en: "Clear all", bn: "সব মুছুন" },
  results: { en: "results", bn: "ফলাফল" },
  result: { en: "result", bn: "ফলাফল" },
  noTransactionsFound: { en: "No transactions found", bn: "কোনো লেনদেন পাওয়া যায়নি" },
  adjustFilters: { en: "Try adjusting your filters or search query", bn: "ফিল্টার বা অনুসন্ধান পরিবর্তন করুন" },
  clearFilters: { en: "Clear filters", bn: "ফিল্টার মুছুন" },
  all: { en: "All", bn: "সব" },
  send: { en: "Send", bn: "পাঠান" },
  received: { en: "Received", bn: "গৃহীত" },
  cashIn: { en: "Cash In", bn: "ক্যাশ ইন" },
  bankTransfer: { en: "Bank Transfer", bn: "ব্যাংক ট্রান্সফার" },
  refreshing: { en: "Refreshing…", bn: "রিফ্রেশ হচ্ছে…" },
  shareReceipt: { en: "Share Receipt", bn: "রসিদ শেয়ার করুন" },
  amount: { en: "Amount", bn: "পরিমাণ" },
  fee: { en: "Fee", bn: "ফি" },
  status: { en: "Status", bn: "স্ট্যাটাস" },
  date: { en: "Date", bn: "তারিখ" },

  // ─── QR Modal ───
  myQrCode: { en: "My QR Code", bn: "আমার কিউআর কোড" },
  scanToSendMoney: { en: "Scan this code to send money to me", bn: "আমাকে টাকা পাঠাতে এই কোড স্ক্যান করুন" },
  yourWalletId: { en: "Your Wallet ID", bn: "আপনার ওয়ালেট আইডি" },
  walletIdCopied: { en: "✓ Wallet ID copied to clipboard!", bn: "✓ ওয়ালেট আইডি কপি হয়েছে!" },
  copyId: { en: "Copy ID", bn: "আইডি কপি" },

  // ─── Wallet Share Sheet ───
  shareMyWallet: { en: "Share My Wallet", bn: "আমার ওয়ালেট শেয়ার" },
  scanToSend: { en: "SCAN TO SEND MONEY", bn: "টাকা পাঠাতে স্ক্যান করুন" },
  saveQr: { en: "Save QR", bn: "কিউআর সেভ" },
  copied: { en: "Copied!", bn: "কপি হয়েছে!" },
  saving: { en: "Saving…", bn: "সেভ হচ্ছে…" },

  // ─── Share Receipt Sheet ───
  shareReceiptTitle: { en: "Share Receipt", bn: "রসিদ শেয়ার" },
  copyShareSave: { en: "Copy, share, or save your receipt", bn: "রসিদ কপি, শেয়ার, বা সেভ করুন" },
  copy: { en: "Copy", bn: "কপি" },
  savePng: { en: "Save PNG", bn: "PNG সেভ" },

  // ─── Flow modal headers ───
  secureInstantTransfer: { en: "Secure & Instant Transfer", bn: "নিরাপদ ও তাৎক্ষণিক ট্রান্সফার" },
  withdrawFromAgent: { en: "Withdraw from Nearby Agent", bn: "নিকটতম এজেন্ট থেকে উত্তোলন" },
  transferToBank: { en: "Transfer to Bank Account", bn: "ব্যাংক অ্যাকাউন্টে ট্রান্সফার" },
  merchantQrPayments: { en: "Merchant & QR Payments", bn: "মার্চেন্ট ও কিউআর পেমেন্ট" },
  topUpWallet: { en: "Top Up Your Wallet · Free", bn: "ওয়ালেট টপ আপ · ফ্রি" },
  utilitiesServices: { en: "Utilities & Services · Free", bn: "ইউটিলিটি ও সেবা · ফ্রি" },
  enterPin: { en: "Enter your 4-digit PIN", bn: "আপনার ৪ সংখ্যার পিন দিন" },
  continue: { en: "Continue", bn: "এগিয়ে যান" },
  enterAmount: { en: "Enter Amount", bn: "পরিমাণ দিন" },
  quickSelect: { en: "Quick select", bn: "দ্রুত নির্বাচন" },
  total: { en: "Total", bn: "মোট" },
  free: { en: "Free", bn: "ফ্রি" },
  done: { en: "Done", bn: "সম্পন্ন" },
  goHome: { en: "Go Home", bn: "হোমে যান" },
  transactionSuccessful: { en: "Transaction Successful!", bn: "লেনদেন সফল!" },
  poweredByEasyPay: { en: "Powered by EasyPay", bn: "ইজিপে দ্বারা পরিচালিত" },
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
