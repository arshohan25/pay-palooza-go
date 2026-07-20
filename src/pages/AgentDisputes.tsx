import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle, Plus, Clock, CheckCircle2, XCircle, Paperclip, FileCheck2, Loader2, Search, MessageSquare } from "lucide-react";
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
import DisputeDetailsDrawer, { type DisputeDetail } from "@/components/DisputeDetailsDrawer";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type DisputeStatus = "open" | "under_review" | "resolved" | "rejected";

type Dispute = {
  id: string;
  subject: string;
  description: string | null;
  status: DisputeStatus;
  transaction_id: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  evidence_url: string | null;
  created_at: string;
  updated_at: string;
};

const SUBJECT_KEYS: Array<{ key: string; i18n: TranslationKey }> = [
  { key: "Cash-in not credited",          i18n: "agDispSubjCashinNotCred" },
  { key: "Cash-out amount mismatch",      i18n: "agDispSubjCashoutMismatch" },
  { key: "Wrong customer debited",        i18n: "agDispSubjWrongDebit" },
  { key: "Duplicate transaction",         i18n: "agDispSubjDuplicate" },
  { key: "Commission not credited",       i18n: "agDispSubjCommNotCred" },
  { key: "Bill payment failed but debited", i18n: "agDispSubjBillFailed" },
  { key: "Other",                         i18n: "agDispSubjOther" },
];
const SUBJECTS = SUBJECT_KEYS.map(s => s.key);

const useStatusMeta = () => {
  const { t } = useI18n();
  return {
    open: { cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock, label: t("agDispStOpen") },
    under_review: { cls: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Search, label: t("agDispStReview") },
    resolved: { cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2, label: t("agDispStResolved") },
    rejected: { cls: "bg-rose-500/15 text-rose-600 border-rose-500/30", icon: XCircle, label: t("agDispStRejected") },
  } as Record<DisputeStatus, { cls: string; icon: any; label: string }>;
};

const StatusPill = ({ s }: { s: DisputeStatus }) => {
  const STATUS_META = useStatusMeta();
  const m = STATUS_META[s] || STATUS_META.open;
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`${m.cls} text-[10px] gap-1 rounded-full`}>
      <Icon size={10} /> {m.label}
    </Badge>
  );
};

