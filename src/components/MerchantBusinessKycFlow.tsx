import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Upload, CheckCircle2, Clock, XCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMerchantCategories } from "@/hooks/use-merchant-categories";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

interface DocSlot {
  key: "nid_front" | "nid_back" | "trade_license" | "bank_statement";
  label: string;
  required: boolean;
}

const DOCS: DocSlot[] = [
  { key: "nid_front", label: "NID Front", required: true },
  { key: "nid_back", label: "NID Back", required: true },
  { key: "trade_license", label: "Trade License", required: true },
  { key: "bank_statement", label: "Bank Statement", required: false },
];

export default function MerchantBusinessKycFlow({ open, onOpenChange }: Props) {
  const { categories } = useMerchantCategories();
  const [loading, setLoading] = useState(true);
  const [userKycOk, setUserKycOk] = useState<boolean | null>(null);
  const [existing, setExisting] = useState<any>(null);
  const [form, setForm] = useState({
    business_name: "",
    category: "retail",
    trade_license_no: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_holder: "",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      const [{ data: profile }, { data: kyc }] = await Promise.all([
        supabase.from("profiles").select("kyc_exempt").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("kyc_verifications").select("status").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setUserKycOk(!!profile?.kyc_exempt || kyc?.status === "verified");
      const { data: m } = await supabase.from("merchants").select("*").eq("user_id", session.user.id).maybeSingle();
      setExisting(m);
      setLoading(false);
      setExisting(m);
      setLoading(false);
    })();
  }, [open]);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const upload = async (slot: DocSlot, file: File): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Not authenticated");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${session.user.id}/${slot.key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("vendor-kyc").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const handleSubmit = async () => {
    if (!form.business_name.trim()) { toast.error("Business name required"); return; }
    if (!form.trade_license_no.trim()) { toast.error("Trade license number required"); return; }
    for (const d of DOCS) {
      if (d.required && !files[d.key]) { toast.error(`${d.label} required`); return; }
    }
    setUploading(true);
    try {
      const uploaded: Record<string, string> = {};
      for (const d of DOCS) {
        const f = files[d.key];
        if (f) uploaded[d.key] = await upload(d, f);
      }
      const { error } = await supabase.rpc("submit_business_kyc", {
        p_business_name: form.business_name.trim(),
        p_category: form.category,
        p_trade_license: form.trade_license_no.trim(),
        p_trade_license_url: uploaded.trade_license,
        p_nid_front_url: uploaded.nid_front,
        p_nid_back_url: uploaded.nid_back,
        p_bank_statement_url: uploaded.bank_statement || null,
        p_bank_name: form.bank_name || null,
        p_bank_account_number: form.bank_account_number || null,
        p_bank_account_holder: form.bank_account_holder || null,
      });
      if (error) throw error;
      toast.success("Application submitted — awaiting admin review");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Business KYC Application
          </SheetTitle>
          <SheetDescription>Submit your business documents for verification</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : !userKycOk ? (
          <Card className="mt-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-sm">User KYC required first</p>
                <p className="text-xs text-muted-foreground mt-1">Please complete your personal KYC verification before applying as a vendor.</p>
              </div>
            </CardContent>
          </Card>
        ) : existing ? (
          <Card className="mt-6 border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                {existing.business_kyc_status === "pending" && <><Clock className="w-4 h-4 text-amber-600" /><span className="text-sm font-semibold">Under Review</span></>}
                {existing.business_kyc_status === "approved" && <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-sm font-semibold">Approved</span></>}
                {existing.business_kyc_status === "rejected" && <><XCircle className="w-4 h-4 text-red-600" /><span className="text-sm font-semibold">Rejected</span></>}
              </div>
              <p className="text-sm text-foreground font-medium">{existing.business_name}</p>
              <Badge variant="outline" className="text-[10px] capitalize">{existing.category}</Badge>
              {existing.business_kyc_rejection_reason && (
                <p className="text-xs text-red-600 mt-2">Reason: {existing.business_kyc_rejection_reason}</p>
              )}
              {existing.business_kyc_status === "approved" && (
                <p className="text-xs text-emerald-600 mt-1">Commission rate: {existing.commission_rate}%</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 mt-4 pb-6">
            <div>
              <Label className="text-xs">Business Name *</Label>
              <Input value={form.business_name} onChange={e => set("business_name", e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <select
                value={form.category}
                onChange={e => set("category", e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                {categories.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Trade License Number *</Label>
              <Input value={form.trade_license_no} onChange={e => set("trade_license_no", e.target.value)} maxLength={50} />
            </div>

            <div className="border-t border-border my-3 pt-3">
              <p className="text-xs font-semibold text-foreground mb-2">Bank Details (for reference)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Bank name" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} />
                <Input placeholder="Account holder" value={form.bank_account_holder} onChange={e => set("bank_account_holder", e.target.value)} />
                <Input placeholder="Account number" value={form.bank_account_number} onChange={e => set("bank_account_number", e.target.value)} className="col-span-2" />
              </div>
            </div>

            <div className="border-t border-border my-3 pt-3">
              <p className="text-xs font-semibold text-foreground mb-2">Documents</p>
              <div className="space-y-2">
                {DOCS.map(d => (
                  <Card key={d.key} className="border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Upload className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">
                          {d.label} {d.required && <span className="text-red-500">*</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {files[d.key]?.name || "No file selected"}
                        </p>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={e => setFiles(f => ({ ...f, [d.key]: e.target.files?.[0] || null }))}
                        />
                        <span className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground inline-block">
                          Choose
                        </span>
                      </label>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <Button className="w-full h-11" disabled={uploading} onClick={handleSubmit}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading…</> : "Submit Application"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
