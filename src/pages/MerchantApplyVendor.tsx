import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Store, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function MerchantApplyVendor() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [merchant, setMerchant] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    store_name: "",
    store_description: "",
    product_categories: "",
    expected_monthly_orders: "",
    pickup_address: "",
    contact_number: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: m }, { data: app }] = await Promise.all([
        supabase.from("merchants").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("merchant_vendor_applications").select("*")
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
        }));
      }
      setLoading(false);
    })();
     
  }, [user]);

  const submit = async () => {
    if (!user || !merchant) return;
    if (!form.store_name.trim()) { toast.error("Store name is required"); return; }
    if (!form.pickup_address.trim()) { toast.error("Pickup address is required"); return; }
    setSubmitting(true);
    const payload = {
      merchant_id: merchant.id,
      user_id: user.id,
      store_name: form.store_name.trim(),
      store_description: form.store_description.trim() || null,
      product_categories: form.product_categories.split(",").map(s => s.trim()).filter(Boolean),
      expected_monthly_orders: form.expected_monthly_orders ? Number(form.expected_monthly_orders) : null,
      pickup_address: form.pickup_address.trim(),
      contact_number: form.contact_number.trim() || null,
      status: "pending",
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    };
    const op = existing && existing.status !== "approved"
      ? supabase.from("merchant_vendor_applications").update(payload).eq("id", existing.id)
      : supabase.from("merchant_vendor_applications").insert(payload);
    const { error } = await op;
    setSubmitting(false);
    if (error) { toast.error("Failed to submit: " + error.message); return; }
    // audit event on merchant
    await supabase.from("merchant_audit_events").insert({
      merchant_id: merchant.id,
      merchant_user_id: user.id,
      actor_id: user.id,
      event_type: "vendor_apply",
      to_value: { store_name: form.store_name },
    });
    toast.success("Vendor application submitted");
    nav("/merchant");
  };

  if (loading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!merchant) return (
    <div className="p-10 text-center">
      <p className="text-muted-foreground">You need a merchant account first.</p>
      <Button onClick={() => nav("/merchant")} className="mt-4">Back</Button>
    </div>
  );

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
            {existing?.status === "rejected" && existing.admin_notes && (
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/30 text-sm">
                <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Admin feedback</p>
                <p className="text-muted-foreground">{existing.admin_notes}</p>
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
            </div>
            {!readOnly && (
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : existing ? "Resubmit application" : "Submit application"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