const Timeline = ({ d }: { d: Dispute }) => {
  const submittedAt = d.created_at;
  const reviewingAt = d.status === "under_review" || d.status === "resolved" || d.status === "rejected" ? d.updated_at : null;
  const closedAt = d.status === "resolved" || d.status === "rejected" ? (d.resolved_at ?? d.updated_at) : null;

  const steps = [
    { key: "submitted", label: "Submitted", at: submittedAt, done: true, icon: FileCheck2 },
    { key: "review", label: "Under review", at: reviewingAt, done: !!reviewingAt, icon: Search },
    {
      key: "closed",
      label: d.status === "rejected" ? "Rejected" : "Resolved",
      at: closedAt,
      done: !!closedAt,
      icon: d.status === "rejected" ? XCircle : CheckCircle2,
    },
  ];

  return (
    <div className="mt-2 pt-2 border-t border-border/40">
      <div className="flex items-start justify-between gap-1">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <div className={`absolute right-1/2 top-3 h-0.5 w-full ${steps[i - 1].done ? "bg-emerald-500/50" : "bg-border"}`} />
              )}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 ${s.done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-background border-border text-muted-foreground"}`}>
                <Icon size={12} />
              </div>
              <p className={`text-[9px] mt-1 text-center ${s.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s.label}</p>
              {s.at && <p className="text-[8px] text-muted-foreground">{new Date(s.at).toLocaleDateString()}</p>}
            </div>
          );
        })}
      </div>
    </div>
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
  const userIdRef = useRef<string | null>(null);

  const [txnId, setTxnId] = useState<string>(params.get("txn") || "");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);

  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // --- API layer ---------------------------------------------------------
  const fetchDisputes = async (): Promise<Dispute[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    userIdRef.current = user.id;
    const { data, error } = await supabase
      .from("disputes")
      .select("id, subject, description, status, transaction_id, resolution_notes, resolved_at, evidence_url, created_at, updated_at")
      .eq("complainant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as Dispute[]) || [];
  };

  const uploadEvidence = async (userId: string, file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("dispute-evidence").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  };

  const createDispute = async (payload: {
    subject: string;
    description: string;
    transactionId: string | null;
    evidenceFile: File | null;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    let evidence_url: string | null = null;
    if (payload.evidenceFile) {
      evidence_url = await uploadEvidence(user.id, payload.evidenceFile);
    }
    const { data, error } = await supabase.from("disputes").insert({
      complainant_id: user.id,
      subject: payload.subject,
      description: payload.description,
      transaction_id: payload.transactionId,
      evidence_url,
    } as any).select().single();
    if (error) throw error;
    return data;
  };

  const updateDisputeStatus = async (id: string, status: DisputeStatus) => {
    const { error } = await supabase
      .from("disputes")
      .update({ status } as any)
      .eq("id", id);
    if (error) throw error;
  };

  const openEvidence = async (path: string) => {
    const { data, error } = await supabase.storage.from("dispute-evidence").createSignedUrl(path, 60);
    if (error) return toast({ title: "Cannot open file", description: error.message, variant: "destructive" });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  // --- lifecycle ---------------------------------------------------------
  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchDisputes();
      setRows(list);
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (params.get("txn")) setOpen(true);
    // eslint-disable-next-line
  }, []);

  // realtime status updates
  useEffect(() => {
    if (!userIdRef.current) return;
    const ch = supabase
      .channel(`disputes-${userIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "disputes", filter: `complainant_id=eq.${userIdRef.current}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rows.length === 0 ? 0 : 1]); // re-subscribe once we have user id

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
    if (evidence && evidence.size > 5 * 1024 * 1024) return toast({ title: "File too large (max 5MB)", variant: "destructive" });

    setSubmitting(true);
    try {
      await createDispute({
        subject: finalSubject,
        description: description.trim(),
        transactionId: txnId || null,
        evidenceFile: evidence,
      });
      toast({ title: "Dispute filed", description: "Support will review within 24h" });
      setOpen(false);
      setDescription(""); setCustomSubject(""); setTxnId(""); setSubject(SUBJECTS[0]); setEvidence(null);
      load();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelDispute = async (d: Dispute) => {
    if (d.status !== "open") return;
    try {
      await updateDisputeStatus(d.id, "rejected");
      toast({ title: "Dispute cancelled" });
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
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
          <p className="text-xs text-muted-foreground py-8 text-center flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </p>
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

              <div className="flex items-center flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span>Filed: {new Date(d.created_at).toLocaleDateString()}</span>
                {d.transaction_id && <span className="font-mono">TX: {d.transaction_id.slice(0, 8)}…</span>}
                {d.evidence_url && (
                  <button
                    onClick={() => openEvidence(d.evidence_url!)}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Paperclip size={10} /> Evidence
                  </button>
                )}
              </div>

              <Timeline d={d} />

              {d.resolution_notes && (
                <div className="mt-1 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-600 mb-0.5">Resolution</p>
                  <p className="text-[11px] text-foreground">{d.resolution_notes}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setDetail(d as unknown as DisputeDetail); setDetailOpen(true); }}
                  className="h-7 text-[10px] rounded-lg gap-1"
                >
                  <MessageSquare size={11} /> View details
                </Button>
                {d.status === "open" && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => cancelDispute(d)}
                    className="h-7 text-[10px] text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg ml-auto"
                  >
                    Cancel dispute
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <DisputeDetailsDrawer
        dispute={detail && (rows.find(r => r.id === detail.id) as unknown as DisputeDetail) || detail}
        open={detailOpen}
        onOpenChange={(o) => { setDetailOpen(o); if (!o) setDetail(null); }}
      />


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
              <Label className="text-[11px]">Reason</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-10 rounded-xl mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {subject === "Other" && (
              <div>
                <Label className="text-[11px]">Custom reason</Label>
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
            <div>
              <Label className="text-[11px]">Evidence (optional, max 5MB)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setEvidence(e.target.files?.[0] || null)}
                  className="h-10 rounded-xl text-xs file:text-xs file:mr-2"
                />
              </div>
              {evidence && (
                <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Paperclip size={9} /> {evidence.name} · {(evidence.size / 1024).toFixed(0)} KB
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl h-10">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="rounded-xl h-10 gap-1">
              {submitting ? <><Loader2 size={12} className="animate-spin" /> Submitting…</> : "File dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentDisputes;
