import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Globe, Shield, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Props { search: string; }

export default function AdminApiIpWhitelist({ search }: Props) {
  const [entries, setEntries] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newIp, setNewIp] = useState({ merchant_id: "", ip_address: "", label: "" });
  const [adding, setAdding] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: ipData }, { data: keyData }, { data: merchantData }] = await Promise.all([
      (supabase as any).from("merchant_ip_whitelist").select("*").order("created_at", { ascending: false }),
      supabase.from("merchant_api_keys").select("id, merchant_id, ip_whitelist_enabled, api_key").order("created_at", { ascending: false }),
      supabase.from("merchants").select("id, business_name"),
    ]);

    const nameMap = Object.fromEntries((merchantData ?? []).map(m => [m.id, m.business_name]));
    setEntries((ipData || []).map((e: any) => ({ ...e, merchant_name: nameMap[e.merchant_id] || "Unknown" })));
    setApiKeys((keyData || []).map((k: any) => ({ ...k, merchant_name: nameMap[k.merchant_id] || "Unknown" })));
    setMerchants(merchantData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAdd = async () => {
    if (!newIp.merchant_id || !newIp.ip_address) { toast.error("Merchant and IP required"); return; }
    setAdding(true);
    const { error } = await (supabase as any).from("merchant_ip_whitelist").insert({
      merchant_id: newIp.merchant_id,
      ip_address: newIp.ip_address.trim(),
      label: newIp.label.trim() || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("IP added"); setNewIp({ merchant_id: "", ip_address: "", label: "" }); setDialogOpen(false); fetchAll(); }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("merchant_ip_whitelist").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else { toast.success("IP removed"); fetchAll(); }
  };

  const toggleWhitelist = async (keyId: string, enabled: boolean) => {
    const { error } = await (supabase as any).from("merchant_api_keys").update({ ip_whitelist_enabled: enabled }).eq("id", keyId);
    if (error) toast.error("Update failed");
    else { toast.success(enabled ? "Whitelist enabled" : "Whitelist disabled"); fetchAll(); }
  };

  const filtered = entries.filter(e => {
    if (!search) return true;
    return e.merchant_name?.toLowerCase().includes(search.toLowerCase()) || e.ip_address?.includes(search) || e.label?.toLowerCase().includes(search.toLowerCase());
  });

  const totalIps = entries.length;
  const enabledKeys = apiKeys.filter(k => k.ip_whitelist_enabled).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Globe className="w-7 h-7 text-primary" />
          <div><p className="text-xl font-bold text-foreground">{totalIps}</p><p className="text-xs text-muted-foreground">Whitelisted IPs</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-7 h-7 text-emerald-500" />
          <div><p className="text-xl font-bold text-foreground">{enabledKeys}</p><p className="text-xs text-muted-foreground">Keys with Whitelist</p></div>
        </CardContent></Card>
      </div>

      {/* Add IP */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Add IP</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add IP to Whitelist</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Merchant</Label>
                <Select value={newIp.merchant_id} onValueChange={v => setNewIp(p => ({ ...p, merchant_id: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select merchant" /></SelectTrigger>
                  <SelectContent>{merchants.map(m => <SelectItem key={m.id} value={m.id}>{m.business_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">IP Address</Label>
                <Input placeholder="e.g. 203.0.113.50" value={newIp.ip_address} onChange={e => setNewIp(p => ({ ...p, ip_address: e.target.value }))} className="h-9 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Label (optional)</Label>
                <Input placeholder="e.g. Production Server" value={newIp.label} onChange={e => setNewIp(p => ({ ...p, label: e.target.value }))} className="h-9 text-xs" />
              </div>
              <Button onClick={handleAdd} disabled={adding} className="w-full">{adding ? "Adding..." : "Add IP"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Whitelist Toggle per Key */}
      {apiKeys.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Whitelist Enforcement per API Key</p>
            {apiKeys.map(k => (
              <div key={k.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{k.merchant_name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{k.api_key?.slice(0, 16)}...</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{k.ip_whitelist_enabled ? "Enabled" : "Disabled"}</span>
                  <Switch checked={!!k.ip_whitelist_enabled} onCheckedChange={v => toggleWhitelist(k.id, v)} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* IP Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No IPs whitelisted</TableCell></TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.merchant_name}</TableCell>
                <TableCell className="font-mono text-xs">{e.ip_address}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.label || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(e.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
