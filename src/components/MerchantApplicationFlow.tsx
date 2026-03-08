import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Store, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const CATEGORIES = [
  "retail",
  "food",
  "ecommerce",
  "services",
  "healthcare",
  "education",
  "travel",
  "electronics",
  "fashion",
  "grocery",
  "pharmacy",
  "restaurant",
  "transportation",
  "real_estate",
  "agriculture",
  "manufacturing",
  "telecom",
  "entertainment",
  "beauty",
  "sports",
  "logistics",
  "consulting",
  "ngo",
  "government",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  retail: "Retail",
  food: "Food & Beverage",
  ecommerce: "E-Commerce",
  services: "Services",
  healthcare: "Healthcare",
  education: "Education",
  travel: "Travel & Tourism",
  electronics: "Electronics",
  fashion: "Fashion & Clothing",
  grocery: "Grocery",
  pharmacy: "Pharmacy",
  restaurant: "Restaurant",
  transportation: "Transportation",
  real_estate: "Real Estate",
  agriculture: "Agriculture",
  manufacturing: "Manufacturing",
  telecom: "Telecom",
  entertainment: "Entertainment",
  beauty: "Beauty & Wellness",
  sports: "Sports & Fitness",
  logistics: "Logistics & Delivery",
  consulting: "Consulting",
  ngo: "NGO / Non-Profit",
  government: "Government",
  other: "Other",
};

