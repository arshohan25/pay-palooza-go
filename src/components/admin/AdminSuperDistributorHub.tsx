import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Crown, Building2, Users, Search, RefreshCw, Link2Off, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import DistributorPickerDialog from "./DistributorPickerDialog";
import { assertAdmin, canManageDistributors } from "@/lib/distributorAdmin";

interface Distributor {
  id: string;
  user_id: string;
  business_name: string;
  status: string;
  territory: string[] | null;
  parent_id: string | null;
}

/**
 * Super Distributor hub — lists SDs (distributors whose user carries the
 * `super_distributor` role), shows their child distributors, and lets admins
 * link / unlink / transfer distributors between super-distributors.
 */
export default function AdminSuperDistributorHub() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [sdIds, setSdIds] = useState<Set<string>>(new Set()); // user_ids
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Distributor | null>(null);
  const [canManage, setCanManage] = useState(true);

  // Actions
  const [transferChild, setTransferChild] = useState<Distributor | null>(null);
  const [unlinkChild, setUnlinkChild] = useState<Distributor | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => { canManageDistributors().then(setCanManage); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: dists }, { data: sdRoles }] = await Promise.all([
      supabase.from("distributors").select("id, user_id, business_name, status, territory, parent_id").limit(500),
      supabase.from("user_roles").select("user_id").eq("role", "super_distributor" as any),
    ]);
    setDistributors((dists as any[]) ?? []);
    setSdIds(new Set(((sdRoles ?? []) as any[]).map((r) => r.user_id)));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel("admin-sd-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "distributors" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // Super distributors = distributors whose owning user has super_distributor role.
  const superDistributors = useMemo(
    () => distributors.filter((d) => sdIds.has(d.user_id)),
    [distributors, sdIds],
  );

  const childrenOf = useCallback(
    (sdId: string) => distributors.filter((d) => d.parent_id === sdId && !sdIds.has(d.user_id)),
    [distributors, sdIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return superDistributors;
    return superDistributors.filter((d) =>
      d.business_name.toLowerCase().includes(q) ||
      (d.territory ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [superDistributors, search]);

  const setParent = async (childId: string, newParent: string | null, prevParent: string | null) => {
    try {
      await assertAdmin();
      const { error } = await supabase.from("distributors").update({ parent_id: newParent }).eq("id", childId);
      if (error) throw error;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: !prevParent ? "distributor_sd_linked" : !newParent ? "distributor_sd_unlinked" : "distributor_sd_transferred",
          entity_type: "distributor",
          entity_id: childId,
          details: { from: prevParent, to: newParent },
        }).then();
      }
      toast.success(
        !newParent ? "Distributor unlinked from SD" : "Distributor moved",
        {
          action: {
            label: "Undo",
            onClick: async () => {
              const { error: e2 } = await supabase.from("distributors").update({ parent_id: prevParent }).eq("id", childId);
              if (e2) toast.error(e2.message); else { toast.success("Undo — restored"); load(); }
            },
          },
        },
      );
      load();
    } catch (e: any) { toast.error(e.message || "Failed"); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const totalChildren = distributors.filter((d) => d.parent_id && !sdIds.has(d.user_id)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Crown className="w-5 h-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Super Distributors</p><p className="text-xl font-bold text-foreground">{superDistributors.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Building2 className="w-5 h-5 text-emerald-500" /></div>
          <div><p className="text-xs text-muted-foreground">Linked distributors</p><p className="text-xl font-bold text-foreground">{totalChildren}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Users className="w-5 h-5 text-amber-500" /></div>
          <div><p className="text-xs text-muted-foreground">Active SDs</p><p className="text-xl font-bold text-foreground">{superDistributors.filter(d => d.status === "active").length}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4" /> Super Distributors</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-8 w-48 text-xs" />
            </div>
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[520px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead className="text-center">Linked Distributors</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No super distributors</TableCell></TableRow>
                ) : filtered.map((sd) => {
                  const kids = childrenOf(sd.id);
                  return (
                    <TableRow key={sd.id}>
                      <TableCell className="font-medium text-foreground">{sd.business_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{sd.territory?.join(", ") || "—"}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{kids.length}</TableCell>
                      <TableCell className="text-center"><Badge variant={sd.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">{sd.status}</Badge></TableCell>
                      <TableCell><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(sd)}>View</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.business_name}</SheetTitle>
            <SheetDescription>Super Distributor · linked distributors</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">Linked distributors ({childrenOf(selected.id).length})</p>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!canManage} onClick={() => setLinkOpen(true)}>Link distributor…</Button>
              </div>
              {childrenOf(selected.id).length === 0 ? (
                <p className="text-xs text-muted-foreground">No distributors linked to this SD yet.</p>
              ) : (
                <ScrollArea className="max-h-[420px]">
                  <div className="space-y-2">
                    {childrenOf(selected.id).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{c.business_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{c.territory?.join(", ") || "No territory"}</p>
                        </div>
                        <Badge variant={c.status === "active" ? "default" : "destructive"} className="text-[10px]">{c.status}</Badge>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Transfer to another SD" disabled={!canManage} onClick={() => setTransferChild(c)}><ArrowRightLeft className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" title="Unlink" disabled={!canManage} onClick={() => setUnlinkChild(c)}><Link2Off className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Link a distributor to this SD */}
      {selected && (
        <DistributorPickerDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          title="Link a distributor"
          description={`Attach a distributor under ${selected.business_name}.`}
          excludeIds={[selected.id, ...superDistributors.map(s => s.id), ...childrenOf(selected.id).map(c => c.id)]}
          onPick={async (childId) => {
            if (!childId) return;
            const child = distributors.find((d) => d.id === childId);
            if (!child) return;
            await setParent(childId, selected.id, child.parent_id);
          }}
        />
      )}

      {/* Transfer child to another SD */}
      {transferChild && selected && (
        <DistributorPickerDialog
          open={!!transferChild}
          onOpenChange={(o) => { if (!o) setTransferChild(null); }}
          title="Transfer to another Super Distributor"
          description={`Move ${transferChild.business_name} under a different SD.`}
          excludeIds={[selected.id, ...distributors.filter(d => !sdIds.has(d.user_id)).map(d => d.id)]}
          allowUnassign
          onPick={async (newSdId) => {
            await setParent(transferChild.id, newSdId, transferChild.parent_id);
            setTransferChild(null);
          }}
        />
      )}

      {/* Unlink confirmation */}
      <AlertDialog open={!!unlinkChild} onOpenChange={(v) => { if (!v) setUnlinkChild(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink distributor?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{unlinkChild?.business_name}</strong> from{" "}
              <strong>{selected?.business_name}</strong>. You can undo from the toast.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!unlinkChild) return;
              const c = unlinkChild;
              setUnlinkChild(null);
              await setParent(c.id, null, c.parent_id);
            }}>Unlink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
