import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle, Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTransactions } from "@/hooks/use-transactions";

type Dispute = {
  id: string;
  subject: string;
  description: string | null;
  status: string;
  transaction_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
};

const SUBJECTS = [
  "Cash-in not credited",
  "Cash-out amount mismatch",
  "Wrong customer debited",
  "Duplicate transaction",
  "Commission not credited",
  "Bill payment failed but debited",
  "Other",
];

const StatusPill = ({ s }: { s: string }) => {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    open: { cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock, label: "Open" },
    in_progress: { cls: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Clock, label: "In progress" },
    resolved: { cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2, label: "Resolved" },
    closed: { cls: "bg-muted text-muted-foreground border-border", icon: XCircle, label: "Closed" },
  };
  const m = map[s] || map.open;
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`${m.cls} text-[10px] gap-1 rounded-full`}>
      <Icon size={10} /> {m.label}
    </Badge>
  );
};

const AgentDisputes = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();
  const { transactions } = useTransactions();

  const [rows, setRows] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [txnId, setTxnId] = useState<string>(params.get("txn") || "");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("disputes")
      .select("id, subject, description, status, transaction_id, resolution_notes, resolved_at, created_at")
      .eq("complainant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows((data as Dispute[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); if (params.get("txn")) setOpen(true); /* eslint-disable-next-line */ }, []);

  const agentTxns = useMemo(
    () => transactions
      .filter(t => ["cashin", "cashout", "banktransfer", "paybill", "b2b"].includes(t.type))
      .slice(0, 30),
    [transactions]
  );

  const submit = async () => {
    const finalSubject = subject === "Other" ? customSubject.trim() : subject;
    if (!finalSubject) return toast({ title: "Subject required", variant: "destructive" });
    if (description.trim().length < 10) return toast({ title: "Add more detail (min 10 chars)", variant: "destructive" });
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("disputes").insert({
        complainant_id: user.id,
        subject: finalSubject,
        description: description.trim(),
        transaction_id: txnId || null,
      });
      if (error) throw error;
      toast({ title: "Dispute filed", description: "Support will review within 24h" });
      setOpen(false);
      setDescription(""); setCustomSubject(""); setTxnId(""); setSubject(SUBJECTS[0]);
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
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
              <AlertCircle size={16} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary-foreground">Disputes</h1>
              <p className="text-[9px] text-primary-foreground/60">Report transaction issues</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setOpen(true)} className="h-8 rounded-lg bg-white/20 hover:bg-white/30 text-primary-foreground border-0 gap-1 text-[11px]">
            <Plus size={12} /> New
          </Button>
        </div>
      </motion.header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <p className="text-xs text-muted-foreground py-8 text-center">Loading…</p>
        ) : rows.length === 0 ? (
          <Card className="p-6 border-0 shadow-elevated rounded-2xl text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
              <AlertCircle size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-foreground">No disputes filed</p>
            <p className="text-[11px] text-muted-foreground">Report any transaction issue and support will follow up.</p>
            <Button onClick={() => setOpen(true)} className="mt-2 rounded-xl gap-1 text-xs h-9">
              <Plus size={12} /> File a dispute
            </Button>
          </Card>
        ) : (
          rows.map(d => (
            <Card key={d.id} className="p-4 border-0 shadow-elevated rounded-2xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-foreground flex-1">{d.subject}</p>
                <StatusPill s={d.status} />
              </div>
              {d.description && <p className="text-[11px] text-muted-foreground line-clamp-3">{d.description}</p>}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                <span>Filed: {new Date(d.created_at).toLocaleDateString()}</span>
                {d.transaction_id && <span className="font-mono">TX: {d.transaction_id.slice(0, 8)}…</span>}
              </div>
              {d.resolution_notes && (
                <div className="mt-1 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-600 mb-0.5">Resolution</p>
                  <p className="text-[11px] text-foreground">{d.resolution_notes}</p>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">File a dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px]">Related transaction (optional)</Label>
              <Select value={txnId || "none"} onValueChange={v => setTxnId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">— None —</SelectItem>
                  {agentTxns.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.type.toUpperCase()} · ৳{Number(t.amount).toFixed(0)} · {new Date(t.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {subject === "Other" && (
              <div>
                <Label className="text-[11px]">Custom subject</Label>
                <Input value={customSubject} onChange={e => setCustomSubject(e.target.value)}
                  maxLength={80} className="h-10 rounded-xl mt-1 text-xs" placeholder="Describe briefly" />
              </div>
            )}
            <div>
              <Label className="text-[11px]">Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={4} maxLength={800} className="rounded-xl mt-1 text-xs"
                placeholder="What happened? Include amount, counterparty, and time if relevant." />
              <p className="text-[9px] text-muted-foreground mt-1 text-right">{description.length}/800</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl h-10">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="rounded-xl h-10 gap-1">
              {submitting ? "Submitting…" : "File dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentDisputes;
