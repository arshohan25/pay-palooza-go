import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Smartphone, Trash2, AlertTriangle, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: "device_registration", entity_id: entityId, details });
  }
}

export default function AdminDeviceManager() {
  const [devices, setDevices] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("device_registrations").select("*").order("created_at", { ascending: false }).limit(500);
    setDevices(data ?? []);

    const uids = [...new Set((data ?? []).map(d => d.user_id))];
    if (uids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", uids);
      const map: Record<string, any> = {};
      (profs ?? []).forEach(p => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const revoke = async (id: string) => {
    const device = devices.find(d => d.id === id);
    const { error } = await supabase.from("device_registrations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Device revoked");
      await auditLog("device_revoked", id, { user_id: device?.user_id, fingerprint: device?.device_fingerprint });
      await fetch();
    }
    setRevokeTarget(null);
  };

  const deviceCountByUser: Record<string, number> = {};
  devices.forEach(d => { deviceCountByUser[d.user_id] = (deviceCountByUser[d.user_id] || 0) + 1; });
  const suspiciousUsers = Object.entries(deviceCountByUser).filter(([, c]) => c >= 3).map(([uid]) => uid);

  const filtered = devices.filter(d => {
    if (!search) return true;
    const p = profiles[d.user_id];
    const s = search.toLowerCase();
    return d.device_fingerprint?.toLowerCase().includes(s) || p?.name?.toLowerCase().includes(s) || p?.phone?.includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Device Manager</h3>
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw size={14} className="mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Smartphone className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{devices.length}</p>
          <p className="text-xs text-muted-foreground">Total Devices</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{suspiciousUsers.length}</p>
          <p className="text-xs text-muted-foreground">Suspicious (3+)</p>
        </CardContent></Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, phone, or fingerprint…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Fingerprint</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => {
                const p = profiles[d.user_id];
                const isSuspicious = suspiciousUsers.includes(d.user_id);
                return (
                  <TableRow key={d.id} className={isSuspicious ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{p?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{p?.phone ?? d.user_id.slice(0, 8)}</p>
                        {isSuspicious && <Badge variant="destructive" className="text-[9px] mt-0.5">Multi-device</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">{d.device_fingerprint}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setRevokeTarget(d.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Device?</AlertDialogTitle>
            <AlertDialogDescription>This will force the user to re-register their device on next login.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => revokeTarget && revoke(revokeTarget)}>Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
