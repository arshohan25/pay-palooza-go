import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { LogIn, Smartphone, AlertTriangle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function AdminUserSessions() {
  const [logins, setLogins] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [suspicious, setSuspicious] = useState<{ userId: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [loginsRes, devicesRes] = await Promise.all([
      supabase.from("audit_logs").select("id, actor_id, action, created_at, details")
        .or("action.eq.admin_login,action.eq.login,action.eq.signup")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("device_registrations").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setLogins(loginsRes.data ?? []);
    setDevices(devicesRes.data ?? []);

    // Detect users with multiple device fingerprints
    const deviceMap: Record<string, Set<string>> = {};
    for (const d of devicesRes.data ?? []) {
      if (!deviceMap[d.user_id]) deviceMap[d.user_id] = new Set();
      deviceMap[d.user_id].add(d.device_fingerprint);
    }
    const sus = Object.entries(deviceMap).filter(([, fps]) => fps.size >= 3).map(([userId, fps]) => ({ userId, count: fps.size }));
    setSuspicious(sus);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><LogIn className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Recent Logins</p><p className="text-xl font-bold text-foreground">{logins.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Smartphone className="w-5 h-5 text-blue-500" /></div>
          <div><p className="text-xs text-muted-foreground">Devices</p><p className="text-xl font-bold text-foreground">{devices.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-xs text-muted-foreground">Suspicious</p><p className="text-xl font-bold text-destructive">{suspicious.length}</p></div>
        </CardContent></Card>
      </div>

      {suspicious.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Multi-Device Alerts</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {suspicious.map(s => (
                <div key={s.userId} className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-mono text-xs">{s.userId.slice(0, 12)}…</span>
                  <Badge variant="destructive">{s.count} devices</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><LogIn className="w-4 h-4" />Login History</CardTitle>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logins.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No login events</TableCell></TableRow>
                ) : logins.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs text-foreground">{l.actor_id.slice(0, 12)}…</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{l.action}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
