import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lock, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useMyStaffAccessRequests, TILE_TO_PERMISSION, type RequestablePermissionKey } from "@/hooks/use-staff-access-requests";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The display label (e.g. "Send Money", "Cash Out"). */
  tileLabel: string | null;
  merchantId: string | null;
  /** The staff_id row of the current user (from useStaffAccess). */
  staffId: string | null;
}

export default function RequestAccessSheet({ open, onClose, tileLabel, merchantId, staffId }: Props) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { submit, cancel, pendingForKey, requests } = useMyStaffAccessRequests(staffId);

  const permissionKey: RequestablePermissionKey | null =
    tileLabel ? TILE_TO_PERMISSION[tileLabel] ?? null : null;

  const existingPending = permissionKey ? pendingForKey(permissionKey) : null;
  const lastDecision = permissionKey
    ? requests.find(r => r.permission_key === permissionKey && (r.status === "denied" || r.status === "granted")) ?? null
    : null;

  useEffect(() => { if (open) setNote(""); }, [open, tileLabel]);

  const handleSubmit = async () => {
    if (!merchantId || !permissionKey || !tileLabel) {
      toast.error("Cannot send request right now"); return;
    }
    setSubmitting(true);
    const { error } = await submit({
      merchantId,
      permissionKey,
      displayLabel: tileLabel,
      note,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Could not send request");
      return;
    }
    toast.success("Request sent — owner has been notified");
    onClose();
  };

  const handleCancel = async () => {
    if (!existingPending) return;
    const { error } = await cancel(existingPending.id);
    if (error) toast.error(error.message);
    else toast.success("Request cancelled");
  };

  const canRequest = !!permissionKey && !!merchantId && !!staffId;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl z-[90]" overlayClassName="z-[90]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Lock size={16} className="text-amber-600" /> Request access
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">You're requesting</p>
            <p className="text-lg font-bold text-foreground">{tileLabel ?? "—"}</p>
            {permissionKey && (
              <Badge variant="outline" className="text-[9px] mt-1.5">
                Permission: {permissionKey.replace("_", " ")}
              </Badge>
            )}
          </div>

          {!canRequest && (
            <p className="text-[11px] text-destructive text-center">
              This permission isn't requestable. Ask your store owner directly.
            </p>
          )}

          {existingPending && (
            <div className="rounded-xl border border-amber-300 bg-amber-500/10 p-3 flex items-start gap-2">
              <Clock size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-amber-700">Request pending</p>
                <p className="text-[10px] text-amber-700/80">The owner has been notified. You'll get access as soon as they approve.</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={handleCancel}>Cancel</Button>
            </div>
          )}

          {!existingPending && lastDecision?.status === "denied" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
              <XCircle size={14} className="text-destructive mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-destructive">Previous request denied</p>
                {lastDecision.deny_reason && <p className="text-[10px] text-destructive/80">"{lastDecision.deny_reason}"</p>}
                <p className="text-[10px] text-muted-foreground mt-0.5">You can ask again with more context below.</p>
              </div>
            </div>
          )}

          {!existingPending && lastDecision?.status === "granted" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-500/10 p-3 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-emerald-700 flex-1">
                You had this permission before — it may have been revoked. Send another request to ask for it again.
              </p>
            </div>
          )}

          {!existingPending && canRequest && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-foreground">Add a note (optional)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. I need this to process today's customer payouts"
                  maxLength={200}
                  className="mt-1 text-xs"
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{note.length}/200</p>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                <Send size={13} className="mr-1.5" />
                {submitting ? "Sending…" : "Send request to owner"}
              </Button>
            </>
          )}

          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
