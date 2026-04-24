import { useState, useEffect, useCallback } from "react";
import { useRealtimeIndicator } from "@/hooks/use-realtime-indicator";
import RealtimeUpdateIndicator from "@/components/admin/RealtimeUpdateIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { verifyPin } from "@/lib/verifyPin";
import { format } from "date-fns";
import {
  Wallet, TrendingUp, HandCoins, Search, Send, RefreshCw,
  ArrowDownCircle, ArrowUpCircle, Coins, Landmark, Filter,
  CalendarIcon, Download, CheckCircle2, FileText, BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fireSuccessConfetti } from "@/lib/confetti";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface Treasury {
  id: string;
  balance: number;
  total_earnings: number;
  total_commissions_paid: number;
  total_disbursed: number;
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  counterparty_user_id: string | null;
  counterparty_role: string | null;
  description: string | null;
  reference: string | null;
  actor_id: string | null;
  created_at: string;
}

interface FoundUser {
  user_id: string;
  name: string | null;
  phone: string;
  balance: number;
  roles: string[];
}

interface DisbursementReceipt {
  recipientName: string;
  recipientPhone: string;
  amount: number;
  oldTreasuryBalance: number;
  newTreasuryBalance: number;
  oldRecipientBalance: number;
  newRecipientBalance: number;
  reference: string;
  timestamp: Date;
}

const LEDGER_TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Wallet }> = {
  initial_deposit: { label: "Initial Deposit", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Landmark },
  disburse: { label: "Disbursement", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: Send },
  earning: { label: "Earning", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: TrendingUp },
  commission_paid: { label: "Commission", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: HandCoins },
  user_addmoney: { label: "Add Money Debit", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: ArrowDownCircle },
};

function formatBDT(amount: number) {
  return `৳${amount.toLocaleString("en-BD")}`;
}

