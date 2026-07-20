import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { haptics } from "@/lib/haptics";
import { useI18n } from "@/lib/i18n";

interface AgentRow {
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  shop_name: string | null;
  address: string | null;
}

const AvailabilityCard = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [row, setRow] = useState<AgentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const timeAgo = (iso: string | null) => {
    if (!iso) return t("avNever");
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return t("avSecAgo").replace("{n}", String(s));
    if (s < 3600) return t("avMinAgo").replace("{n}", String(Math.floor(s / 60)));
    if (s < 86400) return t("avHourAgo").replace("{n}", String(Math.floor(s / 3600)));
    return t("avDayAgo").replace("{n}", String(Math.floor(s / 86400)));
  };

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from("agents")
      .select("is_available, latitude, longitude, location_updated_at, shop_name, address")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setRow(data as AgentRow);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (next: boolean) => {
    if (!user?.id) return;
    if (next && (!row?.latitude || !row?.longitude)) {
      toast.error(t("avSetLocFirst"));
      return;
    }
    haptics.light();
    setSaving(true);
    const { error } = await (supabase as any).from("agents")
      .update({ is_available: next }).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(t("avCantUpdate")); return; }
    setRow(r => r ? { ...r, is_available: next } : r);
    toast.success(next ? t("avOnline") : t("avOffline"));
  };

  const captureLocation = () => {
    if (!navigator.geolocation) { toast.error(t("avGeoUnsupported")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!user?.id) { setLocating(false); return; }
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const { error } = await (supabase as any).from("agents").update({
          latitude: lat, longitude: lng, location_updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
        setLocating(false);
        if (error) { toast.error(t("avCantSaveLoc")); return; }
        setRow(r => r ? { ...r, latitude: lat, longitude: lng, location_updated_at: new Date().toISOString() } : r);
        toast.success(t("avLocSaved"));
      },
      (err) => { setLocating(false); toast.error(err.message || t("avLocDenied")); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const online = !!row?.is_available;
  const hasLoc = !!(row?.latitude && row?.longitude);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-3xl shadow-card border border-border/60 p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center ${online ? "bg-emerald-500/15" : "bg-muted"}`}>
            <Radio size={18} className={online ? "text-emerald-500" : "text-muted-foreground"} />
            {online && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {online ? t("avOpen") : t("avClosed")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {online ? t("avVisibleMap") : t("avNotShown")}
            </p>
          </div>
        </div>
        <Switch checked={online} disabled={saving} onCheckedChange={toggle} />
      </div>

      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">{t("avShopLocation")}</p>
          <p className="text-[12px] text-foreground truncate">
            {hasLoc ? `${row!.latitude!.toFixed(4)}, ${row!.longitude!.toFixed(4)}` : t("avNotSet")}
          </p>
          {hasLoc && (
            <p className="text-[10px] text-muted-foreground">{t("avUpdatedAt").replace("{when}", timeAgo(row?.location_updated_at ?? null))}</p>
          )}
        </div>
        <Button
          size="sm" variant="outline" onClick={captureLocation} disabled={locating}
          className="rounded-xl shrink-0"
        >
          {locating ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <MapPin size={14} className="mr-1.5" />}
          {hasLoc ? t("avUpdate") : t("avSet")}
        </Button>
      </div>
    </motion.div>
  );
};

export default AvailabilityCard;
