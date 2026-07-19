import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Store, CheckCircle2, Clock, XCircle, Camera, Upload, Loader2, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

type PhotoKey = "shop_front" | "shop_inside";
const PHOTOS: { key: PhotoKey; slot: "front" | "inside"; urlField: "shop_front_photo_url" | "shop_inside_photo_url"; metaField: "shop_front_photo_meta" | "shop_inside_photo_meta"; label: string; hint: string }[] = [
  { key: "shop_front",  slot: "front",  urlField: "shop_front_photo_url",  metaField: "shop_front_photo_meta",  label: "Shop front photo",  hint: "Exterior with signboard. Min 640×480, JPG/PNG/WEBP, ≤8MB." },
  { key: "shop_inside", slot: "inside", urlField: "shop_inside_photo_url", metaField: "shop_inside_photo_meta", label: "Shop inside photo", hint: "Interior showing products / counter." },
];

const MAX_MB = 8;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export default function MerchantApplyVendor() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitMode, setResubmitMode] = useState(false);
  const [form, setForm] = useState({
    store_name: "",
    store_description: "",
    product_categories: "",
    expected_monthly_orders: "",
    pickup_address: "",
    contact_number: "",
    resubmit_note: "",
  });
  const [photos, setPhotos] = useState<Record<PhotoKey, { file: File | null; url: string | null; meta: any; uploading: boolean; validating: boolean; error: string | null }>>({
    shop_front:  { file: null, url: null, meta: null, uploading: false, validating: false, error: null },
    shop_inside: { file: null, url: null, meta: null, uploading: false, validating: false, error: null },
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: m }, { data: app }] = await Promise.all([
        supabase.from("merchants").select("*").eq("user_id", user.id).maybeSingle(),
        (supabase as any).from("merchant_vendor_applications").select("*")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setMerchant(m);
      setExisting(app);
      if (m && !form.store_name) {
        setForm(f => ({
          ...f,
          store_name: app?.store_name ?? m.business_name ?? "",
          store_description: app?.store_description ?? "",
          product_categories: (app?.product_categories ?? []).join(", "),
          expected_monthly_orders: app?.expected_monthly_orders?.toString() ?? "",
          pickup_address: app?.pickup_address ?? m.business_address ?? "",
          contact_number: app?.contact_number ?? m.contact_number ?? "",
          resubmit_note: app?.status === "rejected" ? `Resubmitting after: ${app?.admin_notes ?? ""}`.slice(0, 500) : "",
        }));
      }
      if (app) {
        setPhotos({
          shop_front:  { file: null, url: app.shop_front_photo_url  ?? null, meta: app.shop_front_photo_meta,  uploading: false, validating: false, error: null },
          shop_inside: { file: null, url: app.shop_inside_photo_url ?? null, meta: app.shop_inside_photo_meta, uploading: false, validating: false, error: null },
        });
      }
      // Deep-link into resubmit mode
      if (sp.get("resubmit") === "1" && app?.status === "rejected") setResubmitMode(true);
      setLoading(false);
    })();
     
  }, [user]);

  const validateOnServer = async (applicationId: string, slot: "front" | "inside", path: string, captureDate: string | null, reason?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    // Call the function directly with fetch so we can surface the JSON error body
    // (supabase.functions.invoke swallows the response body on non-2xx status).
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-vendor-photo`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ application_id: applicationId, slot, storage_path: path, capture_date: captureDate, reason }),
    });
    let json: any = {};
    try { json = await resp.json(); } catch { /* noop */ }
    if (!resp.ok) throw new Error(json?.error || `Validation failed (${resp.status})`);
    return json;
  };

  const categorizeError = (msg: string): "mime" | "size" | "resolution" | "other" => {
    const m = msg.toLowerCase();
    if (m.includes("file type") || m.includes("mime") || m.includes("jpg") || m.includes("png") || m.includes("webp")) return "mime";
    if (m.includes("mb") || m.includes("exceeds") || m.includes("size")) return "size";
    if (m.includes("resolution") || m.includes("×") || m.includes("dimensions")) return "resolution";
    return "other";
  };

  const preflight = async (file: File): Promise<{ width: number; height: number } | null> => new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

  const pickPhoto = async (key: PhotoKey, slot: "front" | "inside", file: File) => {
    if (!user) return;
    // ---- Pre-upload client-side checks with exact reasons ----
    if (!ALLOWED.includes(file.type)) {
      const msg = `Unsupported file type "${file.type || "unknown"}". Use JPG, PNG or WEBP.`;
      toast.error(msg);
      setPhotos(p => ({ ...p, [key]: { ...p[key], error: msg } }));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      const msg = `File is ${(file.size / 1048576).toFixed(2)} MB — exceeds the ${MAX_MB} MB limit.`;
      toast.error(msg);
      setPhotos(p => ({ ...p, [key]: { ...p[key], error: msg } }));
      return;
    }
    const dims = await preflight(file);
    if (dims && (dims.width < 640 || dims.height < 480)) {
      const msg = `Photo resolution ${dims.width}×${dims.height} is below the required 640×480.`;
      toast.error(msg);
      setPhotos(p => ({ ...p, [key]: { ...p[key], error: msg } }));
      return;
    }
    setPhotos(p => ({ ...p, [key]: { ...p[key], file, uploading: true, error: null } }));
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/vendor-apply/${key}-${Date.now()}.${ext}`;
    const captureDate = file.lastModified ? new Date(file.lastModified).toISOString() : null;

    const { error: upErr } = await supabase.storage.from("vendor-kyc").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      toast.error("Upload failed: " + upErr.message);
      setPhotos(p => ({ ...p, [key]: { ...p[key], uploading: false, error: upErr.message } }));
      return;
    }

    // If we already have an application row, validate immediately server-side.
    if (existing?.id) {
      setPhotos(p => ({ ...p, [key]: { ...p[key], uploading: false, validating: true } }));
      try {
        const out = await validateOnServer(existing.id, slot, path, captureDate, form.resubmit_note || undefined);
        setPhotos(p => ({ ...p, [key]: { file, url: path, meta: out?.meta ?? null, uploading: false, validating: false, error: null } }));
        toast.success(`${key === "shop_front" ? "Shop front" : "Shop inside"} photo validated (${out?.meta?.width}×${out?.meta?.height})`);
      } catch (e: any) {
        setPhotos(p => ({ ...p, [key]: { ...p[key], uploading: false, validating: false, error: e.message } }));
        toast.error(e.message, { duration: 6000 });
      }
    } else {
      // Draft — stash locally, edge function runs at submit-time (below).
      setPhotos(p => ({ ...p, [key]: { file, url: path, meta: { uploaded_at: new Date().toISOString(), capture_date: captureDate, validated: false, width: dims?.width, height: dims?.height }, uploading: false, validating: false, error: null } }));
    }
  };

  const submit = async () => {
    if (!user || !merchant) return;
    if (!form.store_name.trim()) { toast.error("Store name is required"); return; }
    if (!form.pickup_address.trim()) { toast.error("Pickup address is required"); return; }
    if (!photos.shop_front.url)  { toast.error("Shop front photo is required"); return; }
    if (!photos.shop_inside.url) { toast.error("Shop inside photo is required"); return; }
    if (photos.shop_front.error || photos.shop_inside.error) { toast.error("Fix photo validation errors first"); return; }
    setSubmitting(true);
    const payload: any = {
      merchant_id: merchant.id,
      user_id: user.id,
      store_name: form.store_name.trim(),
      store_description: form.store_description.trim() || null,
      product_categories: form.product_categories.split(",").map(s => s.trim()).filter(Boolean),
      expected_monthly_orders: form.expected_monthly_orders ? Number(form.expected_monthly_orders) : null,
      pickup_address: form.pickup_address.trim(),
      contact_number: form.contact_number.trim() || null,
      shop_front_photo_url: photos.shop_front.url,
      shop_inside_photo_url: photos.shop_inside.url,
      shop_front_photo_meta: photos.shop_front.meta,
      shop_inside_photo_meta: photos.shop_inside.meta,
      status: "pending",
      admin_notes: null, reviewed_by: null, reviewed_at: null,
    };

    let appId = existing?.id as string | undefined;
    if (existing && existing.status !== "approved") {
      const { error } = await (supabase as any).from("merchant_vendor_applications").update(payload).eq("id", existing.id);
      if (error) { setSubmitting(false); toast.error("Failed to submit: " + error.message); return; }
    } else {
      const { data, error } = await (supabase as any).from("merchant_vendor_applications").insert(payload).select("id").single();
      if (error) { setSubmitting(false); toast.error("Failed to submit: " + error.message); return; }
      appId = data?.id;
    }

    // Server-side validate any photos not yet validated (draft path or resubmit).
    try {
      if (appId) {
        for (const p of PHOTOS) {
          const st = photos[p.key];
          if (st.url && !st.meta?.validated) {
            await validateOnServer(appId, p.slot, st.url, st.meta?.capture_date ?? null, form.resubmit_note || undefined);
          }
        }
      }
    } catch (e: any) {
      setSubmitting(false);
      toast.error("Server photo validation failed: " + e.message + " — application NOT queued.");
      // Force back to draft
      if (appId) await (supabase as any).from("merchant_vendor_applications").update({ status: "draft" }).eq("id", appId);
      return;
    }

    await supabase.from("merchant_audit_events").insert({
      merchant_id: merchant.id,
      merchant_user_id: user.id,
      actor_id: user.id,
      event_type: resubmitMode ? "vendor_resubmit" : "vendor_apply",
      reason: form.resubmit_note || null,
      to_value: { store_name: form.store_name, shop_front_photo_url: photos.shop_front.url, shop_inside_photo_url: photos.shop_inside.url },
    });

    // In-app notification: confirm the (re)submit is now pending review
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: resubmitMode ? "Vendor photos resubmitted — pending review" : "Vendor application submitted — pending review",
      body: resubmitMode
        ? "Your updated shop photos are back in the admin queue. We'll let you know as soon as they're reviewed."
        : `Your vendor application for "${form.store_name}" is now waiting for admin approval.`,
      category: "merchant_ops",
    });

    setSubmitting(false);
    toast.success(resubmitMode ? "Resubmitted for admin review" : "Vendor application submitted");
    nav("/merchant");
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!merchant) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" /> Finish your merchant setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your account has the merchant role, but the merchant business profile
            (business name, KYC, bank details) hasn't been submitted yet. Complete
            the merchant application first — vendor / EasyPay Shop upgrade unlocks
            right after your merchant profile is approved.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => nav("/merchant/apply")}>
              Start merchant application
            </Button>
            <Button variant="outline" onClick={() => nav("/merchant")}>Back</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (merchant.status !== "approved" || merchant.business_kyc_status !== "approved") {
    const isRejected = merchant.status === "rejected" || merchant.business_kyc_status === "rejected";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" /> Merchant approval required
              </CardTitle>
              <Badge className={isRejected
                ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"}>
                {isRejected ? <><XCircle className="w-3 h-3 mr-1" /> Rejected</> : <><Clock className="w-3 h-3 mr-1" /> Pending review</>}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isRejected
                ? "Your merchant profile was rejected. Please resolve the admin feedback and get your merchant profile approved first — vendor / EasyPay Shop upgrade unlocks after that."
                : "Your merchant profile is still awaiting admin approval. Vendor / EasyPay Shop upgrade opens automatically once your merchant profile is approved."}
            </p>
            <div className="text-xs text-muted-foreground grid gap-1">
              <div className="flex justify-between"><span>Business status</span><span className="font-medium capitalize">{merchant.status}</span></div>
              <div className="flex justify-between"><span>Business KYC</span><span className="font-medium capitalize">{merchant.business_kyc_status}</span></div>
            </div>
            {isRejected && merchant.admin_notes && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/30 text-xs">
                <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Admin feedback</p>
                <p className="text-muted-foreground">{merchant.admin_notes}</p>
              </div>
            )}
            <div className="flex gap-2">
              {isRejected && (
                <Button className="flex-1" onClick={() => nav("/merchant/apply")}>Update merchant profile</Button>
              )}
              <Button variant="outline" className={isRejected ? "" : "flex-1"} onClick={() => nav("/merchant")}>Back to merchant</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = existing && (
    <Badge className={
      existing.status === "approved" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" :
      existing.status === "rejected" ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" :
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    }>
      {existing.status === "approved" ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</> :
       existing.status === "rejected" ? <><XCircle className="w-3 h-3 mr-1" /> Rejected</> :
       <><Clock className="w-3 h-3 mr-1" /> Pending review</>}
    </Badge>
  );

  const readOnly = existing?.status === "approved";
  const isRejected = existing?.status === "rejected";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4">
        <Button variant="ghost" onClick={() => nav("/merchant")} className="mb-3">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Merchant
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" /> Apply for Vendor Access
              </CardTitle>
              {statusBadge}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Your merchant account handles payments. To list products on EasyPay Shop, admins must approve a separate vendor upgrade.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isRejected && existing.admin_notes && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/30 text-sm space-y-2">
                <p className="font-semibold text-red-700 dark:text-red-300">Admin feedback</p>
                <p className="text-muted-foreground">{existing.admin_notes}</p>
                {!resubmitMode && (
                  <Button size="sm" onClick={() => setResubmitMode(true)}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> One-click resubmit
                  </Button>
                )}
              </div>
            )}
            {resubmitMode && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/30 text-xs space-y-2">
                <Label className="text-xs">Optional note back to the admin</Label>
                <Textarea rows={2} maxLength={500} value={form.resubmit_note} onChange={e => setForm({ ...form, resubmit_note: e.target.value })}
                  placeholder="e.g. Uploaded higher-quality photos of the shopfront." />
                <p className="text-[10px] text-muted-foreground">Just re-upload the corrected shop front and inside photos below and press Resubmit.</p>
              </div>
            )}
            <div className="grid gap-3">
              <div>
                <Label>Store name *</Label>
                <Input value={form.store_name} onChange={e => setForm({ ...form, store_name: e.target.value })} disabled={readOnly} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.store_description} onChange={e => setForm({ ...form, store_description: e.target.value })} rows={3} disabled={readOnly} />
              </div>
              <div>
                <Label>Product categories (comma separated)</Label>
                <Input value={form.product_categories} onChange={e => setForm({ ...form, product_categories: e.target.value })} placeholder="fashion, electronics" disabled={readOnly} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Expected monthly orders</Label>
                  <Input type="number" min="0" value={form.expected_monthly_orders} onChange={e => setForm({ ...form, expected_monthly_orders: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Contact number</Label>
                  <Input value={form.contact_number} onChange={e => setForm({ ...form, contact_number: e.target.value })} disabled={readOnly} />
                </div>
              </div>
              <div>
                <Label>Pickup address *</Label>
                <Textarea value={form.pickup_address} onChange={e => setForm({ ...form, pickup_address: e.target.value })} rows={2} disabled={readOnly} />
              </div>

              <div className="pt-2">
                <Label className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Shop photos <span className="text-red-500">*</span></Label>
                <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Server checks type, size (≤{MAX_MB}MB) and minimum 640×480 resolution before your application enters the queue.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {PHOTOS.map(p => {
                    const st = photos[p.key];
                    return (
                      <PhotoTile
                        key={p.key}
                        label={p.label}
                        hint={p.hint}
                        state={st}
                        readOnly={readOnly}
                        onPick={file => pickPhoto(p.key, p.slot, file)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            {!readOnly && (
              <Button className="w-full" onClick={submit}
                disabled={submitting || photos.shop_front.uploading || photos.shop_inside.uploading || photos.shop_front.validating || photos.shop_inside.validating}>
                {submitting ? "Submitting…" : existing ? (isRejected ? "Resubmit application" : "Update application") : "Submit application"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PhotoTile({
  label, hint, state, readOnly, onPick,
}: {
  label: string; hint: string;
  state: { file: File | null; url: string | null; meta: any; uploading: boolean; validating: boolean; error: string | null };
  readOnly: boolean;
  onPick: (file: File) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (state.file) { setPreview(URL.createObjectURL(state.file)); return; }
      if (state.url) {
        const { data } = await supabase.storage.from("vendor-kyc").createSignedUrl(state.url, 600);
        if (!cancelled) setPreview(data?.signedUrl ?? null);
      } else {
        setPreview(null);
      }
    })();
    return () => { cancelled = true; };
  }, [state.file, state.url]);

  const ok = !!state.url && !state.error && state.meta?.validated;
  const borderClass = state.error ? "border-red-500/50" : ok ? "border-emerald-500/40" : "border-dashed";

  return (
    <div className={`rounded-lg border ${borderClass} overflow-hidden`}>
      <div className="aspect-[4/3] bg-muted/40 flex items-center justify-center relative">
        {preview ? (
          <img src={preview} alt={label} className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-8 h-8 text-muted-foreground/40" />
        )}
        {(state.uploading || state.validating) && (
          <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center gap-1">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-[10px] text-muted-foreground">{state.uploading ? "Uploading…" : "Validating…"}</p>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground mb-1.5">{hint}</p>
        {state.error && (() => {
          const m = state.error.toLowerCase();
          const cat = m.includes("file type") || m.includes("mime") || m.includes("jpg") || m.includes("png") || m.includes("webp") ? "Wrong format"
                    : m.includes("mb") || m.includes("exceeds") || m.includes("size") ? "File too large"
                    : m.includes("resolution") || m.includes("×") || m.includes("dimensions") ? "Resolution too low"
                    : "Validation failed";
          return (
            <div className="mb-1 rounded-md border border-red-500/40 bg-red-500/5 p-1.5">
              <p className="text-[10px] font-semibold text-red-700 dark:text-red-300">✕ {cat}</p>
              <p className="text-[10px] text-red-700/90 dark:text-red-300/90 leading-snug">{state.error}</p>
            </div>
          );
        })()}
        {ok && state.meta?.width && (
          <p className="text-[10px] text-emerald-600 mb-1">✓ {state.meta.width}×{state.meta.height}</p>
        )}
        {!readOnly && (
          <label className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary text-primary-foreground cursor-pointer">
            <Upload className="w-3 h-3" />
            {state.url ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
