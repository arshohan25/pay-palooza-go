import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CreditCard, Search, RefreshCw, CheckCircle, XCircle, Banknote, Clock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  disbursed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  repaid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const STATUSES = ["all", "pending", "approved", "rejected", "disbursed", "repaid"] as const;

export default function AdminLoanManagement() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionDialog, setActionDialog] = useState<{ loan: any; action: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("loan_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setLoans(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = loans.filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search && !l.user_id?.includes(search) && !l.id?.includes(search)) return false;
    return true;
  });

  const stats = {
    total: loans.length,
    pending: loans.filter(l => l.status === "pending").length,
    approved: loans.filter(l => l.status === "approved").length,
    disbursed: loans.filter(l => l.status === "disbursed").length,
    totalLent: loans.filter(l => ["approved", "disbursed", "repaid"].includes(l.status)).reduce((s, l) => s + Number(l.amount), 0),
  };

  const handleAction = async () => {
    if (!actionDialog) return;
    const { loan, action, note } = actionDialog;
    if (action === "reject" && !note.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const updates: Record<string, any> = {
      status: action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "disburse" ? "disbursed" : "repaid",
    };
    if (note.trim()) updates.admin_notes = note.trim();
    if (["approve", "reject"].includes(action)) {
      updates.reviewed_by = session?.user?.id;
      updates.reviewed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("loan_applications").update(updates).eq("id", loan.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Loan ${updates.status}`);
    setActionDialog(null);
    fetch();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: CreditCard },
          { label: "Pending", value: stats.pending, icon: Clock },
          { label: "Approved", value: stats.approved, icon: CheckCircle },
          { label: "Disbursed", value: stats.disbursed, icon: Banknote },
          { label: "Total Lent", value: `৳${stats.totalLent.toLocaleString()}`, icon: CreditCard },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by user ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {STATUSES.map(s => (
          <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize h-8 text-xs">
            {s}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={fetch}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2"><CardTitle className="text-base">Loan Applications</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Tenure</TableHead>
                  <TableHead className="text-xs">EMI</TableHead>
                  <TableHead className="text-xs">Rate</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Applied</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No applications found</TableCell></TableRow>
                ) : filtered.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell className="text-xs font-mono">{loan.user_id?.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs font-semibold">৳{Number(loan.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{loan.tenure_days}d</TableCell>
                    <TableCell className="text-xs">৳{Number(loan.emi_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{loan.interest_rate}%</TableCell>
                    <TableCell><Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[loan.status] ?? ""}`}>{loan.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(loan.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {loan.status === "pending" && (
                          <>
                            <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => setActionDialog({ loan, action: "approve", note: "" })}>Approve</Button>
                            <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => setActionDialog({ loan, action: "reject", note: "" })}>Reject</Button>
                          </>
                        )}
                        {loan.status === "approved" && (
                          <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => setActionDialog({ loan, action: "disburse", note: "" })}>Disburse</Button>
                        )}
                        {loan.status === "disbursed" && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setActionDialog({ loan, action: "repaid", note: "" })}>Repaid</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!actionDialog} onOpenChange={v => !v && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">{actionDialog?.action} Loan</AlertDialogTitle>
            <AlertDialogDescription>
              ৳{Number(actionDialog?.loan?.amount).toLocaleString()} for user {actionDialog?.loan?.user_id?.slice(0, 8)}…
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder={actionDialog?.action === "reject" ? "Rejection reason (required)" : "Admin note (optional)"}
            value={actionDialog?.note ?? ""}
            onChange={e => actionDialog && setActionDialog({ ...actionDialog, note: e.target.value })}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction} disabled={saving}>
              {saving ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
