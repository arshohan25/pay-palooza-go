import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ticket, Plus, Percent, CalendarClock, Trash2, DollarSign, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface Props {
  merchantId: string;
}

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export default function MerchantCouponsTab({ merchantId }: Props) {
  const { t, lang } = useI18n();
  const fmt = (n: number) => n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });

    if (!error && data) setCoupons(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
    const channel = supabase
      .channel("merchant_coupons_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons", filter: `merchant_id=eq.${merchantId}` }, () => fetchCoupons())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [merchantId]);

  const resetForm = () => {
    setCode(""); setDescription(""); setDiscountType("percent");
    setDiscountValue(""); setMaxDiscount(""); setMinOrder("");
    setUsageLimit(""); setExpiryDate(undefined);
  };

  const handleCreate = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode || trimmedCode.length < 3) { toast.error(t("mctErrCodeMin")); return; }
    if (trimmedCode.length > 20) { toast.error(t("mctErrCodeMax")); return; }
    const val = parseFloat(discountValue);
    if (!val || val <= 0) { toast.error(t("mctErrValueInvalid")); return; }
    if (discountType === "percent" && val > 100) { toast.error(t("mctErrPctOver100")); return; }

    setSubmitting(true);
    const { error } = await supabase.from("coupons").insert({
      code: trimmedCode,
      description: description.trim() || null,
      discount_type: discountType === "percent" ? "percentage" : "flat",
      discount_value: val,
      max_discount: discountType === "percent" && maxDiscount ? parseFloat(maxDiscount) : null,
      min_order_amount: minOrder ? parseFloat(minOrder) : null,
      usage_limit: usageLimit ? parseInt(usageLimit) : null,
      expires_at: expiryDate ? expiryDate.toISOString() : null,
      merchant_id: merchantId,
      is_active: true,
    });
    setSubmitting(false);

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast.error(t("mctErrDuplicate"));
      } else {
        toast.error(t("mctErrCreate"));
      }
      return;
    }
    toast.success(t("mctCreated"));
    resetForm();
    setShowCreate(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(t("mctErrUpdate")); else toast.success(current ? t("mctDisabled") : t("mctEnabled"));
  };

  const deleteCoupon = async (id: string, couponCode: string) => {
    if (!confirm(t("mctConfirmDelete").replace("{code}", couponCode))) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) toast.error(t("mctErrDelete")); else toast.success(t("mctDeleted"));
  };

  const activeCoupons = coupons.filter(c => c.is_active);
  const totalUsed = coupons.reduce((s, c) => s + c.used_count, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
        {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Ticket size={18} className="text-primary" /> {t("mctTitle")}
        </h3>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowCreate(true)}>
          <Plus size={13} className="mr-1" /> {t("mctCreateCoupon")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-foreground">{fmt(coupons.length)}</p><p className="text-[10px] text-muted-foreground">{t("mctTotal")}</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-emerald-600">{fmt(activeCoupons.length)}</p><p className="text-[10px] text-muted-foreground">{t("mctActive")}</p></CardContent></Card>
        <Card className="border-0 shadow-elevated"><CardContent className="p-3 text-center"><p className="text-lg font-bold text-primary">{fmt(totalUsed)}</p><p className="text-[10px] text-muted-foreground">{t("mctUsed")}</p></CardContent></Card>
      </div>

      {/* Coupon List */}
      {coupons.length === 0 ? (
        <Card className="border-0 shadow-elevated">
          <CardContent className="p-8 text-center">
            <Tag size={32} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">{t("mctNoCoupons")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("mctNoCouponsDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {coupons.map(c => {
            const usagePct = c.usage_limit ? Math.min((c.used_count / c.usage_limit) * 100, 100) : 0;
            const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
            return (
              <Card key={c.id} className="border-0 shadow-elevated">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{c.code}</code>
                        <Badge variant="outline" className="text-[9px]">
                          {c.discount_type === "percentage"
                            ? <><Percent size={10} className="mr-0.5" />{t("mctPercentOff").replace("{n}", fmt(c.discount_value))}</>
                            : <>{t("mctFlatOff").replace("{n}", fmt(c.discount_value))}</>}
                        </Badge>
                        {isExpired && <Badge variant="destructive" className="text-[9px]">{t("mctExpired")}</Badge>}
                      </div>
                      {c.description && <p className="text-[10px] text-muted-foreground truncate">{c.description}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {c.min_order_amount ? t("mctMinN").replace("{n}", fmt(c.min_order_amount)) : t("mctNoMinimum")}
                        {c.max_discount ? ` · ${t("mctMaxN").replace("{n}", fmt(c.max_discount))}` : ""}
                        {c.usage_limit
                          ? ` · ${t("mctUsedFraction").replace("{used}", fmt(c.used_count)).replace("{limit}", fmt(c.usage_limit))}`
                          : ` · ${t("mctUsedN").replace("{n}", fmt(c.used_count))}`}
                      </p>
                      {c.usage_limit && (
                        <Progress value={usagePct} className="h-1.5" />
                      )}
                      {c.expires_at && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarClock size={10} /> {t("mctExpiresOn").replace("{date}", format(new Date(c.expires_at), "MMM d, yyyy"))}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 ml-3">
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
                      <button onClick={() => deleteCoupon(c.id, c.code)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Coupon Sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto z-[80]" overlayClassName="z-[80]">
          <SheetHeader>
            <SheetTitle className="text-base">{t("mctCreateCoupon")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-xs">{t("mctCouponCode")}</Label>
              <Input placeholder={t("mctCodePlaceholder")} value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={20} className="mt-1 uppercase" />
            </div>

            <div>
              <Label className="text-xs">{t("mctDescOptional")}</Label>
              <Input placeholder={t("mctDescPlaceholder")} value={description} onChange={e => setDescription(e.target.value)} maxLength={200} className="mt-1" />
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">{t("mctDiscountType")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant={discountType === "percent" ? "default" : "outline"} onClick={() => setDiscountType("percent")} className="h-9 text-xs">
                  <Percent size={13} className="mr-1" /> {t("mctPercentage")}
                </Button>
                <Button type="button" size="sm" variant={discountType === "flat" ? "default" : "outline"} onClick={() => setDiscountType("flat")} className="h-9 text-xs">
                  <DollarSign size={13} className="mr-1" /> {t("mctFlatAmount")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{discountType === "percent" ? t("mctDiscountPct") : t("mctDiscountFlat")}</Label>
                <Input type="number" placeholder={discountType === "percent" ? "20" : "100"} value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="mt-1" min="0" />
              </div>
              {discountType === "percent" && (
                <div>
                  <Label className="text-xs">{t("mctMaxDiscount")}</Label>
                  <Input type="number" placeholder="200" value={maxDiscount} onChange={e => setMaxDiscount(e.target.value)} className="mt-1" min="0" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("mctMinOrder")}</Label>
                <Input type="number" placeholder="500" value={minOrder} onChange={e => setMinOrder(e.target.value)} className="mt-1" min="0" />
              </div>
              <div>
                <Label className="text-xs">{t("mctUsageLimit")}</Label>
                <Input type="number" placeholder="50" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} className="mt-1" min="1" />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1.5 block">{t("mctExpiryDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 text-xs", !expiryDate && "text-muted-foreground")}>
                    <CalendarClock size={14} className="mr-2" />
                    {expiryDate ? format(expiryDate, "PPP") : t("mctNoExpiry")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[90]" align="start">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={setExpiryDate}
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={submitting}>
              {submitting ? t("mctCreating") : t("mctCreateCoupon")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
