import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Paperclip, Send, Loader2, Clock, Search, CheckCircle2, XCircle,
  FileCheck2, User2, MessageSquare, Hash, Calendar, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

type DisputeStatus = "open" | "under_review" | "resolved" | "rejected";

export type DisputeDetail = {
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
  assigned_to?: string | null;
};

type Message = {
  id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  created_at: string;
};

const STATUS_META: Record<DisputeStatus, { cls: string; icon: any; labelKey: "dddStatusSubmitted" | "dddStatusUnderReview" | "dddStatusResolved" | "dddStatusRejected" }> = {
  open: { cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock, labelKey: "dddStatusSubmitted" },
  under_review: { cls: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Search, labelKey: "dddStatusUnderReview" },
  resolved: { cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2, labelKey: "dddStatusResolved" },
  rejected: { cls: "bg-rose-500/15 text-rose-600 border-rose-500/30", icon: XCircle, labelKey: "dddStatusRejected" },
};

interface Props {
  dispute: DisputeDetail | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export default function DisputeDetailsDrawer({ dispute, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [txn, setTxn] = useState<any | null>(null);
  const [txnLoading, setTxnLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Load referenced transaction details
  useEffect(() => {
    if (!open || !dispute?.transaction_id) { setTxn(null); return; }
    setTxnLoading(true);
    supabase
      .from("transactions")
      .select("id, short_id, type, amount, fee, commission, status, recipient_phone, recipient_name, description, reference, created_at")
      .eq("id", dispute.transaction_id)
      .maybeSingle()
      .then(({ data }) => { setTxn(data); setTxnLoading(false); });
  }, [open, dispute?.transaction_id]);


  const load = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dispute_messages" as any)
      .select("id, sender_id, sender_role, body, created_at")
      .eq("dispute_id", id)
      .order("created_at", { ascending: true });
    if (error) toast({ title: t("dddLoadFailed"), description: error.message, variant: "destructive" });
    setMessages(((data as unknown) as Message[]) || []);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 50);
  };

  useEffect(() => {
    if (!open || !dispute) return;
    load(dispute.id);
    const ch = supabase
      .channel(`dispute-msgs-${dispute.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "dispute_messages", filter: `dispute_id=eq.${dispute.id}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
          setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 50);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, dispute?.id]);

  const openEvidence = async (path: string) => {
    const { data, error } = await supabase.storage.from("dispute-evidence").createSignedUrl(path, 60);
    if (error) return toast({ title: t("dddCannotOpen"), description: error.message, variant: "destructive" });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const send = async () => {
    if (!dispute || !userId || !body.trim()) return;
    setPosting(true);
    setSendError(null);
    try {
      const { error } = await supabase.from("dispute_messages" as any).insert({
        dispute_id: dispute.id,
        sender_id: userId,
        sender_role: "agent",
        body: body.trim(),
      });
      if (error) throw error;
      setBody("");
    } catch (e: any) {
      setSendError(e.message || t("dddFailedToSend"));
      toast({ title: t("dddSendFailed"), description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };


  if (!dispute) return null;

  const meta = STATUS_META[dispute.status] || STATUS_META.open;
  const StatusIcon = meta.icon;

  const steps = [
    { key: "s", label: t("dddStatusSubmitted"), at: dispute.created_at, done: true, icon: FileCheck2 },
    {
      key: "r",
      label: t("dddStatusUnderReview"),
      at: dispute.status !== "open" ? dispute.updated_at : null,
      done: dispute.status !== "open",
      icon: Search,
    },
    {
      key: "c",
      label: dispute.status === "rejected" ? t("dddStatusRejected") : t("dddStatusResolved"),
      at: dispute.resolved_at ?? (dispute.status === "resolved" || dispute.status === "rejected" ? dispute.updated_at : null),
      done: dispute.status === "resolved" || dispute.status === "rejected",
      icon: dispute.status === "rejected" ? XCircle : CheckCircle2,
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 h-[90vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 shrink-0">
          <SheetTitle className="text-sm flex items-center gap-2">
            {t("dddTitle")}
            <Badge variant="outline" className={`${meta.cls} text-[10px] gap-1 rounded-full`}>
              <StatusIcon size={10} /> {t(meta.labelKey)}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {/* Fields */}
          <div className="rounded-2xl border border-border/40 p-3 space-y-2">
            <p className="text-sm font-bold text-foreground">{dispute.subject}</p>
            {dispute.description && (
              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{dispute.description}</p>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Hash size={10} /> <span className="font-mono">{dispute.id.slice(0, 8)}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar size={10} /> {new Date(dispute.created_at).toLocaleString()}
              </div>
              {dispute.transaction_id && (
                <div className="flex items-center gap-1 text-muted-foreground col-span-2">
                  <Hash size={10} /> {t("dddTx")} <span className="font-mono">{dispute.transaction_id}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <ShieldCheck size={10} />
                {dispute.assigned_to ? t("dddHandlerAssigned") : t("dddAwaitingHandler")}
              </div>
            </div>
            {dispute.evidence_url && (
              <button
                onClick={() => openEvidence(dispute.evidence_url!)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <Paperclip size={11} /> {t("dddViewEvidence")}
              </button>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-border/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">{t("dddTimeline")}</p>
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
                    <p className={`text-[10px] mt-1 text-center ${s.done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s.label}</p>
                    {s.at && <p className="text-[9px] text-muted-foreground">{new Date(s.at).toLocaleString()}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referenced transaction */}
          {dispute.transaction_id && (
            <div className="rounded-2xl border border-border/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Referenced transaction</p>
              {txnLoading ? (
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 py-2">
                  <Loader2 size={12} className="animate-spin" /> Loading transaction…
                </div>
              ) : !txn ? (
                <p className="text-[11px] text-muted-foreground">Transaction not found or no longer accessible.</p>
              ) : (
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground uppercase text-[10px]">{txn.type}</span>
                    <Badge variant="outline" className="text-[9px] rounded-full">{txn.status}</Badge>
                  </div>
                  <p className="text-lg font-bold text-foreground">৳{Number(txn.amount).toFixed(2)}</p>
                  <div className="grid grid-cols-2 gap-1 pt-1 text-[10px] text-muted-foreground">
                    <div>Ref: <span className="font-mono text-foreground">{txn.short_id || txn.reference || "—"}</span></div>
                    <div>Fee: ৳{Number(txn.fee || 0).toFixed(2)}</div>
                    {txn.commission > 0 && <div>Commission: ৳{Number(txn.commission).toFixed(2)}</div>}
                    <div>{new Date(txn.created_at).toLocaleString()}</div>
                    {txn.recipient_name && <div className="col-span-2">To: {txn.recipient_name}</div>}
                    {txn.recipient_phone && <div className="col-span-2 font-mono">{txn.recipient_phone}</div>}
                    {txn.description && <div className="col-span-2">{txn.description}</div>}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Resolution */}
          {dispute.resolution_notes && (
            <div className="rounded-2xl p-3 bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-600 mb-1">Resolution</p>
              <p className="text-[11px] text-foreground whitespace-pre-wrap">{dispute.resolution_notes}</p>
            </div>
          )}

          <Separator />

          {/* Conversation */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <MessageSquare size={11} /> Conversation with handler
            </p>
            {loading ? (
              <div className="text-center py-6 text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading…
              </div>
            ) : messages.length === 0 ? (
              <p className="text-[11px] text-muted-foreground text-center py-6">
                No notes yet. Send a message to the dispute handler below.
              </p>
            ) : (
              <div className="space-y-2">
                {messages.map(m => {
                  const mine = m.sender_id === userId;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <User2 size={9} className="opacity-70" />
                          <p className={`text-[9px] font-bold ${mine ? "opacity-90" : "text-muted-foreground"}`}>
                            {mine ? "You" : m.sender_role === "admin" ? "Handler" : m.sender_role}
                          </p>
                        </div>
                        <p className="text-[11px] whitespace-pre-wrap">{m.body}</p>
                        <p className={`text-[9px] mt-0.5 text-right ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        {dispute.status !== "resolved" && dispute.status !== "rejected" && (
          <div className="shrink-0 border-t border-border/40 p-3 bg-background">
            <div className="flex items-end gap-2">
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Message the dispute handler…"
                className="rounded-xl text-xs resize-none"
              />
              <Button
                onClick={send}
                disabled={posting || !body.trim()}
                className="rounded-xl h-10 w-10 p-0 shrink-0"
              >
                {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1">
              {sendError ? (
                <p className="text-[9px] text-rose-600 flex items-center gap-1">
                  <XCircle size={9} /> {sendError}
                </p>
              ) : <span />}
              <p className="text-[9px] text-muted-foreground">{body.length}/500</p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
