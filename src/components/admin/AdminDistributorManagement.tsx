import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Building2, Users, RefreshCw, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface Distributor {
  id: string;
  user_id: string;
  business_name: string;
  commission_rate: number;
  max_float: number;
  status: string;
  territory: string[] | null;
  parent_id: string | null;
  created_at: string;
}

export default function AdminDistributorManagement() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDist, setSelectedDist] = useState<Distributor | null>(null);
  const [linkedAgents, setLinkedAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("distributors").select("*").order("created_at", { ascending: false }).limit(200);
    setDistributors((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("admin-dist-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "distributors" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const toggleStatus = async (d: Distributor) => {
    const newStatus = d.status === "suspended" ? "active" : "suspended";
    const { error } = await supabase.from("distributors").update({ status: newStatus as any }).eq("id", d.id);
    if (error) { toast.error("Failed to update status"); return; }
    toast.success(`Distributor ${newStatus}`);
    load();
  };

  const openDetail = async (d: Distributor) => {
    setSelectedDist(d);
    setAgentsLoading(true);
    const { data } = await supabase.from("agents").select("id, business_name, status, user_id, commission_earned").eq("distributor_id", d.id);
    setLinkedAgents(data ?? []);
    setAgentsLoading(false);
  };

  const activeCount = distributors.filter(d => d.status === "active").length;

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-foreground">{distributors.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><ToggleRight className="w-5 h-5 text-emerald-500" /></div>
          <div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold text-emerald-600">{activeCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-xs text-muted-foreground">Suspended</p><p className="text-xl font-bold text-amber-600">{distributors.length - activeCount}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Distributors</CardTitle>
          <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead className="text-center">Commission</TableHead>
                  <TableHead className="text-center">Max Float</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributors.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No distributors</TableCell></TableRow>
                ) : distributors.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-foreground">{d.business_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.territory?.join(", ") || "—"}</TableCell>
                    <TableCell className="text-center font-mono text-sm">{d.commission_rate}%</TableCell>
                    <TableCell className="text-center font-mono text-sm">৳{d.max_float.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={d.status === "active" ? "default" : "destructive"} className="text-xs">{d.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openDetail(d)}>View</Button>
                        <Button size="sm" variant={d.status === "active" ? "destructive" : "default"} onClick={() => toggleStatus(d)}>
                          {d.status === "active" ? "Suspend" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Sheet open={!!selectedDist} onOpenChange={() => setSelectedDist(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selectedDist?.business_name}</SheetTitle>
            <SheetDescription>Distributor details & linked agents</SheetDescription>
          </SheetHeader>
          {selectedDist && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Status</p><Badge variant={selectedDist.status === "active" ? "default" : "destructive"}>{selectedDist.status}</Badge></div>
                <div><p className="text-muted-foreground">Commission</p><p className="font-medium text-foreground">{selectedDist.commission_rate}%</p></div>
                <div><p className="text-muted-foreground">Max Float</p><p className="font-medium text-foreground">৳{selectedDist.max_float.toLocaleString()}</p></div>
                <div><p className="text-muted-foreground">Territory</p><p className="font-medium text-foreground">{selectedDist.territory?.join(", ") || "—"}</p></div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Linked Agents ({linkedAgents.length})</p>
                {agentsLoading ? <p className="text-xs text-muted-foreground">Loading...</p> : linkedAgents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No agents linked</p>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {linkedAgents.map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <span className="text-sm font-medium text-foreground">{a.business_name || a.id.slice(0, 8)}</span>
                          <Badge variant={a.status === "active" ? "default" : "destructive"} className="text-xs">{a.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
