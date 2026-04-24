import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Package, Store, Star, Ticket, Search, RefreshCw, Trash2, Eye, Edit2,
  ShoppingBag, TrendingUp, AlertTriangle, MoreHorizontal, Plus, Tag,
  Image, Megaphone, CreditCard, Wallet, Truck, Smartphone, ShieldCheck, Percent,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminBannerManager from "./AdminBannerManager";
import AdminMarketingTools from "./AdminMarketingTools";
import AdminEcommerceStats from "./AdminEcommerceStats";
import AdminInventoryAlerts from "./AdminInventoryAlerts";
import AdminFlashSales from "./AdminFlashSales";
import AdminCourierProviders from "./AdminCourierProviders";
import AdminDeliveryZones from "./AdminDeliveryZones";
import AdminReturnRequests from "./AdminReturnRequests";
import AdminVendorKycReview from "./AdminVendorKycReview";
import AdminVendorCommissionManager from "./AdminVendorCommissionManager";
import AdminVendorPayouts from "./AdminVendorPayouts";

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details
    }).then();
  }
}

type SubTab = "dashboard" | "products" | "stores" | "vendor_kyc" | "commissions" | "vendor_payouts" | "reviews" | "coupons" | "banners" | "marketing" | "inventory" | "flash_sales" | "couriers" | "zones" | "returns" | "payments";

const SUB_TABS: { key: SubTab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: TrendingUp },
  { key: "vendor_kyc", label: "Vendor KYC", icon: ShieldCheck },
  { key: "vendor_payouts", label: "Vendor Payouts", icon: Wallet },
  { key: "commissions", label: "Commissions", icon: Percent },
  { key: "products", label: "Products", icon: Package },
  { key: "stores", label: "Vendor Stores", icon: Store },
  { key: "reviews", label: "Reviews", icon: Star },
  { key: "coupons", label: "Coupons", icon: Ticket },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "inventory", label: "Inventory", icon: AlertTriangle },
  { key: "flash_sales", label: "Flash Sales", icon: Tag },
  { key: "couriers", label: "Couriers", icon: Store },
  { key: "zones", label: "Delivery Zones", icon: Package },
  { key: "banners", label: "Banners", icon: Image },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "returns", label: "Returns", icon: Package },
];

