import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CustomPreset {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
  created_at: string;
}

export function usePermissionPresets(merchantId: string | undefined) {
  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = useCallback(async () => {
    if (!merchantId) { setPresets([]); setLoading(false); return; }
    const { data } = await supabase
      .from("merchant_permission_presets" as any)
      .select("id,name,permissions,created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: true });
    setPresets((data as any) || []);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => {
    fetchPresets();
    if (!merchantId) return;
    const ch = supabase
      .channel(`mpp_${merchantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_permission_presets", filter: `merchant_id=eq.${merchantId}` },
        () => fetchPresets()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId, fetchPresets]);

  const save = async (name: string, permissions: Record<string, boolean>) => {
    if (!merchantId) return { error: "No merchant" } as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in" } as any;
    const cleaned: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(permissions)) if (v) cleaned[k] = true;
    return await supabase
      .from("merchant_permission_presets" as any)
      .insert({ merchant_id: merchantId, name: name.trim(), permissions: cleaned, created_by: user.id });
  };

  const update = async (id: string, patch: { name?: string; permissions?: Record<string, boolean> }) => {
    return await supabase.from("merchant_permission_presets" as any).update(patch as any).eq("id", id);
  };

  const remove = async (id: string) => {
    return await supabase.from("merchant_permission_presets" as any).delete().eq("id", id);
  };

  return { presets, loading, save, update, remove, refresh: fetchPresets };
}
