import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, FileText, Eye, ShieldCheck, Clock,
} from "lucide-react";

type DocKey = "nid_front" | "nid_back" | "trade_license" | "bank_statement";

interface DocSpec {
  key: DocKey;
  urlField: "nid_front_url" | "nid_back_url" | "trade_license_url" | "bank_statement_url";
  label: string;
  required: boolean;
  extraCheck?: (m: any) => string | null; // returns error string if invalid
}

const DOCS: DocSpec[] = [
  { key: "nid_front", urlField: "nid_front_url", label: "NID (Front)", required: true },
  { key: "nid_back", urlField: "nid_back_url", label: "NID (Back)", required: true },
  {
    key: "trade_license",
    urlField: "trade_license_url",
    label: "Trade License Document",
    required: true,
    extraCheck: (m) => (!m.trade_license || !String(m.trade_license).trim() ? "Trade license number is missing" : null),
  },
  { key: "bank_statement", urlField: "bank_statement_url", label: "Bank Statement", required: false },
];

interface Props {
  merchantId: string;
  initial: any;
}

type FileState = { loading: boolean; ok: boolean; sizeBytes?: number; contentType?: string; error?: string; signedUrl?: string };

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const MIN_BYTES = 4 * 1024; // 4KB — reject empty/near-empty
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export default function MerchantKycDocStatus({ merchantId, initial }: Props) {
  const [merchant, setMerchant] = useState<any>(initial);
  const [files, setFiles] = useState<Record<DocKey, FileState>>({
    nid_front: { loading: false, ok: false },
    nid_back: { loading: false, ok: false },
    trade_license: { loading: false, ok: false },
    bank_statement: { loading: false, ok: false },
  });

  // Realtime subscribe to merchant row
  useEffect(() => {
    setMerchant(initial);
    const ch = supabase.channel(`mkyc-${merchantId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "merchants", filter: `id=eq.${merchantId}` },
        (payload) => setMerchant(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, initial]);

  // Validate each uploaded file (HEAD via signed url, checks size + content-type)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const d of DOCS) {
        const path = merchant?.[d.urlField] as string | null | undefined;
        if (!path) {
          if (!cancelled) setFiles(f => ({ ...f, [d.key]: { loading: false, ok: false } }));
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
        } catch (e: any) {
          if (cancelled) return;
          setFiles(f => ({ ...f, [d.key]: { loading: false, ok: false, error: e?.message || "Could not validate file" } }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [
    merchant?.nid_front_url, merchant?.nid_back_url,
    merchant?.trade_license_url, merchant?.bank_statement_url,
  ]);

  const summary = useMemo(() => {
    let missing = 0, invalid = 0, ok = 0;
    for (const d of DOCS) {
      const path = merchant?.[d.urlField];
      const st = files[d.key];
      const numErr = d.extraCheck?.(merchant);
      if (d.required && !path) { missing++; continue; }
      if (!path) continue;
      if (st.loading) continue;
      if (st.error || numErr) invalid++; else ok++;
    }
    const numberMissing = !merchant?.trade_license || !String(merchant?.trade_license).trim();
    return { missing, invalid, ok, numberMissing };
  }, [merchant, files]);

  const kycStatus: string = merchant?.business_kyc_status || "pending";
  const canVerify = summary.missing === 0 && summary.invalid === 0 && !summary.numberMissing;

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
          {canVerify ? (
            <p>All required documents present and valid. Merchant is eligible to be marked <strong>KYC Verified</strong>.</p>
          ) : (
            <p>
              {summary.missing > 0 && <>{summary.missing} required document{summary.missing > 1 ? "s" : ""} missing. </>}
              {summary.invalid > 0 && <>{summary.invalid} document{summary.invalid > 1 ? "s" : ""} failed validation. </>}
              {summary.numberMissing && <>Trade license number missing. </>}
              KYC cannot be marked verified until these are resolved.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {DOCS.map(d => {
          const path = merchant?.[d.urlField] as string | null | undefined;
          const st = files[d.key];
          const numErr = d.extraCheck?.(merchant);
          const missing = d.required && !path;
          const invalid = !!st.error;
          const ok = !!path && !st.loading && !invalid && !numErr;

          return (
            <Card key={d.key} className="border">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  ok ? "bg-emerald-500/10" : missing ? "bg-red-500/10" : invalid ? "bg-amber-500/10" : "bg-muted"
                }`}>
                  {st.loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    : ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : missing ? <XCircle className="w-4 h-4 text-red-600" />
                    : invalid ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                    : <FileText className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">
                      {d.label}
                      {d.required && <span className="text-red-500 ml-0.5">*</span>}
                    </p>
                    {ok && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[9px] h-4">Valid</Badge>}
                    {missing && <Badge variant="destructive" className="text-[9px] h-4">Missing</Badge>}
                    {invalid && !missing && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] h-4">Invalid</Badge>}
                    {!d.required && !path && <Badge variant="outline" className="text-[9px] h-4">Optional</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {missing
                      ? "No file uploaded — required for KYC verification"
                      : st.loading ? "Validating…"
                      : invalid ? st.error
                      : ok ? `${st.contentType || "file"} • ${formatBytes(st.sizeBytes || 0)}`
                      : "Not provided"}
                  </p>
                  {numErr && !missing && <p className="text-[10px] text-amber-600 mt-0.5">{numErr}</p>}
                </div>
                {path && st.signedUrl && (
                  <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[10px]">
                    <a href={st.signedUrl} target="_blank" rel="noreferrer"><Eye className="w-3 h-3 mr-1" />View</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function formatBytes(n: number) {
  if (!n) return "unknown size";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
