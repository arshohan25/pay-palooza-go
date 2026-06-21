import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Store, Clock, CheckCircle, XCircle, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useMerchantCategories } from "@/hooks/use-merchant-categories";
import { useI18n, type TranslationKey } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MerchantApplicationFlow({ open, onOpenChange }: Props) {
  const { t, lang } = useI18n();
  const { categories, loading: catsLoading, getLabelForName } = useMerchantCategories();
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [customCategory, setCustomCategory] = useState("");
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

  const applicationSchema = useMemo(() => z.object({
    business_name: z.string().trim().min(2, t("mafErrBusinessName")).max(100),
    category: z.string().min(1, t("mafErrCategory")),
    trade_license: z.string().max(50).optional(),
    owner_name: z.string().trim().min(2, t("mafErrOwnerName")).max(100),
    contact_number: z.string().trim().min(6, t("mafErrContactNumber")).max(20),
    contact_email: z.string().email(t("mafErrEmail")).max(255).optional().or(z.literal("")),
    business_address: z.string().trim().max(300).optional(),
    bank_name: z.string().max(100).optional(),
    bank_branch: z.string().max(100).optional(),
    bank_account_number: z.string().max(30).optional(),
    bank_account_holder: z.string().max(100).optional(),
    bank_routing: z.string().max(20).optional(),
    reason: z.string().trim().max(500).optional(),
  }), [t]);

  const filteredCats = useMemo(() => {
    if (!catSearch) return categories;
    const q = catSearch.toLowerCase();
    return categories.filter(c => c.label.toLowerCase().includes(q) || c.name.includes(q));
  }, [categories, catSearch]);

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
    const finalCategory = form.category === "__other__" ? customCategory.trim() : form.category;
    const parsed = applicationSchema.safeParse({ ...form, category: finalCategory });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || t("mafToastInvalid"));
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { toast.error(t("mafToastSignIn")); setSubmitting(false); return; }

    const { error } = await (supabase as any).from("merchant_applications").insert({
      user_id: session.user.id,
      business_name: parsed.data.business_name,
      category: parsed.data.category,
      trade_license: parsed.data.trade_license || null,
      owner_name: parsed.data.owner_name || null,
      contact_number: parsed.data.contact_number || null,
      contact_email: parsed.data.contact_email || null,
      business_address: parsed.data.business_address || null,
      bank_name: parsed.data.bank_name || null,
      bank_branch: parsed.data.bank_branch || null,
      bank_account_holder: parsed.data.bank_account_holder || null,
      bank_account_number: parsed.data.bank_account_number || null,
      bank_routing: parsed.data.bank_routing || null,
      reason: parsed.data.reason || null,
    });

    if (error) {
      toast.error(t("mafToastFailed") + error.message);
    } else {
      toast.success(t("mafToastSuccess"));
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

  const statusUI = (status: string): { icon: any; color: string; label: string } => {
    if (status === "pending") return { icon: Clock, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", label: t("mafStatusPending") };
    if (status === "approved") return { icon: CheckCircle, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", label: t("mafStatusApproved") };
    return { icon: XCircle, color: "bg-destructive/10 text-destructive", label: t("mafStatusRejected") };
  };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const selectedLabel = form.category === "__other__"
    ? (customCategory || t("mafOtherCustom"))
    : getLabelForName(form.category);

  const dateLocale = lang === "bn" ? "bn-BD" : "en-US";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[90vh] flex flex-col p-0">
        <SheetHeader className="px-6 pt-5 pb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Store size={18} /> {t("mafTitle")}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-5">
          {loading || catsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : existing && (existing.status === "pending" || existing.status === "approved") ? (
            <ExistingApplicationView existing={existing} statusUI={statusUI} getLabelForName={getLabelForName} dateLocale={dateLocale} />
          ) : (
            <>
              {existing?.status === "rejected" && (
                <div className={`rounded-2xl p-4 text-center space-y-2 ${statusUI("rejected").color}`}>
                  <XCircle className="w-8 h-8 mx-auto" />
                  <p className="font-bold">{t("mafPrevRejected")}</p>
                  {existing.admin_notes && <p className="text-sm opacity-80">{existing.admin_notes}</p>}
                  <p className="text-xs opacity-60">{t("mafCanResubmit")}</p>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{t("mafRequiredNote")}</p>

                {/* Business Information */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">{t("mafBusinessInfo")}</h3>
                  <div>
                    <Label>{t("mafBusinessName")}</Label>
                    <Input value={form.business_name} onChange={e => set("business_name", e.target.value)} placeholder={t("mafBusinessNamePh")} maxLength={100} />
                  </div>
                  <div>
                    <Label>{t("mafCategory")}</Label>
                    <Popover open={catOpen} onOpenChange={setCatOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={catOpen} className="w-full justify-between font-normal">
                          {selectedLabel}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder={t("mafSearchCategories")} value={catSearch} onValueChange={setCatSearch} />
                          <CommandList>
                            <CommandEmpty>{t("mafNoCategory")}</CommandEmpty>
                            <CommandGroup className="max-h-[200px] overflow-y-auto">
                              {filteredCats.map(c => (
                                <CommandItem
                                  key={c.name}
                                  value={c.name}
                                  onSelect={() => { set("category", c.name); setCustomCategory(""); setCatOpen(false); setCatSearch(""); }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", form.category === c.name ? "opacity-100" : "opacity-0")} />
                                  {c.label}
                                </CommandItem>
                              ))}
                              <CommandItem
                                value="__other__"
                                onSelect={() => { set("category", "__other__"); setCatOpen(false); setCatSearch(""); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", form.category === "__other__" ? "opacity-100" : "opacity-0")} />
                                {t("mafOtherType")}
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {form.category === "__other__" && (
                      <Input className="mt-2" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder={t("mafEnterCategory")} maxLength={100} />
                    )}
                  </div>
                  <div>
                    <Label>{t("mafTradeLicense")}</Label>
                    <Input value={form.trade_license} onChange={e => set("trade_license", e.target.value)} placeholder={t("mafTradeLicensePh")} maxLength={50} />
                  </div>
                  <div>
                    <Label>{t("mafBusinessAddress")}</Label>
                    <Input value={form.business_address} onChange={e => set("business_address", e.target.value)} placeholder={t("mafBusinessAddressPh")} maxLength={300} />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">{t("mafContactInfo")}</h3>
                  <div>
                    <Label>{t("mafOwnerName")}</Label>
                    <Input value={form.owner_name} onChange={e => set("owner_name", e.target.value)} placeholder={t("mafOwnerNamePh")} maxLength={100} />
                  </div>
                  <div>
                    <Label>{t("mafContactNumber")}</Label>
                    <Input value={form.contact_number} onChange={e => set("contact_number", e.target.value)} placeholder={t("mafContactNumberPh")} maxLength={20} />
                  </div>
                  <div>
                    <Label>{t("mafContactEmail")}</Label>
                    <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} placeholder={t("mafContactEmailPh")} maxLength={255} />
                  </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1">{t("mafBankDetails")}</h3>
                  <div>
                    <Label>{t("mafBankName")}</Label>
                    <Input value={form.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder={t("mafBankNamePh")} maxLength={100} />
                  </div>
                  <div>
                    <Label>{t("mafBranchName")}</Label>
                    <Input value={form.bank_branch} onChange={e => set("bank_branch", e.target.value)} placeholder={t("mafBranchNamePh")} maxLength={100} />
                  </div>
                  <div>
                    <Label>{t("mafAccountHolder")}</Label>
                    <Input value={form.bank_account_holder} onChange={e => set("bank_account_holder", e.target.value)} placeholder={t("mafAccountHolderPh")} maxLength={100} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{t("mafAccountNumber")}</Label>
                      <Input value={form.bank_account_number} onChange={e => set("bank_account_number", e.target.value)} maxLength={30} />
                    </div>
                    <div>
                      <Label>{t("mafRoutingNumber")}</Label>
                      <Input value={form.bank_routing} onChange={e => set("bank_routing", e.target.value)} maxLength={20} />
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <Label>{t("mafReason")}</Label>
                  <Textarea value={form.reason} onChange={e => set("reason", e.target.value)} placeholder={t("mafReasonPh")} maxLength={500} rows={3} />
                </div>

                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting || !form.business_name.trim() || !form.owner_name.trim() || !form.contact_number.trim() || (form.category === "__other__" && !customCategory.trim())}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
                  {t("mafSubmit")}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ExistingApplicationView({ existing, statusUI, getLabelForName, dateLocale }: { existing: any; statusUI: (s: string) => { icon: any; color: string; label: string }; getLabelForName: (n: string) => string; dateLocale: string }) {
  const { t } = useI18n();
  const s = statusUI(existing.status);
  const Icon = s.icon;
  return (
    <div className="space-y-4 pt-4">
      <div className={`rounded-2xl p-5 text-center space-y-3 ${s.color}`}>
        <Icon className="w-10 h-10 mx-auto" />
        <p className="font-bold text-lg">{s.label}</p>
        <p className="text-sm opacity-80">
          {existing.status === "pending" ? t("mafPendingDesc") : t("mafApprovedDesc")}
        </p>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">{t("mafFieldBusiness")}</span><span className="font-medium text-foreground">{existing.business_name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{t("mafFieldCategory")}</span><Badge variant="outline">{getLabelForName(existing.category)}</Badge></div>
        {existing.owner_name && <div className="flex justify-between"><span className="text-muted-foreground">{t("mafFieldOwner")}</span><span className="text-foreground">{existing.owner_name}</span></div>}
        {existing.contact_number && <div className="flex justify-between"><span className="text-muted-foreground">{t("mafFieldContact")}</span><span className="text-foreground">{existing.contact_number}</span></div>}
        <div className="flex justify-between"><span className="text-muted-foreground">{t("mafFieldSubmitted")}</span><span className="text-foreground">{new Date(existing.created_at).toLocaleDateString(dateLocale)}</span></div>
        {existing.admin_notes && (
          <div className="pt-2 border-t border-border">
            <p className="text-muted-foreground text-xs mb-1">{t("mafAdminNotes")}</p>
            <p className="text-foreground">{existing.admin_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
