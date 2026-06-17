import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type Lang = "en" | "bn";
const LANG_KEY = "mfs_ui_lang";

const translations = {
  // AppHeader
  logout: { en: "Logout", bn: "লগআউট" },

  // BalanceCard
  welcomeBack: { en: "Welcome back", bn: "স্বাগতম" },
  goodMorning: { en: "Good Morning", bn: "সুপ্রভাত" },
  goodAfternoon: { en: "Good Afternoon", bn: "শুভ অপরাহ্ন" },
  goodEvening: { en: "Good Evening", bn: "শুভ সন্ধ্যা" },
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
  kycPending: { en: "Pending", bn: "অপেক্ষমাণ" },
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

  // ─── Support & Help ───
  sectionSupport: { en: "Support & Help", bn: "সহায়তা ও সাহায্য" },
  liveChat: { en: "Live Chat", bn: "লাইভ চ্যাট" },
  liveChatSub: { en: "Chat with our support team", bn: "আমাদের সাপোর্ট টিমের সাথে চ্যাট করুন" },
  submitTicket: { en: "Submit a Ticket", bn: "টিকেট জমা দিন" },
  submitTicketSub: { en: "Describe your issue in detail", bn: "আপনার সমস্যা বিস্তারিত বর্ণনা করুন" },
  emailUs: { en: "Email Us", bn: "ইমেইল করুন" },
  myTickets: { en: "My Tickets", bn: "আমার টিকেট" },
  myTicketsSub: { en: "Track your submitted tickets", bn: "আপনার জমা দেওয়া টিকেট ট্র্যাক করুন" },
  ticketSubject: { en: "Subject", bn: "বিষয়" },
  ticketDescription: { en: "Description", bn: "বিবরণ" },
  submitTicketBtn: { en: "Submit Ticket", bn: "টিকেট জমা দিন" },
  submitting: { en: "Submitting…", bn: "জমা হচ্ছে…" },
  ticketSubmitted: { en: "Ticket submitted successfully!", bn: "টিকেট সফলভাবে জমা হয়েছে!" },
  ticketFailed: { en: "Failed to submit ticket.", bn: "টিকেট জমা দিতে ব্যর্থ।" },
  noTicketsYet: { en: "No tickets yet", bn: "এখনো কোনো টিকেট নেই" },
  noTicketsDesc: { en: "Your support tickets will appear here", bn: "আপনার সাপোর্ট টিকেট এখানে দেখা যাবে" },
  open: { en: "Open", bn: "খোলা" },
  closed: { en: "Closed", bn: "বন্ধ" },
  resolved: { en: "Resolved", bn: "সমাধান হয়েছে" },
  ticketClosedHint: { en: "This ticket has been closed and cannot be reopened. Please submit a new ticket for further assistance.", bn: "এই টিকেটটি বন্ধ হয়ে গেছে এবং পুনরায় খোলা যাবে না। আরও সহায়তার জন্য একটি নতুন টিকেট জমা দিন।" },
  rateExperience: { en: "Rate your experience:", bn: "আপনার অভিজ্ঞতা রেট করুন:" },
  yourRating: { en: "Your rating:", bn: "আপনার রেটিং:" },
  ratingSubmitted: { en: "Thanks for your feedback!", bn: "আপনার মতামতের জন্য ধন্যবাদ!" },
  liveChatTitle: { en: "Live Chat — Support", bn: "লাইভ চ্যাট — সাপোর্ট" },
  submitTicketTitle: { en: "Submit a Support Ticket", bn: "সাপোর্ট টিকেট জমা দিন" },
  signInFirst: { en: "Please sign in first.", bn: "অনুগ্রহ করে আগে সাইন ইন করুন।" },
  signInToContact: { en: "Please sign in to contact support.", bn: "সাপোর্টে যোগাযোগ করতে সাইন ইন করুন।" },

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

  // ─── Flow modal: Send Money ───
  flowSendMoney: { en: "Send Money", bn: "টাকা পাঠান" },
  flowSecureTransfer: { en: "Secure & Instant Transfer", bn: "নিরাপদ ও তাৎক্ষণিক ট্রান্সফার" },
  searchByNameNumberWallet: { en: "Search by Name, Number or Wallet ID", bn: "নাম, নম্বর বা ওয়ালেট আইডি দিয়ে খুঁজুন" },
  recentContacts: { en: "Recent contacts", bn: "সাম্প্রতিক যোগাযোগ" },
  uploadQrGallery: { en: "Upload QR from Gallery", bn: "গ্যালারি থেকে QR আপলোড" },
  sendingTo: { en: "Sending to", bn: "পাঠানো হচ্ছে" },
  noteOptional: { en: "Note (optional)", bn: "নোট (ঐচ্ছিক)" },
  sendAmount: { en: "Send Amount", bn: "পাঠানোর পরিমাণ" },
  recipientReceives: { en: "Recipient receives", bn: "প্রাপক পাবেন" },
  slideToSend: { en: "Slide to Send", bn: "পাঠাতে স্লাইড করুন" },
  mobileNumber: { en: "Mobile Number", bn: "মোবাইল নম্বর" },
  walletIdLabel: { en: "Wallet ID", bn: "ওয়ালেট আইডি" },

  // ─── Flow modal: Cash Out ───
  flowCashOut: { en: "Cash Out", bn: "ক্যাশ আউট" },
  flowWithdrawAgent: { en: "Withdraw from Nearby Agent", bn: "নিকটতম এজেন্ট থেকে উত্তোলন" },
  flowTransferBank: { en: "Transfer to Bank Account", bn: "ব্যাংক অ্যাকাউন্টে ট্রান্সফার" },
  howCashOut: { en: "How would you like to cash out?", bn: "আপনি কিভাবে ক্যাশ আউট করতে চান?" },
  chooseMethod: { en: "Choose your preferred withdrawal method", bn: "আপনার পছন্দের উত্তোলন পদ্ধতি বাছুন" },
  agentCashOut: { en: "Agent Cash Out", bn: "এজেন্ট ক্যাশ আউট" },
  withdrawFromAgentDesc: { en: "Withdraw cash from a nearby agent", bn: "নিকটতম এজেন্ট থেকে নগদ উত্তোলন" },
  flowBankTransfer: { en: "Bank Transfer", bn: "ব্যাংক ট্রান্সফার" },
  transferToBankDesc: { en: "Transfer to any bank account", bn: "যেকোনো ব্যাংক অ্যাকাউন্টে ট্রান্সফার" },
  agentIdLabel: { en: "Agent ID", bn: "এজেন্ট আইডি" },
  nearbyAgents: { en: "Nearby agents", bn: "কাছাকাছি এজেন্ট" },
  youReceive: { en: "You receive", bn: "আপনি পাবেন" },
  slideToCashOut: { en: "Slide to Cash Out", bn: "ক্যাশ আউট করতে স্লাইড করুন" },
  selectBank: { en: "Select Bank", bn: "ব্যাংক নির্বাচন" },
  accountNumber: { en: "Account Number", bn: "অ্যাকাউন্ট নম্বর" },
  accountHolderName: { en: "Account Holder Name", bn: "অ্যাকাউন্ট ধারকের নাম" },
  savedAccounts: { en: "Saved Accounts", bn: "সংরক্ষিত অ্যাকাউন্ট" },

  // ─── Flow modal: Payment ───
  flowPayment: { en: "Payment", bn: "পেমেন্ট" },
  flowMerchantQr: { en: "Merchant & QR Payments", bn: "মার্চেন্ট ও কিউআর পেমেন্ট" },
  merchantId: { en: "Merchant ID", bn: "মার্চেন্ট আইডি" },
  recentMerchants: { en: "Recent merchants", bn: "সাম্প্রতিক মার্চেন্ট" },
  payingTo: { en: "Paying to", bn: "পরিশোধ করা হচ্ছে" },
  paymentAmount: { en: "Payment Amount", bn: "পেমেন্টের পরিমাণ" },
  slideToPayment: { en: "Slide to Pay", bn: "পে করতে স্লাইড করুন" },

  // ─── Flow modal: Add Money ───
  flowAddMoney: { en: "Add Money", bn: "টাকা যোগ" },
  flowTopUpWallet: { en: "Top Up Your Wallet · Free", bn: "ওয়ালেট টপ আপ · ফ্রি" },
  addingToWallet: { en: "Adding to wallet", bn: "ওয়ালেটে যোগ হচ্ছে" },
  selectFundingSource: { en: "Select Funding Source", bn: "ফান্ডিং সোর্স নির্বাচন" },
  bankTransferLabel: { en: "Bank Transfer", bn: "ব্যাংক ট্রান্সফার" },
  debitCreditCard: { en: "Debit / Credit Card", bn: "ডেবিট / ক্রেডিট কার্ড" },
  noFees: { en: "No fees!", bn: "কোনো ফি নেই!" },
  addMoneyZeroCharge: { en: "Add money to your wallet at zero charge.", bn: "বিনা চার্জে আপনার ওয়ালেটে টাকা যোগ করুন।" },
  slideToAddMoney: { en: "Slide to Add Money", bn: "টাকা যোগ করতে স্লাইড করুন" },

  // ─── Flow modal: Mobile Recharge ───
  flowRecharge: { en: "Mobile Recharge", bn: "মোবাইল রিচার্জ" },
  selectOperatorOrNumber: { en: "Select operator or enter number", bn: "অপারেটর নির্বাচন বা নম্বর দিন" },
  instantTopUp: { en: "Instant Top-up", bn: "তাৎক্ষণিক টপ-আপ" },
  slideToRecharge: { en: "Slide to Recharge", bn: "রিচার্জ করতে স্লাইড করুন" },

  // ─── Flow modal: Pay Bill ───
  flowPayBill: { en: "Pay Bill", bn: "বিল পে" },
  flowUtilitiesFree: { en: "Utilities & Services · Free", bn: "ইউটিলিটি ও সেবা · ফ্রি" },
  selectBillType: { en: "Select Bill Type", bn: "বিলের ধরন নির্বাচন" },
  selectProvider: { en: "Select Provider", bn: "প্রোভাইডার নির্বাচন" },
  fetchBill: { en: "Fetch Bill", bn: "বিল আনুন" },
  billType: { en: "Bill Type", bn: "বিলের ধরন" },
  slideToPayBill: { en: "Slide to Pay Bill", bn: "বিল পে করতে স্লাইড করুন" },

  // ─── Shared flow inner labels ───
  serviceFee: { en: "Service Fee", bn: "সার্ভিস ফি" },
  feeSource: { en: "Fee source", bn: "ফি উৎস" },
  fromYourBalance: { en: "From your balance", bn: "আপনার ব্যালেন্স থেকে" },
  fromBalance: { en: "From balance", bn: "ব্যালেন্স থেকে" },
  deductedFromAmount: { en: "Deducted from amount", bn: "পরিমাণ থেকে কর্তন" },
  totalFromBalance: { en: "Total from balance", bn: "ব্যালেন্স থেকে মোট" },
  reviewTransfer: { en: "Review Transfer", bn: "ট্রান্সফার পর্যালোচনা" },
  transferSummary: { en: "Transfer Summary", bn: "ট্রান্সফার সারসংক্ষেপ" },
  confirmEnterPin: { en: "Confirm & Enter PIN", bn: "নিশ্চিত করুন ও পিন দিন" },
  edit: { en: "Edit", bn: "সম্পাদনা" },
  sending: { en: "Sending", bn: "পাঠানো হচ্ছে" },
  youreSending: { en: "You're sending", bn: "আপনি পাঠাচ্ছেন" },
  moneySent: { en: "Money Sent!", bn: "টাকা পাঠানো হয়েছে!" },
  recipient: { en: "Recipient", bn: "প্রাপক" },
  mobileWallet: { en: "Mobile / Wallet", bn: "মোবাইল / ওয়ালেট" },
  backToHome: { en: "Back to Home", bn: "হোমে ফিরুন" },
  time: { en: "Time", bn: "সময়" },
  note: { en: "Note", bn: "নোট" },
  scanRecipientQr: { en: "Scan Recipient QR", bn: "প্রাপকের কিউআর স্ক্যান" },
  enterValidNumber: { en: "Enter a valid 11-digit mobile number or Wallet ID (MFS-ABCD-EFGH).", bn: "একটি বৈধ ১১ সংখ্যার মোবাইল নম্বর বা ওয়ালেট আইডি দিন।" },
  enterValidAmount: { en: "Enter a valid amount.", bn: "একটি বৈধ পরিমাণ দিন।" },
  enterYour4DigitPin: { en: "Enter your 4-digit PIN.", bn: "আপনার ৪ সংখ্যার পিন দিন।" },
  confirmWithPin: { en: "Confirm with PIN", bn: "পিন দিয়ে নিশ্চিত করুন" },
  enterWalletPin: { en: "Enter your 4-digit wallet PIN to complete", bn: "সম্পন্ন করতে আপনার ৪ সংখ্যার ওয়ালেট পিন দিন" },
  continueToPIN: { en: "Continue to PIN", bn: "পিনে এগিয়ে যান" },
  cashingOutAt: { en: "Cashing out at", bn: "ক্যাশ আউট হচ্ছে" },
  transferringTo: { en: "Transferring to", bn: "ট্রান্সফার হচ্ছে" },
  personal: { en: "Personal", bn: "ব্যক্তিগত" },
  merchant: { en: "Merchant", bn: "মার্চেন্ট" },
  cashOutAmount: { en: "Cash Out Amount", bn: "ক্যাশ আউট পরিমাণ" },
  transferringToBank: { en: "Transferring to bank", bn: "ব্যাংকে ট্রান্সফার হচ্ছে" },
  cashingOut: { en: "Cashing out", bn: "ক্যাশ আউট হচ্ছে" },
  slideToTransfer: { en: "Slide to Transfer", bn: "ট্রান্সফার করতে স্লাইড করুন" },
  bankTransferSuccessful: { en: "Bank Transfer Successful!", bn: "ব্যাংক ট্রান্সফার সফল!" },
  cashOutSuccessful: { en: "Cash Out Successful!", bn: "ক্যাশ আউট সফল!" },
  youReceived: { en: "You Received", bn: "আপনি পেয়েছেন" },
  feeDeductedFrom: { en: "Fee deducted from", bn: "ফি কর্তন হয়েছে" },
  bank: { en: "Bank", bn: "ব্যাংক" },
  agent: { en: "Agent", bn: "এজেন্ট" },
  orEnterNew: { en: "or enter new", bn: "অথবা নতুন দিন" },
  removeSavedAccount: { en: "Remove saved account?", bn: "সংরক্ষিত অ্যাকাউন্ট সরাবেন?" },
  removeSavedAccountDesc: { en: "This bank account will be removed from your saved list. You can always add it again later.", bn: "এই ব্যাংক অ্যাকাউন্ট আপনার সংরক্ষিত তালিকা থেকে সরানো হবে।" },
  cancel: { en: "Cancel", bn: "বাতিল" },
  remove: { en: "Remove", bn: "সরান" },
  paying: { en: "Paying", bn: "পরিশোধ হচ্ছে" },
  paymentSuccessful: { en: "Payment Successful!", bn: "পেমেন্ট সফল!" },
  category: { en: "Category", bn: "ক্যাটাগরি" },
  scanMerchantQr: { en: "Scan Merchant QR", bn: "মার্চেন্ট কিউআর স্ক্যান" },
  source: { en: "Source", bn: "উৎস" },
  adding: { en: "Adding", bn: "যোগ হচ্ছে" },
  walletCredit: { en: "Wallet Credit", bn: "ওয়ালেট ক্রেডিট" },
  moneyAdded: { en: "Money Added!", bn: "টাকা যোগ হয়েছে!" },
  hasBeenAddedToWallet: { en: "has been added to your wallet", bn: "আপনার ওয়ালেটে যোগ হয়েছে" },
  transactionReceipt: { en: "Transaction Receipt", bn: "লেনদেন রসিদ" },
  iSentTheTransfer: { en: "I've Sent the Transfer", bn: "আমি ট্রান্সফার পাঠিয়েছি" },
  transferFrom: { en: "Transfer from", bn: "ট্রান্সফার হচ্ছে" },
  payViaCard: { en: "via Card", bn: "কার্ডের মাধ্যমে" },
  cardNumber: { en: "Card Number", bn: "কার্ড নম্বর" },
  nameOnCard: { en: "Name on Card", bn: "কার্ডে নাম" },
  expiry: { en: "Expiry", bn: "মেয়াদ" },
  detectedOperator: { en: "Detected operator", bn: "শনাক্তকৃত অপারেটর" },
  unknownOperator: { en: "Unknown operator", bn: "অজানা অপারেটর" },
  browseByOperator: { en: "Browse Package & Special Offer", bn: "প্যাকেজ ও বিশেষ অফার ব্রাউজ করুন" },
  recharging: { en: "Recharging", bn: "রিচার্জ হচ্ছে" },
  rechargeSuccessful: { en: "Recharge Successful!", bn: "রিচার্জ সফল!" },
  scanAgentQr: { en: "Scan Agent QR", bn: "এজেন্ট কিউআর স্ক্যান" },
  confirmPayment: { en: "Confirm Payment", bn: "পেমেন্ট নিশ্চিত করুন" },
  paymentWillBeDeducted: { en: "Payment will be deducted from your wallet balance. A confirmation SMS will be sent to your registered number.", bn: "পেমেন্ট আপনার ওয়ালেট ব্যালেন্স থেকে কর্তন করা হবে। আপনার নিবন্ধিত নম্বরে নিশ্চিতকরণ এসএমএস পাঠানো হবে।" },
  paymentSuccessfulBill: { en: "Payment Successful!", bn: "পেমেন্ট সফল!" },
  billAmount: { en: "Bill Amount", bn: "বিলের পরিমাণ" },
  billMonth: { en: "Bill Month", bn: "বিল মাস" },
  dueDate: { en: "Due Date", bn: "নির্ধারিত তারিখ" },
  accountNoLabel: { en: "Account No.", bn: "অ্যাকাউন্ট নম্বর" },

  // ─── Notification Center ───
  notifications: { en: "Notifications", bn: "নোটিফিকেশন" },
  allRead: { en: "All read", bn: "সব পড়া হয়েছে" },
  clear: { en: "Clear", bn: "মুছুন" },
  allCaughtUp: { en: "All caught up!", bn: "সব দেখা হয়েছে!" },
  noNotificationsRightNow: { en: "No notifications right now.", bn: "এখন কোনো নোটিফিকেশন নেই।" },
  ncTransactions: { en: "Transactions", bn: "লেনদেন" },
  ncPromotions: { en: "Promotions", bn: "প্রমোশন" },
  ncSystem: { en: "System", bn: "সিস্টেম" },

  // ─── Inbox Page ───
  inboxTitle: { en: "Inbox", bn: "ইনবক্স" },
  newChat: { en: "New Chat", bn: "নতুন চ্যাট" },
  typeMessage: { en: "Type a message…", bn: "একটি বার্তা লিখুন…" },
  online: { en: "online", bn: "অনলাইন" },
  members: { en: "members", bn: "সদস্য" },

  // ─── Spending Insights Page ───
  insightsTitle: { en: "Spending Insights", bn: "ব্যয় বিশ্লেষণ" },
  insightsSub2: { en: "Track your spending patterns", bn: "আপনার ব্যয়ের ধরণ ট্র্যাক করুন" },
  totalSent: { en: "Total Sent", bn: "মোট পাঠানো" },
  totalReceived: { en: "Total Received", bn: "মোট প্রাপ্ত" },
  vsLastMonth: { en: "vs last month", bn: "গত মাসের তুলনায়" },
  monthlyBreakdown: { en: "Monthly Breakdown", bn: "মাসিক বিশ্লেষণ" },
  categoryBreakdown: { en: "Category Breakdown", bn: "শ্রেণী বিশ্লেষণ" },
  thisMonth: { en: "This month", bn: "এই মাস" },
  topMerchants: { en: "Top Merchants", bn: "শীর্ষ মার্চেন্ট" },
  cashbackEarned: { en: "Cashback Earned", bn: "ক্যাশব্যাক অর্জিত" },

  // ─── Limits & Charges Page ───
  limitsTitle: { en: "Limits & Charges", bn: "সীমা ও চার্জ" },
  limitsSubtitle: { en: "Your current usage & transaction limits", bn: "আপনার বর্তমান ব্যবহার ও লেনদেন সীমা" },
  limitsInfoBanner: { en: "Limits reset at midnight. Complete KYC verification to unlock higher transaction limits.", bn: "সীমা মধ্যরাতে রিসেট হয়। উচ্চতর লেনদেন সীমা আনলক করতে কেওয়াইসি সম্পন্ন করুন।" },
  daily: { en: "Daily", bn: "দৈনিক" },
  monthly: { en: "Monthly", bn: "মাসিক" },
  used: { en: "Used", bn: "ব্যবহৃত" },
  left: { en: "left of", bn: "বাকি আছে" },
  tariffNote: { en: "Tariff Note", bn: "ট্যারিফ নোট" },
  pctUsed: { en: "used", bn: "ব্যবহৃত" },
  tariffCashOutAgent: { en: "Cash Out at agent: 1.85% per transaction", bn: "এজেন্টে ক্যাশ আউট: প্রতি লেনদেনে ১.৮৫%" },
  tariffCashOutATM: { en: "Cash Out at ATM: ৳15 flat fee per transaction", bn: "ATM-এ ক্যাশ আউট: প্রতি লেনদেনে ৳১৫ ফ্ল্যাট ফি" },
  tariffSendMoney: { en: "Send Money: Free up to ৳25,000/day", bn: "টাকা পাঠান: দৈনিক ৳২৫,০০০ পর্যন্ত ফ্রি" },
  tariffAddMoney: { en: "Add Money via bank: Free of charge", bn: "ব্যাংকের মাধ্যমে টাকা যোগ: বিনা চার্জে" },
  tariffPayment: { en: "Payment to merchants: Free of charge", bn: "মার্চেন্ট পেমেন্ট: বিনা চার্জে" },

  // ─── Refer Page ───
  referTitle: { en: "Refer a Friend", bn: "বন্ধুকে রেফার করুন" },
  referSubtitle: { en: "Earn ৳50 for every successful referral", bn: "প্রতিটি সফল রেফারেলে ৳৫০ আয় করুন" },
  perSuccessfulReferral: { en: "per successful referral", bn: "প্রতিটি সফল রেফারেলে" },
  yourReferralCode: { en: "Your referral code", bn: "আপনার রেফারেল কোড" },
  referralCodeCopied: { en: "Referral code copied!", bn: "রেফারেল কোড কপি হয়েছে!" },
  totalEarned: { en: "Total Earned", bn: "মোট আয়" },
  referred: { en: "Referred", bn: "রেফারকৃত" },
  completed: { en: "Completed", bn: "সম্পন্ন" },
  pending: { en: "Pending", bn: "অপেক্ষমাণ" },
  failed: { en: "Failed", bn: "ব্যর্থ" },
  rewardProgress: { en: "Reward Progress", bn: "পুরস্কার অগ্রগতি" },
  friends: { en: "friends", bn: "বন্ধু" },
  moreForMilestone: { en: "more for next milestone", bn: "পরবর্তী মাইলস্টোনের জন্য আরো" },
  referredFriends: { en: "Referred Friends", bn: "রেফারকৃত বন্ধুরা" },
  howItWorks: { en: "How it Works", bn: "কিভাবে কাজ করে" },
  referStep1: { en: "Share your unique referral code with friends", bn: "আপনার রেফারেল কোড বন্ধুদের সাথে শেয়ার করুন" },
  referStep2: { en: "Friend signs up & completes first transaction", bn: "বন্ধু সাইন আপ করুন ও প্রথম লেনদেন সম্পন্ন করুন" },
  referStep3: { en: "Both you & your friend earn ৳50 instantly", bn: "আপনি ও আপনার বন্ধু উভয়ে তাৎক্ষণিক ৳৫০ পান" },

  // ─── Savings Flow ───
  mySavings: { en: "My Savings", bn: "আমার সঞ্চয়" },
  addToGoal: { en: "Add to Goal", bn: "লক্ষ্যে যোগ করুন" },
  trackGrowMoney: { en: "Track & grow your money", bn: "আপনার টাকা ট্র্যাক ও বৃদ্ধি করুন" },
  totalSaved: { en: "Total Saved", bn: "মোট সঞ্চিত" },
  selectGoal: { en: "Select Goal", bn: "লক্ষ্য নির্বাচন" },
  remaining: { en: "remaining", bn: "বাকি" },
  amountToSave: { en: "Amount to Save", bn: "সঞ্চয়ের পরিমাণ" },
  saveNow: { en: "Save Now", bn: "এখন সঞ্চয় করুন" },
  goalCompleted: { en: "completed!", bn: "সম্পন্ন!" },
  savedToGoal: { en: "saved to", bn: "সঞ্চিত হয়েছে" },
  pctComplete: { en: "complete", bn: "সম্পন্ন" },
  enterValidAmountSavings: { en: "Enter a valid amount.", bn: "একটি বৈধ পরিমাণ দিন।" },
  insufficientBalance: { en: "Insufficient balance.", bn: "অপর্যাপ্ত ব্যালেন্স।" },
  selectSavingsGoal: { en: "Please select a savings goal.", bn: "অনুগ্রহ করে একটি সঞ্চয় লক্ষ্য নির্বাচন করুন।" },
  wallet: { en: "Wallet", bn: "ওয়ালেট" },
  emergencyFund: { en: "Emergency Fund", bn: "জরুরি তহবিল" },
  newPhone: { en: "New Phone", bn: "নতুন ফোন" },
  vacation: { en: "Vacation", bn: "ভ্রমণ" },

  // ─── Shop Flow ───
  shopTitle: { en: "Shop", bn: "শপ" },
  product: { en: "Product", bn: "পণ্য" },
  cart: { en: "Cart", bn: "কার্ট" },
  checkout: { en: "Checkout", bn: "চেকআউট" },
  orderPlaced: { en: "Order Placed!", bn: "অর্ডার সম্পন্ন!" },
  myOrders: { en: "My Orders", bn: "আমার অর্ডার" },
  wishlist: { en: "Wishlist", bn: "উইশলিস্ট" },
  searchProducts: { en: "Search products…", bn: "পণ্য অনুসন্ধান…" },
  flashDeals: { en: "Flash Deals", bn: "ফ্ল্যাশ ডিল" },
  limitedTimeOnly: { en: "Limited time only", bn: "সীমিত সময়ের জন্য" },
  added: { en: "Added", bn: "যোগ হয়েছে" },
  add: { en: "Add", bn: "যোগ" },
  addedToCart: { en: "Added to cart", bn: "কার্টে যোগ হয়েছে" },
  noProductsFound: { en: "No products found", bn: "কোনো পণ্য পাওয়া যায়নি" },
  tryDifferentSearch: { en: "Try a different search or category", bn: "ভিন্ন অনুসন্ধান বা ক্যাটাগরি চেষ্টা করুন" },
  addToCart: { en: "Add to Cart", bn: "কার্টে যোগ" },
  buyNow: { en: "Buy Now", bn: "এখনই কিনুন" },
  shopDescription: { en: "Description", bn: "বিবরণ" },
  customerReviews: { en: "Customer Reviews", bn: "গ্রাহক রিভিউ" },
  writeReview: { en: "Write Review", bn: "রিভিউ লিখুন" },
  reviews: { en: "reviews", bn: "রিভিউ" },
  noReviewsYet: { en: "No reviews yet. Be the first!", bn: "এখনও কোনো রিভিউ নেই। প্রথম হোন!" },
  purchaseToReview: { en: "Purchase this item to leave a review", bn: "রিভিউ দিতে এই পণ্যটি কিনুন" },
  relatedProducts: { en: "Related Products", bn: "সম্পর্কিত পণ্য" },
  limitedTimeOffer: { en: "Limited time offer", bn: "সীমিত সময়ের অফার" },
  removedFromWishlist: { en: "Removed from wishlist", bn: "উইশলিস্ট থেকে সরানো হয়েছে" },
  addedToWishlist: { en: "Added to wishlist", bn: "উইশলিস্টে যোগ হয়েছে" },
  yourWishlistEmpty: { en: "Your wishlist is empty", bn: "আপনার উইশলিস্ট খালি" },
  tapHeartToSave: { en: "Tap the ❤️ on any product to save it", bn: "সংরক্ষণ করতে যেকোনো পণ্যে ❤️ ট্যাপ করুন" },
  browseProducts: { en: "Browse Products", bn: "পণ্য ব্রাউজ করুন" },
  yourCartEmpty: { en: "Your cart is empty", bn: "আপনার কার্ট খালি" },
  continueShopping: { en: "Continue Shopping", bn: "শপিং চালিয়ে যান" },
  promoCode: { en: "Promo Code", bn: "প্রোমো কোড" },
  enterPromoCode: { en: "Enter promo code", bn: "প্রোমো কোড দিন" },
  apply: { en: "Apply", bn: "প্রয়োগ" },
  orderSummary: { en: "Order Summary", bn: "অর্ডার সারসংক্ষেপ" },
  subtotal: { en: "Subtotal", bn: "সাবটোটাল" },
  discount: { en: "Discount", bn: "ছাড়" },
  delivery: { en: "Delivery", bn: "ডেলিভারি" },
  freeCaps: { en: "FREE", bn: "ফ্রি" },
  walletBalanceLabel: { en: "Wallet balance", bn: "ওয়ালেট ব্যালেন্স" },
  proceedToCheckout: { en: "Proceed to Checkout", bn: "চেকআউটে এগিয়ে যান" },
  deliveryAddress: { en: "Delivery Address", bn: "ডেলিভারি ঠিকানা" },
  change: { en: "Change", bn: "পরিবর্তন" },
  addNewAddress: { en: "Add New Address", bn: "নতুন ঠিকানা যোগ" },
  paymentMethod: { en: "Payment Method", bn: "পেমেন্ট পদ্ধতি" },
  mfsWallet: { en: "EasyPay Wallet", bn: "ইজিপে ওয়ালেট" },
  balance: { en: "Balance", bn: "ব্যালেন্স" },
  savedCard: { en: "Saved card", bn: "সংরক্ষিত কার্ড" },
  insufficientBalanceNeed: { en: "Insufficient balance — need", bn: "অপর্যাপ্ত ব্যালেন্স — আরো প্রয়োজন" },
  shopMore: { en: "more", bn: "আরো" },
  items: { en: "Items", bn: "আইটেম" },
  qty: { en: "Qty", bn: "পরিমাণ" },
  placeOrder: { en: "Place Order", bn: "অর্ডার দিন" },
  orderConfirmed: { en: "Your order has been confirmed", bn: "আপনার অর্ডার নিশ্চিত হয়েছে" },
  deliveryInfo: { en: "Delivery Info", bn: "ডেলিভারি তথ্য" },
  estimated35Days: { en: "Estimated: 3–5 business days", bn: "আনুমানিক: ৩-৫ কার্যদিবস" },
  deductedFromWallet: { en: "deducted from wallet", bn: "ওয়ালেট থেকে কর্তন" },
  chargedTo: { en: "charged to", bn: "চার্জ হয়েছে" },
  startShopping: { en: "Start Shopping", bn: "শপিং শুরু করুন" },
  noOrdersYet: { en: "No orders yet", bn: "এখনও কোনো অর্ডার নেই" },
  orders: { en: "orders", bn: "অর্ডার" },
  savedItems: { en: "saved items", bn: "সংরক্ষিত আইটেম" },
  products: { en: "products", bn: "পণ্য" },
  confirmYourOrder: { en: "Confirm your order", bn: "আপনার অর্ডার নিশ্চিত করুন" },
  trackShipment: { en: "Track Shipment", bn: "শিপমেন্ট ট্র্যাক" },
  cancelOrder: { en: "Cancel Order", bn: "অর্ডার বাতিল" },
  cancelThisOrder: { en: "Cancel this order?", bn: "এই অর্ডার বাতিল করবেন?" },
  refundToWallet: { en: "will go back to your wallet.", bn: "আপনার ওয়ালেটে ফেরত যাবে।" },
  refundToCard: { en: "Refund will be processed to your card.", bn: "রিফান্ড আপনার কার্ডে প্রসেস করা হবে।" },
  keepOrder: { en: "Keep Order", bn: "অর্ডার রাখুন" },
  yesCancel: { en: "Yes, Cancel", bn: "হ্যাঁ, বাতিল" },
  paidViaWallet: { en: "Paid via Wallet", bn: "ওয়ালেটে পরিশোধ" },
  paidViaCard: { en: "Paid via Card", bn: "কার্ডে পরিশোধ" },
  estDelivery: { en: "Est. delivery", bn: "আনুমানিক ডেলিভারি" },
  offApplied: { en: "off applied", bn: "ছাড় প্রয়োগ" },
  savingAmount: { en: "saving", bn: "সঞ্চয়" },
  editAddress: { en: "Edit Address", bn: "ঠিকানা সম্পাদনা" },
  newAddress: { en: "New Address", bn: "নতুন ঠিকানা" },
  saveAddress: { en: "Save Address", bn: "ঠিকানা সেভ" },
  fullName: { en: "Full Name", bn: "পুরো নাম" },
  phone: { en: "Phone", bn: "ফোন" },
  addressLine1: { en: "Address Line 1", bn: "ঠিকানা লাইন ১" },
  areaThana: { en: "Area / Thana", bn: "এলাকা / থানা" },
  cityPostcode: { en: "City / Postcode", bn: "শহর / পোস্টকোড" },
  reviewProduct: { en: "Review", bn: "রিভিউ" },
  tapToRate: { en: "Tap to rate", bn: "রেট করতে ট্যাপ করুন" },
  shareExperience: { en: "Share your experience with this product…", bn: "এই পণ্যটি সম্পর্কে আপনার অভিজ্ঞতা শেয়ার করুন…" },
  submit: { en: "Submit", bn: "জমা দিন" },
  pleaseSelectRating: { en: "Please select a rating", bn: "অনুগ্রহ করে রেটিং দিন" },
  pleaseWriteSomething: { en: "Please write something", bn: "অনুগ্রহ করে কিছু লিখুন" },
  fillAllRequired: { en: "Please fill all required fields", bn: "অনুগ্রহ করে সকল প্রয়োজনীয় ফিল্ড পূরণ করুন" },
  addressSaved: { en: "Address saved", bn: "ঠিকানা সেভ হয়েছে" },
  reviewSubmitted: { en: "Review submitted!", bn: "রিভিউ জমা হয়েছে!" },
  shopCheckoutLabel: { en: "Checkout", bn: "চেকআউট" },
  refundOf: { en: "Refund of", bn: "রিফান্ড" },
  orderPlacedTimeline: { en: "Order Placed", bn: "অর্ডার সম্পন্ন" },
  confirmed2: { en: "Confirmed", bn: "নিশ্চিত" },
  shipped: { en: "Shipped", bn: "শিপ হয়েছে" },
  outForDelivery: { en: "Out for Delivery", bn: "ডেলিভারির জন্য বের হয়েছে" },
  delivered: { en: "Delivered", bn: "ডেলিভারি সম্পন্ন" },
  processing: { en: "Processing", bn: "প্রসেসিং" },
  cancelled: { en: "Cancelled", bn: "বাতিল" },

  // ─── Additional i18n keys ───
  noLimit: { en: "No Limit", bn: "কোনো সীমা নেই" },
  mobileRecharge: { en: "Mobile Recharge", bn: "মোবাইল রিচার্জ" },
  tariffCashOutAgentNew: { en: "Cash Out (Agent): 1.19% fee", bn: "ক্যাশ আউট (এজেন্ট): ১.১৯% ফি" },
  tariffATM: { en: "ATM Cash Out: Not available", bn: "ATM ক্যাশ আউট: উপলব্ধ নয়" },
  tariffSendMoneyNew: { en: "Send Money: ৳3 after ৳100 up to ৳50,000, Then ৳5/txn", bn: "টাকা পাঠান: ৳১০০ এর পর ৳৩ (৳৫০,০০০ পর্যন্ত), তারপর ৳৫/লেনদেন" },
  tariffBankTransferNew: { en: "Bank Transfer: 1% fee", bn: "ব্যাংক ট্রান্সফার: ১% ফি" },
  tariffAddMoneyFree: { en: "Add Money: Free", bn: "টাকা যোগ: ফ্রি" },
  tariffPaymentPayBill: { en: "Payment & Pay Bill: No limit, Free", bn: "পেমেন্ট ও বিল পে: কোনো সীমা নেই, ফ্রি" },
  starter: { en: "Starter", bn: "স্টার্টার" },
  bonus: { en: "Bonus", bn: "বোনাস" },
  champion: { en: "Champion", bn: "চ্যাম্পিয়ন" },
  whatsapp: { en: "WhatsApp", bn: "হোয়াটসঅ্যাপ" },
  sms: { en: "SMS", bn: "এসএমএস" },
  referralCodeInput: { en: "Referral Code (optional)", bn: "রেফারেল কোড (ঐচ্ছিক)" },
  referralCodePlaceholder: { en: "e.g. EZP-ABCD-1234", bn: "যেমন: EZP-ABCD-1234" },
  deviceAlreadyRegistered: { en: "This device already has an account. Only one account per device is allowed.", bn: "এই ডিভাইসে ইতিমধ্যে একটি একাউন্ট আছে। প্রতি ডিভাইসে একটি একাউন্ট অনুমোদিত।" },
  kycVerifiedMilestone: { en: "KYC Verified", bn: "কেওয়াইসি যাচাই" },
  firstTxnMilestone: { en: "1st Transaction (≥৳101)", bn: "১ম লেনদেন (≥৳১০১)" },
  fiveTxnsMilestone: { en: "5 Txns (≥৳500)", bn: "৫ লেনদেন (≥৳৫০০)" },
  milestoneReward: { en: "Reward", bn: "পুরস্কার" },
  noReferralsYet: { en: "No referrals yet. Share your code to start earning!", bn: "এখনো কোনো রেফারেল নেই। আয় শুরু করতে আপনার কোড শেয়ার করুন!" },
  active: { en: "Active", bn: "সক্রিয়" },

  // ─── Profile Edit Flow ───
  editProfileTitle: { en: "Edit Profile", bn: "প্রোফাইল সম্পাদনা" },
  updateNamePhotoSub: { en: "Update your display name & photo", bn: "আপনার ডিসপ্লে নাম ও ছবি আপডেট করুন" },
  profilePhoto: { en: "Profile Photo", bn: "প্রোফাইল ছবি" },
  tapToUpload: { en: "Tap to upload · JPEG / PNG · max 5 MB", bn: "আপলোড করতে ট্যাপ করুন · JPEG / PNG · সর্বোচ্চ ৫ MB" },
  removePhoto: { en: "Remove photo", bn: "ছবি সরান" },
  displayName: { en: "Display Name", bn: "ডিসপ্লে নাম" },
  yourFullName: { en: "Your full name", bn: "আপনার পুরো নাম" },
  emailAddress: { en: "Email Address", bn: "ইমেইল ঠিকানা" },
  emailImportantNote: { en: "Once your email is verified and saved, it cannot be changed or removed without contacting support.", bn: "একবার আপনার ইমেইল যাচাই ও সেভ হলে, সাপোর্টে যোগাযোগ ছাড়া এটি পরিবর্তন বা সরানো যাবে না।" },
  emailLockedNote: { en: "Your email is locked. To change it, please contact support.", bn: "আপনার ইমেইল লক করা আছে। পরিবর্তন করতে সাপোর্টে যোগাযোগ করুন।" },
  openLiveChat: { en: "Open Live Chat", bn: "লাইভ চ্যাট খুলুন" },
  important: { en: "Important:", bn: "গুরুত্বপূর্ণ:" },
  enterOtp: { en: "Enter OTP", bn: "OTP দিন" },
  sendOtp: { en: "Send OTP", bn: "OTP পাঠান" },
  sendingDots: { en: "Sending…", bn: "পাঠানো হচ্ছে…" },
  verify: { en: "Verify", bn: "যাচাই" },
  checkEmailOtp: { en: "Check your email for the verification code", bn: "আপনার ইমেইলে যাচাইকরণ কোড দেখুন" },
  resendOtp: { en: "Resend OTP", bn: "OTP পুনরায় পাঠান" },
  resendIn: { en: "Resend in", bn: "পুনরায় পাঠান" },
  profileUpdated: { en: "Profile Updated!", bn: "প্রোফাইল আপডেট হয়েছে!" },
  changesSaved: { en: "Your changes have been saved.", bn: "আপনার পরিবর্তনগুলো সেভ হয়েছে।" },
  saveChanges: { en: "Save Changes", bn: "পরিবর্তন সেভ করুন" },

  // ─── KYC Flow ───
  kycTitle: { en: "KYC Verification", bn: "কেওয়াইসি যাচাই" },
  secureIdCheck: { en: "Secure Identity Check", bn: "নিরাপদ পরিচয় যাচাই" },
  nidFrontLabel: { en: "NID Front", bn: "NID সামনে" },
  nidBackLabel: { en: "NID Back", bn: "NID পিছনে" },
  nidDetailsLabel: { en: "NID Details", bn: "NID তথ্য" },
  livenessLabel: { en: "Liveness", bn: "লাইভনেস" },
  reviewLabel: { en: "Review", bn: "পর্যালোচনা" },
  doneLabel: { en: "Done", bn: "সম্পন্ন" },
  uploadNidFront: { en: "Upload NID Front", bn: "NID সামনের দিক আপলোড করুন" },
  uploadNidFrontSub: { en: "Take a clear photo of the front of your National ID Card", bn: "আপনার জাতীয় পরিচয়পত্রের সামনের দিকের একটি স্পষ্ট ছবি তুলুন" },
  uploadNidBack: { en: "Upload NID Back", bn: "NID পিছনের দিক আপলোড করুন" },
  uploadNidBackSub: { en: "Now capture the back side of your National ID Card", bn: "এবার আপনার জাতীয় পরিচয়পত্রের পিছনের দিকটি ক্যাপচার করুন" },
  confirmNidDetails: { en: "Confirm NID Details", bn: "NID তথ্য নিশ্চিত করুন" },
  confirmNidDetailsSub: { en: "We extracted the following info — please verify and correct if needed", bn: "আমরা নিম্নলিখিত তথ্য বের করেছি — অনুগ্রহ করে যাচাই করুন ও প্রয়োজনে সংশোধন করুন" },
  livenessCheck: { en: "Liveness Check", bn: "লাইভনেস চেক" },
  livenessCheckSub: { en: "We'll verify you're a real person — no photo upload allowed", bn: "আমরা যাচাই করব আপনি একজন প্রকৃত ব্যক্তি — ছবি আপলোড অনুমোদিত নয়" },
  reviewSubmit: { en: "Review & Submit", bn: "পর্যালোচনা ও জমা দিন" },
  reviewSubmitSub: { en: "Check your documents before submitting for verification", bn: "যাচাইয়ের জন্য জমা দেওয়ার আগে আপনার ডকুমেন্ট চেক করুন" },
  nidCardFront: { en: "NID Card — Front Side", bn: "NID কার্ড — সামনের দিক" },
  nidCardBack: { en: "NID Card — Back Side", bn: "NID কার্ড — পিছনের দিক" },
  photoTips: { en: "Photo Tips", bn: "ছবি টিপস" },
  tipCorners: { en: "Ensure all 4 corners of the card are visible", bn: "কার্ডের ৪টি কোণা দৃশ্যমান কিনা নিশ্চিত করুন" },
  tipGlare: { en: "Avoid glare, shadows, or blurry images", bn: "আলোর প্রতিফলন, ছায়া বা ঝাপসা ছবি এড়িয়ে চলুন" },
  tipSurface: { en: "Place card on a dark, flat surface", bn: "কার্ড একটি গাঢ় সমতল পৃষ্ঠে রাখুন" },
  tipBarcode: { en: "Capture the barcode and signature area clearly", bn: "বারকোড ও স্বাক্ষর এলাকা স্পষ্টভাবে ক্যাপচার করুন" },
  tipNoDamage: { en: "Make sure the card is not damaged or folded", bn: "কার্ড ক্ষতিগ্রস্ত বা ভাঁজ করা নয় তা নিশ্চিত করুন" },
  tipLighting: { en: "Use natural lighting for best results", bn: "সেরা ফলাফলের জন্য প্রাকৃতিক আলো ব্যবহার করুন" },
  continueArrow: { en: "Continue →", bn: "এগিয়ে যান →" },
  uploadNidFrontToContinue: { en: "Upload NID Front to Continue", bn: "এগিয়ে যেতে NID সামনে আপলোড করুন" },
  uploadNidBackToContinue: { en: "Upload NID Back to Continue", bn: "এগিয়ে যেতে NID পিছনে আপলোড করুন" },
  confirmDetailsArrow: { en: "Confirm Details →", bn: "তথ্য নিশ্চিত করুন →" },
  fillAllFields: { en: "Fill in all fields to continue", bn: "এগিয়ে যেতে সকল ফিল্ড পূরণ করুন" },
  ocrBadge: { en: "Details auto-extracted from your NID photo. Tap", bn: "আপনার NID ছবি থেকে স্বয়ংক্রিয়ভাবে তথ্য বের করা হয়েছে। ট্যাপ করুন" },
  ocrBadgeSuffix: { en: "to correct any errors.", bn: "কোনো ত্রুটি সংশোধন করতে।" },
  fullNameNid: { en: "Full Name (as on NID)", bn: "পুরো নাম (NID অনুযায়ী)" },
  nidNumber: { en: "NID Number", bn: "NID নম্বর" },
  dateOfBirth: { en: "Date of Birth", bn: "জন্ম তারিখ" },
  tapToUploadDoc: { en: "Tap to upload", bn: "আপলোড করতে ট্যাপ করুন" },
  chooseFile: { en: "Choose File", bn: "ফাইল বাছুন" },
  retake: { en: "Retake", bn: "পুনরায় তুলুন" },
  uploaded: { en: "✓ Uploaded", bn: "✓ আপলোড হয়েছে" },
  notUploaded: { en: "Not uploaded", bn: "আপলোড হয়নি" },
  startLivenessCheck: { en: "Start Liveness Check", bn: "লাইভনেস চেক শুরু করুন" },
  livenessTips: { en: "Liveness Tips", bn: "লাইভনেস টিপস" },
  tipEvenLighting: { en: "Ensure you're in good, even lighting", bn: "ভালো, সমান আলোতে আছেন কিনা নিশ্চিত করুন" },
  tipRemoveGlasses: { en: "Remove glasses, hat, or face coverings", bn: "চশমা, টুপি বা মুখ ঢাকা সরান" },
  tipFollowInstructions: { en: "Follow on-screen instructions carefully", bn: "স্ক্রিনের নির্দেশনা সাবধানে অনুসরণ করুন" },
  noPhotoUpload: { en: "Direct photo upload is not allowed. You must complete the live face scan.", bn: "সরাসরি ছবি আপলোড অনুমোদিত নয়। আপনাকে লাইভ ফেস স্ক্যান সম্পন্ন করতে হবে।" },
  reviewDocuments: { en: "Review Documents →", bn: "ডকুমেন্ট পর্যালোচনা →" },
  documents: { en: "Documents", bn: "ডকুমেন্ট" },
  livenessVerified: { en: "✓ Verified", bn: "✓ যাচাইকৃত" },
  notCompleted: { en: "Not completed", bn: "সম্পন্ন হয়নি" },
  redo: { en: "Redo", bn: "পুনরায় করুন" },
  nidDetails: { en: "NID Details", bn: "NID তথ্য" },
  fullNameLabel: { en: "Full Name", bn: "পুরো নাম" },
  completeAllSteps: { en: "Please complete all steps before submitting.", bn: "জমা দেওয়ার আগে সকল ধাপ সম্পন্ন করুন।" },
  termsNote: { en: "By submitting, you confirm that the documents belong to you and the information is accurate. Your data is encrypted and processed securely.", bn: "জমা দিয়ে আপনি নিশ্চিত করছেন যে ডকুমেন্টগুলো আপনার এবং তথ্য সঠিক। আপনার ডেটা এনক্রিপ্টেড ও নিরাপদে প্রসেস করা হয়।" },
  encrypted256: { en: "256-bit Encrypted", bn: "২৫৬-বিট এনক্রিপ্টেড" },
  privateSecure: { en: "Private & Secure", bn: "ব্যক্তিগত ও নিরাপদ" },
  submitForVerification: { en: "Submit for Verification", bn: "যাচাইয়ের জন্য জমা দিন" },
  completeAllFirst: { en: "Complete All Steps First", bn: "প্রথমে সকল ধাপ সম্পন্ন করুন" },
  submittedTitle: { en: "Submitted!", bn: "জমা হয়েছে!" },
  kycSubmittedSub: { en: "Your KYC documents have been submitted successfully. We'll review them within 24–48 hours.", bn: "আপনার KYC ডকুমেন্ট সফলভাবে জমা হয়েছে। আমরা ২৪-৪৮ ঘণ্টার মধ্যে পর্যালোচনা করব।" },
  verificationStatus: { en: "Verification Status", bn: "যাচাই স্ট্যাটাস" },
  nidDocuments: { en: "NID Documents", bn: "NID ডকুমেন্ট" },
  frontBackUploaded: { en: "Front & back uploaded", bn: "সামনে ও পিছনে আপলোড হয়েছে" },
  faceVerified: { en: "Face verified successfully", bn: "মুখ সফলভাবে যাচাই হয়েছে" },
  reviewText: { en: "Review", bn: "পর্যালোচনা" },
  underReview: { en: "Under review · 24–48 hrs", bn: "পর্যালোচনাধীন · ২৪-৪৮ ঘণ্টা" },
  pendingUpper: { en: "PENDING", bn: "অপেক্ষমাণ" },
  dataProtected: { en: "Data Protected", bn: "ডেটা সুরক্ষিত" },
  backToAccount: { en: "Back to Account", bn: "অ্যাকাউন্টে ফিরুন" },

  // ─── Change PIN Flow ───
  changePinTitle: { en: "Change PIN", bn: "পিন পরিবর্তন" },
  keepAccountSecure: { en: "Keep Your Account Secure", bn: "আপনার অ্যাকাউন্ট নিরাপদ রাখুন" },
  enterCurrentPin: { en: "Enter Current PIN", bn: "বর্তমান পিন দিন" },
  confirmCurrentPinSub: { en: "Confirm your existing 4-digit PIN to continue", bn: "এগিয়ে যেতে আপনার বিদ্যমান ৪ সংখ্যার পিন নিশ্চিত করুন" },
  setNewPin: { en: "Set New PIN", bn: "নতুন পিন সেট করুন" },
  chooseStrongPin: { en: "Choose a strong 4-digit PIN you haven't used before", bn: "আগে ব্যবহার করেননি এমন একটি শক্তিশালী ৪ সংখ্যার পিন নির্বাচন করুন" },
  confirmNewPin: { en: "Confirm New PIN", bn: "নতুন পিন নিশ্চিত করুন" },
  reenterNewPin: { en: "Re-enter your new PIN to make sure it matches", bn: "মিলছে কিনা নিশ্চিত করতে আপনার নতুন পিন পুনরায় দিন" },
  incorrectPin: { en: "Incorrect PIN. Please try again.", bn: "ভুল পিন। আবার চেষ্টা করুন।" },
  pinTooSimple: { en: "PIN is too simple. Avoid sequential or repeated digits.", bn: "পিন খুবই সরল। ধারাবাহিক বা পুনরাবৃত্ত সংখ্যা এড়িয়ে চলুন।" },
  pinsDontMatch: { en: "PINs don't match. Please try again.", bn: "পিন মিলছে না। আবার চেষ্টা করুন।" },
  pinChanged: { en: "PIN Changed!", bn: "পিন পরিবর্তন হয়েছে!" },
  pinChangedSub: { en: "Your transaction PIN has been updated successfully. Use your new PIN for all future transactions.", bn: "আপনার লেনদেন পিন সফলভাবে আপডেট হয়েছে। ভবিষ্যতের সকল লেনদেনে আপনার নতুন পিন ব্যবহার করুন।" },
  pinTips: { en: "PIN tips:", bn: "পিন টিপস:" },
  avoidRepeated: { en: "Avoid repeated digits (e.g. 1111)", bn: "পুনরাবৃত্ত সংখ্যা এড়িয়ে চলুন (যেমন ১১১১)" },
  avoidSequential: { en: "Avoid sequential digits (e.g. 1234)", bn: "ধারাবাহিক সংখ্যা এড়িয়ে চলুন (যেমন ১২৩৪)" },
  dontSharePin: { en: "Don't share your PIN with anyone", bn: "কারো সাথে আপনার পিন শেয়ার করবেন না" },
  demoPin: { en: "Demo PIN:", bn: "ডেমো পিন:" },

  // ─── Spending Insights extras ───
  rechargeCount: { en: "recharge", bn: "রিচার্জ" },
  rechargesCount: { en: "recharges", bn: "রিচার্জ" },

  // ─── KYC Camera & AI ───
  cameraPermissionDenied: { en: "Camera permission denied. Please allow camera access.", bn: "ক্যামেরা অনুমতি প্রত্যাখ্যাত। ক্যামেরা অ্যাক্সেস অনুমতি দিন।" },
  cameraNotAvailable: { en: "Camera not available on this device.", bn: "এই ডিভাইসে ক্যামেরা উপলব্ধ নয়।" },
  photoCaptured: { en: "Photo captured successfully", bn: "ছবি সফলভাবে তোলা হয়েছে" },
  tryAgain: { en: "Try Again", bn: "আবার চেষ্টা করুন" },
  ocrExtracted: { en: "NID data extracted successfully!", bn: "এনআইডি তথ্য সফলভাবে বের করা হয়েছে!" },
  ocrFailed: { en: "Could not extract NID data. Please enter manually.", bn: "এনআইডি তথ্য বের করা যায়নি। ম্যানুয়ালি লিখুন।" },
  faceMatchSuccess: { en: "Face matched with NID!", bn: "মুখ এনআইডির সাথে মিলেছে!" },
  faceMatchFailed: { en: "Face did not match NID photo.", bn: "মুখ এনআইডি ছবির সাথে মেলেনি।" },
  faceMatchInconclusive: { en: "Face match inconclusive. Try again with better lighting.", bn: "মুখ মিলানো অনিশ্চিত। ভালো আলোতে আবার চেষ্টা করুন।" },
  faceMatchError: { en: "Face verification failed. Please try again.", bn: "মুখ যাচাই ব্যর্থ। আবার চেষ্টা করুন।" },
  notAuthenticated: { en: "Please sign in first", bn: "প্রথমে সাইন ইন করুন" },
  submitFailed: { en: "Submission failed. Please try again.", bn: "জমা ব্যর্থ। আবার চেষ্টা করুন।" },
  captureNidFront: { en: "Capture NID Front", bn: "এনআইডি সামনের দিক ক্যাপচার করুন" },
  captureNidFrontSub: { en: "Use your camera to capture the front of your NID card", bn: "আপনার এনআইডি কার্ডের সামনের দিক ক্যামেরা দিয়ে ক্যাপচার করুন" },
  alignNidGuide: { en: "Align your NID card within the frame", bn: "ফ্রেমের মধ্যে এনআইডি কার্ড রাখুন" },
  extractingNidData: { en: "AI is reading your NID card...", bn: "AI আপনার এনআইডি কার্ড পড়ছে..." },
  nidDataExtracted: { en: "NID data extracted by AI — review on next step", bn: "AI দ্বারা এনআইডি তথ্য বের করা হয়েছে — পরবর্তী ধাপে পর্যালোচনা করুন" },
  cameraTips: { en: "Camera Tips", bn: "ক্যামেরা টিপস" },
  processingKyc: { en: "Processing...", bn: "প্রক্রিয়াকরণ..." },
  captureNidToContinue: { en: "Capture NID front to continue", bn: "চালিয়ে যেতে এনআইডি সামনের দিক ক্যাপচার করুন" },
  captureNidBack: { en: "Capture NID Back", bn: "এনআইডি পিছনের দিক ক্যাপচার করুন" },
  captureNidBackSub: { en: "Now capture the back side of your NID card", bn: "এখন আপনার এনআইডি কার্ডের পিছনের দিক ক্যাপচার করুন" },
  alignNidBackGuide: { en: "Align the back of your NID card", bn: "আপনার এনআইডি কার্ডের পিছনের দিক সারিবদ্ধ করুন" },
  captureNidBackToContinue: { en: "Capture NID back to continue", bn: "চালিয়ে যেতে এনআইডি পিছনের দিক ক্যাপচার করুন" },
  aiExtractedBadge: { en: "✨ AI extracted these details from your NID. Tap ✎ to edit.", bn: "✨ AI আপনার এনআইডি থেকে এই তথ্য বের করেছে। সম্পাদনা করতে ✎ ট্যাপ করুন।" },
  fullNameBn: { en: "Full Name (Bengali)", bn: "পূর্ণ নাম (বাংলা)" },
  fatherName: { en: "Father's Name", bn: "পিতার নাম" },
  motherName: { en: "Mother's Name", bn: "মাতার নাম" },
  liveFaceVerification: { en: "Live Face Verification", bn: "লাইভ মুখ যাচাই" },
  liveFaceVerificationSub: { en: "Take a selfie to match with your NID photo", bn: "আপনার এনআইডি ছবির সাথে মেলাতে সেলফি তুলুন" },
  selfieCapture: { en: "Live Selfie", bn: "লাইভ সেলফি" },
  alignFaceGuide: { en: "Position your face within the oval guide", bn: "ডিম্বাকৃতি গাইডের মধ্যে আপনার মুখ রাখুন" },
  comparingFaces: { en: "Comparing faces with AI...", bn: "AI দিয়ে মুখ তুলনা করা হচ্ছে..." },
  aiAnalyzing: { en: "Analyzing facial features", bn: "মুখের বৈশিষ্ট্য বিশ্লেষণ করা হচ্ছে" },
  faceMatchedNid: { en: "✓ Face matched with NID photo", bn: "✓ মুখ এনআইডি ছবির সাথে মিলেছে" },
  faceNotMatched: { en: "✗ Face does not match NID photo", bn: "✗ মুখ এনআইডি ছবির সাথে মেলেনি" },
  faceInconclusive: { en: "Face match inconclusive", bn: "মুখ মিলানো অনিশ্চিত" },
  confidence: { en: "Confidence", bn: "আস্থা" },
  selfieTips: { en: "Selfie Tips", bn: "সেলফি টিপস" },
  tipLookStraight: { en: "Look straight at the camera", bn: "সোজা ক্যামেরার দিকে তাকান" },
  faceNotMatchedRetry: { en: "Your face didn't match the NID photo. Please retake with better lighting or remove obstructions.", bn: "আপনার মুখ এনআইডি ছবির সাথে মেলেনি। ভালো আলোতে আবার তুলুন।" },
  captured: { en: "Captured ✓", bn: "ক্যাপচার হয়েছে ✓" },
  notCaptured: { en: "Not captured", bn: "ক্যাপচার হয়নি" },
  faceVerification: { en: "Face Verification", bn: "মুখ যাচাই" },
  matched: { en: "Matched", bn: "মিলেছে" },
  submittingKyc: { en: "Submitting...", bn: "জমা হচ্ছে..." },
  submitted: { en: "Submitted", bn: "জমা দেওয়া হয়েছে" },
  frontBackCaptured: { en: "Front & back captured via camera", bn: "সামনে ও পিছনে ক্যামেরায় ক্যাপচার করা হয়েছে" },
  notExtracted: { en: "Not extracted", bn: "বের করা হয়নি" },

  // ─── Merchant API access — admin note labels ───
  apiAccessAdminApprovalNote: { en: "Admin's approval note", bn: "অ্যাডমিনের অনুমোদন নোট" },
  apiAccessAdminDenialReason: { en: "Admin's reason for denial", bn: "অ্যাডমিনের প্রত্যাখ্যানের কারণ" },
  apiAccessAdminReason: { en: "Admin's reason", bn: "অ্যাডমিনের কারণ" },
  apiAccessNoReasonProvided: {
    en: "No reason was provided. Please contact support for details.",
    bn: "কোনো কারণ দেওয়া হয়নি। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।",
  },

  // ─── Donations Page ───
  donations: { en: "Donations", bn: "অনুদান" },
  donate: { en: "Donate", bn: "অনুদান দিন" },
  chooseCause: { en: "Choose a Cause", bn: "একটি কারণ বেছে নিন" },
  generosityChanges: { en: "Your generosity changes lives", bn: "আপনার দান জীবন বদলায়" },
  recurringTab: { en: "Recurring", bn: "নিয়মিত" },
  topTab: { en: "Top", bn: "শীর্ষ" },
  changeCause: { en: "Change cause", bn: "কারণ পরিবর্তন" },
  raisedSuffix: { en: "raised", bn: "সংগৃহীত" },
  causeEducation: { en: "Education", bn: "শিক্ষা" },
  causeEducationDesc: { en: "Support students in need", bn: "অভাবী শিক্ষার্থীদের সহায়তা" },
  causeDisaster: { en: "Disaster Relief", bn: "দুর্যোগ সহায়তা" },
  causeDisasterDesc: { en: "Help communities rebuild", bn: "সম্প্রদায়কে পুনর্নির্মাণে সাহায্য" },
  causeHealthcare: { en: "Healthcare", bn: "স্বাস্থ্যসেবা" },
  causeHealthcareDesc: { en: "Access to medical care", bn: "চিকিৎসা সেবা প্রদান" },
  causeWater: { en: "Clean Water", bn: "পরিষ্কার পানি" },
  causeWaterDesc: { en: "Safe drinking water for all", bn: "সবার জন্য নিরাপদ পানীয় জল" },
  causeFood: { en: "Food Security", bn: "খাদ্য নিরাপত্তা" },
  causeFoodDesc: { en: "Fight hunger together", bn: "একসাথে ক্ষুধার বিরুদ্ধে লড়াই" },
  causeOrphan: { en: "Orphan Support", bn: "এতিম সহায়তা" },
  causeOrphanDesc: { en: "A better future for children", bn: "শিশুদের জন্য উজ্জ্বল ভবিষ্যৎ" },

  // ─── Coupons Page ───
  coupons: { en: "Coupons", bn: "কুপন" },
  noCouponsYet: { en: "No coupons yet", bn: "এখনো কোনো কুপন নেই" },
  noCouponsDesc: { en: "We'll notify you when new offers arrive", bn: "নতুন অফার এলে আমরা জানাবো" },
  redeem: { en: "Redeem", bn: "ব্যবহার করুন" },
  expiredLabel: { en: "Expired", bn: "মেয়াদ শেষ" },
  endsTomorrow: { en: "Ends tomorrow", bn: "আগামীকাল শেষ" },
  daysLeftSuffix: { en: "days left", bn: "দিন বাকি" },
  daysRemainingSuffix: { en: "d remaining", bn: "দিন বাকি" },

  // ─── PayPage error state ───
  merchantNotFound: { en: "Merchant Not Found", bn: "মার্চেন্ট পাওয়া যায়নি" },
  merchantNotFoundDescPrefix: { en: "The merchant code", bn: "মার্চেন্ট কোড" },
  merchantNotFoundDescSuffix: { en: "could not be resolved.", bn: "সমাধান করা যায়নি।" },
  loadingPayment: { en: "Loading payment…", bn: "পেমেন্ট লোড হচ্ছে…" },
} as const;

