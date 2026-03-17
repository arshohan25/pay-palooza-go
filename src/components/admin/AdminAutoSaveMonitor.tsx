import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Coins, Clock, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminAutoSaveMonitor() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("savings_auto_save").select("*").order("created_at", { ascending: false }).limit(500);
    setSchedules(data ?? []);

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

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("savings_auto_save").update({ is_active, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error(error.message);
    else await fetch();
  };

  const active = schedules.filter(s => s.is_active && !s.settled);
  const settled = schedules.filter(s => s.settled);
  const totalMonthly = active.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Auto-Save Monitor</h3>
        <Button variant="outline" size="sm" onClick={fetch}><RefreshCw size={14} className="mr-1" />Refresh</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Coins className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{active.length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{settled.length}</p>
          <p className="text-xs text-muted-foreground">Settled</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">৳{totalMonthly.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total/Cycle</p>
        </CardContent></Card>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground">No auto-save schedules found</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map(s => {
                const p = profiles[s.user_id];
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{p?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{p?.phone ?? ""}</p>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">৳{Number(s.amount).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{s.frequency}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.next_run_at ? new Date(s.next_run_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {s.settled ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">Settled</Badge>
                      ) : s.is_active ? (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.is_active} disabled={s.settled} onCheckedChange={(v) => toggleActive(s.id, v)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
