import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, MessageCircle, CheckCircle2, Clock, XCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AccessRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  message: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  merchantId?: string | null;
}

/**
 * Shown to merchants when the API Integration tab is locked.
 * Lets them request access (which surfaces in admin) and/or open Live Chat.
 */
export default function MerchantApiAccessGate({ userId, merchantId }: Props) {
  const navigate = useNavigate();
  const [latest, setLatest] = useState<AccessRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("merchant_api_access_requests")
      .select("id, status, message, reviewer_note, reviewed_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    setLatest(data?.[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`api-access-req-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_api_access_requests", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const submit = async () => {
    setSubmitting(true);
    const { error } = await (supabase as any).from("merchant_api_access_requests").insert({
      user_id: userId,
      merchant_id: merchantId ?? null,
      message: message.trim() || null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request submitted. An admin will review shortly.");
    setOpen(false);
    setMessage("");
  };

  const status = latest?.status;
  const pending = status === "pending";
  const rejected = status === "rejected";

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Globe className="w-6 h-6 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 border-2 border-card flex items-center justify-center">
              <Lock className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground">API Integration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Locked by default. Request access to generate API keys, configure webhooks, and integrate EasyPay into your site or app.
            </p>
          </div>
        </div>

        {/* Status block */}
        {!loading && latest && (
          <div className={`mt-4 rounded-xl border p-3 flex items-start gap-3 ${
            pending ? "border-amber-500/30 bg-amber-500/5"
            : status === "approved" ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-destructive/30 bg-destructive/5"
          }`}>
            {pending && <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
            {status === "approved" && <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
            {rejected && <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground capitalize">
                Request {status}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {pending && "Our team is reviewing your request. You’ll see the API tab as soon as it’s approved."}
                {status === "approved" && "Access granted — refresh if the tab hasn’t appeared yet."}
                {rejected && (latest.reviewer_note || "Your previous request was rejected. You can submit a new one or contact support.")}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                Submitted {new Date(latest.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => setOpen(true)}
            className="text-xs"
          >
            {pending ? "Request Pending" : rejected ? "Request Again" : "Request Access"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/account")}
            className="text-xs gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Live Chat
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          Need help? Open Live Chat from your Account page to talk to support.
        </p>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Request API Integration Access</DialogTitle>
            <DialogDescription className="text-xs">
              Tell us briefly why you need API access. Our team usually responds within one business day.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. I want to accept payments on my website checkout and integrate EasyPay via webhooks."
            rows={4}
            className="text-sm"
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={submitting} onClick={submit}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
