import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Ticket, MessageCircle, Clock, CheckCircle2, Loader2, Plus, Lock, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SupportChat from "@/components/SupportChat";

interface Conversation {
  id: string;
  subject: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { icon: typeof Clock; class: string }> = {
  open: { icon: Clock, class: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  closed: { icon: CheckCircle2, class: "text-muted-foreground bg-muted border-border" },
  resolved: { icon: CheckCircle2, class: "text-primary bg-primary/10 border-primary/20" },
};

const MyTicketsPage = ({ onBack }: { onBack: () => void }) => {
  const { t } = useI18n();
  const [tickets, setTickets] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Conversation | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);

  const loadTickets = async (uid?: string) => {
    const id = uid ?? userId;
    if (!id) return;
    const { data } = await supabase
      .from("support_conversations")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });
    setTickets(data ?? []);
  };

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      setUserId(session.user.id);
      await loadTickets(session.user.id);
      setLoading(false);
    };
    load();
  }, []);

  // Real-time subscription for ticket status changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("my-tickets-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations", filter: `user_id=eq.${userId}` },
        () => { loadTickets(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const getStatusKey = (status: string) => {
    if (status === "open") return "open";
    if (status === "resolved") return "resolved";
    return "closed";
  };

  const handleSubmitTicket = async () => {
    if (!userId) { toast.error(t("signInFirst")); return; }
    setTicketLoading(true);
    const { error } = await supabase.from("support_conversations").insert({
      user_id: userId,
      subject: ticketSubject.trim(),
      status: "open",
    });
    if (error) {
      toast.error(t("ticketFailed"));
    } else {
      if (ticketDesc.trim()) {
        const { data: convos } = await supabase
          .from("support_conversations")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (convos?.[0]) {
          await supabase.from("support_messages").insert({
            conversation_id: convos[0].id,
            sender_id: userId,
            sender_role: "user",
            content: ticketDesc.trim(),
          });
        }
      }
      toast.success(t("ticketSubmitted"));
      setShowTicketForm(false);
      setTicketSubject("");
      setTicketDesc("");
      await loadTickets();
    }
    setTicketLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-2xl bg-card border border-border/60 flex items-center justify-center hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{t("myTickets")}</h1>
          <p className="text-xs text-muted-foreground">{t("myTicketsSub")}</p>
        </div>
        <Button
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setShowTicketForm(true)}
        >
          <Plus size={14} />
          {t("submitTicketBtn")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-3xl gradient-primary flex items-center justify-center text-primary-foreground mb-4">
            <Ticket size={28} />
          </div>
          <p className="font-semibold text-foreground">{t("noTicketsYet")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("noTicketsDesc")}</p>
          <Button className="mt-4 rounded-xl gap-1.5" onClick={() => setShowTicketForm(true)}>
            <Plus size={14} />
            {t("submitTicketBtn")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {tickets.map((ticket, i) => {
              const statusKey = getStatusKey(ticket.status);
              const cfg = statusConfig[statusKey] || statusConfig.open;
              const StatusIcon = cfg.icon;
              const isClosed = statusKey === "closed" || statusKey === "resolved";
              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <button
                    onClick={() => { if (isClosed) return; setSelectedTicket(ticket); }}
                    className={`w-full bg-card rounded-2xl border border-border/60 p-4 text-left transition-colors shadow-card ${isClosed ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/40 active:bg-muted/60"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cfg.class}`}>
                        <StatusIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-foreground truncate">
                          {ticket.subject || "General Support"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${cfg.class}`}>
                            {t(statusKey as any)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(ticket.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                      {isClosed ? (
                        <Lock size={14} className="text-muted-foreground/50 mt-1 shrink-0" />
                      ) : (
                        <MessageCircle size={14} className="text-muted-foreground/50 mt-1 shrink-0" />
                      )}
                    </div>
                  </button>
                  {isClosed && (
                    <div className="flex items-start gap-1.5 mt-1.5 px-2">
                      <Info size={12} className="text-muted-foreground/60 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-muted-foreground/70 leading-snug">
                        {t("ticketClosedHint")}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Chat Sheet for selected ticket */}
      <Sheet open={!!selectedTicket} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[85vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-5 pb-3">
            <SheetTitle className="text-base truncate">
              {selectedTicket?.subject || "General Support"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {userId ? (
              <SupportChat userId={userId} conversationId={selectedTicket?.id} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                {t("signInToContact")}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Ticket Form Sheet */}
      <Sheet open={showTicketForm} onOpenChange={(open) => { setShowTicketForm(open); if (!open) { setTicketSubject(""); setTicketDesc(""); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0">
          <SheetHeader className="px-6 pt-5 pb-3">
            <SheetTitle className="text-base">{t("submitTicketTitle")}</SheetTitle>
          </SheetHeader>
          <div className="px-6 pb-8 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">{t("ticketSubject")}</label>
              <Input
                placeholder="e.g. Email change request"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">{t("ticketDescription")}</label>
              <Textarea
                placeholder={t("submitTicketSub")}
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
                rows={4}
              />
            </div>
            <Button
              className="w-full"
              disabled={!ticketSubject.trim() || ticketLoading}
              onClick={handleSubmitTicket}
            >
              {ticketLoading ? t("submitting") : t("submitTicketBtn")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
};

export default MyTicketsPage;
