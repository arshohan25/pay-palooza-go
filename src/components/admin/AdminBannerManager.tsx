import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, GripVertical, Image, Upload, X, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { icons } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  badge_text: string | null;
  icon: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  link_url: string | null;
  media_url: string | null;
  media_type: string | null;
  is_active: boolean;
  sort_order: number;
  expires_at: string | null;
  created_at: string;
  placement: string;
}

const PLACEMENT_OPTIONS = [
  { value: "home", label: "Home Only" },
  { value: "shop", label: "Shop Only" },
  { value: "both", label: "Home & Shop" },
];

const ICON_OPTIONS = ["Gift", "Zap", "Star", "Heart", "ShieldCheck", "Sparkles", "Trophy", "Megaphone", "PartyPopper", "Rocket", "Tag", "Percent", "BadgeDollarSign", "Crown"];

const FEATURE_LINKS = [
  { value: "", label: "No Link" },
  { value: "feature:sendmoney", label: "Send Money" },
  { value: "feature:cashout", label: "Cash Out" },
  { value: "feature:payment", label: "Payment" },
  { value: "feature:recharge", label: "Mobile Recharge" },
  { value: "feature:paybill", label: "Pay Bill" },
  { value: "feature:addmoney", label: "Add Money" },
  { value: "feature:shop", label: "Shop" },
  { value: "feature:banktransfer", label: "Bank Transfer" },
  { value: "feature:savings", label: "Savings" },
  { value: "feature:refer", label: "Refer & Earn" },
  { value: "feature:kyc", label: "KYC Verification" },
  { value: "feature:history", label: "Transaction History" },
];

const emptyForm = {
  title: "",
  subtitle: "",
  badge_text: "Limited Offer",
  icon: "Gift",
  gradient_from: "#0ea5e9",
  gradient_to: "#06b6d4",
  link_url: "",
  link_mode: "feature" as "feature" | "external",
  media_url: "",
  media_type: "" as string,
  is_active: true,
  sort_order: 0,
  expires_at: "",
  placement: "home",
};

