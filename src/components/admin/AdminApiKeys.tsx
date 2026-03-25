import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Copy, Eye, EyeOff, ShieldCheck, ShieldOff, Search, Plus } from "lucide-react";
import { format } from "date-fns";

interface ApiKey {
  id: string;
  merchant_id: string;
  api_key: string;
  secret_key: string;
  app_password: string | null;
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  merchant_name?: string;
}

interface Merchant {
  id: string;
  business_name: string;
}

interface AdminApiKeysProps {
  search: string;
}

export default function AdminApiKeys({ search }: AdminApiKeysProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newSecret, setNewSecret] = useState<{ secret: string; apiKey: string; appPassword: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("merchant_api_keys")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) { setKeys([]); setLoading(false); return; }

    const merchantIds = [...new Set(data.map(k => k.merchant_id))];
    const { data: mData } = await supabase
      .from("merchants")
      .select("id, business_name")
      .in("id", merchantIds);

    const nameMap = Object.fromEntries((mData ?? []).map(m => [m.id, m.business_name]));
    setKeys(data.map(k => ({ ...k, merchant_name: nameMap[k.merchant_id] || "Unknown" })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  useEffect(() => {
    const ch = supabase.channel("admin-api-keys-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_api_keys" }, () => fetchKeys())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchKeys]);

  const counts = {
    total: keys.length,
    active: keys.filter(k => k.is_active).length,
    revoked: keys.filter(k => !k.is_active).length,
  };

  const filtered = keys.filter(k => {
    if (!search) return true;
    const s = search.toLowerCase();
    return k.merchant_name?.toLowerCase().includes(s) || k.api_key.toLowerCase().includes(s);
  });

  const fetchMerchants = async () => {
    const { data } = await supabase.from("merchants").select("id, business_name").eq("status", "active").order("business_name");
    setMerchants(data ?? []);
  };

  const openGenerate = () => {
    fetchMerchants();
    setSelectedMerchant("");
    setWebhookUrl("");
    setNewSecret(null);
    setShowSecret(false);
    setGenerateOpen(true);
  };

  const handleGenerate = async () => {
    if (!selectedMerchant) { toast.error("Select a merchant"); return; }
    setGenerating(true);
    try {
      const apiKey = "epk_" + crypto.randomUUID().replace(/-/g, "");
      const secretKey = "eps_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const appPassword = "epp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

      const { error } = await supabase.from("merchant_api_keys").insert({
        merchant_id: selectedMerchant,
        api_key: apiKey,
        secret_key: secretKey,
        app_password: appPassword,
        webhook_url: webhookUrl || null,
        is_active: true,
      });
      if (error) throw error;

      setNewSecret({ secret: secretKey, apiKey, appPassword });
      toast.success("API key generated");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const toggleKey = async (id: string, active: boolean) => {
    setRevoking(id);
    await supabase.from("merchant_api_keys").update({ is_active: !active, updated_at: new Date().toISOString() }).eq("id", id);
    toast.success(active ? "Key revoked" : "Key reactivated");
    setRevoking(null);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const maskKey = (key: string) => key.slice(0, 8) + "•".repeat(12) + key.slice(-4);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Key className="w-8 h-8 text-primary" />
          <div><p className="text-2xl font-bold text-foreground">{counts.total}</p><p className="text-xs text-muted-foreground">Total Keys</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-500" />
          <div><p className="text-2xl font-bold text-foreground">{counts.active}</p><p className="text-xs text-muted-foreground">Active</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <ShieldOff className="w-8 h-8 text-destructive" />
          <div><p className="text-2xl font-bold text-foreground">{counts.revoked}</p><p className="text-xs text-muted-foreground">Revoked</p></div>
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
              <TableHead>Webhook</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No API keys found</TableCell></TableRow>
            ) : filtered.map(k => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.merchant_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{maskKey(k.api_key)}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyText(k.api_key, "API Key")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={k.is_active ? "default" : "destructive"}>
                    {k.is_active ? "Active" : "Revoked"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[150px] truncate text-xs font-mono">{k.webhook_url || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(k.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={k.is_active ? "destructive" : "outline"}
                    disabled={revoking === k.id}
                    onClick={() => toggleKey(k.id, k.is_active)}
                  >
                    {k.is_active ? "Revoke" : "Reactivate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Generate Key Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
            <DialogDescription>Create new API credentials for a merchant.</DialogDescription>
          </DialogHeader>

          {newSecret ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">⚠️ Copy these credentials now — secret is shown only once.</p>
              {[
                { label: "API Key", value: newSecret.apiKey },
                { label: "Secret Key", value: showSecret ? newSecret.secret : "•".repeat(40) },
                { label: "App Password", value: newSecret.appPassword },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 font-mono break-all border">{value}</code>
                    {label === "Secret Key" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSecret(!showSecret)}>
                        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyText(label === "Secret Key" ? newSecret.secret : value, label)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setGenerateOpen(false); setNewSecret(null); setShowSecret(false); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Merchant</label>
                <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                  <SelectTrigger><SelectValue placeholder="Select merchant..." /></SelectTrigger>
                  <SelectContent>
                    {merchants.map(m => <SelectItem key={m.id} value={m.id}>{m.business_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Webhook URL (optional)</label>
                <Input placeholder="https://..." value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancel</Button>
                <Button onClick={handleGenerate} disabled={generating || !selectedMerchant}>
                  <Key className="w-4 h-4 mr-1" /> Generate
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Expose openGenerate to parent */}
      <GenerateKeyTrigger onOpen={openGenerate} />
    </div>
  );
}

// Hidden component that exposes openGenerate via ref pattern
function GenerateKeyTrigger({ onOpen }: { onOpen: () => void }) {
  React.useEffect(() => {
    (window as any).__openGenerateApiKey = onOpen;
    return () => { delete (window as any).__openGenerateApiKey; };
  }, [onOpen]);
  return null;
}
