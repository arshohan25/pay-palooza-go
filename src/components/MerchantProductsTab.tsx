import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Search, ToggleLeft, ToggleRight,
  ImagePlus, X, Loader2, Video, Play, Upload, Layers,
} from "lucide-react";
import VariantsEditorSheet from "@/components/merchant/VariantsEditorSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import MerchantBulkUploadSheet from "@/components/MerchantBulkUploadSheet";
import MerchantInventoryAlerts from "@/components/MerchantInventoryAlerts";

interface Product {
  id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  price: number;
  original_price: number | null;
  category: string;
  emoji: string;
  image_url: string | null;
  images: string[];
  video_url: string | null;
  stock: number;
  is_active: boolean;
  badge: string | null;
  badge_color: string | null;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "Accessories", "Agriculture", "Air Conditioning", "Animal Feed", "Apparel", "Aquarium", "Art Supplies",
  "Automotive", "Baby & Kids", "Bags", "Bakery", "Batteries", "Beauty", "Bedding", "Beverages",
  "Bicycles", "Books", "Building Materials", "Cameras", "Candles", "Catering", "Ceramics",
  "Cleaning Supplies", "Clothing", "Computers", "Confectionery", "Cosmetics", "Crafts",
  "Curtains & Blinds", "Dairy", "Decor", "Dental", "Desserts", "Digital Products", "Drones",
  "Education", "Electrical", "Electronics", "Eyewear", "Fabric", "Farm Produce", "Fashion",
  "Fertilizers", "Fitness", "Flooring", "Flowers", "Food", "Footwear", "Frozen Foods",
  "Furniture", "Gadgets", "Games", "Garden", "General", "Gift Cards", "Gifts", "Grocery",
  "Hair Care", "Handcraft", "Hardware", "Health", "Herbs", "Home Appliances", "Home Decor",
  "Hygiene", "Ice Cream", "Industrial", "Insurance", "Interior Design", "Jewelry",
  "Kids Toys", "Kitchen", "Laundry", "Leather", "Lighting", "Lingerie", "Luggage", "Luxury",
  "Makeup", "Marine", "Mattresses", "Meat", "Medical Devices", "Medicine", "Men's Fashion",
  "Mobile Accessories", "Music", "Nursery", "Office Supplies", "Organic", "Outdoor",
  "Paint", "Party Supplies", "Perfume", "Pet Care", "Photography", "Plumbing", "Poultry",
  "Printing", "Puzzles", "Real Estate", "Recycling", "Restaurants", "Safety Equipment",
  "Salon", "Seafood", "Security", "Shoes", "Skincare", "Snacks", "Solar", "Spices",
  "Sports", "Stationery", "Storage", "Supplements", "Tailoring", "Tea & Coffee",
  "Textiles", "Tools", "Toys", "Travel", "Uniforms", "Vegetables", "Veterinary",
  "Watches", "Water", "Wedding", "Wellness", "Women's Fashion", "Woodwork", "Yoga",
];
const EMOJIS = ["📦", "🎧", "⌚", "👕", "🍔", "💊", "🏠", "📱", "💻", "🎮", "☕", "🎁", "👟", "🔧", "📷", "💡", "🧴", "🎂"];
const BADGES = [
  { label: "None", value: "", color: "" },
  { label: "NEW", value: "NEW", color: "#9C27B0" },
  { label: "HOT", value: "HOT", color: "#FF5722" },
  { label: "SALE", value: "SALE", color: "#FF9800" },
  { label: "TOP PICK", value: "TOP PICK", color: "#00BCD4" },
];
const MAX_IMAGES = 4;

function CategorySearchSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filtered = CATEGORIES.filter(c => c.toLowerCase().includes(search.toLowerCase()));

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomMode(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative mt-1.5">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); setCustomMode(false); }}
        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-left flex items-center justify-between"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>{value || "Select category"}</span>
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-[90] overflow-hidden">
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm rounded-lg"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c}
                type="button"
                className={`w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors ${c === value ? "bg-primary/10 text-primary font-medium" : "text-foreground"}`}
                onClick={() => { onChange(c); setOpen(false); }}
              >
                {c}
              </button>
            ))}
            {filtered.length === 0 && !customMode && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No match found</p>
            )}
            {!customMode ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-left text-primary font-medium hover:bg-muted/50 border-t border-border"
                onClick={() => { setCustomMode(true); setCustomValue(search); }}
              >
                ＋ Add Custom Category
              </button>
            ) : (
              <div className="p-2 border-t border-border flex gap-2">
                <Input
                  placeholder="Custom category name"
                  value={customValue}
                  onChange={e => setCustomValue(e.target.value)}
                  className="h-8 text-sm rounded-lg flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!customValue.trim()}
                  onClick={() => { onChange(customValue.trim()); setOpen(false); setCustomMode(false); }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Video URL helpers
const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const getVimeoId = (url: string): string | null => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
};

const getVideoThumbnail = (url: string): string | null => {
  const ytId = getYouTubeId(url);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
  return null;
};

interface Props {
  merchantId: string;
  businessName?: string;
}

const ensureVendorStore = async (merchantId: string, businessName: string) => {
  const { data } = await (supabase as any)
    .from("vendor_stores")
    .select("id")
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (!data) {
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    await (supabase as any).from("vendor_stores").insert({
      merchant_id: merchantId,
      store_name: businessName,
      slug,
      is_active: true,
    });
  }
};

const MerchantProductsTab = ({ merchantId, businessName }: Props) => {
  const { toast } = useToast();
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [variantsProductId, setVariantsProductId] = useState<string | null>(null);
  const [variantsProductName, setVariantsProductName] = useState<string>("");
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [form, setForm] = useState({
    name: "", description: "", price: "", original_price: "",
    category: "General", emoji: "📦", stock: "0",
    badge: "", badge_color: "", is_active: true,
    images: [] as string[],
    video_url: "",
  });

  const resetForm = () => {
    setForm({
      name: "", description: "", price: "", original_price: "",
      category: "General", emoji: "📦", stock: "0",
      badge: "", badge_color: "", is_active: true,
      images: [],
      video_url: "",
    });
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("merchant_products")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    if (!error) {
      setProducts((data ?? []).map((p: any) => ({
        ...p,
        images: p.images || [],
      })));
    }
    setLoading(false);
  }, [merchantId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    const channel = supabase
      .channel("merchant-products-rt")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "merchant_products",
        filter: `merchant_id=eq.${merchantId}`,
      }, () => { loadProducts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId, loadProducts]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${merchantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return null;
    }

    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
      return;
    }

    setUploadingSlot(slotIndex);
    const url = await uploadImage(file);
    if (url) {
      setForm(f => {
        const newImages = [...f.images];
        if (slotIndex < newImages.length) {
          newImages[slotIndex] = url;
        } else {
          newImages.push(url);
        }
        return { ...f, images: newImages };
      });
    }
    setUploadingSlot(null);

    // Reset input
    if (fileInputRefs.current[slotIndex]) {
      fileInputRefs.current[slotIndex]!.value = "";
    }
  };

  const removeImage = (index: number) => {
    setForm(f => ({
      ...f,
      images: f.images.filter((_, i) => i !== index),
    }));
  };

  const openAdd = () => { resetForm(); setEditing(null); setShowSheet(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "",
      price: String(p.price), original_price: p.original_price ? String(p.original_price) : "",
      category: p.category, emoji: p.emoji, stock: String(p.stock),
      badge: p.badge || "", badge_color: p.badge_color || "", is_active: p.is_active,
      images: p.images || [],
      video_url: p.video_url || "",
    });
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!form.price || Number(form.price) <= 0) { toast({ title: "Valid price required", variant: "destructive" }); return; }
    setSaving(true);
    if (!editing && businessName) {
      await ensureVendorStore(merchantId, businessName);
    }
    const payload = {
      merchant_id: merchantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      category: form.category,
      emoji: form.emoji,
      stock: Number(form.stock) || 0,
      badge: form.badge || null,
      badge_color: form.badge_color || null,
      is_active: form.is_active,
      image_url: form.images[0] || null, // Primary image for backwards compat
      images: form.images,
      video_url: form.video_url.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await (supabase as any)
        .from("merchant_products").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Product updated ✓" }); setShowSheet(false); loadProducts(); }
    } else {
      const { error } = await (supabase as any)
        .from("merchant_products").insert(payload);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Product added ✓" }); setShowSheet(false); loadProducts(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const { error } = await (supabase as any).from("merchant_products").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", variant: "destructive" }); }
    else { toast({ title: "Product deleted" }); loadProducts(); }
    setDeleting(null);
  };

  const toggleActive = async (p: Product) => {
    await (supabase as any)
      .from("merchant_products")
      .update({ is_active: !p.is_active, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    loadProducts();
  };

  const updateStock = async (p: Product, delta: number) => {
    const newStock = Math.max(0, p.stock + delta);
    await (supabase as any)
      .from("merchant_products")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock: newStock } : x));
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const videoThumbnail = form.video_url ? getVideoThumbnail(form.video_url) : null;
  const hasValidVideo = form.video_url && (getYouTubeId(form.video_url) || getVimeoId(form.video_url));

  return (
    <div className="space-y-4">
      {/* Inventory Alerts */}
      <MerchantInventoryAlerts merchantId={merchantId} />

      {/* Header bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <Button onClick={() => setShowBulkUpload(true)} variant="outline" className="shrink-0 rounded-xl gap-1.5 h-10" size="sm">
          <Upload size={14} /> CSV
        </Button>
        <Button onClick={openAdd} className="shrink-0 rounded-xl gap-1.5 h-10" size="sm">
          <Plus size={15} /> Add
        </Button>
      </div>

      {/* Bulk Upload Sheet */}
      <MerchantBulkUploadSheet
        merchantId={merchantId}
        businessName={businessName}
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        onSuccess={loadProducts}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: products.length, emoji: "📦" },
          { label: "Active", value: products.filter(p => p.is_active).length, emoji: "✅" },
          { label: "Out of Stock", value: products.filter(p => p.stock === 0).length, emoji: "⚠️" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/60 rounded-2xl p-3 text-center">
            <p className="text-lg">{s.emoji}</p>
            <p className="text-[18px] font-extrabold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">🏪</p>
          <p className="text-[15px] font-bold text-foreground">
            {products.length === 0 ? "No products yet" : "No results"}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {products.length === 0 ? "Add your first product to start selling" : "Try a different search"}
          </p>
          {products.length === 0 && (
            <Button onClick={openAdd} className="rounded-xl gap-1.5 mt-2">
              <Plus size={15} /> Add First Product
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p, i) => {
            const primaryImage = p.images?.[0] || p.image_url;
            return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-card border rounded-2xl p-3.5 flex items-center gap-3 transition-opacity ${!p.is_active ? "opacity-60 border-border/40" : "border-border/60"}`}
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden relative">
                {primaryImage ? (
                  <img src={primaryImage} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{p.emoji}</span>
                )}
                {p.images && p.images.length > 1 && (
                  <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold bg-background/80 px-1 rounded">
                    +{p.images.length - 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-foreground truncate">{p.name}</p>
                  {p.badge && (
                    <span className="text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: p.badge_color || "#9C27B0" }}>{p.badge}</span>
                  )}
                  {p.video_url && <Video size={10} className="text-primary shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-bold text-primary">৳{Number(p.price).toLocaleString()}</span>
                  {p.original_price && (
                    <span className="text-[10px] text-muted-foreground line-through">৳{Number(p.original_price).toLocaleString()}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">· {p.category}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateStock(p, -1)}
                      className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">−</button>
                    <span className={`text-[11px] font-bold tabular-nums ${p.stock === 0 ? "text-destructive" : "text-foreground"}`}>
                      {p.stock}
                    </span>
                    <button onClick={() => updateStock(p, 1)}
                      className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">+</button>
                    <span className="text-[9px] text-muted-foreground">stock</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => toggleActive(p)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  {p.is_active ? <Eye size={13} className="text-green-600" /> : <EyeOff size={13} className="text-muted-foreground" />}
                </button>
                <button onClick={() => { setVariantsProductId(p.id); setVariantsProductName(p.name); }}
                  className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center" title="Variants">
                  <Layers size={12} className="text-primary" />
                </button>
                <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <Pencil size={12} className="text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                  className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Trash2 size={12} className="text-destructive" />
                </button>
              </div>
            </motion.div>
          );})}
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={showSheet} onOpenChange={setShowSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto z-[80]" overlayClassName="z-[80]">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Product" : "Add Product"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4 pb-8">
            {/* Multi-Image Upload Grid */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Product Photos (up to {MAX_IMAGES})
              </label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {Array.from({ length: MAX_IMAGES }).map((_, idx) => {
                  const imageUrl = form.images[idx];
                  const isUploading = uploadingSlot === idx;
                  
                  return (
                    <div key={idx} className="relative aspect-square">
                      {imageUrl ? (
                        <div className="relative w-full h-full rounded-xl overflow-hidden border border-border/60 bg-muted">
                          <img src={imageUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                          {idx === 0 && (
                            <span className="absolute top-1 left-1 text-[8px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/90 shadow-sm flex items-center justify-center"
                          >
                            <X size={10} className="text-foreground" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRefs.current[idx]?.click()}
                          disabled={isUploading || (idx > 0 && !form.images[idx - 1])}
                          className="w-full h-full rounded-xl border-2 border-dashed border-border/80 bg-muted/30 flex flex-col items-center justify-center gap-1 transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isUploading ? (
                            <Loader2 size={16} className="animate-spin text-primary" />
                          ) : (
                            <>
                              <ImagePlus size={16} className="text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground">{idx === 0 ? "Primary" : `#${idx + 1}`}</span>
                            </>
                          )}
                        </button>
                      )}
                      <input
                        ref={el => fileInputRefs.current[idx] = el}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleFileSelect(e, idx)}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">First image will be shown in product cards. Max 5MB each.</p>
            </div>

            {/* Video URL Input */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Video size={12} /> Product Video (optional)
              </label>
              <Input
                value={form.video_url}
                onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder="Paste YouTube or Vimeo link..."
                className="mt-1.5 rounded-xl"
              />
              {videoThumbnail && hasValidVideo && (
                <div className="mt-2 relative rounded-xl overflow-hidden aspect-video bg-muted">
                  <img src={videoThumbnail} alt="Video thumbnail" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                      <Play size={18} className="text-foreground ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
              {form.video_url && !hasValidVideo && (
                <p className="text-[10px] text-destructive mt-1">Invalid video URL. Supports YouTube & Vimeo.</p>
              )}
            </div>

            {/* Emoji picker */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Emoji Icon {form.images.length > 0 && <span className="text-muted-foreground/60">(fallback)</span>}
              </label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${form.emoji === e ? "border-primary bg-primary/10" : "border-border bg-muted"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Product name" className="mt-1.5 rounded-xl" />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description" rows={2} className="mt-1.5 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Price (৳) *</label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="0" className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Original Price</label>
                <Input type="number" value={form.original_price} onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))}
                  placeholder="For sale badge" className="mt-1.5 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Stock</label>
                <Input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                <CategorySearchSelect
                  value={form.category}
                  onChange={(val) => setForm(f => ({ ...f, category: val }))}
                />
              </div>
            </div>

            {/* Badge */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Badge</label>
              <div className="flex gap-2 flex-wrap mt-1.5">
                {BADGES.map(b => (
                  <button key={b.value} onClick={() => setForm(f => ({ ...f, badge: b.value, badge_color: b.color }))}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${form.badge === b.value ? "text-white border-transparent" : "bg-muted text-muted-foreground border-border"}`}
                    style={form.badge === b.value && b.color ? { background: b.color } : {}}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/60">
              <span className="text-[13px] font-semibold text-foreground">Listed (visible in shop)</span>
              <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}>
                {form.is_active
                  ? <ToggleRight size={28} className="text-green-600" />
                  : <ToggleLeft size={28} className="text-muted-foreground" />}
              </button>
            </div>

            <Button onClick={handleSave} disabled={saving || uploadingSlot !== null} className="w-full h-12 rounded-xl text-[14px] font-bold">
              {saving ? "Saving..." : uploadingSlot !== null ? "Uploading..." : editing ? "Update Product" : "Add Product"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MerchantProductsTab;
