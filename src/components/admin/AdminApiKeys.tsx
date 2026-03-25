import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Key, Copy, Eye, EyeOff, ShieldCheck, ShieldOff, RefreshCw, Clock, Trash2 } from "lucide-react";
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

export default function AdminApiKeys({ search, onGenerateRef }: AdminApiKeysProps & { onGenerateRef?: (fn: () => void) => void }) {
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
  const [deleting, setDeleting] = useState<string | null>(null);

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
    try {
      const { error } = await supabase.from("merchant_api_keys").update({ is_active: !active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success(active ? "Key revoked" : "Key reactivated");
      await fetchKeys();
    } catch (e: any) {
      toast.error(e.message || "Failed to update key");
    } finally {
      setRevoking(null);
    }
  };

  const handleRotate = async (key: ApiKey) => {
    setRotating(key.id);
    try {
      const newApiKey = "epk_" + crypto.randomUUID().replace(/-/g, "");
      const newSecretKey = "eps_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const newAppPassword = "epp_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);

      const graceExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("merchant_api_keys").update({
        is_active: false,
        rotation_expires_at: graceExpiry,
        updated_at: new Date().toISOString(),
      }).eq("id", key.id);

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
    try {
      const { error } = await supabase.from("merchant_api_keys").update({
        permissions: permEditPerms,
        updated_at: new Date().toISOString(),
      }).eq("id", permEditKey.id);
      if (error) throw error;
      toast.success("Permissions updated");
      setPermEditOpen(false);
      await fetchKeys();
    } catch (e: any) {
      toast.error(e.message || "Failed to update permissions");
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.from("merchant_api_keys").delete().eq("id", id);
      if (error) throw error;
      toast.success("API key deleted");
      await fetchKeys();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete key");
    } finally {
      setDeleting(null);
    }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const maskKey = (key: string) => key.slice(0, 8) + "•".repeat(12) + key.slice(-4);

  const isInGracePeriod = (k: ApiKey) =>
    !k.is_active && k.rotation_expires_at && new Date(k.rotation_expires_at) > new Date();

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Summary Cards — Glass-morphism */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Keys */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/10 via-background to-background ring-1 ring-primary/10">
            <div className="absolute -top-4 -right-4 opacity-[0.07]">
              <Key className="w-24 h-24 text-primary" />
            </div>
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Key className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Keys</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground">{counts.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500/10 via-background to-background ring-1 ring-emerald-500/10">
            <div className="absolute -top-4 -right-4 opacity-[0.07]">
              <ShieldCheck className="w-24 h-24 text-emerald-500" />
            </div>
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Active</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground">{counts.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revoked */}
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-destructive/10 via-background to-background ring-1 ring-destructive/10">
            <div className="absolute -top-4 -right-4 opacity-[0.07]">
              <ShieldOff className="w-24 h-24 text-destructive" />
            </div>
            <CardContent className="p-5 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
                  <ShieldOff className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Revoked</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground">{counts.revoked}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Table */}
        <Card className="hidden md:block border-0 shadow-lg rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border/50 hover:bg-muted/30">
                  <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70">Merchant</TableHead>
                  <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70">API Key</TableHead>
                  <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70 w-auto">Env</TableHead>
                  <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70 w-auto">Status</TableHead>
                  <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70 w-auto">Permissions</TableHead>
                  <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70 w-auto whitespace-nowrap">Created</TableHead>
                  <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-muted-foreground/70 whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No API keys found</TableCell></TableRow>
                ) : filtered.map(k => (
                  <TableRow key={k.id} className="border-b border-border/50 hover:bg-primary/[0.03] transition-colors">
                    <TableCell className="font-medium text-foreground">{k.merchant_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs font-mono bg-gradient-to-r from-muted/80 to-muted/40 border border-border/50 px-2 py-1 rounded-md">{maskKey(k.api_key)}</code>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg hover:bg-muted" onClick={() => copyText(k.api_key, "API Key")}>
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy API Key</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted/50 border border-border/50">
                        <span className={`w-1.5 h-1.5 rounded-full ${k.environment === "test" ? "bg-amber-500" : "bg-emerald-500"}`} />
                        {k.environment === "test" ? "Test" : "Live"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${
                          k.is_active
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }`}>
                          {k.is_active ? "Active" : "Revoked"}
                        </span>
                        {isInGracePeriod(k) && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 border border-amber-400/30 bg-amber-500/10 rounded-full px-2 py-0.5">
                            <Clock className="w-3 h-3" />
                            Grace {formatDistanceToNow(new Date(k.rotation_expires_at!), { addSuffix: false })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-auto py-1 px-2.5 rounded-full bg-primary/5 text-primary hover:bg-primary/10 font-medium"
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
                      <div className="flex gap-1 justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg hover:bg-muted"
                              disabled={rotating === k.id || !k.is_active}
                              onClick={() => handleRotate(k)}
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Rotate Key</TooltipContent>
                        </Tooltip>
                        <Button
                          size="sm"
                          variant={k.is_active ? "destructive" : "outline"}
                          className="h-8 rounded-lg text-xs px-3"
                          disabled={revoking === k.id}
                          onClick={() => toggleKey(k.id, k.is_active)}
                        >
                          {k.is_active ? "Revoke" : "Reactivate"}
                        </Button>
                        {!k.is_active && !isInGracePeriod(k) && (
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-destructive/10" disabled={deleting === k.id}>
                                    <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent>Delete Key</TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove this revoked API key for {k.merchant_name}. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(k.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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
            <Card className="border-0 shadow-md rounded-2xl"><CardContent className="p-5 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : filtered.length === 0 ? (
            <Card className="border-0 shadow-md rounded-2xl"><CardContent className="p-5 text-center text-muted-foreground">No API keys found</CardContent></Card>
          ) : filtered.map(k => (
            <Card key={k.id} className="border-0 shadow-md rounded-2xl overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm text-foreground">{k.merchant_name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/50 border border-border/50">
                      <span className={`w-1.5 h-1.5 rounded-full ${k.environment === "test" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      {k.environment === "test" ? "Test" : "Live"}
                    </span>
                    <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                      k.is_active
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}>
                      {k.is_active ? "Active" : "Revoked"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <code className="text-xs font-mono bg-gradient-to-r from-muted/80 to-muted/40 border border-border/50 px-2.5 py-1.5 rounded-lg flex-1 truncate">{maskKey(k.api_key)}</code>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 rounded-lg hover:bg-muted" onClick={() => copyText(k.api_key, "API Key")}>
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>

                {isInGracePeriod(k) && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 border border-amber-400/30 bg-amber-500/10 rounded-full px-2 py-0.5">
                    <Clock className="w-3 h-3" />
                    Grace {formatDistanceToNow(new Date(k.rotation_expires_at!), { addSuffix: false })}
                  </span>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{format(new Date(k.created_at), "dd MMM yyyy")}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-auto py-1 px-2.5 rounded-full bg-primary/5 text-primary hover:bg-primary/10 font-medium"
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
                    className="flex-1 rounded-xl h-9"
                    disabled={rotating === k.id || !k.is_active}
                    onClick={() => handleRotate(k)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Rotate
                  </Button>
                  <Button
                    size="sm"
                    variant={k.is_active ? "destructive" : "outline"}
                    className="flex-1 rounded-xl h-9"
                    disabled={revoking === k.id}
                    onClick={() => toggleKey(k.id, k.is_active)}
                  >
                    {k.is_active ? "Revoke" : "Reactivate"}
                  </Button>
                  {!k.is_active && !isInGracePeriod(k) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-destructive/10" disabled={deleting === k.id}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove this revoked API key for {k.merchant_name}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(k.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Permissions Editor Dialog */}
        <Dialog open={permEditOpen} onOpenChange={setPermEditOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-lg font-semibold">Edit Permissions</DialogTitle>
              <DialogDescription>Select which actions this API key can perform.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {ALL_PERMISSIONS.map(p => (
                <div key={p.value} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={`perm-${p.value}`}
                    checked={permEditPerms.includes(p.value)}
                    onCheckedChange={(checked) => {
                      setPermEditPerms(prev =>
                        checked ? [...prev, p.value] : prev.filter(x => x !== p.value)
                      );
                    }}
                  />
                  <Label htmlFor={`perm-${p.value}`} className="cursor-pointer font-medium">{p.label}</Label>
                </div>
              ))}
            </div>
            <DialogFooter className="pt-4 border-t border-border/50">
              <Button variant="outline" onClick={() => setPermEditOpen(false)} className="rounded-xl">Cancel</Button>
              <Button onClick={savePermissions} disabled={permEditPerms.length === 0} className="rounded-xl">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Generate Key Dialog */}
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-lg font-semibold">Generate API Key</DialogTitle>
              <DialogDescription>Create new API credentials for a merchant.</DialogDescription>
            </DialogHeader>

            {newSecret ? (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">⚠️ Copy these credentials now — secret is shown only once.</p>
                </div>
                {[
                  { label: "API Key", value: newSecret.apiKey },
                  { label: "Secret Key", value: showSecret ? newSecret.secret : "•".repeat(40) },
                  { label: "App Password", value: newSecret.appPassword },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">{label}</p>
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 text-xs bg-gradient-to-r from-muted/80 to-muted/40 rounded-lg px-3 py-2 font-mono break-all border border-border/50">{value}</code>
                      {label === "Secret Key" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => setShowSecret(!showSecret)}>
                          {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => copyText(label === "Secret Key" ? newSecret.secret : value, label)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <DialogFooter className="pt-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => { setGenerateOpen(false); setNewSecret(null); setShowSecret(false); }}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-5 py-1">
                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">Merchant</label>
                  <Select value={selectedMerchant} onValueChange={setSelectedMerchant}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select merchant..." /></SelectTrigger>
                    <SelectContent>
                      {merchants.map(m => <SelectItem key={m.id} value={m.id}>{m.business_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">Environment</label>
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
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">Permissions</label>
                  <div className="space-y-2">
                    {ALL_PERMISSIONS.map(p => (
                      <div key={p.value} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`new-perm-${p.value}`}
                          checked={newPermissions.includes(p.value)}
                          onCheckedChange={(checked) => {
                            setNewPermissions(prev =>
                              checked ? [...prev, p.value] : prev.filter(x => x !== p.value)
                            );
                          }}
                        />
                        <Label htmlFor={`new-perm-${p.value}`} className="cursor-pointer">{p.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 block">Webhook URL (optional)</label>
                  <Input placeholder="https://..." value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="rounded-xl" />
                </div>
                <DialogFooter className="pt-2">
                  <Button variant="outline" onClick={() => setGenerateOpen(false)} className="rounded-xl">Cancel</Button>
                  <Button onClick={handleGenerate} disabled={generating || !selectedMerchant} className="rounded-xl">
                    <Key className="w-4 h-4 mr-1.5" /> Generate
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Register openGenerate with parent */}
        <RegisterOpenGenerate onGenerateRef={onGenerateRef} openGenerate={openGenerate} />
      </div>
    </TooltipProvider>
  );
}

function RegisterOpenGenerate({ onGenerateRef, openGenerate }: { onGenerateRef?: (fn: () => void) => void; openGenerate: () => void }) {
  const ref = useRef(openGenerate);
  ref.current = openGenerate;
  useEffect(() => {
    onGenerateRef?.(() => ref.current());
  }, [onGenerateRef]);
  return null;
}
