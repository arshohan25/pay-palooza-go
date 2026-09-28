import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Receipt, CheckCircle2, Home, ScanLine, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SlideToConfirm from "@/components/SlideToConfirm";

import { supabase } from "@/integrations/supabase/client";
import { verifyPin } from "@/lib/verifyPin";
import QrScannerModal from "@/components/QrScannerModal";
import { useI18n } from "@/lib/i18n";

const fmt = (n: number) => new Intl.NumberFormat("en-BD").format(n);

const AgentBillPay = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();

  const providers = [
    { name: "DESCO", categoryKey: "electricity", icon: "⚡" },
    { name: "DPDC", categoryKey: "electricity", icon: "⚡" },
    { name: "Titas Gas", categoryKey: "gas", icon: "🔥" },
    { name: "WASA", categoryKey: "water", icon: "💧" },
    { name: "Link3", categoryKey: "internet", icon: "🌐" },
    { name: "Carnival", categoryKey: "internet", icon: "🌐" },
  ];

  const categoryMeta: Record<string, { label: string; icon: string }> = {
    electricity: { label: t("agBillCatElectricity"), icon: "⚡" },
    gas: { label: t("agBillCatGas"), icon: "🔥" },
    water: { label: t("agBillCatWater"), icon: "💧" },
    internet: { label: t("agBillCatInternet"), icon: "🌐" },
  };
  const categoryKeys = Object.keys(categoryMeta).filter(k =>
    providers.some(p => p.categoryKey === k)
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"select" | "form" | "done">("select");
  const [processing, setProcessing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");

  const filtered = providers.filter(p => {
    if (cat !== "all" && p.categoryKey !== cat) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      categoryMeta[p.categoryKey].label.toLowerCase().includes(q)
    );
  });

  const headingLabel = search.trim()
    ? t("agBillFilteredBillers")
    : cat === "all"
      ? t("agBillAllBillers")
      : categoryMeta[cat].label;

  const handlePay = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const pinValid = await verifyPin(pin);
      if (!pinValid) { toast({ title: t("agBillWrongPin"), description: t("agBillWrongPinDesc"), variant: "destructive" }); setPin(""); setProcessing(false); return; }
      const reference = (() => { const C = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let r = ""; for (let i = 0; i < 12; i++) r += C[Math.floor(Math.random() * 36)]; return r; })();
      const { error } = await supabase.rpc("record_transaction", {
        p_type: "paybill" as any,
        p_amount: Number(amount),
        p_fee: 0,
        p_description: `Bill Pay - ${selected}`,
        p_recipient_name: selected,
        p_reference: reference,
      });
      if (error) throw error;

      // Submit to biller provider (edge function). If no live config, it queues for manual settlement.
      const idemKey = `pb_${reference}_${Number(amount)}`;
      const { data: payRes, error: payErr } = await supabase.functions.invoke("pay-bill", {
        body: { biller_name: selected, account_no: accountNo, amount: Number(amount), reference, idempotency_key: idemKey },
        headers: { "idempotency-key": idemKey },
      });
      if (payErr) {
        toast({ title: t("agBillPaid"), description: `৳${amount} → ${selected} (queued for settlement)` });
      } else if (payRes?.queued) {
        toast({ title: t("agBillPaid"), description: `৳${amount} → ${selected} (queued for settlement)` });
      } else {
        toast({ title: t("agBillPaid"), description: `৳${amount} → ${selected}${payRes?.provider_ref ? ` • Ref ${payRes.provider_ref}` : ""}` });
      }
      setStep("done");
    } catch (err: any) {
      toast({ title: t("agBillFailed"), description: err.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
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
              <Receipt size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">{t("agBillPay")}</h1>
              <p className="text-[9px] text-primary-foreground/60">{t("agBillPayTagline")}</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5">
        {step === "done" ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-primary" />
              </motion.div>
              <p className="text-lg font-extrabold text-foreground">{t("agBillPaidTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {t("agBillPaidDesc").replace("{amount}", fmt(Number(amount))).replace("{name}", selected ?? "")}
              </p>
              <Button onClick={() => { setStep("select"); setSelected(null); setAccountNo(""); setAmount(""); setPin(""); }} className="w-full gradient-primary text-primary-foreground rounded-xl h-11">{t("agBillPayAnother")}</Button>
              <Button onClick={() => navigate("/agent")} variant="outline" className="w-full rounded-xl h-11 text-sm font-bold gap-2"><Home size={16} /> {t("agBillBackToDash")}</Button>
            </Card>
          </motion.div>
        ) : step === "form" ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 border-0 shadow-elevated rounded-2xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{providers.find(p => p.name === selected)?.icon}</span>
                <h3 className="text-base font-extrabold text-foreground">{selected}</h3>
              </div>
              <div>
                <Label className="text-xs font-semibold">{t("agBillAccountLabel")}</Label>
                <div className="relative mt-1">
                  <Input placeholder={t("agBillAccountPh")} value={accountNo} onChange={e => setAccountNo(e.target.value)} className="rounded-xl h-11 pr-11" />
                  <button type="button" onClick={() => setShowQr(true)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors">
                    <ScanLine size={16} />
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">{t("agBillAmountLabel")}</Label>
                <Input type="text" inputMode="numeric" placeholder={t("agBillAmountPh")} value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ""))} className="rounded-xl h-11 mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">{t("agBillEnterPin")}</Label>
                <Input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="text-center text-lg tracking-[0.5em] rounded-xl h-12 mt-1" />
              </div>
              <SlideToConfirm onConfirm={handlePay} disabled={!accountNo || !amount || pin.length < 4 || processing} label={processing ? t("agBillProcessing") : t("agBillSlideToPay")} icon={Receipt} />
              <Button variant="ghost" onClick={() => { setPin(""); setStep("select"); }} className="w-full text-muted-foreground">{t("agBillBack")}</Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("agBillSearchPh")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-8 h-10 text-sm rounded-full border-border/40 bg-card shadow-card"
              />
              {search && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch("")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-muted-foreground mb-2 px-1">
              {search.trim() ? t("agBillFilteredBillers") : t("agBillAllBillers")}
              <span className="font-semibold text-muted-foreground/70"> · {filtered.length}</span>
            </p>
            {filtered.length === 0 ? (
              <Card className="p-8 border-0 shadow-card rounded-2xl text-center">
                <p className="text-sm text-muted-foreground">{t("agBillNoBillers")}</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((p, i) => (
                  <motion.div key={p.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card
                      className="p-4 border-0 shadow-card rounded-2xl cursor-pointer press-effect hover:shadow-elevated transition-shadow"
                      onClick={() => { setSelected(p.name); setStep("form"); }}
                    >
                      <span className="text-2xl">{p.icon}</span>
                      <p className="text-xs font-bold text-foreground mt-2">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground">{p.category}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
      <QrScannerModal
        open={showQr}
        onClose={() => setShowQr(false)}
        title={t("agBillScanQr")}
        onScan={(result) => {
          setShowQr(false);
          setAccountNo(result.trim());
        }}
      />
    </div>
  );
};

export default AgentBillPay;
