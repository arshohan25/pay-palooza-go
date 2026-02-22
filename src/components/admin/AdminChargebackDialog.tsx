import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChargebackTarget {
  userId: string;
  name: string | null;
  phone: string;
  balance: number;
  referenceTxnId?: string;
  prefillAmount?: number;
}

interface AdminChargebackDialogProps {
  target: ChargebackTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AdminChargebackDialog({ target, open, onOpenChange, onSuccess }: AdminChargebackDialogProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");

  const reset = () => {
    setAmount("");
    setReason("");
    setStep("form");
    setProcessing(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const parsedAmount = parseFloat(amount);
  const isValid = parsedAmount > 0 && reason.trim().length >= 3;

  const handleConfirm = async () => {
    if (!target || !isValid) return;
    setProcessing(true);

    try {
      const { data, error } = await supabase.rpc("admin_chargeback", {
        p_target_user_id: target.userId,
        p_amount: parsedAmount,
        p_reason: reason.trim(),
        p_reference_txn_id: target.referenceTxnId || null,
      });

      if (error) throw error;

      const result = data as any;
      toast.success(`Chargeback successful`, {
        description: `৳${result.deducted?.toLocaleString()} deducted. New balance: ৳${result.new_balance?.toLocaleString()}`,
      });

      handleOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error("Chargeback failed", { description: err.message });
    } finally {
      setProcessing(false);
    }
  };

  if (!target) return null;

  // Pre-fill amount on first open
  const effectiveAmount = amount || (target.prefillAmount ? String(target.prefillAmount) : "");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Chargeback
          </DialogTitle>
          <DialogDescription>
            Deduct funds from a user's account. This action is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        {/* Target user info */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">User</span>
            <span className="text-sm font-medium text-foreground">{target.name || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Phone</span>
            <span className="text-sm font-mono text-foreground">{target.phone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Balance</span>
            <Badge variant="secondary" className="text-xs">৳{target.balance.toLocaleString()}</Badge>
          </div>
          {target.referenceTxnId && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ref Txn</span>
              <span className="text-[11px] font-mono text-muted-foreground">{target.referenceTxnId.slice(0, 12)}…</span>
            </div>
          )}
        </div>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cb-amount">Amount (৳)</Label>
              <Input
                id="cb-amount"
                type="number"
                min="1"
                max={target.balance}
                placeholder="Enter amount"
                value={effectiveAmount}
                onChange={e => setAmount(e.target.value)}
              />
              {parsedAmount > target.balance && (
                <p className="text-xs text-destructive">
                  Amount exceeds balance. Will be capped to ৳{target.balance.toLocaleString()}.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb-reason">Reason (required)</Label>
              <Textarea
                id="cb-reason"
                placeholder="e.g. Reversal of fraudulent transaction, penalty for policy violation…"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button variant="destructive" disabled={!isValid} onClick={() => setStep("confirm")}>
                Review Chargeback
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-destructive">Confirm Chargeback</p>
              <p className="text-sm text-foreground">
                Deduct <strong>৳{Math.min(parsedAmount, target.balance).toLocaleString()}</strong> from{" "}
                <strong>{target.name || target.phone}</strong>'s account.
              </p>
              <p className="text-xs text-muted-foreground">Reason: {reason}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")} disabled={processing}>Back</Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={processing}>
                {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Confirm & Deduct
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
