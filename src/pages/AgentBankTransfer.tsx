import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Landmark, CheckCircle2, Home, Plus, Trash2, Send, ArrowDownToLine,
  Building2, CreditCard, User, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";

import { useSavedBanks, SavedBankAccount } from "@/hooks/use-saved-banks";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const genRef = () => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; };

const BANKS = ["Dutch-Bangla Bank", "Brac Bank", "City Bank", "Eastern Bank", "Islami Bank", "Janata Bank", "Sonali Bank", "Southeast Bank", "UCB", "Other"];

type Mode = "send" | "receive";
type Step = "select" | "form" | "confirm" | "done";

const AgentBankTransfer = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accounts, save, remove, refetch } = useSavedBanks();

  const [mode, setMode] = useState<Mode>("send");
  const [step, setStep] = useState<Step>("select");
  const [selectedAccount, setSelectedAccount] = useState<SavedBankAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [processing, setProcessing] = useState(false);

  // Add bank form
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newAccNumber, setNewAccNumber] = useState("");
  const [newAccHolder, setNewAccHolder] = useState("");
  const [newShortCode, setNewShortCode] = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<SavedBankAccount | null>(null);

  const fee = mode === "send" ? (Number(amount) > 100 ? 5 : 0) : 0;

  const handleSaveBank = async () => {
    if (!newBankName || !newAccNumber || !newAccHolder) {
      toast({ title: "Missing fields", description: "Fill all bank details", variant: "destructive" });
      return;
    }
    await save({
      bank_name: newBankName,
      account_number: newAccNumber,
      account_holder: newAccHolder,
      short_code: newShortCode || newBankName.slice(0, 3).toUpperCase(),
    });
    toast({ title: "Bank Saved", description: `${newBankName} account added` });
    setShowAddBank(false);
    setNewBankName(""); setNewAccNumber(""); setNewAccHolder(""); setNewShortCode("");
  };

  const handleDeleteBank = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget.id);
    toast({ title: "Removed", description: `${deleteTarget.bank_name} account deleted` });
    setDeleteTarget(null);
  };

  const handleConfirm = async () => {
    if (processing || !selectedAccount) return;
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
  };

  const progressPct = step === "select" ? "25%" : step === "form" ? "50%" : step === "confirm" ? "75%" : "100%";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-hero px-4 pt-3 pb-3 sticky top-0 z-30"
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
                  {mode === "send" && Number(amount) > 100 && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">Fee: ৳5</p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[5000, 10000, 25000, 50000].map(a => (
                    <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground press-effect hover:bg-primary/10 hover:text-primary transition-colors">
                      ৳{fmt(a)}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!amount || Number(amount) < 10}
                  className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold"
                >
                  Continue
                </Button>
              </Card>
            </motion.div>
          )}

          {/* ── STEP: Confirm ── */}
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
                <div>
                  <Label className="text-xs font-semibold">Enter PIN</Label>
                  <Input
                    type="password" inputMode="numeric" maxLength={4}
                    value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1"
                  />
                </div>
                <SlideToConfirm
                  onConfirm={handleConfirm}
                  disabled={pin.length < 4 || processing}
                  label={processing ? "Processing…" : `Slide to ${mode === "send" ? "Send" : "Receive"}`}
                  icon={Building2}
                />
                <Button variant="ghost" onClick={() => setStep("form")} className="w-full text-muted-foreground">Cancel</Button>
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

                <div>
                  <Label className="text-xs font-semibold">Bank Name</Label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    {BANKS.map(b => (
                      <button
                        key={b}
                        onClick={() => { setNewBankName(b); setNewShortCode(b.slice(0, 3).toUpperCase()); }}
                        className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all truncate ${
                          newBankName === b ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
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
