import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Download, Calendar as CalIcon, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const fmt = (n: number) => new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const toISO = (d: Date) => d.toISOString().slice(0, 10);

type Txn = {
  id: string;
  created_at: string;
  type: string;
  amount: number;
  fee: number | null;
  commission: number | null;
  recipient_phone: string | null;
  reference: string | null;
  description: string | null;
  status: string;
};

const agentTxnLabel = (type: string) => {
  if (type === "cashin") return "Cash Out Received";
  if (type === "cashout") return "Cash In Sent";
  return type;
};

const AgentStatement = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { toast } = useToast();
  const today = new Date();
  const weekAgo = new Date(Date.now() - 6 * 86400000);
  const [from, setFrom] = useState(toISO(weekAgo));
  const [to, setTo] = useState(toISO(today));
  const [txns, setTxns] = useState<Txn[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, { data: tx }] = await Promise.all([
        supabase.from("profiles").select("name, phone, balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("transactions")
          .select("id, created_at, type, amount, fee, commission, recipient_phone, reference, description, status")
          .eq("user_id", user.id)
          .gte("created_at", `${from}T00:00:00`)
          .lte("created_at", `${to}T23:59:59`)
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);
      if (prof) {
        setAgentName(prof.name || prof.phone || "");
        setBalance(Number(prof.balance) || 0);
      }
      setTxns((tx as Txn[]) || []);
    } catch (err: any) {
      toast({ title: "Failed to load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const summary = useMemo(() => {
    const s = { cashOutReceived: 0, cashInSent: 0, b2bOut: 0, banktransfer: 0, paybill: 0, commission: 0, fees: 0, count: txns.length };
    for (const t of txns) {
      const a = Number(t.amount) || 0;
      s.commission += Number(t.commission) || 0;
      s.fees += Number(t.fee) || 0;
      if (t.type === "cashin") s.cashOutReceived += a;
      else if (t.type === "cashout") s.cashInSent += a;
      else if (t.type === "send") s.b2bOut += a;
      else if (t.type === "banktransfer") s.banktransfer += a;
      else if (t.type === "paybill") s.paybill += a;
    }
    return s;
  }, [txns]);

  // Physical cash estimate: Cash In Sent adds cash on hand; Cash Out Received pays cash out.
  const cashInHand = summary.cashInSent - summary.cashOutReceived;

  const exportCSV = () => {
    const rows = [
      ["Date", "Type", "Amount (BDT)", "Fee", "Commission", "Counterparty", "Reference", "Description", "Status"],
      ...txns.map(t => [
        new Date(t.created_at).toISOString(),
        agentTxnLabel(t.type),
        String(Number(t.amount) || 0),
        String(Number(t.fee) || 0),
        String(Number(t.commission) || 0),
        t.recipient_phone || "",
        t.reference || "",
        (t.description || "").replace(/[\r\n,]/g, " "),
        t.status,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agent-statement_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${txns.length} transactions` });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Agent Statement", 14, 16);
    doc.setFontSize(10);
    doc.text(`Agent: ${agentName}`, 14, 24);
    doc.text(`Period: ${from} to ${to}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    autoTable(doc, {
      startY: 42,
      head: [["Metric", "Value (BDT)"]],
      body: [
        ["Cash Out Received (wallet in)", fmt(summary.cashOutReceived)],
        ["Cash In Sent (wallet out)", fmt(summary.cashInSent)],
        ["B2B Send", fmt(summary.b2bOut)],
        ["Bank Transfer", fmt(summary.banktransfer)],
        ["Bill Pay", fmt(summary.paybill)],
        ["Total Commission Earned", fmt(summary.commission)],
        ["Total Fees Paid", fmt(summary.fees)],
        ["Net Cash in Hand (Cash In Sent - Cash Out Received)", fmt(cashInHand)],
        ["Current Wallet Balance", fmt(balance)],
        ["Transaction Count", String(summary.count)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 40] },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 8,
      head: [["Date", "Type", "Amount", "Fee", "Comm.", "Party", "Ref"]],
      body: txns.map(t => [
        new Date(t.created_at).toLocaleString("en-GB", { hour12: false }),
        agentTxnLabel(t.type),
        fmt(Number(t.amount) || 0),
        fmt(Number(t.fee) || 0),
        fmt(Number(t.commission) || 0),
        t.recipient_phone || "-",
        t.reference || "-",
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 30, 40] },
    });

    doc.save(`agent-statement_${from}_${to}.pdf`);
    toast({ title: "PDF exported" });
  };

  return (
    <div className="min-h-screen bg-background pb-10">
      <motion.header
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="gradient-send px-4 pt-3 pb-3 sticky top-0 z-30"
      >
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/agent")} className="tap-target text-primary-foreground/80 hover:text-primary-foreground">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-9 h-9 rounded-xl glass-hero flex items-center justify-center">
              <FileText size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">{t("agStTitle")}</h1>
              <p className="text-[9px] text-primary-foreground/60">{t("agStTagline")}</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <Card className="p-4 border-0 shadow-elevated rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><CalIcon size={14} /> {t("agStDateRange")}</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground">{t("agStFrom")}</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} max={to} className="rounded-xl h-10 mt-1" />
            </div>
            <div>
              <Label className="text-[10px] font-semibold text-muted-foreground">{t("agStTo")}</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} min={from} max={toISO(new Date())} className="rounded-xl h-10 mt-1" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: t("agStToday"), days: 0 },
              { label: "7d", days: 6 },
              { label: "30d", days: 29 },
            ].map(p => (
              <button key={p.label} onClick={() => { setFrom(toISO(new Date(Date.now() - p.days * 86400000))); setTo(toISO(new Date())); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                {p.label}
              </button>
            ))}
          </div>
          <Button onClick={load} disabled={loading} className="w-full gradient-primary text-primary-foreground rounded-xl h-10 text-sm font-bold">
            {loading ? t("agComLoading") : t("agComRefresh")}
          </Button>
        </Card>

        <Card className="p-4 border-0 shadow-elevated rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold"><Wallet size={14} /> {t("agStEodSummary")}</div>
            <span className="text-[10px] text-muted-foreground">{t("agStTxnsCount").replace("{count}", String(summary.count))}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label={t("agStCashOutRecv")} val={summary.cashOutReceived} tone="primary" />
            <Metric label={t("agStCashInSent")} val={summary.cashInSent} tone="destructive" />
            <Metric label={t("agStB2bSend")} val={summary.b2bOut} />
            <Metric label={t("agStBankTransfer")} val={summary.banktransfer} />
            <Metric label={t("agStBillPay")} val={summary.paybill} />
            <Metric label={t("agStFeesPaid")} val={summary.fees} />
            <Metric label={t("agStCommEarned")} val={summary.commission} tone="primary" bold />
            <Metric label={t("agStWalletBal")} val={balance} bold />
          </div>
          <div className="mt-2 p-3 rounded-xl bg-muted/60 border border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("agStNetCash")}</p>
            <p className={`text-lg font-extrabold ${cashInHand >= 0 ? "text-primary" : "text-destructive"}`}>৳{fmt(cashInHand)}</p>
            <p className="text-[10px] text-muted-foreground">{t("agStNetCashDesc")}</p>
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-elevated rounded-2xl space-y-2">
          <p className="text-sm font-semibold">{t("agStExport")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={exportCSV} disabled={!txns.length} variant="outline" className="rounded-xl h-11 gap-2 text-sm font-bold">
              <Download size={14} /> CSV
            </Button>
            <Button onClick={exportPDF} disabled={!txns.length} className="gradient-primary text-primary-foreground rounded-xl h-11 gap-2 text-sm font-bold">
              <Download size={14} /> PDF
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

const Metric = ({ label, val, tone, bold }: { label: string; val: number; tone?: "primary" | "destructive"; bold?: boolean }) => (
  <div className="p-2.5 rounded-lg bg-muted/40">
    <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
    <p className={`${bold ? "font-extrabold" : "font-bold"} ${tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground"}`}>
      ৳{fmt(val)}
    </p>
  </div>
);

export default AgentStatement;
