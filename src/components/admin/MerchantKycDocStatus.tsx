import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, FileText, Eye, ShieldCheck, Clock, Send, ArrowRight,
} from "lucide-react";

type DocKey = "nid_front" | "nid_back" | "trade_license" | "bank_statement" | "trade_license_number";

interface DocSpec {
  key: DocKey;
  urlField?: "nid_front_url" | "nid_back_url" | "trade_license_url" | "bank_statement_url";
  label: string;
  required: boolean;
  numberField?: boolean;
}

const DOCS: DocSpec[] = [
  { key: "nid_front", urlField: "nid_front_url", label: "NID (Front)", required: true },
  { key: "nid_back", urlField: "nid_back_url", label: "NID (Back)", required: true },
  { key: "trade_license", urlField: "trade_license_url", label: "Trade License Document", required: true },
  { key: "trade_license_number", label: "Trade License Number", required: true, numberField: true },
  { key: "bank_statement", urlField: "bank_statement_url", label: "Bank Statement", required: false },
];

interface Props {
  merchantId: string;
  initial: any;
}

type FileState = { loading: boolean; ok: boolean; sizeBytes?: number; contentType?: string; error?: string; signedUrl?: string };

const MAX_BYTES = 8 * 1024 * 1024;
const MIN_BYTES = 4 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Severity ordering: missing > invalid > loading > optional-missing > valid
const RANK: Record<string, number> = { missing: 0, invalid: 1, loading: 2, optional: 3, valid: 4 };

