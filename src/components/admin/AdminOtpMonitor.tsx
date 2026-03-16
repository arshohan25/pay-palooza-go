import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Key, RefreshCw, AlertTriangle } from "lucide-react";

export default function AdminOtpMonitor() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    // Get OTP/PIN related audit log entries
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .or("action.ilike.%otp%,action.ilike.%pin%,action.ilike.%reset%")
      .order("created_at", { ascending: false })
      .limit(300);
    setEvents(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Detect abuse: group by entity (phone/user) in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recentEvents = events.filter(e => e.created_at >= oneHourAgo);
  const actorCounts: Record<string, number> = {};
  recentEvents.forEach(e => {
    const key = e.actor_id;
    actorCounts[key] = (actorCounts[key] || 0) + 1;
  });
  const abuseFlags = Object.entries(actorCounts).filter(([, c]) => c >= 5);

  // Stats
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter(e => e.created_at?.startsWith(today));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">OTP & PIN Monitor</h3>
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw size={14} className="mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Key className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{todayEvents.length}</p>
          <p className="text-xs text-muted-foreground">Today</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <ShieldAlert className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{recentEvents.length}</p>
          <p className="text-xs text-muted-foreground">Last Hour</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{abuseFlags.length}</p>
          <p className="text-xs text-muted-foreground">Abuse Flags</p>
        </CardContent></Card>
      </div>

      {abuseFlags.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3">
            <p className="text-sm font-medium text-destructive flex items-center gap-1"><AlertTriangle size={14} /> Abuse Detected</p>
            <p className="text-xs text-muted-foreground mt-1">{abuseFlags.length} user(s) with 5+ OTP/PIN requests in the last hour</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {abuseFlags.map(([uid, count]) => (
                <Badge key={uid} variant="destructive" className="text-[10px]">{uid.slice(0, 8)}… ({count}x)</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No OTP/PIN events found</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.slice(0, 100).map(e => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{e.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{e.actor_id?.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {e.details ? JSON.stringify(e.details).slice(0, 80) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
