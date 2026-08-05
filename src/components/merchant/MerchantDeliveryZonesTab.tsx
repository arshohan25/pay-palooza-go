import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Truck, Plus, Trash2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import MerchantCourierRoutingCard from "@/components/merchant/MerchantCourierRoutingCard";

interface Zone {
  id: string;
  zone_name: string;
  districts: string[];
  delivery_fee: number;
  free_shipping_threshold: number | null;
  estimated_days: string | null;
  is_active: boolean;
}

const emptyForm = {
  zone_name: "",
  districts: [] as string[],
  delivery_fee: "",
  free_shipping_threshold: "",
  estimated_days: "",
};

export default function MerchantDeliveryZonesTab({ merchantId }: { merchantId: string }) {
  const { t } = useI18n();
  const [zones, setZones] = useState<Zone[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("merchant_delivery_zones")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("delivery_fee", { ascending: true });
    setZones((data as Zone[]) ?? []);
  }, [merchantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("wallet_route_codes")
        .select("district")
        .eq("is_active", true)
        .order("district", { ascending: true });
      const names = Array.from(new Set(((data as { district: string }[]) ?? []).map((r) => r.district)));
      setDistricts(names);
    })();
  }, []);

  const filtered = useMemo(
    () => districts.filter((d) => d.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 60),
    [districts, search],
  );

  const toggleDistrict = (d: string) =>
    setForm((f) => ({
      ...f,
      districts: f.districts.includes(d) ? f.districts.filter((x) => x !== d) : [...f.districts, d],
    }));

  const save = async () => {
    if (!form.zone_name.trim() || form.districts.length === 0) {
      toast.error(t("mdzNeedNameDistricts"));
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("merchant_delivery_zones").insert({
      merchant_id: merchantId,
      zone_name: form.zone_name.trim(),
      districts: form.districts,
      delivery_fee: Number(form.delivery_fee) || 0,
      free_shipping_threshold: form.free_shipping_threshold ? Number(form.free_shipping_threshold) : null,
      estimated_days: form.estimated_days.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("mdzSaved"));
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const toggleActive = async (z: Zone) => {
    await (supabase as any)
      .from("merchant_delivery_zones")
      .update({ is_active: !z.is_active })
      .eq("id", z.id);
    load();
  };

  const remove = async (z: Zone) => {
    await (supabase as any).from("merchant_delivery_zones").delete().eq("id", z.id);
    toast.success(t("mdzDeleted"));
    load();
  };

  return (
    <div className="space-y-3">
      <MerchantCourierRoutingCard merchantId={merchantId} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{t("mdzTitle")}</p>
            <p className="text-[11px] text-muted-foreground">{t("mdzSubtitle")}</p>
          </div>
        </div>
        <Button size="sm" className="h-8 rounded-full gap-1 text-[11px] font-bold"
          onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X size={13} /> : <Plus size={13} />} {t("mdzNewZone")}
        </Button>
      </div>

      {showForm && (
        <Card className="p-3 space-y-3 border-0 shadow-card rounded-2xl">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">{t("mdzZoneName")}</label>
            <Input value={form.zone_name} placeholder={t("mdzZoneNamePh")}
              onChange={(e) => setForm((f) => ({ ...f, zone_name: e.target.value }))}
              className="mt-1.5 rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">{t("mdzFee")}</label>
              <Input type="number" inputMode="numeric" value={form.delivery_fee}
                onChange={(e) => setForm((f) => ({ ...f, delivery_fee: e.target.value }))}
                placeholder="60" className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">{t("mdzFreeAbove")}</label>
              <Input type="number" inputMode="numeric" value={form.free_shipping_threshold}
                onChange={(e) => setForm((f) => ({ ...f, free_shipping_threshold: e.target.value }))}
                placeholder="1000" className="mt-1.5 rounded-xl" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">{t("mdzEta")}</label>
            <Input value={form.estimated_days} placeholder={t("mdzEtaPh")}
              onChange={(e) => setForm((f) => ({ ...f, estimated_days: e.target.value }))}
              className="mt-1.5 rounded-xl" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <MapPin size={11} /> {t("mdzDistricts")} ({form.districts.length})
            </label>
            <div className="relative mt-1.5">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("mdzSearchDistrict")} className="pl-8 rounded-xl" />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 max-h-44 overflow-y-auto scrollbar-hide">
              {filtered.map((d) => {
                const on = form.districts.includes(d);
                return (
                  <button key={d} type="button" onClick={() => toggleDistrict(d)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-foreground border-border/50"
                    }`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <Button className="w-full rounded-xl font-bold" disabled={saving} onClick={save}>
            {t("mdzSave")}
          </Button>
        </Card>
      )}

      {zones.length === 0 && !showForm && (
        <Card className="p-4 border-0 shadow-card rounded-2xl">
          <p className="text-[12px] text-muted-foreground text-center">{t("mdzEmpty")}</p>
        </Card>
      )}

      {zones.map((z) => (
        <Card key={z.id} className="p-3 border-0 shadow-card rounded-2xl">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold text-foreground truncate">{z.zone_name}</p>
                {!z.is_active && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {t("mdzInactive")}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{z.districts.join(", ")}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-foreground">৳{Math.round(z.delivery_fee)}</span>
                {z.free_shipping_threshold != null && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                    {t("mdzFreeAboveTag").replace("{n}", String(Math.round(z.free_shipping_threshold)))}
                  </span>
                )}
                {z.estimated_days && (
                  <span className="text-[10px] text-muted-foreground">{z.estimated_days}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={z.is_active} onCheckedChange={() => toggleActive(z)} />
              <button onClick={() => remove(z)} className="p-1.5 rounded-lg bg-destructive/10">
                <Trash2 size={13} className="text-destructive" />
              </button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