/* ═══════════════════════ PRODUCTS TAB ═══════════════════════ */
function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("merchant_products")
      .select("*, vendor_stores(store_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setProducts(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("merchant_products").update({ is_active: !current }).eq("id", id);
    auditLog("toggle_product", "merchant_product", id, { is_active: !current });
    toast.success(current ? "Product deactivated" : "Product activated");
    load();
  };

  const saveInlineEdit = async (id: string) => {
    const updates: any = {};
    if (editPrice) updates.price = parseFloat(editPrice);
    if (editStock) updates.stock = parseInt(editStock);
    if (Object.keys(updates).length === 0) { setEditingId(null); return; }
    await supabase.from("merchant_products").update(updates).eq("id", id);
    auditLog("edit_product", "merchant_product", id, updates);
    toast.success("Product updated");
    setEditingId(null);
    load();
  };

  const deleteProduct = async (id: string) => {
    await supabase.from("merchant_products").delete().eq("id", id);
    auditLog("delete_product", "merchant_product", id, {});
    toast.success("Product deleted");
    load();
  };

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
    (p.vendor_stores as any)?.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products or vendors…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{products.length}</p>
          <p className="text-xs text-muted-foreground">Total Products</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-primary">{products.filter(p => p.is_active).length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{products.filter(p => (p.stock ?? 0) <= 5).length}</p>
          <p className="text-xs text-muted-foreground">Low Stock</p>
        </CardContent></Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading products…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No products found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <Card key={p.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{(p.vendor_stores as any)?.store_name || "No Store"}</p>
                  {editingId === p.id ? (
                    <div className="flex gap-2 mt-1">
                      <Input placeholder="Price" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="h-7 text-xs w-20" />
                      <Input placeholder="Stock" value={editStock} onChange={e => setEditStock(e.target.value)} className="h-7 text-xs w-16" />
                      <Button size="sm" className="h-7 text-xs" onClick={() => saveInlineEdit(p.id)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-semibold text-foreground">৳{p.price}</span>
                      <span className="text-xs text-muted-foreground">Stock: {p.stock ?? "∞"}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">
                    {p.is_active ? "Active" : "Off"}
                  </Badge>
                  <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p.id, p.is_active)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(p.id); setEditPrice(p.price?.toString() || ""); setEditStock(p.stock?.toString() || ""); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteProduct(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ STORES TAB ═══════════════════════ */
function StoresTab() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailStore, setDetailStore] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("vendor_stores")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setStores(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("vendor_stores").update({ is_active: !current }).eq("id", id);
    auditLog("toggle_store", "vendor_store", id, { is_active: !current });
    toast.success(!current ? "Store activated" : "Store suspended");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{stores.length} vendor stores</p>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading stores…</div>
      ) : stores.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No vendor stores yet</div>
      ) : (
        <div className="space-y-2">
          {stores.map(s => (
            <Card key={s.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                {s.logo_url ? (
                  <img src={s.logo_url} alt={s.store_name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-foreground">{s.store_name}</p>
                  <p className="text-xs text-muted-foreground">/{s.slug}</p>
                </div>
                <Badge variant={s.is_active ? "default" : "destructive"} className="text-[10px] shrink-0">
                  {s.is_active ? "Active" : "Inactive"}
                </Badge>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggleActive(s.id, s.is_active)}>
                  {s.is_active ? "Suspend" : "Activate"}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDetailStore(s)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!detailStore} onOpenChange={() => setDetailStore(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{detailStore?.store_name}</SheetTitle>
            <SheetDescription>Store details</SheetDescription>
          </SheetHeader>
          {detailStore && (
            <ScrollArea className="mt-4 space-y-3 pr-4 h-[70vh]">
              <div className="space-y-3">
                {detailStore.banner_url && <img src={detailStore.banner_url} alt="Banner" className="w-full h-32 object-cover rounded-xl" />}
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Slug:</span> <span className="text-foreground">/{detailStore.slug}</span></p>
                  <p><span className="text-muted-foreground">Status:</span> <Badge variant={detailStore.is_active ? "default" : "destructive"}>{detailStore.is_active ? "Active" : "Inactive"}</Badge></p>
                  <p><span className="text-muted-foreground">Description:</span> <span className="text-foreground">{detailStore.description || "—"}</span></p>
                  <p><span className="text-muted-foreground">Created:</span> <span className="text-foreground">{new Date(detailStore.created_at).toLocaleDateString()}</span></p>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ═══════════════════════ REVIEWS TAB ═══════════════════════ */
function ReviewsTab() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_reviews")
      .select("*, merchant_products(name), profiles(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setReviews(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteReview = async (id: string) => {
    await supabase.from("product_reviews").delete().eq("id", id);
    auditLog("delete_review", "product_review", id, {});
    toast.success("Review removed");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{reviews.length} reviews</p>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No reviews yet</div>
      ) : (
        <div className="space-y-2">
          {reviews.map(r => (
            <Card key={r.id} className="border shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < (r.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm mt-1 text-foreground">{r.review_text || "No comment"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Product: {(r.merchant_products as any)?.name || "Unknown"} · By: {(r.profiles as any)?.name || "Anonymous"}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => deleteReview(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ COUPONS TAB ═══════════════════════ */
function CouponsTab() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: "", discount_type: "percentage", discount_value: "10", usage_limit: "", min_order_amount: "", max_discount: "", description: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setCoupons(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
    auditLog("toggle_coupon", "coupon", id, { is_active: !current });
    toast.success(current ? "Coupon deactivated" : "Coupon activated");
    load();
  };

  const createCoupon = async () => {
    if (!form.code.trim()) { toast.error("Code is required"); return; }
    const insert: any = {
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      description: form.description || null,
    };
    if (form.usage_limit) insert.usage_limit = parseInt(form.usage_limit);
    if (form.min_order_amount) insert.min_order_amount = parseFloat(form.min_order_amount);
    if (form.max_discount) insert.max_discount = parseFloat(form.max_discount);

    const { error, data } = await supabase.from("coupons").insert(insert).select("id").single();
    if (error) { toast.error(error.message); return; }
    auditLog("create_coupon", "coupon", data?.id || "new", { code: insert.code, discount_type: insert.discount_type, discount_value: insert.discount_value });
    toast.success("Coupon created");
    setShowCreate(false);
    setForm({ code: "", discount_type: "percentage", discount_value: "10", usage_limit: "", min_order_amount: "", max_discount: "", description: "" });
    load();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    auditLog("delete_coupon", "coupon", id, {});
    toast.success("Coupon deleted");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{coupons.length} coupons</p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> New Coupon
        </Button>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {showCreate && (
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="font-medium text-sm text-foreground">Create Coupon</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="CODE" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.discount_type}
                onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))}
              >
                <option value="percentage">Percentage %</option>
                <option value="fixed">Fixed ৳</option>
              </select>
              <Input placeholder="Discount value" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} />
              <Input placeholder="Max discount ৳" value={form.max_discount} onChange={e => setForm(p => ({ ...p, max_discount: e.target.value }))} />
              <Input placeholder="Usage limit" value={form.usage_limit} onChange={e => setForm(p => ({ ...p, usage_limit: e.target.value }))} />
              <Input placeholder="Min order ৳" value={form.min_order_amount} onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))} />
            </div>
            <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" onClick={createCoupon}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading coupons…</div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No coupons yet</div>
      ) : (
        <div className="space-y-2">
          {coupons.map(c => (
            <Card key={c.id} className="border shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Tag className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-sm text-foreground">{c.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.discount_type === "percentage" ? `${c.discount_value}% off` : `৳${c.discount_value} off`}
                    {c.max_discount ? ` (max ৳${c.max_discount})` : ""}
                    {c.min_order_amount ? ` · min ৳${c.min_order_amount}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Used: {c.used_count || 0}{c.usage_limit ? `/${c.usage_limit}` : ""} 
                    {c.expires_at ? ` · Exp: ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                    {c.is_active ? "Active" : "Off"}
                  </Badge>
                  <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCoupon(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ PAYMENT METHODS TAB ═══════════════════════ */
const ICON_MAP: Record<string, any> = { wallet: Wallet, truck: Truck, smartphone: Smartphone, "credit-card": CreditCard };

function PaymentMethodsTab() {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("checkout_payment_methods")
      .select("*")
      .order("sort_order", { ascending: true });
    setMethods(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (id: string, current: boolean) => {
    await supabase.from("checkout_payment_methods").update({ is_enabled: !current }).eq("id", id);
    auditLog("toggle_payment_method", "checkout_payment_methods", id, { is_enabled: !current });
    toast.success(current ? "Payment method disabled" : "Payment method enabled");
    load();
  };

  const saveEdit = async (id: string) => {
    const updates: any = {};
    if (editLabel.trim()) updates.label = editLabel.trim();
    if (editDesc.trim()) updates.description = editDesc.trim();
    if (Object.keys(updates).length === 0) { setEditId(null); return; }
    await supabase.from("checkout_payment_methods").update(updates).eq("id", id);
    auditLog("edit_payment_method", "checkout_payment_methods", id, updates);
    toast.success("Payment method updated");
    setEditId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-sm text-muted-foreground flex-1">{methods.length} payment methods</p>
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading payment methods…</div>
      ) : (
        <div className="space-y-2">
          {methods.map(m => {
            const IconComp = ICON_MAP[m.icon] || CreditCard;
            return (
              <Card key={m.id} className="border shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <IconComp className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {editId === m.id ? (
                      <div className="space-y-1.5">
                        <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Label" className="h-7 text-xs" />
                        <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" className="h-7 text-xs" />
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => saveEdit(m.id)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-sm text-foreground">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.description || "—"}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">key: {m.key}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={m.is_enabled ? "default" : "secondary"} className="text-[10px]">
                      {m.is_enabled ? "On" : "Off"}
                    </Badge>
                    <Switch checked={m.is_enabled} onCheckedChange={() => toggleEnabled(m.id, m.is_enabled)} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditId(m.id); setEditLabel(m.label); setEditDesc(m.description || ""); }}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ MAIN HUB ═══════════════════════ */
export default function AdminEcommerceHub() {
  const [subTab, setSubTab] = useState<SubTab>("dashboard");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ShoppingBag className="w-6 h-6 text-primary" />
        <h2 className="text-lg font-bold text-foreground">E-Commerce Management</h2>
      </div>

      <div className="bg-muted/50 rounded-lg p-1 flex flex-wrap gap-0.5">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              subTab === t.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setSubTab(t.key)}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <Separator />

      {subTab === "dashboard" && <AdminEcommerceStats />}
      {subTab === "products" && <ProductsTab />}
      {subTab === "stores" && <StoresTab />}
      {subTab === "reviews" && <ReviewsTab />}
      {subTab === "coupons" && <CouponsTab />}
      {subTab === "inventory" && <AdminInventoryAlerts />}
      {subTab === "flash_sales" && <AdminFlashSales />}
      {subTab === "couriers" && <AdminCourierProviders />}
      {subTab === "zones" && <AdminDeliveryZones />}
      {subTab === "banners" && <AdminBannerManager />}
      {subTab === "marketing" && <AdminMarketingTools />}
      {subTab === "returns" && <AdminReturnRequests />}
      {subTab === "payments" && <PaymentMethodsTab />}
      {subTab === "vendor_kyc" && <AdminVendorKycReview />}
      {subTab === "vendor_payouts" && <AdminVendorPayouts />}
      {subTab === "commissions" && <AdminVendorCommissionManager />}
    </div>
  );
}
