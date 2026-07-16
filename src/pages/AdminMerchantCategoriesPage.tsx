import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { ArrowLeft, Tag, Edit2, RefreshCw, Power, PowerOff, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

interface Row { id: string; name: string; label: string; is_active: boolean; sort_order: number; created_by?: string | null; original_input?: string | null; created_at?: string; }

export default function AdminMerchantCategoriesPage() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [renameFor, setRenameFor] = useState<Row | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("merchant_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    setRows(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (r: Row) => {
    const { error } = await (supabase as any).rpc("admin_set_merchant_category_active", { _name: r.name, _active: !r.is_active });
    if (error) return toast.error(error.message);
    toast.success(`Category ${r.is_active ? "disabled" : "enabled"}`);
    load();
  };

  const submitRename = async () => {
    if (!renameFor || !renameValue.trim()) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("admin_rename_merchant_category", { _old_name: renameFor.name, _new_label: renameValue.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Renamed — existing merchants moved automatically");
    setRenameFor(null); setRenameValue("");
    load();
  };

  const filtered = rows.filter(r =>
    !search.trim() ||
    r.label.toLowerCase().includes(search.toLowerCase()) ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.original_input ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const otherCreated = filtered.filter(r => r.created_by);
  const standard    = filtered.filter(r => !r.created_by);

  const renderRow = (r: Row) => (
    <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border ${r.is_active ? "bg-card" : "bg-muted/30 opacity-70"}`}>
      <Tag className="w-4 h-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm truncate">{r.label}</p>
          <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.name}</code>
          {!r.is_active && <Badge variant="outline" className="text-[10px]">disabled</Badge>}
          {r.created_by && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30"><UserIcon className="w-2.5 h-2.5 mr-1" /> from Other</Badge>}
        </div>
        {r.original_input && r.original_input !== r.label && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Original typed value: "{r.original_input}"</p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={() => { setRenameFor(r); setRenameValue(r.label); }}>
        <Edit2 className="w-3.5 h-3.5 mr-1" /> Rename
      </Button>
      <Button size="sm" variant={r.is_active ? "outline" : "default"} onClick={() => toggle(r)}>
        {r.is_active ? <><PowerOff className="w-3.5 h-3.5 mr-1" /> Disable</> : <><Power className="w-3.5 h-3.5 mr-1" /> Enable</>}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-3">
        <Button variant="ghost" onClick={() => nav(-1)} className="mb-1"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Tag className="w-4 h-4" /> Merchant Categories</CardTitle>
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Search by label, code or original typed value…" value={search} onChange={e => setSearch(e.target.value)} />
            {otherCreated.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Created via "Other" ({otherCreated.length})</p>
                {otherCreated.map(renderRow)}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Standard ({standard.length})</p>
              {standard.map(renderRow)}
              {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">No categories</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!renameFor} onOpenChange={o => !o && setRenameFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename "{renameFor?.label}"</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input value={renameValue} maxLength={80} onChange={e => setRenameValue(e.target.value)} placeholder="New display label" />
            <p className="text-[11px] text-muted-foreground">All merchants currently on <code>{renameFor?.name}</code> will be moved to the renamed category automatically.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitRename} disabled={saving || !renameValue.trim()}>{saving ? "Saving…" : "Rename & migrate"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
