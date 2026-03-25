import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gauge, Key, Shield } from "lucide-react";

interface Props { search: string; }

const RATE_OPTIONS = [
  { value: "10", label: "10/min" },
  { value: "30", label: "30/min" },
  { value: "60", label: "60/min" },
  { value: "120", label: "120/min" },
  { value: "300", label: "300/min" },
  { value: "600", label: "600/min" },
  { value: "0", label: "Unlimited" },
];

export default function AdminApiRateLimits({ search }: Props) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data: keyData } = await supabase.from("merchant_api_keys").select("*").order("created_at", { ascending: false });
    if (!keyData) { setKeys([]); setLoading(false); return; }

    const merchantIds = [...new Set(keyData.map((k: any) => k.merchant_id))];
    const { data: merchants } = await supabase.from("merchants").select("id, business_name").in("id", merchantIds);
    const nameMap = Object.fromEntries((merchants ?? []).map(m => [m.id, m.business_name]));

    setKeys(keyData.map((k: any) => ({ ...k, merchant_name: nameMap[k.merchant_id] || "Unknown" })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleRateChange = async (keyId: string, value: string) => {
    setUpdating(keyId);
    const limit = parseInt(value);
    const { error } = await (supabase as any).from("merchant_api_keys").update({ rate_limit_per_minute: limit }).eq("id", keyId);
    if (error) toast.error("Failed to update rate limit");
    else { toast.success("Rate limit updated"); fetchKeys(); }
    setUpdating(null);
  };

  const filtered = keys.filter(k => {
    if (!search) return true;
    return k.merchant_name?.toLowerCase().includes(search.toLowerCase()) || k.api_key?.includes(search);
  });

  const totalKeys = keys.length;
  const customLimits = keys.filter(k => k.rate_limit_per_minute && k.rate_limit_per_minute !== 60).length;
  const activeKeys = keys.filter(k => k.is_active).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Key className="w-7 h-7 text-primary" />
          <div><p className="text-xl font-bold text-foreground">{totalKeys}</p><p className="text-xs text-muted-foreground">Total Keys</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Gauge className="w-7 h-7 text-amber-500" />
          <div><p className="text-xl font-bold text-foreground">{customLimits}</p><p className="text-xs text-muted-foreground">Custom Limits</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-7 h-7 text-emerald-500" />
          <div><p className="text-xl font-bold text-foreground">{activeKeys}</p><p className="text-xs text-muted-foreground">Active Keys</p></div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>API Key</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rate Limit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No API keys found</TableCell></TableRow>
            ) : filtered.map(k => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.merchant_name}</TableCell>
                <TableCell className="text-xs font-mono">{k.api_key?.slice(0, 16)}...</TableCell>
                <TableCell><Badge variant={k.is_active ? "default" : "secondary"}>{k.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>
                  <Select
                    value={String(k.rate_limit_per_minute || 60)}
                    onValueChange={(v) => handleRateChange(k.id, v)}
                    disabled={updating === k.id}
                  >
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RATE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
