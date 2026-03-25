import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Shield, Plus, Trash2, Search, Pencil } from "lucide-react";

interface BlacklistEntry {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  blocked_by: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "blacklist_entry", entity_id: entityId, details
    });
  }
}

export default function AdminBlacklistManager() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ type: "phone", value: "", reason: "" });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<BlacklistEntry | null>(null);
  const [editForm, setEditForm] = useState({ type: "", reason: "" });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("blacklist_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setEntries((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const addEntry = async () => {
    if (!newEntry.value.trim()) return;
    setAdding(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from("blacklist_entries").insert({
      type: newEntry.type,
      value: newEntry.value.trim(),
      reason: newEntry.reason || null,
      blocked_by: session!.user.id,
    } as any).select("id").single();
    if (error) toast.error(error.message);
    else {
      await auditLog("blacklist_added", data.id, { type: newEntry.type, value: newEntry.value });
      toast.success("Entry added to blacklist");
      setNewEntry({ type: "phone", value: "", reason: "" });
      setShowAdd(false);
      fetch();
    }
    setAdding(false);
  };

  const toggleActive = async (entry: BlacklistEntry) => {
    await supabase.from("blacklist_entries").update({ is_active: !entry.is_active } as any).eq("id", entry.id);
    await auditLog("blacklist_toggled", entry.id, { is_active: !entry.is_active });
    fetch();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("blacklist_entries").delete().eq("id", id);
    await auditLog("blacklist_deleted", id, {});
    toast.success("Entry removed");
    fetch();
  };

  const openEdit = (e: BlacklistEntry) => {
    setEditing(e);
    setEditForm({ type: e.type, reason: e.reason ?? "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("blacklist_entries").update({
      type: editForm.type,
      reason: editForm.reason || null,
    } as any).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    await auditLog("blacklist_edited", editing.id, { old_type: editing.type, new_type: editForm.type });
    toast.success("Entry updated");
    setEditing(null);
    fetch();
  };

  const filtered = entries.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (search && !e.value.toLowerCase().includes(search.toLowerCase()) && !e.reason?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const typeBadge = (t: string) => {
    const colors: Record<string, string> = { phone: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", ip: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", device: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" };
    return <Badge variant="secondary" className={`text-[10px] ${colors[t] ?? ""}`}>{t}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-5 h-5" /> Blacklist / Watchlist</CardTitle>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="w-4 h-4 mr-1" /> Add Entry</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAdd && (
            <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Select value={newEntry.type} onValueChange={v => setNewEntry({ ...newEntry, type: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="ip">IP Address</SelectItem>
                    <SelectItem value="device">Device</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Value (phone/IP/fingerprint)" value={newEntry.value} onChange={e => setNewEntry({ ...newEntry, value: e.target.value })} className="flex-1 min-w-[200px]" />
              </div>
              <Input placeholder="Reason (optional)" value={newEntry.reason} onChange={e => setNewEntry({ ...newEntry, reason: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" disabled={adding || !newEntry.value.trim()} onClick={addEntry}>{adding ? "Adding…" : "Add to Blacklist"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <div className="bg-muted/50 rounded-lg p-1 flex gap-0.5">
              {([
                { key: "all", label: "All Types" },
                { key: "phone", label: "Phone" },
                { key: "ip", label: "IP" },
                { key: "device", label: "Device" },
              ] as const).map(t => (
                <button key={t.key} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  filterType === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`} onClick={() => setFilterType(t.key)}>{t.label}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No blacklist entries found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{typeBadge(e.type)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.value}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.reason || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.is_active ? "destructive" : "secondary"} className="text-[10px] cursor-pointer" onClick={() => toggleActive(e)}>
                          {e.is_active ? "Blocked" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(e)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Entry?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently remove "{e.value}" from the blacklist.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteEntry(e.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Blacklist Entry</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select value={editForm.type} onValueChange={v => setEditForm({ ...editForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="ip">IP Address</SelectItem>
                  <SelectItem value="device">Device</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reason</label>
              <Input value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
