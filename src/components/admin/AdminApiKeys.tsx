import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Copy, Eye, EyeOff, ShieldCheck, ShieldOff, RefreshCw, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const ALL_PERMISSIONS = [
  { value: "create_session", label: "Create Session" },
  { value: "check_status", label: "Check Status" },
  { value: "list_sessions", label: "List Sessions" },
  { value: "refund", label: "Refund" },
];

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
  environment?: string;
  permissions?: string[];
  rotation_expires_at?: string | null;
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
  const [newEnv, setNewEnv] = useState<"live" | "test">("live");
  const [newPermissions, setNewPermissions] = useState<string[]>(["create_session", "check_status", "list_sessions"]);
  const [permEditOpen, setPermEditOpen] = useState(false);
  const [permEditKey, setPermEditKey] = useState<ApiKey | null>(null);
  const [permEditPerms, setPermEditPerms] = useState<string[]>([]);
  const [rotating, setRotating] = useState<string | null>(null);

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
    setNewEnv("live");
    setNewPermissions(["create_session", "check_status", "list_sessions"]);
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
        environment: newEnv,
        permissions: newPermissions,
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

  const handleRotate = async (key: ApiKey) => {
    setRotating(key.id);
    try {
      const newApiKey = "epk_" + crypto.randomUUID().replace(/-/g, "");
      const newSecretKey = "eps_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const newAppPassword = "epp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

      // Set 24h grace period on old key and deactivate
      const graceExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("merchant_api_keys").update({
        is_active: false,
        rotation_expires_at: graceExpiry,
        updated_at: new Date().toISOString(),
      }).eq("id", key.id);

      // Create new key with same settings
      const { error } = await supabase.from("merchant_api_keys").insert({
        merchant_id: key.merchant_id,
        api_key: newApiKey,
        secret_key: newSecretKey,
        app_password: newAppPassword,
        webhook_url: key.webhook_url,
        is_active: true,
        environment: key.environment || "live",
        permissions: key.permissions || ["create_session", "check_status", "list_sessions"],
      });
      if (error) throw error;

      toast.success("Key rotated. Old key valid for 24h grace period.");
      fetchKeys();
    } catch (e: any) {
      toast.error(e.message || "Rotation failed");
    } finally {
      setRotating(null);
    }
  };

  const savePermissions = async () => {
    if (!permEditKey) return;
    await supabase.from("merchant_api_keys").update({
      permissions: permEditPerms,
      updated_at: new Date().toISOString(),
    }).eq("id", permEditKey.id);
    toast.success("Permissions updated");
    setPermEditOpen(false);
    fetchKeys();
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const maskKey = (key: string) => key.slice(0, 8) + "•".repeat(12) + key.slice(-4);

  const isInGracePeriod = (k: ApiKey) =>
    !k.is_active && k.rotation_expires_at && new Date(k.rotation_expires_at) > new Date();

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <div className="overflow-x-auto">
        <Table className="min-w-[1050px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Merchant</TableHead>
              <TableHead className="min-w-[180px]">API Key</TableHead>
              <TableHead className="min-w-[60px]">Env</TableHead>
              <TableHead className="min-w-[90px]">Status</TableHead>
              <TableHead className="min-w-[80px]">Permissions</TableHead>
              <TableHead className="whitespace-nowrap min-w-[100px]">Created</TableHead>
              <TableHead className="whitespace-nowrap min-w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No API keys found</TableCell></TableRow>
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
                  <Badge variant={k.environment === "test" ? "secondary" : "default"} className="text-xs">
                    {k.environment === "test" ? "Test" : "Live"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={k.is_active ? "default" : "destructive"}>
                      {k.is_active ? "Active" : "Revoked"}
                    </Badge>
                    {isInGracePeriod(k) && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 gap-1">
                        <Clock className="w-3 h-3" />
                        Grace {formatDistanceToNow(new Date(k.rotation_expires_at!), { addSuffix: false })}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-auto py-1"
                    onClick={() => {
                      setPermEditKey(k);
                      setPermEditPerms(k.permissions || ["create_session", "check_status", "list_sessions"]);
                      setPermEditOpen(true);
                    }}
                  >
                    {(k.permissions || []).length} perms
                  </Button>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(k.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex gap-1 whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rotating === k.id || !k.is_active}
                      onClick={() => handleRotate(k)}
                      title="Rotate key"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={k.is_active ? "destructive" : "outline"}
                      disabled={revoking === k.id}
                      onClick={() => toggleKey(k.id, k.is_active)}
                    >
                      {k.is_active ? "Revoke" : "Reactivate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <Card><CardContent className="p-4 text-center text-muted-foreground">Loading...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-4 text-center text-muted-foreground">No API keys found</CardContent></Card>
        ) : filtered.map(k => (
          <Card key={k.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm text-foreground">{k.merchant_name}</p>
                <div className="flex items-center gap-1.5">
                  <Badge variant={k.environment === "test" ? "secondary" : "default"} className="text-xs">
                    {k.environment === "test" ? "Test" : "Live"}
                  </Badge>
                  <Badge variant={k.is_active ? "default" : "destructive"} className="text-xs">
                    {k.is_active ? "Active" : "Revoked"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded flex-1 truncate">{maskKey(k.api_key)}</code>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copyText(k.api_key, "API Key")}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>

              {isInGracePeriod(k) && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 gap-1">
                  <Clock className="w-3 h-3" />
                  Grace {formatDistanceToNow(new Date(k.rotation_expires_at!), { addSuffix: false })}
                </Badge>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{format(new Date(k.created_at), "dd MMM yyyy")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-1"
                  onClick={() => {
                    setPermEditKey(k);
                    setPermEditPerms(k.permissions || ["create_session", "check_status", "list_sessions"]);
                    setPermEditOpen(true);
                  }}
                >
                  {(k.permissions || []).length} perms
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={rotating === k.id || !k.is_active}
                  onClick={() => handleRotate(k)}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rotate
                </Button>
                <Button
                  size="sm"
                  variant={k.is_active ? "destructive" : "outline"}
                  className="flex-1"
                  disabled={revoking === k.id}
                  onClick={() => toggleKey(k.id, k.is_active)}
                >
                  {k.is_active ? "Revoke" : "Reactivate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permissions Editor Dialog */}
      <Dialog open={permEditOpen} onOpenChange={setPermEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>Select which actions this API key can perform.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_PERMISSIONS.map(p => (
              <div key={p.value} className="flex items-center gap-2">
                <Checkbox
                  id={`perm-${p.value}`}
                  checked={permEditPerms.includes(p.value)}
                  onCheckedChange={(checked) => {
                    setPermEditPerms(prev =>
                      checked ? [...prev, p.value] : prev.filter(x => x !== p.value)
                    );
                  }}
                />
                <Label htmlFor={`perm-${p.value}`}>{p.label}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermEditOpen(false)}>Cancel</Button>
            <Button onClick={savePermissions} disabled={permEditPerms.length === 0}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <label className="text-sm font-medium mb-1.5 block">Environment</label>
                <RadioGroup value={newEnv} onValueChange={(v) => setNewEnv(v as "live" | "test")} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="live" id="env-live" />
                    <Label htmlFor="env-live">Live</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="test" id="env-test" />
                    <Label htmlFor="env-test">Test</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Permissions</label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map(p => (
                    <div key={p.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`new-perm-${p.value}`}
                        checked={newPermissions.includes(p.value)}
                        onCheckedChange={(checked) => {
                          setNewPermissions(prev =>
                            checked ? [...prev, p.value] : prev.filter(x => x !== p.value)
                          );
                        }}
                      />
                      <Label htmlFor={`new-perm-${p.value}`}>{p.label}</Label>
                    </div>
                  ))}
                </div>
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

function GenerateKeyTrigger({ onOpen }: { onOpen: () => void }) {
  React.useEffect(() => {
    (window as any).__openGenerateApiKey = onOpen;
    return () => { delete (window as any).__openGenerateApiKey; };
  }, [onOpen]);
  return null;
}