export type TranslationKey = keyof typeof translations;
export const translationsMap = translations;

/** Dev-only registry of keys requested but missing in current language. */
const missingKeys = new Set<string>();
const warnedKeys = new Set<string>();
/** key::lang -> Set of source file references (e.g. "src/pages/AccountPage.tsx:123") */
const missingSources = new Map<string, Set<string>>();
type Listener = () => void;
const listeners = new Set<Listener>();

export interface MissingTranslationEntry {
  key: string;
  lang: Lang;
  sources: string[];
}

let cachedSnapshot: MissingTranslationEntry[] = [];
function rebuildSnapshot() {
  cachedSnapshot = Array.from(missingKeys).map((id) => {
    const [key, lang] = id.split("::") as [string, Lang];
    return { key, lang, sources: Array.from(missingSources.get(id) ?? []) };
  });
}

export function getMissingTranslationKeys(): string[] {
  return Array.from(missingKeys);
}

export function getMissingTranslations(): MissingTranslationEntry[] {
  return cachedSnapshot;
}

export function subscribeMissingTranslations(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifyMissing() {
  rebuildSnapshot();
  listeners.forEach((l) => l());
}

export function resetMissingTranslationKeys(): void {
  missingKeys.clear();
  warnedKeys.clear();
  missingSources.clear();
  notifyMissing();
}


/** Parse a stack trace and return the first frame inside src/ that isn't i18n.tsx itself. */
function inferCallerSource(): string | null {
  try {
    const stack = new Error().stack;
    if (!stack) return null;
    for (const line of stack.split("\n")) {
      const m = line.match(/\/src\/([^)\s:]+\.(?:tsx?|jsx?)):(\d+):\d+/);
      if (!m) continue;
      if (m[1].endsWith("lib/i18n.tsx")) continue;
      return `src/${m[1]}:${m[2]}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

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
    (key: TranslationKey) => {
      const entry = (translations as Record<string, { en: string; bn: string } | undefined>)[key as string];
      const value = entry?.[lang];
      if (!value) {
        const id = `${String(key)}::${lang}`;
        const isNew = !missingKeys.has(id);
        missingKeys.add(id);
        if (import.meta.env.DEV) {
          const src = inferCallerSource();
          if (src) {
            let set = missingSources.get(id);
            if (!set) {
              set = new Set();
              missingSources.set(id, set);
            }
            set.add(src);
          }
          if (!warnedKeys.has(id)) {
            warnedKeys.add(id);
            // eslint-disable-next-line no-console
            console.warn(
              `[i18n] Missing translation for "${String(key)}" (lang=${lang})${src ? ` at ${src}` : ""}`
            );
          }
          if (isNew) {
            // Defer to avoid render-phase setState in subscribers.
            queueMicrotask(() => listeners.forEach((l) => l()));
          }
        }
        // Visible fallback so QA can spot gaps in the UI
        return `⟦${String(key)}⟧`;
      }
      return value;
    },
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