export default function AdminBannerManager() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("promo_banners")
      .select("*")
      .order("sort_order");
    setBanners((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getLinkMode = (url: string | null): "feature" | "external" => {
    if (!url) return "feature";
    if (url.startsWith("feature:")) return "feature";
    return "external";
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...emptyForm, sort_order: banners.length });
    setDialogOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditId(b.id);
    const mode = getLinkMode(b.link_url);
    setForm({
      title: b.title,
      subtitle: b.subtitle || "",
      badge_text: b.badge_text || "",
      icon: b.icon || "Gift",
      gradient_from: b.gradient_from || "#0ea5e9",
      gradient_to: b.gradient_to || "#06b6d4",
      link_url: b.link_url || "",
      link_mode: mode,
      media_url: b.media_url || "",
      media_type: b.media_type || "",
      is_active: b.is_active,
      sort_order: b.sort_order,
      expires_at: b.expires_at ? b.expires_at.slice(0, 16) : "",
      placement: (b as any).placement || "home",
    });
    setDialogOpen(true);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File too large. Max 10MB.");
      return;
    }

    let mediaType = "image";
    if (file.type.startsWith("video/")) mediaType = "video";
    else if (file.type === "image/gif") mediaType = "gif";

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("banner-media")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("banner-media")
      .getPublicUrl(path);

    setForm(prev => ({
      ...prev,
      media_url: urlData.publicUrl,
      media_type: mediaType,
    }));
    setUploading(false);
    toast.success("Media uploaded!");
  };

  const removeMedia = () => {
    setForm(prev => ({ ...prev, media_url: "", media_type: "" }));
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);

    const finalLinkUrl = form.link_mode === "feature"
      ? (form.link_url || null)
      : (form.link_url.trim() || null);

    const payload: any = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      badge_text: form.badge_text.trim() || null,
      icon: form.icon,
      gradient_from: form.gradient_from,
      gradient_to: form.gradient_to,
      link_url: finalLinkUrl,
      media_url: form.media_url || null,
      media_type: form.media_type || null,
      is_active: form.is_active,
      sort_order: form.sort_order,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      placement: form.placement,
    };

    if (editId) {
      const { error } = await supabase.from("promo_banners").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Banner updated");
    } else {
      const { error } = await supabase.from("promo_banners").insert(payload);
      if (error) toast.error(error.message); else toast.success("Banner created");
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const deleteBanner = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("promo_banners").delete().eq("id", deleteId);
    if (error) toast.error(error.message); else toast.success("Banner deleted");
    setDeleteId(null);
    load();
  };

  const toggleActive = async (b: Banner) => {
    await supabase.from("promo_banners").update({ is_active: !b.is_active }).eq("id", b.id);
    load();
  };

  const getLinkLabel = (url: string | null) => {
    if (!url) return null;
    const found = FEATURE_LINKS.find(f => f.value === url);
    return found ? found.label : url;
  };

  return (
    <div className="w-full max-w-full overflow-hidden space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 min-w-0">
          <Image className="w-5 h-5 shrink-0" /> <span className="truncate">Promo Banners</span>
        </h2>
        <Button size="sm" onClick={openAdd} className="shrink-0 h-7 px-2 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading…</div>
      ) : banners.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No banners yet. Add your first promo banner above.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {banners.map((b) => {
            return (
              <Card key={b.id} className="w-full max-w-full overflow-hidden">
                <div className="p-2 sm:p-3">
                  <div className="flex items-start gap-2.5">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    {b.media_url ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        {b.media_type === "video" ? (
                          <video src={b.media_url} muted className="w-full h-full object-cover" />
                        ) : (
                          <img src={b.media_url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `linear-gradient(135deg, ${b.gradient_from}, ${b.gradient_to})` }}
                      >
                        {(() => { const IC = (icons as any)[b.icon || "Gift"] || icons.Gift; return <IC className="w-5 h-5 text-white" />; })()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-sm font-semibold truncate">{b.title}</p>
                        <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} className="shrink-0 scale-90" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{b.subtitle || "No subtitle"}</p>
                      <div className="flex items-center justify-between mt-1.5 gap-1">
                        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                          <Badge variant={b.is_active ? "default" : "secondary"} className="text-[9px] shrink-0 px-1">{b.is_active ? "On" : "Off"}</Badge>
                          {b.link_url && (
                            <Badge variant="outline" className="text-[9px] shrink-0 gap-0.5 max-w-[100px] truncate px-1">
                              <Link2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{getLinkLabel(b.link_url)}</span>
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center shrink-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(b)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDeleteId(b.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Banner" : "Add Banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Invite Friends & Earn ৳50" />
            </div>
            <div>
              <Label>Subtitle</Label>
              <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Optional description" />
            </div>
            <div>
              <Label>Badge Text</Label>
              <Input value={form.badge_text} onChange={(e) => setForm({ ...form, badge_text: e.target.value })} placeholder="Limited Offer" />
            </div>

            {/* Media Upload */}
            <div>
              <Label>Banner Media (Image / GIF / Video)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.gif"
                className="hidden"
                onChange={handleMediaUpload}
              />
              {form.media_url ? (
                <div className="relative mt-1 rounded-lg overflow-hidden border border-border">
                  {form.media_type === "video" ? (
                    <video src={form.media_url} muted autoPlay loop playsInline className="w-full h-32 object-cover" />
                  ) : (
                    <img src={form.media_url} alt="" className="w-full h-32 object-cover" />
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-1 right-1 w-6 h-6"
                    onClick={removeMedia}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mt-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Uploading…" : "Upload Media"}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Max 10MB. Images, GIFs, or videos. Overrides gradient background.</p>
            </div>

            <div>
              <Label>Icon</Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {ICON_OPTIONS.map((name) => {
                  const IC = (icons as any)[name];
                  return IC ? (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm({ ...form, icon: name })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${form.icon === name ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                    >
                      <IC className="w-4 h-4" />
                    </button>
                  ) : null;
                })}
              </div>
            </div>

            {!form.media_url && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Gradient From</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={form.gradient_from} onChange={(e) => setForm({ ...form, gradient_from: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={form.gradient_from} onChange={(e) => setForm({ ...form, gradient_from: e.target.value })} className="text-xs" />
                  </div>
                </div>
                <div>
                  <Label>Gradient To</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={form.gradient_to} onChange={(e) => setForm({ ...form, gradient_to: e.target.value })} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Input value={form.gradient_to} onChange={(e) => setForm({ ...form, gradient_to: e.target.value })} className="text-xs" />
                  </div>
                </div>
              </div>
            )}

            {/* Link Target */}
            <div>
              <Label>Link Target</Label>
              <div className="flex gap-2 mt-1 mb-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.link_mode === "feature" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, link_mode: "feature", link_url: "" })}
                  className="text-xs"
                >
                  <Link2 className="w-3 h-3 mr-1" /> App Feature
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.link_mode === "external" ? "default" : "outline"}
                  onClick={() => setForm({ ...form, link_mode: "external", link_url: "" })}
                  className="text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> External URL
                </Button>
              </div>
              {form.link_mode === "feature" ? (
                <Select
                  value={form.link_url}
                  onValueChange={(v) => setForm({ ...form, link_url: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a feature…" />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURE_LINKS.map((f) => (
                      <SelectItem key={f.value} value={f.value || "none"}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://example.com"
                />
              )}
            </div>

            {/* Preview */}
            <div>
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div
                className="rounded-xl p-4 mt-1 relative overflow-hidden"
                style={form.media_url ? undefined : { background: `linear-gradient(135deg, ${form.gradient_from}, ${form.gradient_to})` }}
              >
                {form.media_url && (
                  <>
                    {form.media_type === "video" ? (
                      <video src={form.media_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <img src={form.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/40" />
                  </>
                )}
                <div className="relative z-10">
                  {form.badge_text && <span className="inline-block bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">{form.badge_text}</span>}
                  <p className="text-white text-sm font-bold">{form.title || "Banner Title"}</p>
                  {form.subtitle && <p className="text-white/80 text-xs mt-0.5">{form.subtitle}</p>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Expires At</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Banner?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBanner}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
