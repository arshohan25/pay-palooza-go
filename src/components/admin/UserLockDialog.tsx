import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Lock, Loader2, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const LOCKABLE_FEATURES = [
  { value: "send_money", label: "Send Money" },
  { value: "cash_out", label: "Cash Out" },
  { value: "cash_in", label: "Cash In" },
  { value: "add_money", label: "Add Money" },
  { value: "payment", label: "Payment" },
  { value: "mobile_recharge", label: "Mobile Recharge" },
  { value: "pay_bill", label: "Pay Bill" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "qr_scan", label: "QR Scan" },
  { value: "support_chat", label: "Support Chat" },
  { value: "savings", label: "Savings" },
  { value: "all_transactions", label: "All Transactions" },
];

const DURATION_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "custom", label: "Custom Date" },
];

function getExpiresAt(duration: string, customDate?: string): string | null {
  if (duration === "permanent") return null;
  if (duration === "custom" && customDate) return new Date(customDate).toISOString();
  const now = new Date();
  const map: Record<string, number> = {
    "1h": 3600000, "6h": 21600000, "24h": 86400000,
    "7d": 604800000, "30d": 2592000000,
  };
  if (map[duration]) return new Date(now.getTime() + map[duration]).toISOString();
  return null;
}

interface UserLockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetLabel: string; // e.g. "Rahim Uddin (01711223344)"
  onLocked?: () => void;
}

export default function UserLockDialog({ open, onOpenChange, targetUserId, targetLabel, onLocked }: UserLockDialogProps) {
  const { user } = useAuth();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [duration, setDuration] = useState("permanent");
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [existingLocks, setExistingLocks] = useState<string[]>([]);
  const [loadingLocks, setLoadingLocks] = useState(false);

  // Fetch existing locks for this user
  useEffect(() => {
    if (!open || !targetUserId) return;
    setLoadingLocks(true);
    supabase
      .from("feature_locks")
      .select("feature")
      .eq("target_user_id", targetUserId)
      .eq("is_active", true)
      .then(({ data }) => {
        setExistingLocks((data ?? []).map((d: any) => d.feature));
        setLoadingLocks(false);
      });
  }, [open, targetUserId]);

  const resetForm = () => {
    setSelectedFeatures([]);
    setDuration("permanent");
    setCustomDate("");
    setReason("");
  };

  const toggleFeature = (value: string) => {
    setSelectedFeatures(prev =>
      prev.includes(value) ? prev.filter(f => f !== value) : [...prev, value]
    );
  };

  const selectAll = () => {
    const unlocked = LOCKABLE_FEATURES.map(f => f.value).filter(f => !existingLocks.includes(f));
    setSelectedFeatures(unlocked);
  };

  const createLocks = async () => {
    if (!user || selectedFeatures.length === 0) return;
    setSaving(true);
    const expiresAt = getExpiresAt(duration, customDate);

    const rows = selectedFeatures.map(feature => ({
      target_user_id: targetUserId,
      feature,
      reason: reason || null,
      locked_by: user.id,
      expires_at: expiresAt,
    }));

    const { error } = await supabase.from("feature_locks").insert(rows as any);

    if (error) {
      toast.error("Failed to create locks");
    } else {
      const count = selectedFeatures.length;
      toast.success(`${count} feature${count > 1 ? "s" : ""} locked for ${targetLabel}`);
      resetForm();
      onOpenChange(false);
      onLocked?.();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-destructive" /> Lock Features
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target user info */}
          <div className="p-3 rounded-xl bg-muted/60 border border-border">
            <p className="text-xs text-muted-foreground mb-0.5">Target</p>
            <p className="text-sm font-semibold text-foreground">{targetLabel}</p>
          </div>

          {/* Feature selection with checkboxes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Features to Lock</Label>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={selectAll}>
                Select All
              </Button>
            </div>

            {loadingLocks ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {LOCKABLE_FEATURES.map(f => {
                  const alreadyLocked = existingLocks.includes(f.value);
                  const isSelected = selectedFeatures.includes(f.value);
                  return (
                    <label
                      key={f.value}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer text-sm ${
                        alreadyLocked
                          ? "bg-destructive/10 border-destructive/30 opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "bg-primary/10 border-primary/30"
                          : "bg-card border-border hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        checked={isSelected || alreadyLocked}
                        disabled={alreadyLocked}
                        onCheckedChange={() => !alreadyLocked && toggleFeature(f.value)}
                      />
                      <span className={alreadyLocked ? "line-through text-muted-foreground" : ""}>
                        {f.label}
                      </span>
                      {alreadyLocked && (
                        <Lock className="w-3 h-3 text-destructive ml-auto shrink-0" />
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            {existingLocks.length > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> Grayed features are already locked
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {duration === "custom" && (
              <Input
                type="datetime-local"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="mt-1"
              />
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="e.g. Suspicious activity, compliance review…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="resize-none h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={createLocks}
            disabled={selectedFeatures.length === 0 || saving}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Lock {selectedFeatures.length > 0 ? `(${selectedFeatures.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
