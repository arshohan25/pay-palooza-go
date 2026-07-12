import { useState } from "react";
import { toast } from "sonner";
import { AlertOctagon, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  open: boolean;
  onClose: () => void;
  transactionId?: string | null;
  subjectUserId?: string | null;
  subjectLabel?: string;
}

const REASONS = [
  { v: "structuring", l: "Structuring / repeated small amounts" },
  { v: "unknown_source", l: "Unknown source of funds" },
  { v: "refused_id", l: "Refused to show ID" },
  { v: "impersonation", l: "Suspected impersonation" },
  { v: "unusual_behavior", l: "Unusual behavior" },
  { v: "other", l: "Other" },
];

const FlagSuspiciousSheet = ({ open, onClose, transactionId, subjectUserId, subjectLabel }: Props) => {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setReason(""); setSeverity("medium"); setNotes(""); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!user?.id) { toast.error("Login required"); return; }
    if (!reason) { toast.error("Choose a reason"); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from("aml_reports").insert({
      agent_id: user.id,
      subject_user_id: subjectUserId ?? null,
      transaction_id: transactionId ?? null,
      reason,
      severity,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message || "Report failed"); return; }
    toast.success("Reported to compliance");
    close();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8">
        <SheetHeader className="mb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <AlertOctagon size={18} className="text-rose-500" />
            Flag suspicious activity
          </SheetTitle>
        </SheetHeader>

        {subjectLabel && (
          <div className="mb-3 rounded-xl bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">
            Subject: <span className="text-foreground font-semibold">{subjectLabel}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-xl h-11 mt-1"><SelectValue placeholder="Choose reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Severity</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {(["low", "medium", "high"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`h-10 rounded-xl text-xs font-semibold capitalize border transition-colors
                    ${severity === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Notes (optional)</Label>
            <Textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              maxLength={500} rows={3}
              placeholder="Anything compliance should know…"
              className="rounded-xl mt-1"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={close}>Cancel</Button>
            <Button className="flex-1 rounded-xl h-11" onClick={submit} disabled={submitting || !reason}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : "Submit report"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FlagSuspiciousSheet;
