import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Shuffle, Copy, ExternalLink, CheckCircle2, XCircle, Store } from "lucide-react";
import { toast } from "sonner";
import {
  buildEmailPayload,
  buildPushPayload,
  SAMPLE_BUSINESSES,
  type MerchantApprovalStatus,
} from "@/lib/merchantApprovalTemplate";

export default function AdminApprovalTemplatePreview() {
  const [businessName, setBusinessName] = useState("Karim Electronics");
  const [recipientName, setRecipientName] = useState("Karim Rahman");
  const [status, setStatus] = useState<MerchantApprovalStatus>("approved");
  const [reason, setReason] = useState("Trade license image is blurry — please re-upload a clearer copy.");

  const push = useMemo(
    () => buildPushPayload({ businessName, status, reason: status === "rejected" ? reason : null }),
    [businessName, status, reason],
  );
  const email = useMemo(
    () => buildEmailPayload({ businessName, recipientName, status, reason: status === "rejected" ? reason : null }),
    [businessName, recipientName, status, reason],
  );

  const cycleSample = () => {
    const idx = SAMPLE_BUSINESSES.indexOf(businessName);
    setBusinessName(SAMPLE_BUSINESSES[(idx + 1) % SAMPLE_BUSINESSES.length]);
  };

  const copyHtml = async () => {
    await navigator.clipboard.writeText(email.html);
    toast.success("Email HTML copied");
  };

  const openInTab = () => {
    const blob = new Blob([email.html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank", "noopener");
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Template Preview</h3>
              <Badge variant="secondary" className="text-[10px]">notify-merchant-approval</Badge>
            </div>
            <Button size="sm" variant="outline" onClick={cycleSample}>
              <Shuffle className="w-3.5 h-3.5 mr-1.5" /> Sample name
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Merchant business name</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Recipient name (email salutation)</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Decision</Label>
            <div className="inline-flex p-1 rounded-xl bg-muted">
              <button
                onClick={() => setStatus("approved")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition ${
                  status === "approved" ? "bg-emerald-500 text-white shadow" : "text-muted-foreground"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approved
              </button>
              <button
                onClick={() => setStatus("rejected")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition ${
                  status === "rejected" ? "bg-destructive text-white shadow" : "text-muted-foreground"
                }`}
              >
                <XCircle className="w-3.5 h-3.5" /> Rejected
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Reviewer's note {status === "approved" && <span className="text-muted-foreground">(rejected only)</span>}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={status === "approved"}
              rows={2}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Push preview */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Push notification</h4>
              <Badge variant="outline" className="text-[10px] ml-auto">{push.category}</Badge>
            </div>

            {/* Mock device push card */}
            <div className="rounded-[19px] bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-xl">
              <div className="rounded-2xl bg-white/95 backdrop-blur p-3 shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">EasyPay</span>
                      <span className="text-[10px] text-slate-500">now</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-snug mt-0.5 break-words">{push.title}</p>
                    <p className="text-xs text-slate-700 leading-snug mt-1 break-words">{push.body}</p>
                    <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                      {push.ctaLabel} <span aria-hidden>→</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-white/60 text-center mt-3">Tap opens {push.ctaUrl}</p>
            </div>

            <div className="text-[11px] text-muted-foreground space-y-1 px-1">
              <div><span className="font-semibold">Title:</span> {push.title}</div>
              <div><span className="font-semibold">Body:</span> {push.body}</div>
            </div>
          </CardContent>
        </Card>

        {/* Email preview */}
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Mail className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Email</h4>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" variant="outline" onClick={copyHtml}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> HTML
                </Button>
                <Button size="sm" variant="outline" onClick={openInTab}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-16 shrink-0">Subject</span>
                <span className="font-semibold text-foreground break-words">{email.subject}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-16 shrink-0">Preview</span>
                <span className="text-muted-foreground break-words">{email.preheader}</span>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border bg-white">
              <iframe
                title="Email preview"
                srcDoc={email.html}
                sandbox=""
                className="w-full block"
                style={{ height: 560, border: 0, background: "#ffffff" }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
