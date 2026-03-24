import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Coins, TrendingUp, CalendarClock, RefreshCw, Pencil, Trash2, XCircle, Pause, Play } from "lucide-react";

interface UserSavingsSummary {
  user_id: string;
  name: string;
  phone: string;
  total_saved: number;
  goal_count: number;
  active_goals: number;
}

async function auditLog(action: string, entityType: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await supabase.from("audit_logs").insert({ actor_id: session.user.id, action, entity_type: entityType, entity_id: entityId, details });
  }
}

export default function AdminSavingsManagement() {
  const [summaries, setSummaries] = useState<UserSavingsSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [totalPlatformSavings, setTotalPlatformSavings] = useState(0);
  const [totalGoals, setTotalGoals] = useState(0);
  const [activeAutoSaves, setActiveAutoSaves] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserSavingsSummary | null>(null);
  const [userGoals, setUserGoals] = useState<any[]>([]);
  const [userDeposits, setUserDeposits] = useState<any[]>([]);
  const [userAutoSaves, setUserAutoSaves] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editGoal, setEditGoal] = useState<{ goal: any; name: string; target_amount: string } | null>(null);
  const [deleteGoal, setDeleteGoal] = useState<any | null>(null);
  const [closeGoal, setCloseGoal] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsRes, autoRes] = await Promise.all([
        supabase.from("savings_goals").select("*"),
        supabase.from("savings_auto_save").select("*").eq("is_active", true),
      ]);
      const goals = (goalsRes.data as any[]) ?? [];
      const autoSaves = (autoRes.data as any[]) ?? [];
      setActiveAutoSaves(autoSaves.length);
      setTotalGoals(goals.length);
      setTotalPlatformSavings(goals.reduce((s, g) => s + Number(g.saved_amount), 0));
      const userMap = new Map<string, { total_saved: number; goal_count: number; active_goals: number }>();
      for (const g of goals) {
        const existing = userMap.get(g.user_id) ?? { total_saved: 0, goal_count: 0, active_goals: 0 };
        existing.total_saved += Number(g.saved_amount);
        existing.goal_count += 1;
        if (g.status === "active") existing.active_goals += 1;
        userMap.set(g.user_id, existing);
      }
      const userIds = [...userMap.keys()];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", userIds);
        const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
        setSummaries(userIds.map(uid => {
          const p = profileMap.get(uid);
          const s = userMap.get(uid)!;
          return { user_id: uid, name: p?.name ?? "Unknown", phone: p?.phone ?? "", ...s };
        }).sort((a, b) => b.total_saved - a.total_saved));
      } else { setSummaries([]); }
    } catch { setSummaries([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openUserDetail = async (user: UserSavingsSummary) => {
    setSelectedUser(user);
    setDetailLoading(true);
    try {
      const [goalsRes, depositsRes, autoRes] = await Promise.all([
        supabase.from("savings_goals").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false }),
        supabase.from("savings_deposits").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false }).limit(50),
        supabase.from("savings_auto_save").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false }),
      ]);
      setUserGoals((goalsRes.data as any[]) ?? []);
      setUserDeposits((depositsRes.data as any[]) ?? []);
      setUserAutoSaves((autoRes.data as any[]) ?? []);
    } catch {
      setUserGoals([]); setUserDeposits([]); setUserAutoSaves([]);
    } finally { setDetailLoading(false); }
  };

  const refreshDetail = () => { if (selectedUser) openUserDetail(selectedUser); };

  const handleEditGoal = async () => {
    if (!editGoal) return;
    setSaving(true);
    const { goal, name, target_amount } = editGoal;
    const { error } = await supabase.from("savings_goals").update({ name, target_amount: Number(target_amount) }).eq("id", goal.id);
    if (!error) await auditLog("savings_goal_edit", "savings_goal", goal.id, { previous: { name: goal.name, target_amount: goal.target_amount }, new: { name, target_amount } });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Goal updated");
    setEditGoal(null);
    refreshDetail();
    loadData();
  };

  const handleDeleteGoal = async () => {
    if (!deleteGoal) return;
    setSaving(true);
    const { error } = await supabase.from("savings_goals").delete().eq("id", deleteGoal.id);
    if (!error) await auditLog("savings_goal_delete", "savings_goal", deleteGoal.id, { name: deleteGoal.name, saved_amount: deleteGoal.saved_amount, user_id: deleteGoal.user_id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Goal deleted");
    setDeleteGoal(null);
    refreshDetail();
    loadData();
  };

  const handleCloseGoal = async () => {
    if (!closeGoal) return;
    setSaving(true);
    // Return saved amount to user wallet and close goal
    const savedAmt = Number(closeGoal.saved_amount);
    if (savedAmt > 0) {
      const { data: profile } = await supabase.from("profiles").select("balance").eq("user_id", closeGoal.user_id).single();
      if (profile) {
        const newBalance = Number(profile.balance) + savedAmt;
        await supabase.from("profiles").update({ balance: newBalance } as any).eq("user_id", closeGoal.user_id);
      }
    }
    const { error } = await supabase.from("savings_goals").update({ status: "completed" as any, saved_amount: 0 }).eq("id", closeGoal.id);
    if (!error) await auditLog("savings_goal_close", "savings_goal", closeGoal.id, { name: closeGoal.name, returned_amount: savedAmt, user_id: closeGoal.user_id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Goal closed, ৳${savedAmt.toLocaleString()} returned to wallet`);
    setCloseGoal(null);
    refreshDetail();
    loadData();
  };

  const toggleAutoSave = async (autoSave: any) => {
    const newActive = !autoSave.is_active;
    const { error } = await supabase.from("savings_auto_save").update({ is_active: newActive }).eq("id", autoSave.id);
    if (!error) await auditLog("savings_autosave_toggle", "savings_auto_save", autoSave.id, { previous_active: autoSave.is_active, new_active: newActive });
    if (error) { toast.error(error.message); return; }
    toast.success(newActive ? "Auto-save resumed" : "Auto-save paused");
    refreshDetail();
    loadData();
  };

  const filtered = summaries.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center"><Coins className="w-5 h-5 text-teal-600 dark:text-teal-400" /></div>
            <div><p className="text-xs text-muted-foreground">Total Savings</p><p className="text-lg font-bold text-foreground">৳{totalPlatformSavings.toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
            <div><p className="text-xs text-muted-foreground">Total Goals</p><p className="text-lg font-bold text-foreground">{totalGoals}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><CalendarClock className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
            <div><p className="text-xs text-muted-foreground">Active Auto-Saves</p><p className="text-lg font-bold text-foreground">{activeAutoSaves}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone…" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={loadData} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No savings data found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => (
            <Card key={user.user_id} className="cursor-pointer hover:bg-muted/40 transition-colors border-border/60" onClick={() => openUserDetail(user)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div><p className="text-sm font-semibold text-foreground">{user.name || user.phone}</p><p className="text-xs text-muted-foreground">{user.phone} • {user.goal_count} goal(s), {user.active_goals} active</p></div>
                <div className="text-right"><p className="text-sm font-bold text-foreground">৳{user.total_saved.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">saved</p></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selectedUser?.name || selectedUser?.phone}</SheetTitle>
            <SheetDescription>{selectedUser?.phone} — Savings Details</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-2">
            {detailLoading ? (
              <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="space-y-4">
                {/* Goals */}
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Goals ({userGoals.length})</p>
                  {userGoals.map((g: any) => (
                    <div key={g.id} className="p-3 rounded-xl border border-border/60 mb-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">{g.emoji} {g.name}</p>
                        <div className="flex items-center gap-1">
                          <Badge variant={g.status === "completed" ? "default" : "secondary"}>{g.status}</Badge>
                          {g.status === "active" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => setEditGoal({ goal: g, name: g.name, target_amount: String(g.target_amount) })}><Pencil className="w-3 h-3" /></Button>
                              <Button size="sm" variant="ghost" className="h-6 px-1 text-orange-600" onClick={() => setCloseGoal(g)}><XCircle className="w-3 h-3" /></Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 px-1 text-destructive" onClick={() => setDeleteGoal(g)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">৳{Number(g.saved_amount).toLocaleString()} / ৳{Number(g.target_amount).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Auto-saves */}
                {userAutoSaves.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Auto-Save Schedules ({userAutoSaves.length})</p>
                    {userAutoSaves.map((a: any) => (
                      <div key={a.id} className="p-3 rounded-xl border border-border/60 mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">৳{Number(a.amount).toLocaleString()} / {a.frequency}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.duration && <span className="mr-1">Duration: {a.duration}</span>}
                            {a.ends_at && <span>• Ends: {new Date(a.ends_at).toLocaleDateString()}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">Next: {a.next_run_at ? new Date(a.next_run_at).toLocaleDateString() : "—"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={a.settled ? "default" : a.is_active ? "default" : "secondary"}>
                            {a.settled ? "Settled" : a.is_active ? "Active" : "Paused"}
                          </Badge>
                          {!a.settled && (
                            <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => toggleAutoSave(a)}>
                              {a.is_active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Deposits */}
                <div>
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Deposit History ({userDeposits.length})</p>
                  {userDeposits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No deposits yet</p>
                  ) : userDeposits.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                      <div><p className="text-sm font-medium text-foreground">৳{Number(d.amount).toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p></div>
                      <Badge variant="outline" className="text-[10px]">{d.source}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Edit goal dialog */}
      <Dialog open={!!editGoal} onOpenChange={v => !v && setEditGoal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Goal</DialogTitle><DialogDescription>Update goal name and target</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Goal name" value={editGoal?.name ?? ""} onChange={e => editGoal && setEditGoal({ ...editGoal, name: e.target.value })} />
            <Input placeholder="Target amount (৳)" type="number" value={editGoal?.target_amount ?? ""} onChange={e => editGoal && setEditGoal({ ...editGoal, target_amount: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGoal(null)}>Cancel</Button>
            <Button onClick={handleEditGoal} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close goal confirmation */}
      <AlertDialog open={!!closeGoal} onOpenChange={v => !v && setCloseGoal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Goal</AlertDialogTitle>
            <AlertDialogDescription>Close "{closeGoal?.name}" and return ৳{Number(closeGoal?.saved_amount).toLocaleString()} to the user's wallet?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseGoal} disabled={saving}>{saving ? "Closing…" : "Close & Return"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete goal confirmation */}
      <AlertDialog open={!!deleteGoal} onOpenChange={v => !v && setDeleteGoal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>Permanently delete "{deleteGoal?.name}"? Saved amount (৳{Number(deleteGoal?.saved_amount).toLocaleString()}) will NOT be returned. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGoal} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{saving ? "Deleting…" : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
