import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, Search, Filter, Image as ImageIcon,
  ChevronDown, AlertCircle, Wallet, Landmark, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface FundRequestRow {
  id: string;
  user_id: string;
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
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  name: string | null;
  phone: string;
  balance: number;
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock, label: "Pending" },
  approved: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: CheckCircle2, label: "Approved" },
  rejected: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: XCircle, label: "Rejected" },
};

export default function AdminFundRequests() {
  const [requests, setRequests] = useState<FundRequestRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | "add_money" | "withdraw">("all");
  const [search, setSearch] = useState("");
  const [approveTarget, setApproveTarget] = useState<FundRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<FundRequestRow | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from("fund_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data as FundRequestRow[]) ?? [];
    setRequests(rows);

    // Fetch profiles for all unique user IDs
    const userIds = [...new Set(rows.map(r => r.user_id))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, name, phone, balance")
        .in("user_id", userIds);
      const map: Record<string, UserProfile> = {};
      (profs ?? []).forEach(p => { map[p.user_id] = { name: p.name, phone: p.phone, balance: p.balance }; });
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    const ch = supabase
      .channel("admin-fund-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRequests]);

  const filtered = requests.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (search) {
      const profile = profiles[r.user_id];
      const q = search.toLowerCase();
      const match = (profile?.name?.toLowerCase().includes(q)) ||
        (profile?.phone?.includes(q)) ||
        (r.transaction_id_proof?.toLowerCase().includes(q)) ||
        (r.bank_name?.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleApprove = async () => {
    if (!approveTarget) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("admin_approve_fund_request", {
        p_request_id: approveTarget.id,
        p_admin_note: adminNote.trim() || null,
      });
      if (error) throw error;
      toast.success(`${approveTarget.type === "add_money" ? "Add Money" : "Withdrawal"} of ৳${approveTarget.amount.toLocaleString()} approved`);
      setApproveTarget(null);
      setAdminNote("");
    } catch (e: any) {
      toast.error(e.message || "Failed to approve");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (adminNote.trim().length < 3) { toast.error("Rejection reason is required (min 3 chars)"); return; }
    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc("admin_reject_fund_request", {
        p_request_id: rejectTarget.id,
        p_admin_note: adminNote.trim(),
      });
      if (error) throw error;
      toast.success("Request rejected");
      setRejectTarget(null);
      setAdminNote("");
    } catch (e: any) {
      toast.error(e.message || "Failed to reject");
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading fund requests…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          Fund Requests
          {pendingCount > 0 && <Badge variant="destructive" className="text-xs">{pendingCount} pending</Badge>}
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <button key={f} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${filter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setFilter(f)}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 && <Badge variant="secondary" className="text-[10px] px-1">{pendingCount}</Badge>}
            </button>
          ))}
        </div>
        <div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5">
          {(["all", "add_money", "withdraw"] as const).map(f => (
            <button key={f} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${typeFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTypeFilter(f)}>
              {f === "all" ? "All Types" : f === "add_money" ? "Add Money" : "Withdraw"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name, phone, TxnID…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {/* Request Cards */}
      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No requests found.</p>}
        {filtered.map(req => {
          const profile = profiles[req.user_id];
          const statusCfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const isAddMoney = req.type === "add_money";

          return (
            <Card key={req.id} className="border shadow-sm">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAddMoney ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-blue-100 dark:bg-blue-900/30"}`}>
                      {isAddMoney ? <Wallet size={18} className="text-emerald-600" /> : <Landmark size={18} className="text-blue-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{profile?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{profile?.phone || "—"} · Balance: ৳{(profile?.balance ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge className={`${statusCfg.color} text-[10px] gap-1`}><StatusIcon size={10} />{statusCfg.label}</Badge>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground capitalize">{req.type.replace("_", " ")}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-bold text-foreground">৳{req.amount.toLocaleString()}</span></div>
                  {req.source_method && <div><span className="text-muted-foreground">Source:</span> <span className="font-medium text-foreground capitalize">{req.source_method.replace("_", " ")}</span></div>}
                  {req.transaction_id_proof && <div><span className="text-muted-foreground">TxnID:</span> <span className="font-mono text-foreground">{req.transaction_id_proof}</span></div>}
                  {req.bank_name && <div><span className="text-muted-foreground">Bank:</span> <span className="font-medium text-foreground">{req.bank_name}</span></div>}
                  {req.account_number && <div><span className="text-muted-foreground">A/C:</span> <span className="font-mono text-foreground">{req.account_number}</span></div>}
                  {req.account_holder && <div className="col-span-2"><span className="text-muted-foreground">Holder:</span> <span className="font-medium text-foreground">{req.account_holder}</span></div>}
                  <div className="col-span-2"><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{new Date(req.created_at).toLocaleString()}</span></div>
                </div>

                {/* Proof */}
                {req.proof_url && (
                  <button onClick={() => setProofPreview(req.proof_url)}
                    className="flex items-center gap-2 text-xs text-primary hover:underline">
                    <ImageIcon size={12} /> View Proof
                  </button>
                )}

                {/* Admin note */}
                {req.admin_note && (
                  <div className="text-xs p-2 rounded-lg bg-muted/50 border border-border">
                    <span className="text-muted-foreground">Admin note:</span> <span className="text-foreground">{req.admin_note}</span>
                  </div>
                )}

                {/* Actions */}
                {req.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={() => { setApproveTarget(req); setAdminNote(""); }}>
                      <CheckCircle2 size={14} className="mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => { setRejectTarget(req); setAdminNote(""); }}>
                      <XCircle size={14} className="mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={!!approveTarget} onOpenChange={() => setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve {approveTarget?.type === "add_money" ? "Add Money" : "Withdrawal"} Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will {approveTarget?.type === "add_money" ? "credit" : "debit"} ৳{approveTarget?.amount.toLocaleString()} {approveTarget?.type === "add_money" ? "to" : "from"} the user's wallet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Optional note…" value={adminNote} onChange={e => setAdminNote(e.target.value)} className="min-h-[60px]" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700">
              {processing ? "Processing…" : "Confirm Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Reason is required. The user will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea placeholder="Rejection reason (required)…" value={adminNote} onChange={e => setAdminNote(e.target.value)} className="min-h-[80px]" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={processing || adminNote.trim().length < 3} className="bg-destructive hover:bg-destructive/90">
              {processing ? "Processing…" : "Confirm Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proof Preview Modal */}
      <AlertDialog open={!!proofPreview} onOpenChange={() => setProofPreview(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Payment Proof</AlertDialogTitle>
          </AlertDialogHeader>
          {proofPreview && <img src={proofPreview} alt="Proof" className="w-full max-h-[60vh] object-contain rounded-lg" />}
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
