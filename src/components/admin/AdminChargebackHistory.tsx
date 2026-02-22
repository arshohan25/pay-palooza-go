import { useState, useEffect, useCallback, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Loader2, RefreshCw, Download, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

interface Profile {
  user_id: string;
  name: string | null;
  phone: string;
}

export default function AdminChargebackHistory() {
  const [chargebacks, setChargebacks] = useState<any[]>([]);
  const [auditMap, setAuditMap] = useState<Record<string, AuditEntry>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reverse chargeback state
  const [reverseTarget, setReverseTarget] = useState<{ txnId: string; userName: string; amount: number } | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const resolveProfiles = useCallback(async (userIds: string[], existing: Record<string, Profile>) => {
    const newIds = [...new Set(userIds)].filter(id => id && !existing[id]);
    if (newIds.length === 0) return existing;
    const { data } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", newIds);
    const updated = { ...existing };
    (data ?? []).forEach(p => { updated[p.user_id] = p; });
    return updated;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: txns } = await supabase
      .from("transactions")
      .select("*")
      .eq("type", "chargeback")
      .order("created_at", { ascending: false })
      .limit(500);

    const rows = txns ?? [];

    const targetUserIds = rows.map(t => t.user_id);
    const { data: audits } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", "chargeback")
      .order("created_at", { ascending: false })
      .limit(500);

    const auditByTxn: Record<string, AuditEntry> = {};
    rows.forEach(txn => {
      const matching = (audits ?? []).find(a =>
        a.entity_id === txn.user_id &&
        Math.abs(new Date(a.created_at).getTime() - new Date(txn.created_at).getTime()) < 5000
      );
      if (matching) auditByTxn[txn.id] = matching as AuditEntry;
    });

    setAuditMap(auditByTxn);

    const allIds = [
      ...targetUserIds,
      ...(audits ?? []).map(a => a.actor_id),
    ];
    const resolved = await resolveProfiles(allIds, {});

    setChargebacks(rows);
    setProfiles(resolved);
    setLoading(false);
  }, [resolveProfiles]);

  useEffect(() => { loadData(); }, []);

  const filtered = chargebacks.filter(txn => {
    if (!search) return true;
    const q = search.toLowerCase();
    const user = profiles[txn.user_id];
    return (
      user?.name?.toLowerCase().includes(q) ||
      user?.phone?.includes(q) ||
      txn.short_id?.toLowerCase().includes(q) ||
      txn.description?.toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const headers = ["Short ID", "Date", "User Name", "User Phone", "Amount", "Status", "Reason", "Admin", "Reference", "Balance After"];
    const csvRows = [headers.join(",")];
    filtered.forEach(txn => {
      const user = profiles[txn.user_id];
      const audit = auditMap[txn.id];
      const admin = audit ? profiles[audit.actor_id] : null;
      csvRows.push([
        txn.short_id,
        format(new Date(txn.created_at), "yyyy-MM-dd HH:mm:ss"),
        `"${user?.name || "—"}"`,
        user?.phone || "—",
        txn.amount,
        txn.status,
        `"${(txn.description || "").replace(/"/g, '""')}"`,
        `"${admin?.name || "System"}"`,
        txn.reference || "—",
        txn.balance_after ?? "—",
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chargebacks-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReverse = async () => {
    if (!reverseTarget || reverseReason.trim().length < 3) return;
    setReversing(true);
    try {
      const { data, error } = await supabase.rpc("admin_reverse_chargeback", {
        p_chargeback_txn_id: reverseTarget.txnId,
        p_reason: reverseReason.trim(),
      });
      if (error) throw error;
      const result = data as any;
      toast.success("Chargeback reversed", {
        description: `৳${result.credited?.toLocaleString()} credited back. New balance: ৳${result.new_balance?.toLocaleString()}`,
      });
      setReverseTarget(null);
      setReverseReason("");
      loadData();
    } catch (err: any) {
      toast.error("Reversal failed", { description: err.message });
    } finally {
      setReversing(false);
    }
  };

  return (
    <>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="text-base">Chargeback History</CardTitle>
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
              <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Short ID</th>
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Reason</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Admin</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                    <th className="text-left px-4 py-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(txn => {
                    const user = profiles[txn.user_id];
                    const audit = auditMap[txn.id];
                    const admin = audit ? profiles[audit.actor_id] : null;
                    const isExpanded = expandedId === txn.id;
                    const isReversed = txn.status === "reversed";

                    return (
                      <Fragment key={txn.id}>
                        <tr
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : txn.id)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{txn.short_id}</td>
                          <td className="px-4 py-3">
                            <div className="leading-tight">
                              <p className="font-medium text-foreground text-xs">{user?.name || "—"}</p>
                              <p className="text-[11px] text-muted-foreground">{user?.phone || "—"}</p>
                            </div>
                          </td>
                          <td className={`px-4 py-3 font-semibold ${isReversed ? "text-muted-foreground line-through" : "text-destructive"}`}>
                            -৳{txn.amount?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={isReversed ? "outline" : "destructive"} className="text-xs">
                              {txn.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-[200px] truncate">
                            {txn.description || "—"}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <p className="text-xs text-foreground">{admin?.name || "System"}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">
                            {format(new Date(txn.created_at), "MMM dd, yyyy, hh:mm a")}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>

                        <AnimatePresence>
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="bg-muted/30 px-6 py-4 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <p className="text-muted-foreground text-xs mb-1">Transaction ID</p>
                                        <p className="font-mono text-xs text-foreground break-all">{txn.id}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs mb-1">Target User</p>
                                        <p className="text-foreground">{user?.name || "—"}</p>
                                        <p className="text-xs text-muted-foreground">{user?.phone || "—"}</p>
                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{txn.user_id}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs mb-1">Amount Deducted</p>
                                        <p className="text-destructive font-semibold">৳{txn.amount?.toLocaleString()}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs mb-1">Balance After</p>
                                        <p className="text-foreground">
                                          {txn.balance_after != null ? `৳${Number(txn.balance_after).toLocaleString()}` : "—"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs mb-1">Reason</p>
                                        <p className="text-foreground">{txn.description || "—"}</p>
                                      </div>
                                      <div>
                                        <p className="text-muted-foreground text-xs mb-1">Reference Txn</p>
                                        <p className="font-mono text-xs text-foreground">{txn.reference || "—"}</p>
                                      </div>

                                      {audit && (
                                        <>
                                          <div>
                                            <p className="text-muted-foreground text-xs mb-1">Performed By (Admin)</p>
                                            <p className="text-foreground">{admin?.name || "Unknown"}</p>
                                            <p className="text-xs text-muted-foreground">{admin?.phone || "—"}</p>
                                            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{audit.actor_id}</p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground text-xs mb-1">Previous Balance</p>
                                            <p className="text-foreground">
                                              {audit.details?.previous_balance != null
                                                ? `৳${Number(audit.details.previous_balance).toLocaleString()}`
                                                : "—"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-muted-foreground text-xs mb-1">Audit Timestamp</p>
                                            <p className="text-foreground">
                                              {format(new Date(audit.created_at), "MMMM dd, yyyy, hh:mm:ss a")}
                                            </p>
                                          </div>
                                        </>
                                      )}

                                      <div>
                                        <p className="text-muted-foreground text-xs mb-1">Transaction Date</p>
                                        <p className="text-foreground">
                                          {format(new Date(txn.created_at), "MMMM dd, yyyy, hh:mm:ss a")}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Reverse button */}
                                    {!isReversed && (
                                      <div className="flex justify-end pt-2 border-t border-border/50">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1.5 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReverseTarget({
                                              txnId: txn.id,
                                              userName: user?.name || user?.phone || "User",
                                              amount: txn.amount,
                                            });
                                          }}
                                        >
                                          <Undo2 className="w-3.5 h-3.5" />
                                          Reverse Chargeback
                                        </Button>
                                      </div>
                                    )}
                                    {isReversed && (
                                      <div className="flex justify-end pt-2 border-t border-border/50">
                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                          Reversed
                                        </Badge>
                                      </div>
                                    )}
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
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-10 text-sm">No chargebacks found</p>
          )}
        </CardContent>
      </Card>

      {/* Reverse Chargeback Dialog */}
      <Dialog open={!!reverseTarget} onOpenChange={(v) => { if (!v) { setReverseTarget(null); setReverseReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-primary" />
              Reverse Chargeback
            </DialogTitle>
            <DialogDescription>
              Credit back the deducted amount to the user's account. This action is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          {reverseTarget && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">User</span>
                  <span className="text-sm font-medium text-foreground">{reverseTarget.userName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount to credit</span>
                  <Badge variant="secondary" className="text-xs text-emerald-700 dark:text-emerald-300">
                    +৳{reverseTarget.amount.toLocaleString()}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reverse-reason">Reason for reversal (required)</Label>
                <Textarea
                  id="reverse-reason"
                  placeholder="e.g. Chargeback issued in error, dispute resolved in user's favour…"
                  value={reverseReason}
                  onChange={e => setReverseReason(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setReverseTarget(null); setReverseReason(""); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleReverse}
                  disabled={reversing || reverseReason.trim().length < 3}
                >
                  {reversing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Confirm Reversal
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
