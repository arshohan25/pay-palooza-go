import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Landmark, CheckCircle2, Home, Plus, Trash2, Send, ArrowDownToLine,
  Building2, CreditCard, User, X, Search, ChevronDown, ShieldCheck, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";
import { verifyPin } from "@/lib/verifyPin";
import { BANGLADESH_BANKS } from "@/lib/bangladeshBanks";

import { useSavedBanks, SavedBankAccount } from "@/hooks/use-saved-banks";
import { useFeeConfig } from "@/hooks/use-fee-config";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const genRef = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };

type Mode = "send" | "receive";
type Step = "select" | "form" | "pin" | "confirm" | "done";

const AgentBankTransfer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accounts, save, remove, refetch } = useSavedBanks();

  const [mode, setMode] = useState<Mode>("send");
  const [step, setStep] = useState<Step>("select");
  const [selectedAccount, setSelectedAccount] = useState<SavedBankAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Add bank form
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newAccHolder, setNewAccHolder] = useState("");
  const [newShortCode, setNewShortCode] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SavedBankAccount | null>(null);

  const { calcBankTransferFee, getFeeLabel } = useFeeConfig();
  const fee = mode === "send" ? calcBankTransferFee(Number(amount)) : 0;

  const filteredBanks = useMemo(() => {
    if (!bankSearch.trim()) return BANGLADESH_BANKS;
    const q = bankSearch.toLowerCase();
    return BANGLADESH_BANKS.filter(b => b.name.toLowerCase().includes(q) || b.short.toLowerCase().includes(q));
  }, [bankSearch]);

  const selectedNewBank = BANGLADESH_BANKS.find(b => b.name === newBankName);

  const handleSaveBank = async () => {
    if (!newBankName || !newAccNumber || !newAccHolder) {
      toast({ title: "Missing fields", description: "Fill all bank details", variant: "destructive" });
      return;
    }
    await save({
      bank_name: newBankName,
      account_number: newAccNumber,
      account_holder: newAccHolder,
      short_code: newShortCode || BANGLADESH_BANKS.find(b => b.name === newBankName)?.short || newBankName.slice(0, 3).toUpperCase(),
    });
    toast({ title: "Bank Saved", description: `${newBankName} account added` });
    setShowAddBank(false);
    setNewBankName(""); setNewAccNumber(""); setNewAccHolder(""); setNewShortCode(""); setBankSearch("");
  };

  const handleDeleteBank = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast({ title: "Removed", description: `${deleteTarget.bank_name} account deleted` });
    setDeleteTarget(null);
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) { setPinError("Enter your 4-digit PIN."); return; }
    setProcessing(true);
    setPinError("");
    try {
      const valid = await verifyPin(pin);
      if (!valid) { setPinError("Incorrect PIN. Try again."); setPin(""); setProcessing(false); return; }
      setPinVerified(true);
      setStep("confirm");
    } catch (e: any) {
      setPinError(e.message || "Verification failed.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSlideConfirm = async () => {
    if (processing || !selectedAccount || !pinVerified) return;
    setProcessing(true);
    try {
      const txType = mode === "send" ? "banktransfer" : "addmoney";
      const { error } = await supabase.rpc("record_transaction", {
        p_type: txType as any,
        p_amount: Number(amount),
        p_fee: fee,
        p_recipient_name: selectedAccount.account_holder,
        p_recipient_phone: selectedAccount.account_number,
        p_description: `Bank ${mode === "send" ? "Send" : "Receive"} — ${selectedAccount.bank_name}`,
        p_reference: genRef(),
      });
      if (error) throw error;
      setStep("done");
      toast({ title: `Bank ${mode === "send" ? "Transfer" : "Deposit"} Successful`, description: `৳${amount} ${mode === "send" ? "sent to" : "received from"} ${selectedAccount.bank_name}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setStep("select");
    setSelectedAccount(null);
    setAmount("");
    setPin("");
    setPinError("");
    setPinVerified(false);
  };

  const progressPct = step === "select" ? "25%" : step === "form" ? "50%" : step === "pin" ? "65%" : step === "confirm" ? "85%" : "100%";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-send px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => step === "select" ? navigate("/agent") : reset()} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <Landmark size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Bank Transfer</h1>
              <p className="text-[9px] text-primary-foreground/60">
                {mode === "send" ? "Send to Bank" : "Receive from Bank"}
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-xl mx-auto mt-3">
          <div className="h-1.5 bg-primary-foreground/10 rounded-full overflow-hidden">
            <motion.div animate={{ width: progressPct }} className="h-full bg-primary-foreground/40 rounded-full" transition={{ duration: 0.4 }} />
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        {/* Mode toggle */}
        {step === "select" && (
          <div className="grid grid-cols-2 gap-2 mb-5">
            {(["send", "receive"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === m ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-muted text-muted-foreground"
                }`}
              >
                {m === "send" ? <Send size={14} /> : <ArrowDownToLine size={14} />}
                {m === "send" ? "Send to Bank" : "Receive from Bank"}
              </button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── STEP: Select Account ── */}
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-foreground">Saved Accounts</p>
                <Button size="sm" variant="outline" onClick={() => setShowAddBank(true)} className="text-xs gap-1.5 rounded-xl h-8">
                  <Plus size={14} /> Add Bank
                </Button>
              </div>

              {accounts.length === 0 ? (
                <Card className="p-8 border-0 shadow-card rounded-2xl text-center space-y-3">
                  <Landmark size={36} className="mx-auto text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No saved bank accounts</p>
                  <Button onClick={() => setShowAddBank(true)} className="gradient-primary text-primary-foreground rounded-xl h-10 text-xs font-bold gap-1.5">
                    <Plus size={14} /> Add Your First Bank
                  </Button>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {accounts.map((acc, i) => (
                    <motion.div
                      key={acc.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card
                        className="p-4 border-0 shadow-card rounded-2xl flex items-center gap-3 cursor-pointer hover:shadow-elevated transition-shadow press-effect"
                        onClick={() => { setSelectedAccount(acc); setStep("form"); }}
                      >
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 size={18} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-foreground truncate">{acc.bank_name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {acc.account_holder} · ****{acc.account_number.slice(-4)}
                          </p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(acc); }}
                          className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors tap-target"
                        >
                          <Trash2 size={14} />
                        </button>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── STEP: Amount Form ── */}
          {step === "form" && selectedAccount && (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
                {/* Selected bank info */}
                <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-foreground">{selectedAccount.bank_name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedAccount.account_holder} · ****{selectedAccount.account_number.slice(-4)}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Amount (৳)</Label>
                  <Input
                    type="text" inputMode="numeric" placeholder="Enter amount"
                    value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))}
                    className="rounded-xl h-12 mt-1 text-lg font-bold"
                  />
                  {mode === "send" && fee > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">Fee: ৳{fmt(fee)} ({getFeeLabel("banktransfer")})</p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[5000, 10000, 25000, 50000].map(a => (
                    <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground press-effect hover:bg-primary/10 hover:text-primary transition-colors">
                      ৳{fmt(a)}
                    </button>
                  ))}
                </div>

                {amount && Number(amount) >= 10 && (
                  <Button
                    onClick={() => setStep("pin")}
                    className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold animate-fade-in"
                  >
                    Continue
                  </Button>
                )}
              </Card>
            </motion.div>
          )}

          {/* ── STEP: PIN ── */}
          {step === "pin" && selectedAccount && (
            <motion.div key="pin" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-2xl">
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <ShieldCheck size={32} className="text-primary" />
                  </div>
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-foreground">Enter Your PIN</h2>
                    <p className="text-sm text-muted-foreground">
                      Confirm {mode === "send" ? "transfer" : "deposit"} of ৳{fmt(Number(amount) + fee)}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${pin.length > i ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}>
                        {pin.length > i ? "•" : ""}
                      </div>
                    ))}
                  </div>
                  <div className="w-full max-w-[200px]">
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Enter 4-digit PIN"
                      value={pin}
                      onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPin(v); setPinError(""); }}
                      className="text-center text-lg tracking-[0.5em] rounded-xl h-12"
                      autoFocus
                    />
                  </div>
                  {pinError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{pinError}</p>}
                  <Button
                    className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold"
                    onClick={handlePinSubmit}
                    disabled={processing || pin.length !== 4}
                  >
                    {processing ? "Verifying…" : "Verify PIN"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setStep("form"); setPin(""); setPinError(""); }} className="w-full text-muted-foreground">Back</Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── STEP: Confirm (Slide) ── */}
          {step === "confirm" && selectedAccount && (
            <motion.div key="confirm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
                <h3 className="text-base font-extrabold text-foreground text-center">
                  Confirm Bank {mode === "send" ? "Transfer" : "Deposit"}
                </h3>
                <div className="space-y-2.5 bg-muted/50 rounded-xl p-4">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bank</span><span className="font-bold text-foreground">{selectedAccount.bank_name}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Account</span><span className="font-bold text-foreground">****{selectedAccount.account_number.slice(-4)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Holder</span><span className="font-bold text-foreground">{selectedAccount.account_holder}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
                  {fee > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Fee</span><span className="font-bold text-foreground">৳{fmt(fee)}</span></div>}
                  <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-2">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-foreground">৳{fmt(Number(amount) + fee)}</span>
                  </div>
                </div>
                <SlideToConfirm
                  onConfirm={handleSlideConfirm}
                  disabled={processing}
                  label={processing ? "Processing…" : `Slide to ${mode === "send" ? "Send" : "Receive"}`}
                  icon={Building2}
                />
                <Button variant="ghost" onClick={() => { setStep("pin"); setPin(""); setPinError(""); setPinVerified(false); }} className="w-full text-muted-foreground">Cancel</Button>
              </Card>
            </motion.div>
          )}

          {/* ── STEP: Done ── */}
          {step === "done" && selectedAccount && (
            <motion.div key="done" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-primary" />
                </motion.div>
                <div>
                  <p className="text-lg font-extrabold text-foreground">
                    {mode === "send" ? "Transfer Successful" : "Deposit Successful"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ৳{fmt(Number(amount))} {mode === "send" ? "sent to" : "received from"} {selectedAccount.bank_name}
                  </p>
                </div>
                {fee > 0 && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground">Fee charged</p>
                    <p className="text-sm font-bold text-foreground">৳{fmt(fee)}</p>
                  </div>
                )}
                <Button onClick={reset} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">
                  New Transfer
                </Button>
                <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2">
                  <Home size={16} /> Back to Dashboard
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Add Bank Sheet ── */}
      <AnimatePresence>
        {showAddBank && (
          <>
            <motion.div key="add-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" onClick={() => setShowAddBank(false)} />
            <motion.div
              key="add-sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed bottom-0 left-0 right-0 z-[71] bg-card rounded-t-3xl shadow-float max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted-foreground/25" /></div>
              <div className="px-5 pt-2 pb-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-foreground">Add Bank Account</h3>
                  <button onClick={() => setShowAddBank(false)} className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                    <X size={15} />
                  </button>
                </div>

                {/* Searchable bank dropdown */}
                <div>
                  <Label className="text-xs font-semibold">Bank Name</Label>
                  <Popover open={bankDropdownOpen} onOpenChange={setBankDropdownOpen}>
                    <PopoverTrigger asChild>
                      <button className="w-full flex items-center gap-3 p-3 mt-1.5 rounded-xl border border-border bg-card hover:border-primary/50 transition-all text-left">
                        {selectedNewBank ? (
                          <>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: selectedNewBank.color }}>
                              {selectedNewBank.short.slice(0, 2)}
                            </div>
                            <span className="flex-1 text-sm font-semibold text-foreground truncate">{selectedNewBank.name}</span>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Landmark size={14} className="text-muted-foreground" />
                            </div>
                            <span className="flex-1 text-sm text-muted-foreground">Choose a bank…</span>
                          </>
                        )}
                        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-60 overflow-hidden" align="start">
                      <div className="p-2 border-b border-border">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search banks…"
                            value={bankSearch}
                            onChange={e => setBankSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-48">
                        {filteredBanks.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No banks found</p>
                        ) : (
                          filteredBanks.map(b => (
                            <button
                              key={b.id}
                              onClick={() => { setNewBankName(b.name); setNewShortCode(b.short); setBankDropdownOpen(false); setBankSearch(""); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${newBankName === b.name ? "bg-primary/10" : ""}`}
                            >
                              <div className="w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: b.color }}>
                                {b.short.slice(0, 2)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{b.name}</p>
                              </div>
                              {newBankName === b.name && <CheckCircle2 size={12} className="text-primary shrink-0" />}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5"><CreditCard size={12} /> Account Number</Label>
                  <Input
                    type="text" inputMode="numeric" placeholder="Enter account number"
                    value={newAccNumber} onChange={e => setNewAccNumber(e.target.value.replace(/\D/g, ""))}
                    maxLength={20} className="rounded-xl h-11 mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5"><User size={12} /> Account Holder Name</Label>
                  <Input
                    placeholder="Enter full name" value={newAccHolder}
                    onChange={e => setNewAccHolder(e.target.value)} maxLength={60}
                    className="rounded-xl h-11 mt-1"
                  />
                </div>

                <Button
                  onClick={handleSaveBank}
                  disabled={!newBankName || !newAccNumber || !newAccHolder}
                  className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold"
                >
                  Save Bank Account
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Bank Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-semibold">{deleteTarget?.bank_name}</span> (****{deleteTarget?.account_number.slice(-4)}) from your saved accounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBank} className="bg-destructive text-destructive-foreground rounded-xl">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AgentBankTransfer;
