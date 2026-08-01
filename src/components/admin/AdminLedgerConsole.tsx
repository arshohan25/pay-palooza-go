import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Loader2, RefreshCw, Scale, ShieldCheck, X,
} from "lucide-react";

const REASON_CODES = [
  { value: "failed_txn_reversal", label: "Failed transaction reversal" },
  { value: "duplicate_charge", label: "Duplicate charge refund" },
  { value: "gateway_mismatch", label: "Gateway settlement mismatch" },
  { value: "goodwill_credit", label: "Goodwill / retention credit" },
  { value: "promo_correction", label: "Promo or cashback correction" },
  { value: "fraud_clawback", label: "Fraud clawback" },
  { value: "manual_correction", label: "Manual balance correction" },
];

const DUAL_APPROVAL_THRESHOLD = 50000;

interface Adjustment {
  id: string;
  target_user_id: string;
  direction: string;
  amount: number;
  reason_code: string;
  notes: string | null;
  status: string;
  balance_before: number | null;
  balance_after: number | null;
  requested_by: string;
  approved_by: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  applied: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  pending_approval: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

/**
 * Manual ledger adjustment console — admin credit/debit with reason codes,
 * dual approval above the threshold, and a full audit trail.
 */
const AdminLedgerConsole = () => {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [target, setTarget] = useState<{ user_id: string; name: string | null; phone: string; balance: number } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0].value);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [selfId, setSelfId] = useState<string | null>(null);

  const numericAmount = Number(amount) || 0;
  const needsApproval = numericAmount >= DUAL_APPROVAL_THRESHOLD;

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_ledger_adjustments" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (data ?? []) as any as Adjustment[];
    setRows(list);

    const ids = [...new Set(list.flatMap((r) => [r.target_user_id, r.requested_by]))];
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", ids);
      setNames(
        Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.name || p.phone])),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRows();
    supabase.auth.getSession().then(({ data }) => setSelfId(data.session?.user.id ?? null));
  }, [loadRows]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-ledger-adjustments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_ledger_adjustments" },
        () => loadRows(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadRows]);

  const lookup = async () => {
    const clean = phone.replace(/\s+/g, "");
    if (clean.length < 11) {
      toast({ title: "Enter a valid 11-digit wallet number", variant: "destructive" });
      return;
    }
    setLookingUp(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, name, phone, balance")
      .eq("phone", clean)
      .maybeSingle();
    setLookingUp(false);
    if (error || !data) {
      setTarget(null);
      toast({ title: "No wallet found for that number", variant: "destructive" });
      return;
    }
    setTarget(data as any);
  };

  const submit = async () => {
    if (!target) return;
    if (numericAmount <= 0) {
      toast({ title: "Enter an amount greater than zero", variant: "destructive" });
      return;
    }
    if (direction === "debit" && numericAmount > Number(target.balance)) {
      toast({ title: "Debit exceeds the wallet balance", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("admin_request_balance_adjustment" as any, {
      _target_user_id: target.user_id,
      _direction: direction,
      _amount: numericAmount,
      _reason_code: reasonCode,
      _notes: notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Adjustment failed", description: error.message, variant: "destructive" });
      return;
    }
    const result: any = data;
    if (result?.status === "pending_approval") {
      toast({
        title: "Sent for second-admin approval",
        description: `৳${numericAmount.toLocaleString()} is above the ৳${DUAL_APPROVAL_THRESHOLD.toLocaleString()} threshold.`,
      });
    } else {
      toast({
        title: "Adjustment applied",
        description: `New balance: ৳${Number(result?.balance_after ?? 0).toLocaleString()}`,
      });
      setTarget({ ...target, balance: Number(result?.balance_after ?? target.balance) });
    }
    setAmount("");
    setNotes("");
    loadRows();
  };

  const review = async (id: string, approve: boolean) => {
    setActingId(id);
    const { error } = await supabase.rpc("admin_review_balance_adjustment" as any, {
      _adjustment_id: id,
      _approve: approve,
      _notes: null,
    });
    setActingId(null);
    if (error) {
      toast({ title: approve ? "Approval failed" : "Rejection failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: approve ? "Adjustment approved and applied" : "Adjustment rejected" });
    loadRows();
  };

  const pending = useMemo(() => rows.filter((r) => r.status === "pending_approval"), [rows]);

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="w-4 h-4 text-primary" /> Manual Ledger Adjustment
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Every adjustment is reason-coded and audit-logged. Amounts of ৳{DUAL_APPROVAL_THRESHOLD.toLocaleString()} or
            more require a second admin to approve.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Wallet number</Label>
              <Input
                value={phone}
                inputMode="numeric"
                placeholder="01XXXXXXXXX"
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              />
            </div>
            <Button variant="outline" onClick={lookup} disabled={lookingUp}>
              {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Look up"}
            </Button>
          </div>

          {target && (
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{target.name || "Unnamed user"}</p>
                  <p className="text-xs text-muted-foreground">{target.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Current balance</p>
                  <p className="text-lg font-bold tabular-nums">৳{Number(target.balance).toLocaleString()}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Direction</Label>
                  <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Credit (add funds)</SelectItem>
                      <SelectItem value="debit">Debit (remove funds)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount (৳)</Label>
                  <Input
                    value={amount}
                    inputMode="decimal"
                    placeholder="0"
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason code</Label>
                  <Select value={reasonCode} onValueChange={setReasonCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REASON_CODES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  rows={2}
                  value={notes}
                  placeholder="Ticket reference, context, approver instructions…"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {needsApproval && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    This amount is at or above the dual-approval threshold. It will be queued for another admin instead of
                    applying immediately.
                  </span>
                </div>
              )}

              <Button onClick={submit} disabled={submitting || numericAmount <= 0} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                {needsApproval ? "Submit for approval" : direction === "credit" ? "Apply credit" : "Apply debit"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <div>
            <CardTitle className="text-base">Adjustment trail</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {pending.length} awaiting approval · last 100 records
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadRows} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    {loading ? "Loading…" : "No manual adjustments yet."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{names[r.target_user_id] ?? r.target_user_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${r.direction === "credit" ? "text-emerald-600" : "text-destructive"}`}>
                      {r.direction === "credit" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {r.direction}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums">
                    ৳{Number(r.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    {REASON_CODES.find((c) => c.value === r.reason_code)?.label ?? r.reason_code}
                  </TableCell>
                  <TableCell className="text-xs">{names[r.requested_by] ?? r.requested_by.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[r.status] ?? ""}`}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending_approval" ? (
                      r.requested_by === selfId ? (
                        <span className="text-[11px] text-muted-foreground">Needs another admin</span>
                      ) : (
                        <div className="inline-flex gap-1.5">
                          <Button size="sm" variant="outline" disabled={actingId === r.id} onClick={() => review(r.id, true)}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" disabled={actingId === r.id} onClick={() => review(r.id, false)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLedgerConsole;
