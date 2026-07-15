import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RotateCcw, Loader2, Plus, Minus } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface Version {
  id: string;
  preset_id: string;
  name: string;
  description: string | null;
  permissions: string[];
  is_builtin: boolean;
  change_type: "created" | "updated" | "deleted" | "restored";
  changed_by: string | null;
  created_at: string;
  changed_by_name?: string;
}

interface Props {
  presetId: string | null;
  presetName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored?: () => void;
}

export default function PresetVersionHistoryDialog({ presetId, presetName, open, onOpenChange, onRestored }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState<Version | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!presetId) return;
    setLoading(true);
    const { data } = await supabase
      .from("admin_role_permission_preset_versions" as any)
      .select("id, preset_id, name, description, permissions, is_builtin, change_type, changed_by, created_at")
      .eq("preset_id", presetId)
      .order("created_at", { ascending: false });
    const list = ((data ?? []) as any[]) as Version[];
    const ids = Array.from(new Set(list.map((v) => v.changed_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, name, phone").in("user_id", ids);
      const m = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.user_id, p]));
      for (const v of list) v.changed_by_name = v.changed_by ? (m[v.changed_by]?.name || m[v.changed_by]?.phone) : undefined;
    }
    setVersions(list);
    setLoading(false);
  }, [presetId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const doRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    const { error } = await supabase.rpc("restore_preset_version" as any, { _version_id: restoreTarget.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Restored preset to version from ${format(new Date(restoreTarget.created_at), "PPp")}`);
    setRestoreTarget(null);
    onOpenChange(false);
    onRestored?.();
  };

  // Compute a diff against the immediately-newer version (chronologically after this one).
  const diffs = useMemo(() => {
    const map: Record<string, { added: string[]; removed: string[] }> = {};
    // versions are DESC; compare each with previous (index-1) which is newer
    for (let i = 0; i < versions.length; i++) {
      const cur = new Set(versions[i].permissions || []);
      const newer = i === 0 ? null : new Set(versions[i - 1].permissions || []);
      if (!newer) { map[versions[i].id] = { added: [], removed: [] }; continue; }
      const added: string[] = [];
      const removed: string[] = [];
      for (const k of newer) if (!cur.has(k)) added.push(k);
      for (const k of cur) if (!newer.has(k)) removed.push(k);
      map[versions[i].id] = { added, removed };
    }
    return map;
  }, [versions]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-4 h-4" /> Version history — {presetName}</DialogTitle>
            <DialogDescription>Every change to this preset is snapshotted. Click restore on any version to bring it back.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : versions.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No versions yet.</p>
          ) : (
            <ScrollArea className="max-h-[520px]">
              <div className="space-y-2">
                {versions.map((v, i) => {
                  const isCurrent = i === 0;
                  const d = diffs[v.id];
                  return (
                    <div key={v.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium flex items-center gap-2">
                            {isCurrent && <Badge className="bg-emerald-500/10 text-emerald-700 text-[9px]">current</Badge>}
                            <Badge variant="outline" className="text-[9px] capitalize">{v.change_type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {v.changed_by_name ? `by ${v.changed_by_name}` : v.changed_by ? `by ${v.changed_by.slice(0, 8)}` : "system"}
                            {" · "}<span title={format(new Date(v.created_at), "PPpp")}>{format(new Date(v.created_at), "PPp")}</span>
                          </p>
                        </div>
                        {!isCurrent && v.change_type !== "deleted" && (
                          <Button size="sm" variant="outline" onClick={() => setRestoreTarget(v)} className="gap-1 shrink-0">
                            <RotateCcw className="w-3 h-3" /> Restore
                          </Button>
                        )}
                      </div>

                      {d && (d.added.length > 0 || d.removed.length > 0) && (
                        <div className="text-[10px] flex flex-wrap gap-1">
                          {d.added.map((k) => (
                            <Badge key={`a-${k}`} variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                              <Plus className="w-2.5 h-2.5 mr-0.5" />{k}
                            </Badge>
                          ))}
                          {d.removed.map((k) => (
                            <Badge key={`r-${k}`} variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                              <Minus className="w-2.5 h-2.5 mr-0.5" />{k}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1">Snapshot ({(v.permissions || []).length} permissions):</p>
                        <div className="flex flex-wrap gap-1">
                          {(v.permissions || []).length === 0
                            ? <span className="text-[10px] text-muted-foreground italic">no permissions</span>
                            : v.permissions.map((k) => <Badge key={k} variant="secondary" className="text-[9px]">{k}</Badge>)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current preset with the snapshot from{" "}
              {restoreTarget && format(new Date(restoreTarget.created_at), "PPp")}. A new "restored" version entry will be added.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRestore} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