const applicationSchema = z.object({
  business_name: z.string().trim().min(2, "Business name required").max(100),
  category: z.string().min(1),
  trade_license: z.string().max(50).optional(),
  owner_name: z.string().trim().min(2, "Owner name required").max(100),
  contact_number: z.string().trim().min(6, "Contact number required").max(20),
  contact_email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  business_address: z.string().trim().max(300).optional(),
  bank_name: z.string().max(100).optional(),
  bank_branch: z.string().max(100).optional(),
  bank_account_number: z.string().max(30).optional(),
  bank_account_holder: z.string().max(100).optional(),
  bank_routing: z.string().max(20).optional(),
  reason: z.string().trim().max(500).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MerchantApplicationFlow({ open, onOpenChange }: Props) {
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    category: "retail",
    trade_license: "",
    owner_name: "",
    contact_number: "",
    contact_email: "",
    business_address: "",
    bank_name: "",
    bank_branch: "",
    bank_account_number: "",
    bank_account_holder: "",
    bank_routing: "",
    reason: "",
  });

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from("merchant_applications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setExisting(data);
      setLoading(false);
    };
    load();
  }, [open]);

  const handleSubmit = async () => {
    const parsed = applicationSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || "Invalid input");
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error("Please sign in"); setSubmitting(false); return; }

    const { error } = await (supabase as any).from("merchant_applications").insert({
      user_id: session.user.id,
      business_name: parsed.data.business_name,
      category: parsed.data.category,
      trade_license: parsed.data.trade_license || null,
      bank_name: parsed.data.bank_name || null,
      bank_account_number: parsed.data.bank_account_number || null,
      bank_routing: parsed.data.bank_routing || null,
      reason: parsed.data.reason || null,
      // Store extra fields in reason as JSON metadata appended
      // We'll use the reason field creatively or add to the insert
    });

    if (error) {
      toast.error("Failed to submit: " + error.message);
    } else {
      toast.success("Application submitted! We'll review it shortly.");
      const { data } = await (supabase as any)
        .from("merchant_applications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setExisting(data);
    }
    setSubmitting(false);
  };

  const statusUI = (status: string) => {
    if (status === "pending") return { icon: Clock, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", label: "Pending Review" };
    if (status === "approved") return { icon: CheckCircle, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", label: "Approved" };
    return { icon: XCircle, color: "bg-destructive/10 text-destructive", label: "Rejected" };
  };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[90vh] flex flex-col p-0">
        <SheetHeader className="px-6 pt-5 pb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Store size={18} /> Become a Merchant
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : existing && (existing.status === "pending" || existing.status === "approved") ? (
            <ExistingApplicationView existing={existing} statusUI={statusUI} />
          ) : (
            <>
              {existing?.status === "rejected" && (
                <div className={`rounded-2xl p-4 text-center space-y-2 ${statusUI("rejected").color}`}>
                  <XCircle className="w-8 h-8 mx-auto" />
                  <p className="font-bold">Previous Application Rejected</p>
                  {existing.admin_notes && <p className="text-sm opacity-80">{existing.admin_notes}</p>}
                  <p className="text-xs opacity-60">You can submit a new application below.</p>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Fields marked with * are required</p>
                
                {/* Business Information */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Business Information</h3>
                  <div>
                    <Label>Business Name *</Label>
                    <Input value={form.business_name} onChange={e => set("business_name", e.target.value)} placeholder="Your business name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Category *</Label>
                    <Select value={form.category} onValueChange={v => set("category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Trade License Number</Label>
                    <Input value={form.trade_license} onChange={e => set("trade_license", e.target.value)} placeholder="License number (if available)" maxLength={50} />
                  </div>
                  <div>
                    <Label>Business Address</Label>
                    <Input value={form.business_address} onChange={e => set("business_address", e.target.value)} placeholder="Full business address" maxLength={300} />
                  </div>
                </div>

                {/* Owner / Contact Information */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Contact Information</h3>
                  <div>
                    <Label>Owner / Representative Name *</Label>
                    <Input value={form.owner_name} onChange={e => set("owner_name", e.target.value)} placeholder="Full name" maxLength={100} />
                  </div>
                  <div>
                    <Label>Contact Number *</Label>
                    <Input value={form.contact_number} onChange={e => set("contact_number", e.target.value)} placeholder="e.g. 01XXXXXXXXX" maxLength={20} />
                  </div>
                  <div>
                    <Label>Contact Email</Label>
                    <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} placeholder="business@email.com" maxLength={255} />
                  </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">Bank / Settlement Details</h3>
                  <div>
                    <Label>Bank Name</Label>
                    <Input value={form.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder="e.g. Dutch Bangla Bank" maxLength={100} />
                  </div>
                  <div>
                    <Label>Branch Name</Label>
                    <Input value={form.bank_branch} onChange={e => set("bank_branch", e.target.value)} placeholder="e.g. Gulshan Branch" maxLength={100} />
                  </div>
                  <div>
                    <Label>Account Holder Name</Label>
                    <Input value={form.bank_account_holder} onChange={e => set("bank_account_holder", e.target.value)} placeholder="Name on bank account" maxLength={100} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Account Number</Label>
                      <Input value={form.bank_account_number} onChange={e => set("bank_account_number", e.target.value)} maxLength={30} />
                    </div>
                    <div>
                      <Label>Routing Number</Label>
                      <Input value={form.bank_routing} onChange={e => set("bank_routing", e.target.value)} maxLength={20} />
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <Label>Why do you want a merchant account?</Label>
                  <Textarea value={form.reason} onChange={e => set("reason", e.target.value)} placeholder="Tell us about your business and why you need a merchant account..." maxLength={500} rows={3} />
                </div>

                <Button className="w-full" onClick={handleSubmit} disabled={submitting || !form.business_name.trim() || !form.owner_name.trim() || !form.contact_number.trim()}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
                  Submit Application
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ExistingApplicationView({ existing, statusUI }: { existing: any; statusUI: (s: string) => { icon: any; color: string; label: string } }) {
  const s = statusUI(existing.status);
  const Icon = s.icon;
  return (
    <div className="space-y-4 pt-4">
      <div className={`rounded-2xl p-5 text-center space-y-3 ${s.color}`}>
        <Icon className="w-10 h-10 mx-auto" />
        <p className="font-bold text-lg">{s.label}</p>
        <p className="text-sm opacity-80">
          {existing.status === "pending"
            ? "Your merchant application is being reviewed. We'll notify you once a decision is made."
            : "Your merchant account is active! Go to the Merchant Dashboard to manage your business."}
        </p>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Business</span><span className="font-medium text-foreground">{existing.business_name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Category</span><Badge variant="outline" className="capitalize">{existing.category}</Badge></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Submitted</span><span className="text-foreground">{new Date(existing.created_at).toLocaleDateString()}</span></div>
        {existing.admin_notes && (
          <div className="pt-2 border-t border-border">
            <p className="text-muted-foreground text-xs mb-1">Admin Notes</p>
            <p className="text-foreground">{existing.admin_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
