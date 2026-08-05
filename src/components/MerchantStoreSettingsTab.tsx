import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Store, ImagePlus, Globe, Loader2, Check, Eye, Percent } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface StoreData {
  id?: string;
  merchant_id: string;
  slug: string;
  store_name: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  social_links: { facebook?: string; instagram?: string; website?: string };
  is_active: boolean;
}

interface Props {
  merchantId: string;
  businessName: string;
}

const MerchantStoreSettingsTab = ({ merchantId, businessName }: Props) => {
  const { t } = useI18n();
  const { toast } = useToast();
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  // Service-charge settings (persisted on the merchant row via a security-definer RPC)
  const [svc, setSvc] = useState({ enabled: false, rate: 0, absorb: false });
  const [svcLoaded, setSvcLoaded] = useState(false);
  const [svcSaving, setSvcSaving] = useState(false);

  // Tips / gratuity settings
  const [tips, setTips] = useState({ enabled: false, presets: "5, 10, 15" });
  const [tipsSaving, setTipsSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("merchants")
        .select("service_charge_enabled, service_charge_rate, service_charge_absorb, tips_enabled, tip_presets")
        .eq("id", merchantId)
        .maybeSingle();
      if (alive && data) {
        setSvc({
          enabled: !!data.service_charge_enabled,
          rate: Number(data.service_charge_rate || 0),
          absorb: !!data.service_charge_absorb,
        });
        setTips({
          enabled: !!data.tips_enabled,
          presets: Array.isArray(data.tip_presets) && data.tip_presets.length > 0
            ? data.tip_presets.join(", ")
            : "5, 10, 15",
        });
      }
      if (alive) setSvcLoaded(true);
    })();
    return () => { alive = false; };
  }, [merchantId]);

  const saveServiceCharge = async () => {
    if (svc.rate < 0 || svc.rate > 20) {
      toast({ title: "Invalid rate", description: "Service charge must be between 0% and 20%.", variant: "destructive" });
      return;
    }
    setSvcSaving(true);
    const { error } = await (supabase as any).rpc("merchant_update_service_charge", {
      p_enabled: svc.enabled,
      p_rate: svc.rate,
      p_absorb: svc.absorb,
    });
    setSvcSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Service charge updated" });
    }
  };

  const saveTips = async () => {
    const presets = tips.presets
      .split(",")
      .map(v => Math.round(Number(v.trim())))
      .filter(v => Number.isFinite(v) && v > 0 && v <= 100)
      .slice(0, 4);
    setTipsSaving(true);
    const { error } = await (supabase as any).rpc("merchant_update_tips", {
      p_merchant_id: merchantId,
      p_enabled: tips.enabled,
      p_presets: presets.length > 0 ? presets : [5, 10, 15],
    });
    setTipsSaving(false);
    if (error) {
      toast({ title: t("mtipSaveFailed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("mtipSaved") });
      setTips(s => ({ ...s, presets: (presets.length > 0 ? presets : [5, 10, 15]).join(", ") }));
    }
  };



  const [form, setForm] = useState({
    store_name: "",
    store_name_bn: "",
    slug: "",
    description: "",
    logo_url: "" as string | null,
    banner_url: "" as string | null,
    facebook: "",
    instagram: "",
    website: "",
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: merchRow }] = await Promise.all([
      (supabase as any).from("vendor_stores").select("*").eq("merchant_id", merchantId).maybeSingle(),
      (supabase as any).from("merchants").select("business_name_bn").eq("id", merchantId).maybeSingle(),
    ]);
    const bnName = (merchRow?.business_name_bn as string | null) || "";

    if (data) {
      setStore(data);
      const sl = (data.social_links || {}) as any;
      setForm({
        store_name: data.store_name || "",
        store_name_bn: bnName,
        slug: data.slug || "",
        description: data.description || "",
        logo_url: data.logo_url,
        banner_url: data.banner_url,
        facebook: sl.facebook || "",
        instagram: sl.instagram || "",
        website: sl.website || "",
        is_active: data.is_active ?? true,
      });
    } else {
      // Pre-fill defaults
      const defaultSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      setForm(f => ({ ...f, store_name: businessName, store_name_bn: bnName, slug: defaultSlug }));
    }
    setLoading(false);
  }, [merchantId, businessName]);

  useEffect(() => { load(); }, [load]);

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${merchantId}/${folder}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: true });
    if (error) { toast({ title: t("mssUploadFailed"), description: error.message, variant: "destructive" }); return null; }
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const url = await uploadFile(file, "logo");
    if (url) setForm(f => ({ ...f, logo_url: url }));
    setUploadingLogo(false);
    if (logoRef.current) logoRef.current.value = "";
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    const url = await uploadFile(file, "banner");
    if (url) setForm(f => ({ ...f, banner_url: url }));
    setUploadingBanner(false);
    if (bannerRef.current) bannerRef.current.value = "";
  };

  const handleSave = async () => {
    if (!form.store_name.trim()) { toast({ title: t("mssStoreNameRequired"), variant: "destructive" }); return; }
    if (!form.slug.trim()) { toast({ title: t("mssSlugRequired"), variant: "destructive" }); return; }
    setSaving(true);

    // Optimistic UI: broadcast the pending name so the dashboard header updates immediately
    const optimisticName = form.store_name.trim();
    const optimisticNameBn = form.store_name_bn.trim() || null;
    const previousName = store?.store_name || "";
    window.dispatchEvent(new CustomEvent("merchant:business-name-preview", { detail: { merchantId, name: optimisticName, nameBn: optimisticNameBn } }));

    const payload = {
      merchant_id: merchantId,
      store_name: form.store_name.trim(),
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""),
      description: form.description.trim(),
      logo_url: form.logo_url || null,
      banner_url: form.banner_url || null,
      social_links: {
        facebook: form.facebook.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        website: form.website.trim() || undefined,
      },
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (store?.id) {
      ({ error } = await (supabase as any).from("vendor_stores").update(payload).eq("id", store.id));
    } else {
      ({ error } = await (supabase as any).from("vendor_stores").insert(payload));
    }

    // Also sync the merchant's business_name (+ optional Bangla name) so the
    // dashboard header reflects the new name. Merchants cannot UPDATE
    // public.merchants directly (admin-only RLS), so we call a scoped
    // SECURITY DEFINER RPC that only lets the caller rename their own record.
    if (!error && payload.store_name) {
      const { error: mErr } = await (supabase as any)
        .rpc("merchant_update_business_name", { p_name: payload.store_name, p_name_bn: optimisticNameBn });
      if (mErr) {
        window.dispatchEvent(new CustomEvent("merchant:business-name-preview", { detail: { merchantId, name: previousName, nameBn: null } }));
        toast({ title: t("mssSaveFailed"), description: mErr.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }


    if (error) {
      // Roll back optimistic header update on failure
      window.dispatchEvent(new CustomEvent("merchant:business-name-preview", { detail: { merchantId, name: previousName } }));
      toast({ title: t("mssSaveFailed"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("mssSaved") });
      load();
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Banner Preview */}
      <Card className="overflow-hidden">
        <div className="relative h-32 bg-muted">
          {form.banner_url ? (
            <img src={form.banner_url} alt={t("mssBannerAlt")} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ImagePlus size={24} />
            </div>
          )}
          <button onClick={() => bannerRef.current?.click()} disabled={uploadingBanner}
            className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm text-xs font-semibold text-foreground shadow-sm">
            {uploadingBanner ? <Loader2 size={12} className="animate-spin" /> : t("mssChangeBanner")}
          </button>
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
        </div>
        <div className="relative px-4 pb-4 -mt-8">
          <div className="w-16 h-16 rounded-2xl border-4 border-background bg-muted flex items-center justify-center overflow-hidden shadow-sm">
            {form.logo_url ? (
              <img src={form.logo_url} alt={t("mssLogoAlt")} className="w-full h-full object-cover" />
            ) : (
              <Store size={24} className="text-muted-foreground" />
            )}
          </div>
          <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
            className="absolute left-4 top-6 w-16 h-16 rounded-2xl bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            {uploadingLogo ? <Loader2 size={14} className="animate-spin text-white" /> : <ImagePlus size={14} className="text-white" />}
          </button>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          <div className="mt-2">
            <p className="text-sm font-bold text-foreground">{form.store_name || t("mssYourStore")}</p>
            <p className="text-xs text-muted-foreground">/shop/{form.slug || t("mssYourSlug")}</p>
          </div>
        </div>
      </Card>

      {/* Form fields */}
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("mssStoreName")}</label>
          <Input value={form.store_name} onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))} className="mt-1 rounded-xl" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("mssStoreNameBn")}</label>
          <Input
            value={form.store_name_bn}
            onChange={e => setForm(f => ({ ...f, store_name_bn: e.target.value }))}
            placeholder={t("mssStoreNameBnPh")}
            maxLength={120}
            className="mt-1 rounded-xl"
            lang="bn"
          />
          <p className="text-[10px] text-muted-foreground mt-1">{t("mssStoreNameBnHelp")}</p>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("mssUrlSlug")}</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">/shop/</span>
            <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} className="rounded-xl flex-1" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t("mssDescription")}</label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 rounded-xl" rows={3} placeholder={t("mssDescPlaceholder")} />
        </div>
      </div>

      {/* Social Links */}
      <Card className="p-4 space-y-3">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5"><Globe size={13} /> {t("mssSocialLinks")}</h4>
        {[
          { key: "facebook", label: t("mssFacebook"), placeholder: "https://facebook.com/yourpage" },
          { key: "instagram", label: t("mssInstagram"), placeholder: "https://instagram.com/yourshop" },
          { key: "website", label: t("mssWebsite"), placeholder: "https://yoursite.com" },
        ].map(s => (
          <div key={s.key}>
            <label className="text-[10px] text-muted-foreground font-medium">{s.label}</label>
            <Input
              value={(form as any)[s.key]}
              onChange={e => setForm(f => ({ ...f, [s.key]: e.target.value }))}
              placeholder={s.placeholder}
              className="mt-0.5 h-9 rounded-xl text-xs"
            />
          </div>
        ))}
      </Card>

      {/* Service charge */}
      {svcLoaded && (
        <Card className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Percent size={13} className="text-primary" /> Service Charge
              </h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Apply an additional charge on top of order subtotals. Applied at checkout and audited on every settlement.
              </p>
            </div>
            <button onClick={() => setSvc(s => ({ ...s, enabled: !s.enabled }))}
              className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${svc.enabled ? "bg-primary" : "bg-muted"}`}>
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${svc.enabled ? "left-6" : "left-1"}`} />
            </button>
          </div>

          {svc.enabled && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Rate (%)</label>
                <Input
                  type="number" min={0} max={20} step={0.5}
                  value={svc.rate}
                  onChange={e => setSvc(s => ({ ...s, rate: Number(e.target.value) || 0 }))}
                  className="mt-1 h-10 rounded-xl text-sm"
                  placeholder="e.g. 5"
                />
                <p className="text-[10.5px] text-muted-foreground mt-1">Max 20%. Applied to order subtotal.</p>
              </div>

              <div className="rounded-2xl border border-border/60 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground">Who pays this charge?</p>
                {[
                  { key: false, title: "Add to customer total", desc: "Charge appears as a line item; you receive the full amount at settlement." },
                  { key: true,  title: "Absorb from settlement", desc: "Customer pays the same total; charge is deducted from your net payout." },
                ].map(opt => (
                  <button
                    key={String(opt.key)}
                    onClick={() => setSvc(s => ({ ...s, absorb: opt.key }))}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors ${svc.absorb === opt.key ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/40"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 ${svc.absorb === opt.key ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                      <span className="text-[12px] font-semibold">{opt.title}</span>
                    </div>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5 ml-5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                Preview on a ৳1,000 order: charge&nbsp;=&nbsp;<b className="text-foreground">৳{(1000 * svc.rate / 100).toFixed(2)}</b>
                {" · "}{svc.absorb ? "deducted from your payout" : "added to customer total"}
              </div>
            </>
          )}

          <Button onClick={saveServiceCharge} disabled={svcSaving} variant="outline" size="sm"
            className="w-full rounded-xl h-9 gap-1.5 text-[12px] font-bold">
            {svcSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save service-charge settings
          </Button>
        </Card>
      )}

      {/* Active toggle */}
      <div className="flex items-center justify-between bg-card border border-border/60 rounded-2xl p-4">
        <div>
          <p className="text-sm font-bold text-foreground">{t("mssStoreActive")}</p>
          <p className="text-[11px] text-muted-foreground">{t("mssStoreActiveDesc")}</p>
        </div>
        <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          className={`w-12 h-7 rounded-full transition-colors relative ${form.is_active ? "bg-primary" : "bg-muted"}`}>
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${form.is_active ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-12 gap-2 text-sm font-bold">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {store?.id ? t("mssUpdateStore") : t("mssCreateStore")}
      </Button>
    </div>
  );
};

export default MerchantStoreSettingsTab;