export default function AdminTreasury() {
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const { visible, flash } = useRealtimeIndicator();
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Send funds state
  const [searchPhone, setSearchPhone] = useState("");
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [sendAmount, setSendAmount] = useState("");
  const [sendDescription, setSendDescription] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showPinStep, setShowPinStep] = useState(false);
  const [receipt, setReceipt] = useState<DisbursementReceipt | null>(null);

  const loadTreasury = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from("platform_treasury").select("*").limit(1).single(),
      supabase.from("treasury_ledger").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (t) setTreasury(t as unknown as Treasury);
    if (l) setLedger(l as unknown as LedgerEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadTreasury(); }, [loadTreasury]);

  // Fire confetti when receipt appears
  useEffect(() => {
    if (receipt) fireSuccessConfetti();
  }, [receipt]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("treasury-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_treasury" }, () => { loadTreasury(); flash(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "treasury_ledger" }, () => { loadTreasury(); flash(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTreasury]);

  const searchUser = async () => {
    if (!searchPhone || searchPhone.length < 3) return;
    setSearching(true);
    setFoundUser(null);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, name, phone, balance")
      .eq("phone", searchPhone)
      .single();

    if (!profile) {
      toast.error("User not found");
      setSearching(false);
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id);

    setFoundUser({
      ...profile,
      roles: roles?.map(r => r.role) || ["customer"],
    });
    setSearching(false);
  };

  const handleSendFunds = async () => {
    if (!foundUser || !sendAmount || !pinInput) return;
    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid amount");
      return;
    }
    if (treasury && amount > treasury.balance) {
      toast.error("Amount exceeds treasury balance");
      return;
    }

    setSending(true);
    const pinValid = await verifyPin(pinInput);
    if (!pinValid) {
      toast.error("Invalid PIN");
      setSending(false);
      return;
    }

    const { data, error } = await supabase.rpc("admin_disburse_funds", {
      p_target_phone: foundUser.phone,
      p_amount: amount,
      p_description: sendDescription || `Admin disbursement to ${foundUser.name || foundUser.phone}`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      const result = data as unknown as { success: boolean; new_treasury_balance: number; target_new_balance: number; target_name: string };
      
      const oldTreasuryBal = treasury?.balance ?? 0;
      const oldRecipientBal = foundUser.balance;

      // Optimistic UI update using RPC response data
      if (result && treasury) {
        setTreasury(prev => prev ? { ...prev, balance: result.new_treasury_balance, total_disbursed: prev.total_disbursed + amount } : prev);
      }

      // Build receipt
      setReceipt({
        recipientName: foundUser.name || "Unknown",
        recipientPhone: foundUser.phone,
        amount,
        oldTreasuryBalance: oldTreasuryBal,
        newTreasuryBalance: result?.new_treasury_balance ?? oldTreasuryBal - amount,
        oldRecipientBalance: oldRecipientBal,
        newRecipientBalance: result?.target_new_balance ?? oldRecipientBal + amount,
        reference: `DISB-${format(new Date(), "yyyyMMdd-HHmmss")}`,
        timestamp: new Date(),
      });

      toast.success(`৳${amount.toLocaleString()} sent to ${foundUser.name || foundUser.phone}`);
      setSearchPhone("");
      setFoundUser(null);
      setSendAmount("");
      setSendDescription("");
      setPinInput("");
      setShowPinStep(false);
      
      // Delayed full refetch for ledger + consistency
      setTimeout(() => loadTreasury(), 500);
    }
    setSending(false);
  };

  const filteredLedger = ledger.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (dateFrom) {
      const entryDate = new Date(e.created_at);
      if (entryDate < dateFrom) return false;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      const entryDate = new Date(e.created_at);
      if (entryDate > end) return false;
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ["Type", "Amount", "Balance After", "Counterparty Role", "Description", "Reference", "Date"];
    const rows = filteredLedger.map(e => [
      LEDGER_TYPE_CONFIG[e.type]?.label || e.type,
      e.amount,
      e.balance_after,
      e.counterparty_role || "",
      (e.description || "").replace(/,/g, " "),
      e.reference || "",
      new Date(e.created_at).toISOString(),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treasury-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const handlePrintReceipt = () => {
    if (!receipt) return;
    const doc = new jsPDF();
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("EasyPay", 105, 16, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Disbursement Receipt", 105, 28, { align: "center" });
    doc.setTextColor(0, 0, 0);
    autoTable(doc, {
      startY: 45,
      head: [["Field", "Details"]],
      body: [
        ["Recipient", receipt.recipientName],
        ["Phone", receipt.recipientPhone],
        ["Amount", `BDT ${receipt.amount.toLocaleString()}`],
        ["Old Treasury Balance", `BDT ${receipt.oldTreasuryBalance.toLocaleString()}`],
        ["New Treasury Balance", `BDT ${receipt.newTreasuryBalance.toLocaleString()}`],
        ["Old Recipient Balance", `BDT ${receipt.oldRecipientBalance.toLocaleString()}`],
        ["New Recipient Balance", `BDT ${receipt.newRecipientBalance.toLocaleString()}`],
        ["Reference", receipt.reference],
        ["Timestamp", format(receipt.timestamp, "MMM d, yyyy · HH:mm:ss")],
      ],
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 10 },
    });
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Powered by EasyPay", 105, pageHeight - 10, { align: "center" });
    doc.save(`receipt-${receipt.reference}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RealtimeUpdateIndicator visible={visible} />
      {/* ═══ Overview Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-[var(--shadow-card)] bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-primary flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium text-muted-foreground leading-snug">Platform Balance</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-foreground break-words leading-tight">{formatBDT(treasury?.balance ?? 0)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground leading-snug">Total Earnings</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-foreground break-words leading-tight">{formatBDT(treasury?.total_earnings ?? 0)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-500 flex items-center justify-center">
                  <HandCoins className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground leading-snug">Commissions Paid</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-foreground break-words leading-tight">{formatBDT(treasury?.total_commissions_paid ?? 0)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-500 flex items-center justify-center">
                  <ArrowUpCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground leading-snug">Total Disbursed</span>
              </div>
              <p className="text-xl md:text-2xl font-bold text-foreground break-words leading-tight">{formatBDT(treasury?.total_disbursed ?? 0)}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ═══ Send Funds Section ═══ */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" /> Send Treasury Funds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter phone number…"
                className="pl-10"
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchUser()}
              />
            </div>
            <Button onClick={searchUser} disabled={searching} variant="outline">
              {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {/* Found user */}
          {foundUser && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  {(foundUser.name?.[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{foundUser.name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{foundUser.phone} · Balance: ৳{foundUser.balance.toLocaleString()}</p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {foundUser.roles.map(r => (
                    <Badge key={r} variant="secondary" className="text-xs capitalize">{r}</Badge>
                  ))}
                </div>
              </div>

              {!showPinStep ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    placeholder="Amount (৳)"
                    value={sendAmount}
                    onChange={e => setSendAmount(e.target.value)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={sendDescription}
                    onChange={e => setSendDescription(e.target.value)}
                  />
                  <Button
                    className="sm:col-span-2"
                    disabled={!sendAmount || parseFloat(sendAmount) <= 0}
                    onClick={() => setShowPinStep(true)}
                  >
                    <Send className="w-4 h-4 mr-2" /> Continue to PIN
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sending <strong>৳{parseFloat(sendAmount).toLocaleString()}</strong> to <strong>{foundUser.name || foundUser.phone}</strong>
                  </p>
                  <Input
                    type="password"
                    maxLength={4}
                    placeholder="Enter your 4-digit PIN"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value.replace(/\D/g, ""))}
                    className="max-w-48"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSendFunds} disabled={pinInput.length !== 4 || sending}>
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                      Confirm & Send
                    </Button>
                    <Button variant="outline" onClick={() => { setShowPinStep(false); setPinInput(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Disbursement Receipt ═══ */}
      {receipt && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", damping: 20 }}>
          <Card className="border-0 shadow-[var(--shadow-card)] overflow-hidden">
            <div className="bg-emerald-500 dark:bg-emerald-600 px-5 py-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span className="font-semibold text-white text-sm">Disbursement Successful</span>
            </div>
            <CardContent className="p-5 space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">৳{receipt.amount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  sent to <strong>{receipt.recipientName}</strong> ({receipt.recipientPhone})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Treasury side */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> Platform Treasury
                  </p>
                  <p className="text-sm text-muted-foreground line-through">{formatBDT(receipt.oldTreasuryBalance)}</p>
                  <p className="text-base font-bold text-foreground">{formatBDT(receipt.newTreasuryBalance)}</p>
                </div>
                {/* Recipient side */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Recipient Balance
                  </p>
                  <p className="text-sm text-muted-foreground line-through">৳{receipt.oldRecipientBalance.toLocaleString()}</p>
                  <p className="text-base font-bold text-foreground">৳{receipt.newRecipientBalance.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                <span>Ref: {receipt.reference}</span>
                <span>{format(receipt.timestamp, "MMM d, yyyy · HH:mm:ss")}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={handlePrintReceipt}>
                  <FileText className="w-4 h-4 mr-1.5" /> Print Receipt
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setReceipt(null)}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ Treasury Ledger ═══ */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" /> Treasury Ledger
            </CardTitle>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={exportCSV}>
              <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("text-xs h-7 justify-start", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("text-xs h-7 justify-start", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  {dateTo ? format(dateTo, "MMM d, yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                Clear dates
              </Button>
            )}
            <div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5 ml-auto">
              {["all", "earning", "disburse", "user_addmoney", "commission_paid", "initial_deposit"].map(f => (
                <button
                  key={f}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterType === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setFilterType(f)}
                >
                  {f === "all" ? "All" : LEDGER_TYPE_CONFIG[f]?.label || f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Balance After</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map(entry => {
                  const config = LEDGER_TYPE_CONFIG[entry.type] || { label: entry.type, color: "bg-muted text-muted-foreground", icon: Coins };
                  const isDebit = ["disburse", "user_addmoney", "commission_paid"].includes(entry.type);
                  return (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`text-xs ${config.color}`}>
                          {config.label}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${isDebit ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {isDebit ? "-" : "+"}৳{entry.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {formatBDT(entry.balance_after)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell max-w-xs truncate">
                        {entry.description || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(entry.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredLedger.length === 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                <BookOpen className="w-7 h-7 text-muted-foreground" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">No ledger entries</p>
              <p className="text-xs text-muted-foreground mt-1">Ledger entries will appear here</p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
