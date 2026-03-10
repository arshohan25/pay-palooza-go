import { useState, useEffect, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Loader2, RefreshCw, RotateCcw, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import AdminChargebackDialog from "./AdminChargebackDialog";

const TXN_TYPE_COLORS: Record<string, string> = {
  send: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  receive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  cashout: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  cashin: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  payment: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  recharge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  paybill: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  addmoney: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  banktransfer: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  chargeback: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "secondary",
  pending: "outline",
  failed: "destructive",
  reversed: "outline",
};

const TXN_TYPES = ["all", "send", "receive", "cashout", "cashin", "payment", "recharge", "paybill", "addmoney", "banktransfer", "chargeback"];
const TXN_STATUSES = ["all", "completed", "pending", "failed", "reversed"];

interface Profile {
  user_id: string;
  name: string | null;
  phone: string;
}

export default function AdminActivityMonitor() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [chargebackTarget, setChargebackTarget] = useState<any>(null);

  const PAGE_SIZE = 100;

  const resolveProfiles = useCallback(async (txns: any[], existing: Record<string, Profile>) => {
    const newIds = [...new Set(txns.map(t => t.user_id))].filter(id => !existing[id]);
    if (newIds.length === 0) return existing;

    const { data } = await supabase
      .from("profiles")
      .select("user_id, name, phone")
      .in("user_id", newIds);

    const updated = { ...existing };
    (data ?? []).forEach(p => { updated[p.user_id] = p; });
    return updated;
  }, []);

  const loadTransactions = useCallback(async (offset = 0) => {
    const isInitial = offset === 0;
    if (isInitial) setLoading(true); else setLoadingMore(true);

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = data ?? [];
    const allTxns = isInitial ? rows : [...transactions, ...rows];

    const updatedProfiles = await resolveProfiles(allTxns, isInitial ? {} : profiles);

    setTransactions(allTxns);
    setProfiles(updatedProfiles);
    setHasMore(rows.length === PAGE_SIZE);
    if (isInitial) setLoading(false); else setLoadingMore(false);
  }, [transactions, profiles, resolveProfiles]);

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time new transactions
  useEffect(() => {
    const channel = supabase
      .channel("admin-activity-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, async (payload) => {
        const newTxn = payload.new as any;
        setTransactions(prev => [newTxn, ...prev]);
        const updated = await resolveProfiles([newTxn], profiles);
        setProfiles(updated);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profiles, resolveProfiles]);

  // Filter logic
  const filtered = transactions.filter(txn => {
    if (typeFilter !== "all" && txn.type !== typeFilter) return false;
    if (statusFilter !== "all" && txn.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const sender = profiles[txn.user_id];
      const senderMatch = sender?.name?.toLowerCase().includes(q) || sender?.phone?.includes(q);
      const receiverMatch = txn.recipient_name?.toLowerCase().includes(q) || txn.recipient_phone?.includes(q);
      const idMatch = txn.id?.toLowerCase().includes(q) || txn.short_id?.toLowerCase().includes(q);
      if (!senderMatch && !receiverMatch && !idMatch) return false;
    }
    return true;
  });

  const getSender = (txn: any) => profiles[txn.user_id];

  const exportCsv = () => {
    const headers = ["Short ID", "Type", "Sender Name", "Sender Phone", "Receiver Name", "Receiver Phone", "Amount", "Fee", "Commission", "Balance After", "Status", "Description", "Reference", "Date"];
    const csvRows = [headers.join(",")];
    filtered.forEach(txn => {
      const sender = profiles[txn.user_id];
      csvRows.push([
        txn.short_id,
        txn.type,
        `"${sender?.name || ""}"`,
        sender?.phone || "",
        `"${txn.recipient_name || ""}"`,
        txn.recipient_phone || "",
        txn.amount,
        txn.fee,
        txn.commission,
        txn.balance_after ?? "",
        txn.status,
        `"${(txn.description || "").replace(/"/g, '""')}"`,
        txn.reference || "",
        format(new Date(txn.created_at), "yyyy-MM-dd HH:mm:ss"),
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="text-base">Activity Monitor</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, phone, ID…"
                className="pl-10 w-full md:w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={exportCsv} disabled={filtered.length === 0} title="Export CSV">
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => loadTransactions(0)} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {TXN_TYPES.map(t => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? "default" : "outline"}
              className="text-xs h-7 capitalize"
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </Button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {TXN_STATUSES.map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              className="text-xs h-7 capitalize"
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Short ID</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Sender</th>
                    <th className="text-left px-4 py-3 font-medium">Receiver</th>
                    <th className="text-left px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Fee</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Commission</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Balance After</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Date-Time</th>
                    <th className="text-left px-4 py-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(txn => {
                    const sender = getSender(txn);
                    const isExpanded = expandedId === txn.id;
                    return (
                      <Fragment key={txn.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : txn.id)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{txn.short_id}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className={`text-xs ${TXN_TYPE_COLORS[txn.type] ?? ""}`}>
                              {txn.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="leading-tight">
                              <p className="font-medium text-foreground text-xs">{sender?.name || "—"}</p>
                              <p className="text-[11px] text-muted-foreground">{sender?.phone || "—"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="leading-tight">
                              <p className="font-medium text-foreground text-xs">{txn.recipient_name || "—"}</p>
                              <p className="text-[11px] text-muted-foreground">{txn.recipient_phone || "—"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">৳{txn.amount?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">৳{txn.fee?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">৳{txn.commission?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden xl:table-cell">
                            {txn.balance_after != null ? `৳${Number(txn.balance_after).toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_BADGE[txn.status] ?? "outline"} className="text-xs capitalize">{txn.status}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {format(new Date(txn.created_at), "MMM dd, yyyy, hh:mm a")}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>
                        <AnimatePresence>
                          {isExpanded && (
                            <tr>
                              <td colSpan={11} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="bg-muted/30 px-6 py-4 grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-1">Transaction ID</p>
                                      <p className="font-mono text-xs text-foreground break-all">{txn.id}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-1">Description</p>
                                      <p className="text-foreground">{txn.description || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-1">Reference</p>
                                      <p className="font-mono text-xs text-foreground">{txn.reference || "—"}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-1">Amount / Fee / Commission</p>
                                      <p className="text-foreground">৳{txn.amount?.toLocaleString()} / ৳{txn.fee?.toLocaleString()} / ৳{txn.commission?.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-1">Balance After</p>
                                      <p className="text-foreground">{txn.balance_after != null ? `৳${Number(txn.balance_after).toLocaleString()}` : "—"}</p>
                                    </div>
                                    <div className="flex items-end">
                                      <Button
                                        size="sm" variant="destructive" className="text-xs h-7 gap-1"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const { data: profile } = await supabase.from("profiles").select("balance").eq("user_id", txn.user_id).single();
                                          setChargebackTarget({ userId: txn.user_id, name: sender?.name || null, phone: sender?.phone || "", balance: parseFloat(String(profile?.balance ?? "0")), transactionId: txn.id, transactionAmount: txn.amount });
                                        }}
                                      >
                                        <RotateCcw className="w-3 h-3" /> Chargeback
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-border/50">
              {filtered.map(txn => {
                const sender = getSender(txn);
                const isExpanded = expandedId === txn.id;
                return (
                  <div key={txn.id}>
                    <button
                      className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : txn.id)}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className={`text-[10px] ${TXN_TYPE_COLORS[txn.type] ?? ""}`}>{txn.type}</Badge>
                          <Badge variant={STATUS_BADGE[txn.status] ?? "outline"} className="text-[10px] capitalize">{txn.status}</Badge>
                          <span className="text-[10px] font-mono text-muted-foreground ml-auto">{txn.short_id}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground truncate">
                            {sender?.name || sender?.phone || "—"} → {txn.recipient_name || txn.recipient_phone || "—"}
                          </p>
                          <span className="font-semibold text-foreground text-sm shrink-0 ml-2">৳{txn.amount?.toLocaleString()}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(txn.created_at), "MMM dd, hh:mm a")}</p>
                      </div>
                      <div className="shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-muted/30 px-3 pb-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">Sender</p>
                              <p className="font-medium text-foreground">{sender?.name || "—"}</p>
                              <p className="text-muted-foreground">{sender?.phone || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Receiver</p>
                              <p className="font-medium text-foreground">{txn.recipient_name || "—"}</p>
                              <p className="text-muted-foreground">{txn.recipient_phone || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Fee</p>
                              <p className="text-foreground">৳{txn.fee?.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Commission</p>
                              <p className="text-foreground">৳{txn.commission?.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Balance After</p>
                              <p className="text-foreground">{txn.balance_after != null ? `৳${Number(txn.balance_after).toLocaleString()}` : "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-0.5">Reference</p>
                              <p className="font-mono text-foreground">{txn.reference || "—"}</p>
                            </div>
                            {txn.description && (
                              <div className="col-span-2">
                                <p className="text-muted-foreground mb-0.5">Description</p>
                                <p className="text-foreground">{txn.description}</p>
                              </div>
                            )}
                            <div className="col-span-2">
                              <p className="text-muted-foreground mb-0.5">Transaction ID</p>
                              <p className="font-mono text-[10px] text-foreground break-all">{txn.id}</p>
                            </div>
                            <div className="col-span-2 pt-1">
                              <Button
                                size="sm" variant="destructive" className="text-xs h-7 gap-1"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const { data: profile } = await supabase.from("profiles").select("balance").eq("user_id", txn.user_id).single();
                                  setChargebackTarget({ userId: txn.user_id, name: sender?.name || null, phone: sender?.phone || "", balance: parseFloat(profile?.balance || "0"), transactionId: txn.id, transactionAmount: txn.amount });
                                }}
                              >
                                <RotateCcw className="w-3 h-3" /> Chargeback
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-10 text-sm">No transactions found</p>
            )}

            {hasMore && filtered.length > 0 && (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" onClick={() => loadTransactions(transactions.length)} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AdminChargebackDialog
        target={chargebackTarget}
        open={!!chargebackTarget}
        onOpenChange={(v) => { if (!v) setChargebackTarget(null); }}
        onSuccess={() => loadTransactions(0)}
      />
    </Card>
  );
}
