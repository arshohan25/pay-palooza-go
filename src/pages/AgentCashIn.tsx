import { normalizeBDPhoneInput } from "@/lib/phoneInput";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpFromLine, CheckCircle2, Home, HandCoins, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";
import { supabase } from "@/integrations/supabase/client";
import { usePhoneValidation } from "@/hooks/use-phone-validation";
import QrScannerModal from "@/components/QrScannerModal";
import { parseQrData } from "@/lib/qrParser";
import { verifyPin } from "@/lib/verifyPin";
import { useI18n } from "@/lib/i18n";




const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);
const COMMISSION_RATE = 0.0049;

const AgentCashIn = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [processing, setProcessing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [resolvedName, setResolvedName] = useState("");
  const [walletStatus, setWalletStatus] = useState<"idle" | "checking" | "valid" | "not_found" | "not_user">("idle");
  const [walletChecking, setWalletChecking] = useState(false);
  const phoneValidation = usePhoneValidation(phone);
  const commission = Number(amount) > 0 ? Math.round(Number(amount) * COMMISSION_RATE * 100) / 100 : 0;

  useEffect(() => {
    if (phone.length !== 11 || !phone.startsWith("01")) {
      setWalletStatus("idle");
      setResolvedName("");
      return;
    }
    let cancelled = false;
    const verify = async () => {
      setWalletStatus("checking");
      setWalletChecking(true);
      try {
        const { data, error } = await supabase.rpc("get_customer_daily_cashin_usage", { p_phone: phone });
        if (cancelled) return;
        if (error) throw error;
        const row = (data as any)?.[0] ?? {};
        if (!row.customer_user_id) {
          setWalletStatus("not_found");
          setResolvedName("");
        } else if (!row.is_user_wallet) {
          setWalletStatus("not_user");
          setResolvedName("");
        } else {
          setWalletStatus("valid");
          try {
            const { data: r } = await supabase.rpc("resolve_transfer_recipient", { p_identifier: phone, p_flow: "send" });
            const res = r as any;
            if (!cancelled && res?.found) setResolvedName(res.recipient_name);
          } catch {}
        }
      } catch {
        if (!cancelled) setWalletStatus("idle");
      } finally {
        if (!cancelled) setWalletChecking(false);
      }
    };
    verify();
    return () => { cancelled = true; };
  }, [phone]);


  const handleConfirm = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const ok = await verifyPin(pin);
      if (!ok) {
        toast({ title: "Incorrect PIN", description: "Please try again.", variant: "destructive" });
        setPin("");
        setProcessing(false);
        return;
      }
      const amtVal = Number(amount);
      const DAILY_CASHIN_LIMIT = 50000;
      const { data: usageData, error: usageErr } = await supabase.rpc("get_customer_daily_cashin_usage", { p_phone: phone });
      if (usageErr) throw usageErr;
      const row = (usageData as any)?.[0] ?? {};
      if (!row.customer_user_id) {
        toast({ title: "Number not found", description: "No wallet exists for this number.", variant: "destructive" });
        setProcessing(false);
        return;
      }
      if (!row.is_user_wallet) {
        toast({ title: "Not a user wallet", description: "Cash In is allowed only to customer (user) wallets, not agent/distributor/merchant numbers.", variant: "destructive" });
        setProcessing(false);
        return;
      }
      const used = Number(row.used ?? 0);
      const remaining = Math.max(0, DAILY_CASHIN_LIMIT - used);
      if (amtVal > remaining) {
        toast({
          title: "Customer daily Cash In limit exceeded",
          description: `Customer used ৳${used.toLocaleString("en-BD")} of ৳${DAILY_CASHIN_LIMIT.toLocaleString("en-BD")} today. Remaining: ৳${remaining.toLocaleString("en-BD")}.`,
          variant: "destructive",
        });
        setProcessing(false);
        return;
      }
      const { error } = await supabase.rpc("agent_cashin" as any, {
        p_customer_phone: phone,
        p_amount: Number(amount),
        p_commission: commission,
        p_description: "Agent Cash In",
        p_reference: (() => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; })(),
      });
      if (error) throw error;
      window.dispatchEvent(new Event("txn:refresh"));
      setStep("done");
      toast({ title: "Cash In Successful", description: `৳${amount} deposited to ${phone}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-send px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/agent")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <ArrowUpFromLine size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">{t("agCinTitle")}</h1>
              <p className="text-[9px] text-primary-foreground/60">{t("agCinTagline")}</p>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-xl mx-auto mt-3">
          <div className="h-1.5 bg-primary-foreground/10 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: step === "form" ? "33%" : step === "confirm" ? "66%" : "100%" }}
              className="h-full bg-primary-foreground/40 rounded-full"
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        {step === "done" ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 size={32} className="text-primary" />
              </motion.div>
              <div>
                <p className="text-lg font-extrabold text-foreground">{t("agCinSuccess")}</p>
                <p className="text-sm text-muted-foreground mt-1">৳{fmt(Number(amount))} → {phone}</p>
              </div>
              <div className="space-y-2 bg-muted/50 rounded-xl p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("agComAmount")}</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("agComFee")}</span><span className="font-bold text-primary">{t("agComFree")}</span></div>
                <p className="text-[11px] text-muted-foreground text-right">৳{fmt(Number(amount))} + {t("agComFree")}</p>
                <div className="flex justify-between border-t border-border/40 pt-2"><span className="text-muted-foreground">{t("agCinCommissionEarned")}</span><span className="font-bold text-primary">+৳{fmt(commission)}</span></div>
              </div>
              <Button onClick={() => { setStep("form"); setPhone(""); setAmount(""); setPin(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">
                {t("agCinNewTxn")}
              </Button>
              <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2">
                <Home size={16} /> {t("agComBackToDash")}
              </Button>
            </Card>
          </motion.div>
        ) : step === "confirm" ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <h3 className="text-base font-extrabold text-foreground text-center">{t("agCinConfirm")}</h3>
              <div className="space-y-2.5 bg-muted/50 rounded-xl p-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("agComCustomer")}</span><span className="font-bold text-foreground">{phone}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("agComAmount")}</span><span className="font-extrabold text-foreground">৳{fmt(Number(amount))}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("agComFee")}</span><span className="font-bold text-primary">{t("agComFree")}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">{t("agCinCommissionRate")}</span><span className="font-bold text-primary">৳{fmt(commission)}</span></div>
              </div>
              <div>
                <Label className="text-xs font-semibold">{t("agComEnterPin")}</Label>
                <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1" />
              </div>
              <SlideToConfirm onConfirm={handleConfirm} disabled={pin.length < 4 || processing} label={processing ? t("agComProcessing") : t("agCinSlideDeposit")} icon={HandCoins} />
              <Button variant="ghost" onClick={() => setStep("form")} className="w-full text-muted-foreground">{t("agComCancel")}</Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div>
                <Label className="text-xs font-semibold">{t("agCinCustPhone")}</Label>
                <div className="relative mt-1">
                  <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, "")); setResolvedName(""); setWalletStatus("idle"); }} onBlur={() => phoneValidation.setTouched(true)} maxLength={11} className={`rounded-xl h-11 pr-11 ${phoneValidation.inputClassName}`} />
                  <button type="button" onClick={() => setShowQr(true)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                    <ScanLine size={16} />
                  </button>
                </div>
                {walletStatus === "checking" && <p className="text-[11px] text-muted-foreground mt-1 animate-pulse">Verifying wallet…</p>}
                {walletStatus === "valid" && resolvedName && <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> {resolvedName}</p>}
                {walletStatus === "valid" && !resolvedName && <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Valid customer wallet</p>}
                {walletStatus === "not_found" && <p className="text-[11px] text-destructive font-medium mt-1">No wallet exists for this number.</p>}
                {walletStatus === "not_user" && <p className="text-[11px] text-destructive font-medium mt-1">Not a customer wallet. Cash In is only allowed to user wallets.</p>}
                {phoneValidation.showError && <p className="text-[10px] text-destructive font-medium mt-1 animate-fade-in">{phoneValidation.errorMessage}</p>}

              </div>
              <div>
                <Label className="text-xs font-semibold">{t("agComAmountLbl")}</Label>
                <Input type="text" inputMode="numeric" placeholder={t("agComEnterAmt")} value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
                {Number(amount) > 0 && (
                  <p className="text-[10px] text-primary font-semibold mt-1.5">{t("agCinCommissionLine")}: ৳{fmt(commission)}</p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {[500, 1000, 2000, 5000, 10000].map(a => (
                  <button key={a} onClick={() => setAmount(String(a))} className="px-3 py-2 rounded-xl text-xs font-bold bg-muted text-muted-foreground press-effect hover:bg-primary/10 hover:text-primary transition-colors">
                    ৳{fmt(a)}
                  </button>
                ))}
              </div>
              {phoneValidation.isValid && amount && Number(amount) >= 10 && (
                <Button onClick={() => { if (phoneValidation.triggerShake()) return; setStep("confirm"); }} disabled={walletStatus !== "valid" || walletChecking} className="w-full gradient-primary text-primary-foreground rounded-xl h-11 text-sm font-bold animate-fade-in disabled:opacity-50">
                  {walletChecking ? "Verifying wallet…" : walletStatus !== "valid" ? "Enter a valid customer wallet" : t("agComContinue")}
                </Button>
              )}
            </Card>
          </motion.div>
        )}
      </div>
      <QrScannerModal
        open={showQr}
        onClose={() => setShowQr(false)}
        title={t("agComScanCustQr")}
        onScan={async (result) => {
          setShowQr(false);
          const parsed = parseQrData(result);
          const extracted = normalizeBDPhoneInput(parsed.identifier ?? "") || normalizeBDPhoneInput(result);
          setPhone(extracted);
          try {
            const { data } = await supabase.rpc("resolve_transfer_recipient", { p_identifier: extracted, p_flow: "send" });
            const res = data as any;
            if (res?.found) setResolvedName(res.recipient_name);
          } catch {}
        }}
      />
    </div>
  );
};

export default AgentCashIn;