export default function MerchantKycDocStatus({ merchantId, initial }: Props) {
  const [merchant, setMerchant] = useState<any>(initial);
  const [files, setFiles] = useState<Record<DocKey, FileState>>({
    nid_front: { loading: false, ok: false },
    nid_back: { loading: false, ok: false },
    trade_license: { loading: false, ok: false },
    bank_statement: { loading: false, ok: false },
    trade_license_number: { loading: false, ok: false },
  });
  const [resubmit, setResubmit] = useState<{ doc: DocSpec; suggested: string } | null>(null);
  const [resubmitReason, setResubmitReason] = useState("");
  const [sending, setSending] = useState(false);
  const [openReqs, setOpenReqs] = useState<Set<string>>(new Set());

  // Realtime subscribe to merchant row + open resubmit requests
  useEffect(() => {
    setMerchant(initial);
    (async () => {
      const { data } = await (supabase as any)
        .from("merchant_kyc_resubmit_requests")
        .select("doc_key,status")
        .eq("merchant_id", merchantId)
        .eq("status", "pending");
      setOpenReqs(new Set((data ?? []).map((r: any) => r.doc_key)));
    })();
    const ch = supabase.channel(`mkyc-${merchantId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "merchants", filter: `id=eq.${merchantId}` },
        (payload) => setMerchant(payload.new))
      .on("postgres_changes",
        { event: "*", schema: "public", table: "merchant_kyc_resubmit_requests", filter: `merchant_id=eq.${merchantId}` },
        async () => {
          const { data } = await (supabase as any).from("merchant_kyc_resubmit_requests")
            .select("doc_key,status").eq("merchant_id", merchantId).eq("status", "pending");
          setOpenReqs(new Set((data ?? []).map((r: any) => r.doc_key)));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, initial]);

  // Validate each uploaded file + record persistent state via RPC
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const d of DOCS) {
        if (d.numberField) {
          const val = merchant?.trade_license?.toString().trim();
          const err = val ? null : "Missing";
          const status: "valid" | "missing" = val ? "valid" : "missing";
          if (!cancelled) setFiles(f => ({ ...f, [d.key]: { loading: false, ok: !err, error: err ?? undefined } }));
          (supabase as any).rpc("record_merchant_kyc_validation", {
            p_merchant: merchantId, p_doc: d.key, p_status: status, p_reason: err,
          }).then();
          continue;
        }
        const path = merchant?.[d.urlField!] as string | null | undefined;
        if (!path) {
          if (!cancelled) setFiles(f => ({ ...f, [d.key]: { loading: false, ok: false } }));
          (supabase as any).rpc("record_merchant_kyc_validation", {
            p_merchant: merchantId, p_doc: d.key, p_status: d.required ? "missing" : "valid",
            p_reason: d.required ? "No file uploaded" : null,
          }).then();
          continue;
        }
        setFiles(f => ({ ...f, [d.key]: { loading: true, ok: false } }));
        try {
          const { data, error } = await supabase.storage.from("vendor-kyc").createSignedUrl(path, 300);
          if (error || !data?.signedUrl) throw error || new Error("Signed URL failed");
          const res = await fetch(data.signedUrl, { method: "HEAD" });
          if (!res.ok) throw new Error(`Unreachable (HTTP ${res.status})`);
          const size = Number(res.headers.get("content-length") || 0);
          const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
          let err: string | null = null;
          if (size > 0 && size < MIN_BYTES) err = "File looks empty or corrupted";
          else if (size > MAX_BYTES) err = "File exceeds 8MB limit";
          else if (type && !ALLOWED_TYPES.includes(type)) err = `Unsupported type: ${type}`;
          if (cancelled) return;
          setFiles(f => ({
            ...f,
            [d.key]: err
              ? { loading: false, ok: false, sizeBytes: size, contentType: type, error: err, signedUrl: data.signedUrl }
              : { loading: false, ok: true, sizeBytes: size, contentType: type, signedUrl: data.signedUrl },
          }));
          (supabase as any).rpc("record_merchant_kyc_validation", {
            p_merchant: merchantId, p_doc: d.key, p_status: err ? "invalid" : "valid", p_reason: err,
          }).then();
        } catch (e: any) {
          if (cancelled) return;
          const msg = e?.message || "Could not validate file";
          setFiles(f => ({ ...f, [d.key]: { loading: false, ok: false, error: msg } }));
          (supabase as any).rpc("record_merchant_kyc_validation", {
            p_merchant: merchantId, p_doc: d.key, p_status: "invalid", p_reason: msg,
          }).then();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [
    merchantId,
    merchant?.nid_front_url, merchant?.nid_back_url,
    merchant?.trade_license_url, merchant?.bank_statement_url, merchant?.trade_license,
  ]);

  // Rank each doc → sorted list
  const ranked = useMemo(() => {
    return DOCS.map(d => {
      const st = files[d.key];
      let path: any = null;
      if (d.numberField) path = merchant?.trade_license?.toString().trim();
      else path = merchant?.[d.urlField!];
      const missing = d.required && !path;
      const invalid = !!st.error && !missing;
      const loading = st.loading;
      const category = missing ? "missing" : invalid ? "invalid" : loading ? "loading" : !path ? "optional" : "valid";
      return { d, st, category, missing, invalid, loading, path };
    }).sort((a, b) => RANK[a.category] - RANK[b.category]);
  }, [merchant, files]);

  const summary = useMemo(() => {
    let missing = 0, invalid = 0, ok = 0;
    for (const r of ranked) {
      if (r.category === "missing") missing++;
      else if (r.category === "invalid") invalid++;
      else if (r.category === "valid") ok++;
    }
    return { missing, invalid, ok };
  }, [ranked]);

  const nextAction = ranked.find(r => r.category === "missing") ?? ranked.find(r => r.category === "invalid");
  const kycStatus: string = merchant?.business_kyc_status || "pending";
  const canVerify = summary.missing === 0 && summary.invalid === 0;

  const openResubmit = (r: typeof ranked[number]) => {
    const suggested = r.missing
      ? `${r.d.label} is missing. Please upload a clear ${r.d.label.toLowerCase()}.`
      : `${r.d.label} failed validation: ${r.st.error}. Please re-upload.`;
    setResubmit({ doc: r.d, suggested });
    setResubmitReason(suggested);
  };

  const submitResubmit = async () => {
    if (!resubmit) return;
    if (!resubmitReason.trim()) { toast.error("Reason is required"); return; }
    setSending(true);
    const { error } = await (supabase as any).rpc("request_merchant_kyc_resubmit", {
      p_merchant: merchantId, p_doc: resubmit.doc.key, p_reason: resubmitReason.trim(),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Resubmit request sent for ${resubmit.doc.label}`);
    setResubmit(null); setResubmitReason("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> KYC Documents
        </h4>
        <div className="flex items-center gap-2">
          {kycStatus === "verified" && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>}
          {kycStatus === "pending" && <Badge variant="outline" className="text-[10px]"><Clock className="w-3 h-3 mr-1" />Pending</Badge>}
          {kycStatus === "rejected" && <Badge variant="destructive" className="text-[10px]"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>}
        </div>
      </div>

      {/* Summary strip */}
      <div className={`rounded-lg border p-2.5 text-xs flex items-start gap-2 ${
        canVerify
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
      }`}>
        {canVerify ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
        <div className="flex-1">
          {canVerify
            ? <p>All required documents present and valid. Merchant is eligible to be marked <strong>KYC Verified</strong>.</p>
            : <p>
                {summary.missing > 0 && <>{summary.missing} required item{summary.missing > 1 ? "s" : ""} missing. </>}
                {summary.invalid > 0 && <>{summary.invalid} document{summary.invalid > 1 ? "s" : ""} failed validation. </>}
                KYC cannot be marked verified until these are resolved.
              </p>}
        </div>
      </div>

      {/* Next action */}
      {nextAction && (
        <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-2.5 flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-primary font-semibold">Next action</p>
            <p className="text-xs text-foreground truncate">
              {nextAction.category === "missing" ? "Upload" : "Fix"} <strong>{nextAction.d.label}</strong>
              {nextAction.st.error ? ` — ${nextAction.st.error}` : ""}
            </p>
          </div>
          <Button size="sm" className="h-7 text-[10px] gap-1" onClick={() => openResubmit(nextAction)}
                  disabled={openReqs.has(nextAction.d.key)}>
            <Send className="w-3 h-3" />
            {openReqs.has(nextAction.d.key) ? "Requested" : "Request resubmit"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {ranked.map(({ d, st, category, missing, invalid, loading }) => {
          const ok = category === "valid";
          const isNext = nextAction?.d.key === d.key;
          return (
            <Card key={d.key} className={`border ${isNext ? "ring-2 ring-primary/40" : ""}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  ok ? "bg-emerald-500/10" : missing ? "bg-red-500/10" : invalid ? "bg-amber-500/10" : "bg-muted"
                }`}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : missing ? <XCircle className="w-4 h-4 text-red-600" />
                    : invalid ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                    : <FileText className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-medium text-foreground">
                      {d.label}{d.required && <span className="text-red-500 ml-0.5">*</span>}
                    </p>
                    {ok && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[9px] h-4">Valid</Badge>}
                    {missing && <Badge variant="destructive" className="text-[9px] h-4">Missing</Badge>}
                    {invalid && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] h-4">Invalid</Badge>}
                    {!d.required && category === "optional" && <Badge variant="outline" className="text-[9px] h-4">Optional</Badge>}
                    {openReqs.has(d.key) && <Badge variant="outline" className="text-[9px] h-4 border-primary text-primary">Resubmit requested</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {missing ? (d.numberField ? "Trade license number not provided" : "No file uploaded — required for KYC verification")
                      : loading ? "Validating…"
                      : invalid ? st.error
                      : ok ? (d.numberField ? `Value: ${merchant?.trade_license}` : `${st.contentType || "file"} • ${formatBytes(st.sizeBytes || 0)}`)
                      : "Not provided"}
                  </p>
                </div>
                {st.signedUrl && !d.numberField && (
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                    <a href={st.signedUrl} target="_blank" rel="noreferrer"><Eye className="w-3 h-3 mr-1" />View</a>
                  </Button>
                )}
                {(missing || invalid) && (
                  <Button
                    size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1"
                    onClick={() => openResubmit({ d, st, category, missing, invalid, loading, path: null } as any)}
                    disabled={openReqs.has(d.key)}
                  >
                    <Send className="w-3 h-3" />
                    {openReqs.has(d.key) ? "Sent" : "Resubmit"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Resubmit dialog */}
      <Dialog open={!!resubmit} onOpenChange={v => { if (!v) { setResubmit(null); setResubmitReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request resubmission</DialogTitle>
            <DialogDescription>
              The merchant will be notified in-app with the reason below and prompted to upload <strong>{resubmit?.doc.label}</strong> again.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={resubmitReason}
            onChange={e => setResubmitReason(e.target.value)}
            placeholder="Explain what's wrong or missing"
            rows={4}
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right">{resubmitReason.length}/500</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmit(null)}>Cancel</Button>
            <Button onClick={submitResubmit} disabled={sending || !resubmitReason.trim()} className="gap-1">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatBytes(n: number) {
  if (!n) return "unknown size";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
