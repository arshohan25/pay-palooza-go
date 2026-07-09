import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle, ChevronDown, ImageIcon, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { ExternalLink } from "@/components/ExternalLink";

interface FundRequest {
  id: string;
  type: string;
  amount: number;
  status: string;
  source_method: string | null;
  proof_url: string | null;
  transaction_id_proof: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  admin_note: string | null;
  created_at: string;
  transaction_id: string | null;
}

const statusConfig: Record<string, { icon: typeof Clock; labelKey: "frhStatusPending" | "frhStatusApproved" | "frhStatusRejected"; class: string }> = {
  pending:  { icon: Clock,        labelKey: "frhStatusPending",  class: "bg-amber-500/12 text-amber-600 border-amber-500/20" },
  approved: { icon: CheckCircle2, labelKey: "frhStatusApproved", class: "bg-emerald-500/12 text-emerald-600 border-emerald-500/20" },
  rejected: { icon: XCircle,      labelKey: "frhStatusRejected", class: "bg-destructive/12 text-destructive border-destructive/20" },
};

const FundRequestHistory = ({ onBack }: { onBack: () => void }) => {
  const { t } = useI18n();
  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data } = await supabase
      .from("fund_requests")
      .select("id, type, amount, status, source_method, proof_url, transaction_id_proof, bank_name, account_number, account_holder, admin_note, created_at, transaction_id")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setRequests((data as FundRequest[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel("user-fund-requests-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetch]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="min-h-screen pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-card border border-border/60 flex items-center justify-center active:scale-95 transition-transform">
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <h1 className="text-[17px] font-bold text-foreground">{t("frhTitle")}</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Inbox size={48} strokeWidth={1.2} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">No requests yet</p>
          <p className="text-xs opacity-70 mt-1">Your deposit & withdrawal requests will appear here</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {requests.map((r) => {
            const isDeposit = r.type === "add_money";
            const st = statusConfig[r.status] ?? statusConfig.pending;
            const StatusIcon = st.icon;
            const isOpen = expanded === r.id;

            return (
              <motion.div
                key={r.id}
                layout
                className="bg-card rounded-2xl border border-border/60 shadow-card overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDeposit ? "gradient-primary" : "gradient-cashout"} text-primary-foreground`}>
                    {isDeposit ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-foreground">{isDeposit ? "Add Money" : "Bank Transfer"}</p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.class}`}>
                        <StatusIcon size={10} /> {st.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(r.created_at)}</p>
                  </div>
                  <p className={`text-[14px] font-bold tabular-nums ${isDeposit ? "text-primary" : "text-foreground"}`}>
                    ৳{r.amount.toLocaleString()}
                  </p>
                  <ChevronDown size={14} className={`text-muted-foreground/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/40">
                        {r.source_method && (
                          <Detail label="Method" value={r.source_method} />
                        )}
                        {r.bank_name && (
                          <Detail label="Bank" value={r.bank_name} />
                        )}
                        {r.account_number && (
                          <Detail label="Account" value={r.account_number} />
                        )}
                        {r.account_holder && (
                          <Detail label="Holder" value={r.account_holder} />
                        )}
                        {r.transaction_id_proof && (
                          <Detail label="TXN ID" value={r.transaction_id_proof} />
                        )}
                        {r.admin_note && (
                          <div className="bg-destructive/8 rounded-xl px-3 py-2">
                            <p className="text-[10px] font-bold text-destructive/70 uppercase tracking-wider">Admin Note</p>
                            <p className="text-[12px] text-destructive mt-0.5">{r.admin_note}</p>
                          </div>
                        )}
                        {r.proof_url && (
                          <ExternalLink href={r.proof_url} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline">
                            <ImageIcon size={12} /> View Proof
                          </ExternalLink>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className="text-[12px] font-medium text-foreground">{value}</span>
  </div>
);

export default FundRequestHistory;
