import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Store, ImagePlus, Globe, Loader2, Check, Eye } from "lucide-react";
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

  const [form, setForm] = useState({
    store_name: "",
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
    const { data } = await (supabase as any)
      .from("vendor_stores")
      .select("*")
      .eq("merchant_id", merchantId)
      .maybeSingle();

    if (data) {
      setStore(data);
      const sl = (data.social_links || {}) as any;
      setForm({
        store_name: data.store_name || "",
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
      setForm(f => ({ ...f, store_name: businessName, slug: defaultSlug }));
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
    if (!form.store_name.trim()) { toast({ title: "Store name required", variant: "destructive" }); return; }
    if (!form.slug.trim()) { toast({ title: "Store URL slug required", variant: "destructive" }); return; }
    setSaving(true);

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

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Store settings saved ✓" });
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
            <img src={form.banner_url} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ImagePlus size={24} />
            </div>
          )}
          <button onClick={() => bannerRef.current?.click()} disabled={uploadingBanner}
            className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm text-xs font-semibold text-foreground shadow-sm">
            {uploadingBanner ? <Loader2 size={12} className="animate-spin" /> : "Change Banner"}
          </button>
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
        </div>
        <div className="relative px-4 pb-4 -mt-8">
          <div className="w-16 h-16 rounded-2xl border-4 border-background bg-muted flex items-center justify-center overflow-hidden shadow-sm">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
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
            <p className="text-sm font-bold text-foreground">{form.store_name || "Your Store"}</p>
            <p className="text-xs text-muted-foreground">/shop/{form.slug || "your-slug"}</p>
          </div>
        </div>
      </Card>

      {/* Form fields */}
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Store Name</label>
          <Input value={form.store_name} onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))} className="mt-1 rounded-xl" />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">URL Slug</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">/shop/</span>
            <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} className="rounded-xl flex-1" />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 rounded-xl" rows={3} placeholder="Tell customers about your store..." />
        </div>
      </div>

      {/* Social Links */}
      <Card className="p-4 space-y-3">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5"><Globe size={13} /> Social Links</h4>
        {[
          { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage" },
          { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourshop" },
          { key: "website", label: "Website", placeholder: "https://yoursite.com" },
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

      {/* Active toggle */}
      <div className="flex items-center justify-between bg-card border border-border/60 rounded-2xl p-4">
        <div>
          <p className="text-sm font-bold text-foreground">Store Active</p>
          <p className="text-[11px] text-muted-foreground">Visible in marketplace when active</p>
        </div>
        <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
          className={`w-12 h-7 rounded-full transition-colors relative ${form.is_active ? "bg-primary" : "bg-muted"}`}>
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-background shadow-sm transition-transform ${form.is_active ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-12 gap-2 text-sm font-bold">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        {store?.id ? "Update Store" : "Create Store"}
      </Button>
    </div>
  );
};

export default MerchantStoreSettingsTab;
