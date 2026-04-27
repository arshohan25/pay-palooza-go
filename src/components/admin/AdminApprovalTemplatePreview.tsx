import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Mail, Shuffle, Copy, ExternalLink, CheckCircle2, XCircle, Store, Link2, Unlink, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import {
  buildEmailPayload,
  buildPushPayload,
  SAMPLE_BUSINESSES,
  type MerchantApprovalStatus,
} from "@/lib/merchantApprovalTemplate";

export interface PreviewApplication {
  id: string;
  business_name: string;
  status: string;
  admin_notes?: string | null;
  applicant_name?: string;
  owner_name?: string | null;
  contact_email?: string | null;
  applicant_phone?: string;
  contact_number?: string | null;
}

interface Props {
  applications?: PreviewApplication[];
}

export default function AdminApprovalTemplatePreview({ applications = [] }: Props) {
  const [selectedId, setSelectedId] = useState<string>("manual");
  const [businessName, setBusinessName] = useState("Karim Electronics");
  const [recipientName, setRecipientName] = useState("Karim Rahman");
  const [status, setStatus] = useState<MerchantApprovalStatus>("approved");
  const [reason, setReason] = useState("Trade license image is blurry — please re-upload a clearer copy.");
  const [linked, setLinked] = useState(false);
  const [scenario, setScenario] = useState<string>("none");

  // Test scenarios — try to find an application that already matches the edge case;
  // otherwise synthesize the fields so reviewers always see a representative preview.
  const SCENARIOS: Record<string, { label: string; description: string }> = {
    none: { label: "— No scenario —", description: "" },
    missing_email: { label: "Missing email", description: "Application has no contact email" },
    missing_phone: { label: "Missing phone", description: "Application has no contact phone" },
    rejected_with_reason: { label: "Rejected with reason", description: "Decision is rejected and includes reviewer note" },
  };

  const findScenarioMatch = (key: string): PreviewApplication | undefined => {
    if (key === "missing_email") return applications.find(a => !a.contact_email);
    if (key === "missing_phone") return applications.find(a => !a.applicant_phone && !a.contact_number);
    if (key === "rejected_with_reason") return applications.find(a => a.status === "rejected" && !!a.admin_notes);
    return undefined;
  };

  useEffect(() => {
    if (scenario === "none") return;
    const match = findScenarioMatch(scenario);
    if (match) {
      setSelectedId(match.id);
      return;
    }
    // No real application matches — synthesize.
    setSelectedId("manual");
    setLinked(false);
    if (scenario === "missing_email") {
      setBusinessName("Hasan Tea Stall");
      setRecipientName("Hasan Mia");
      setStatus("approved");
      setReason("");
    } else if (scenario === "missing_phone") {
      setBusinessName("Nadia Tailors");
      setRecipientName("Nadia Akter");
      setStatus("approved");
      setReason("");
    } else if (scenario === "rejected_with_reason") {
      setBusinessName("Rahim Mart");
      setRecipientName("Rahim Uddin");
      setStatus("rejected");
      setReason("Trade license image is blurry — please re-upload a clearer copy.");
    }
  }, [scenario, applications]);

  // Hydrate fields from the chosen application; "manual" leaves them as-is.
  useEffect(() => {
    if (selectedId === "manual") { setLinked(false); return; }
    const app = applications.find(a => a.id === selectedId);
    if (!app) return;
    setLinked(true);
    setBusinessName(app.business_name || "");
    setRecipientName(app.applicant_name || app.owner_name || "Merchant");
    if (app.status === "approved" || app.status === "rejected") {
      setStatus(app.status as MerchantApprovalStatus);
    } else {
      setStatus("approved");
    }
    setReason(app.admin_notes || "");
  }, [selectedId, applications]);

  const selectedApp = applications.find(a => a.id === selectedId);

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
              {linked && (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <Link2 className="w-3 h-3 mr-1" /> Live data
                </Badge>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={cycleSample} disabled={linked}>
              <Shuffle className="w-3.5 h-3.5 mr-1.5" /> Sample name
            </Button>
          </div>

          {/* Application picker */}
          <div className="space-y-1.5">
            <Label className="text-xs">Load from a real application</Label>
            <div className="flex gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={applications.length ? "Pick a merchant application…" : "No applications loaded"} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="manual">Manual sample data</SelectItem>
                  {applications.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.business_name} · {a.applicant_name || a.owner_name || "—"} · {a.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linked && (
                <Button size="sm" variant="outline" onClick={() => setSelectedId("manual")}>
                  <Unlink className="w-3.5 h-3.5 mr-1" /> Detach
                </Button>
              )}
            </div>
            {selectedApp && (
              <p className="text-[11px] text-muted-foreground">
                Recipient email: <span className="text-foreground">{selectedApp.contact_email || "—"}</span>
                {" · "}Phone: <span className="text-foreground">{selectedApp.applicant_phone || selectedApp.contact_number || "—"}</span>
              </p>
            )}
          </div>

          {/* Test scenarios */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-muted-foreground" /> Test scenario
            </Label>
            <Select value={scenario} onValueChange={setScenario}>
              <SelectTrigger>
                <SelectValue placeholder="Pick an edge case to preview…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SCENARIOS).map(([key, s]) => (
                  <SelectItem key={key} value={key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {scenario !== "none" && (
              <p className="text-[11px] text-muted-foreground">
                {SCENARIOS[scenario].description}
                {" · "}
                {findScenarioMatch(scenario)
                  ? <span className="text-emerald-600 dark:text-emerald-400">Matched a real application</span>
                  : <span className="text-amber-600 dark:text-amber-400">No match — using synthesized sample</span>}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Merchant business name</Label>
              <Input value={businessName} onChange={(e) => { setBusinessName(e.target.value); setLinked(false); }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Recipient name (email salutation)</Label>
              <Input value={recipientName} onChange={(e) => { setRecipientName(e.target.value); setLinked(false); }} />
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
              onChange={(e) => { setReason(e.target.value); setLinked(false); }}
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
