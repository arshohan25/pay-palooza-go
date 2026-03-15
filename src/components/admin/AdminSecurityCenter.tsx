import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, Smartphone, Globe, Key, Search, Clock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-3 py-2.5 font-medium text-xs">User</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Type</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">IP</th>
              <th className="text-left px-3 py-2.5 font-medium text-xs">Time</th>
            </tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2.5 text-xs font-medium">{s.profile?.name || s.profile?.phone || s.actor_id?.slice(0, 8)}</td>
                  <td className="px-3 py-2.5"><Badge variant="secondary" className="text-[10px]">{s.action === "admin_login" ? "Admin" : "Team"}</Badge></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{s.ip_address || "—"}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && sessions.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No login sessions recorded</div>}
      </CardContent>
    </Card>
  );
}

function DeviceManagementTab() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("device_registrations").select("*").order("created_at", { ascending: false }).limit(100);
      if (data) {
        const uids = [...new Set(data.map(d => d.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", uids);
        const pMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));
        setDevices(data.map(d => ({ ...d, profile: pMap[d.user_id] })));
      }
      setLoading(false);
    })();
  }, []);

  const filtered = devices.filter(d =>
    !search || d.profile?.phone?.includes(search) || d.profile?.name?.toLowerCase().includes(search.toLowerCase()) || d.device_fingerprint?.includes(search)
  );

  return (
    <div className="space-y-3">
      <div className="relative"><Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" /><Input placeholder="Search by phone or fingerprint..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">User</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Fingerprint</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Registered</th>
              </tr></thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{d.profile?.name || d.profile?.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">{d.device_fingerprint?.slice(0, 16)}...</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No devices found</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function IpWhitelistTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("merchant_ip_whitelist").select("*, merchants(business_name)").order("created_at", { ascending: false });
      setEntries(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">IP whitelist entries across merchant API integrations</p>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-2.5 font-medium text-xs">Merchant</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">IP Address</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs">Label</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs hidden sm:table-cell">Added</th>
              </tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs font-medium">{(e.merchants as any)?.business_name || "—"}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" />{e.ip_address}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{e.label || "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{new Date(e.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && entries.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No IP whitelist entries</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function TwoFAManagementTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Check device registrations as a proxy for 2FA-like security
      const { data: devices } = await supabase.from("device_registrations").select("user_id");
      const deviceUserIds = new Set((devices ?? []).map(d => d.user_id));

      const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone, status").order("name").limit(200);
      setUsers((profiles ?? []).map(p => ({
        ...p,
        has2FA: deviceUserIds.has(p.user_id),
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = users.filter(u => !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone?.includes(search));
  const enabledCount = users.filter(u => u.has2FA).length;

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
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No users found</div>}
        </CardContent>
      </Card>
    </div>
  );
}
