import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Smartphone, Globe, Key, Search, Clock, ShieldCheck, Trash2, Ban, Plus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details,
    });
  }
}

export default function AdminSecurityCenter() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" /> Security Center
      </h3>
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="sessions" className="text-xs">Sessions</TabsTrigger>
          <TabsTrigger value="devices" className="text-xs">Devices</TabsTrigger>
          <TabsTrigger value="ipwhitelist" className="text-xs">IP Whitelist</TabsTrigger>
          <TabsTrigger value="twofa" className="text-xs">2FA</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions"><LoginSessionsTab /></TabsContent>
        <TabsContent value="devices"><DeviceManagementTab /></TabsContent>
        <TabsContent value="ipwhitelist"><IpWhitelistTab /></TabsContent>
        <TabsContent value="twofa"><TwoFAManagementTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function LoginSessionsTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [terminateTarget, setTerminateTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("audit_logs").select("*")
      .eq("action", "admin_login").order("created_at", { ascending: false }).limit(50);
    const { data: teamLogins } = await supabase.from("audit_logs").select("*")
      .eq("action", "team_login").order("created_at", { ascending: false }).limit(50);
    const allSessions = [...(data ?? []), ...(teamLogins ?? [])].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const actorIds = [...new Set(allSessions.map(s => s.actor_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", actorIds);
    const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
    setSessions(allSessions.map(s => ({ ...s, profile: pMap[s.actor_id] })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const terminateSession = async (s: any) => {
    const { error } = await supabase.from("audit_logs").delete().eq("id", s.id);
    if (error) { toast.error("Failed to terminate session"); return; }
    await auditLog("session_terminate", "session", s.id, { user: s.profile?.name || s.actor_id, action_type: s.action });
    toast.success("Session terminated");
    setTerminateTarget(null);
    load();
  };

  const terminateAll = async () => {
    const nonAdminSessions = sessions.filter(s => s.action === "team_login");
    if (nonAdminSessions.length === 0) { toast.info("No team sessions to terminate"); return; }
    const ids = nonAdminSessions.map(s => s.id);
    await supabase.from("audit_logs").delete().in("id", ids);
    await auditLog("session_terminate_all", "session", "bulk", { count: ids.length });
    toast.success(`${ids.length} team session(s) terminated`);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="destructive" onClick={terminateAll}><Ban className="w-3.5 h-3.5 mr-1" />Terminate All Team</Button>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">User</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">IP</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Time</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Action</th>
              </tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{s.profile?.name || s.profile?.phone || s.actor_id?.slice(0, 8)}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{s.action === "admin_login" ? "Admin" : "Team"}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{s.ip_address || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(s.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setTerminateTarget(s)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && sessions.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No login sessions recorded</div>}
        </CardContent>
      </Card>
      <AlertDialog open={!!terminateTarget} onOpenChange={() => setTerminateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Session?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the session record for {terminateTarget?.profile?.name || "this user"}.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => terminateSession(terminateTarget)}>Terminate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeviceManagementTab() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("device_registrations").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) {
      const uids = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone, status").in("user_id", uids);
      const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
      setDevices(data.map(d => ({ ...d, profile: pMap[d.user_id] })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = devices.filter(d =>
    !search || d.profile?.phone?.includes(search) || d.profile?.name?.toLowerCase().includes(search.toLowerCase()) || d.device_fingerprint?.includes(search)
  );

  const revokeDevice = async (d: any) => {
    const { error } = await supabase.from("device_registrations").delete().eq("id", d.id);
    if (error) { toast.error("Failed to revoke device"); return; }
    await auditLog("device_revoke", "device", d.id, { user_id: d.user_id, fingerprint: d.device_fingerprint?.slice(0, 16) });
    toast.success("Device revoked");
    setRevokeTarget(null);
    load();
  };

  const bulkRevoke = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("device_registrations").delete().in("id", ids);
    if (error) { toast.error("Failed to revoke devices"); return; }
    await auditLog("device_bulk_revoke", "device", "bulk", { count: ids.length });
    toast.success(`${ids.length} device(s) revoked`);
    setSelected(new Set());
    load();
  };

  const blockUser = async (userId: string, name: string) => {
    await supabase.from("profiles").update({ status: "suspended" } as any).eq("user_id", userId);
    await auditLog("user_block_from_device", "user", userId, { reason: "Blocked from device management" });
    toast.success(`${name || "User"} blocked`);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by phone or fingerprint..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
        {selected.size > 0 && <Button size="sm" variant="destructive" onClick={bulkRevoke}><Trash2 className="w-3.5 h-3.5 mr-1" />Revoke ({selected.size})</Button>}
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2.5 w-8"><input type="checkbox" className="rounded" onChange={e => setSelected(e.target.checked ? new Set(filtered.map(d => d.id)) : new Set())} checked={selected.size > 0 && selected.size === filtered.length} /></th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">User</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Fingerprint</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Registered</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5"><input type="checkbox" className="rounded" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} /></td>
                    <td className="px-3 py-2.5 text-xs font-medium">{d.profile?.name || d.profile?.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{d.device_fingerprint?.slice(0, 16)}...</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setRevokeTarget(d)} title="Revoke"><Trash2 className="w-3.5 h-3.5" /></Button>
                        {d.profile?.status === "active" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => blockUser(d.user_id, d.profile?.name)} title="Block User"><Ban className="w-3.5 h-3.5" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No devices found</div>}
        </CardContent>
      </Card>
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Device?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the device registration for {revokeTarget?.profile?.name || "this user"}. They will need to re-register their device.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => revokeDevice(revokeTarget)}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IpWhitelistTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [merchants, setMerchants] = useState<any[]>([]);
  const [form, setForm] = useState({ ip_address: "", label: "", merchant_id: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: mData }] = await Promise.all([
      supabase.from("merchant_ip_whitelist").select("*, merchants(business_name)").order("created_at", { ascending: false }),
      supabase.from("merchants").select("id, business_name").eq("status", "active"),
    ]);
    setEntries(data ?? []);
    setMerchants(mData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addEntry = async () => {
    if (!form.ip_address || !form.merchant_id) { toast.error("IP and merchant are required"); return; }
    const { error } = await supabase.from("merchant_ip_whitelist").insert({
      ip_address: form.ip_address, label: form.label || null, merchant_id: form.merchant_id,
    } as any);
    if (error) { toast.error("Failed to add IP entry"); return; }
    await auditLog("ip_whitelist_add", "ip_whitelist", form.ip_address, { merchant_id: form.merchant_id, label: form.label });
    toast.success("IP whitelist entry added");
    setAddOpen(false);
    setForm({ ip_address: "", label: "", merchant_id: "" });
    load();
  };

  const deleteEntry = async (e: any) => {
    const { error } = await supabase.from("merchant_ip_whitelist").delete().eq("id", e.id);
    if (error) { toast.error("Failed to delete"); return; }
    await auditLog("ip_whitelist_delete", "ip_whitelist", e.id, { ip: e.ip_address });
    toast.success("IP entry deleted");
    setDeleteTarget(null);
    load();
  };

  const saveLabel = async (e: any) => {
    await supabase.from("merchant_ip_whitelist").update({ label: editLabel } as any).eq("id", e.id);
    await auditLog("ip_whitelist_edit", "ip_whitelist", e.id, { new_label: editLabel });
    toast.success("Label updated");
    setEditingId(null);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">IP whitelist entries across merchant API integrations</p>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" />Add IP</Button>
      </div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Merchant</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">IP Address</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Label</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Added</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{(e.merchants as any)?.business_name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" />{e.ip_address}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {editingId === e.id ? (
                        <div className="flex gap-1">
                          <Input value={editLabel} onChange={ev => setEditLabel(ev.target.value)} className="h-6 text-xs w-24" onKeyDown={ev => { if (ev.key === "Enter") saveLabel(e); if (ev.key === "Escape") setEditingId(null); }} autoFocus />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveLabel(e)}>✓</Button>
                        </div>
                      ) : (
                        <span className="cursor-pointer hover:underline" onClick={() => { setEditingId(e.id); setEditLabel(e.label || ""); }}>{e.label || "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(e.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(e)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && entries.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No IP whitelist entries</div>}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add IP Whitelist Entry</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">IP Address</Label><Input placeholder="e.g. 203.0.113.10" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} /></div>
            <div><Label className="text-xs">Label (optional)</Label><Input placeholder="Office server" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Merchant</Label>
              <Select value={form.merchant_id} onValueChange={v => setForm(f => ({ ...f, merchant_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select merchant" /></SelectTrigger>
                <SelectContent>{merchants.map(m => <SelectItem key={m.id} value={m.id}>{m.business_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={addEntry}>Add Entry</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP Entry?</AlertDialogTitle>
            <AlertDialogDescription>Remove IP {deleteTarget?.ip_address} from the whitelist?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteEntry(deleteTarget)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TwoFAManagementTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lockTarget, setLockTarget] = useState<any>(null);
  const [lockDuration, setLockDuration] = useState("24h");
  const [revokeTarget, setRevokeTarget] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: devices } = await supabase.from("device_registrations").select("user_id");
    const deviceUserIds = new Set((devices ?? []).map(d => d.user_id));
    const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone, status").order("name").limit(200);
    setUsers((profiles ?? []).map(p => ({ ...p, has2FA: deviceUserIds.has(p.user_id) })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search));
  const enabledCount = users.filter(u => u.has2FA).length;

  const forceRemoveDevice = async (u: any) => {
    const { error } = await supabase.from("device_registrations").delete().eq("user_id", u.user_id);
    if (error) { toast.error("Failed to remove device"); return; }
    await auditLog("force_remove_device", "user", u.user_id, { name: u.name, phone: u.phone });
    toast.success(`Device removed for ${u.name || u.phone}`);
    setRevokeTarget(null);
    load();
  };

  const lockAccount = async () => {
    if (!lockTarget) return;
    await supabase.from("profiles").update({ status: "suspended" } as any).eq("user_id", lockTarget.user_id);
    await auditLog("account_lock", "user", lockTarget.user_id, { name: lockTarget.name, duration: lockDuration, reason: "Locked from 2FA management" });
    toast.success(`Account locked for ${lockTarget.name || lockTarget.phone} (${lockDuration})`);
    setLockTarget(null);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Total Users</p><p className="text-lg font-bold text-foreground">{users.length}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Device Verified</p><p className="text-lg font-bold text-emerald-600">{enabledCount}</p></CardContent></Card>
        <Card className="border-0 shadow-[var(--shadow-card)]"><CardContent className="p-3 text-center"><p className="text-[10px] text-muted-foreground">Unverified</p><p className="text-lg font-bold text-destructive">{users.length - enabledCount}</p></CardContent></Card>
      </div>
      <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Search user..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">User</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Phone</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Device Security</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.slice(0, 50).map(u => (
                <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">{u.name || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{u.phone}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={u.has2FA ? "default" : "secondary"} className="text-[10px] gap-1">
                      <ShieldCheck className="w-3 h-3" />{u.has2FA ? "Verified" : "None"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5"><Badge variant={u.status === "active" ? "secondary" : "destructive"} className="text-[10px]">{u.status}</Badge></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      {u.has2FA && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setRevokeTarget(u)} title="Remove Device"><Smartphone className="w-3.5 h-3.5" /></Button>
                      )}
                      {u.status === "active" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { setLockTarget(u); setLockDuration("24h"); }} title="Lock Account"><Lock className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No users found</div>}
        </CardContent>
      </Card>

      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Device Registration?</AlertDialogTitle>
            <AlertDialogDescription>Force-remove all device registrations for {revokeTarget?.name || revokeTarget?.phone}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => forceRemoveDevice(revokeTarget)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!lockTarget} onOpenChange={() => setLockTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lock Account</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Lock account for <span className="font-medium text-foreground">{lockTarget?.name || lockTarget?.phone}</span></p>
            <div>
              <Label className="text-xs">Duration</Label>
              <Select value={lockDuration} onValueChange={setLockDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="24h">24 Hours</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" variant="destructive" onClick={lockAccount}>Lock Account</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
