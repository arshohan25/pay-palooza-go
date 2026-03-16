import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Plus, Eye, EyeOff, Trash2 } from "lucide-react";

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  body: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

export default function AdminChangelogManager() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ version: "", title: "", body: "" });
  const [adding, setAdding] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("changelog_entries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setEntries((data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const addEntry = async () => {
    if (!newEntry.version.trim() || !newEntry.title.trim()) return;
    setAdding(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("changelog_entries").insert({
      version: newEntry.version.trim(),
      title: newEntry.title.trim(),
      body: newEntry.body,
      created_by: session!.user.id,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Changelog entry created"); setNewEntry({ version: "", title: "", body: "" }); setShowAdd(false); fetch(); }
    setAdding(false);
  };

  const togglePublish = async (entry: ChangelogEntry) => {
    const updates: any = { is_published: !entry.is_published, updated_at: new Date().toISOString() };
    if (!entry.is_published) updates.published_at = new Date().toISOString();
    await supabase.from("changelog_entries").update(updates).eq("id", entry.id);
    toast.success(entry.is_published ? "Unpublished" : "Published");
    fetch();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("changelog_entries").delete().eq("id", id);
    toast.success("Entry deleted");
    fetch();
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg"><FileText className="w-5 h-5" /> Changelog / Release Notes</CardTitle>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="w-4 h-4 mr-1" /> New Entry</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAdd && (
            <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Version (e.g. v2.5.0)" value={newEntry.version} onChange={e => setNewEntry({ ...newEntry, version: e.target.value })} className="w-40" />
                <Input placeholder="Title" value={newEntry.title} onChange={e => setNewEntry({ ...newEntry, title: e.target.value })} className="flex-1" />
              </div>
              <Textarea placeholder="Release notes body (supports plain text)" value={newEntry.body} onChange={e => setNewEntry({ ...newEntry, body: e.target.value })} rows={4} />
              <div className="flex gap-2">
                <Button size="sm" disabled={adding || !newEntry.version.trim() || !newEntry.title.trim()} onClick={addEntry}>{adding ? "Creating…" : "Create Entry"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-muted-foreground text-sm text-center py-8">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No changelog entries yet</p>
          ) : (
            <div className="space-y-3">
              {entries.map(e => (
                <div key={e.id} className="p-4 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{e.version}</Badge>
                      <span className="text-sm font-medium text-foreground">{e.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={e.is_published ? "default" : "secondary"} className="text-[10px]">
                        {e.is_published ? "Published" : "Draft"}
                      </Badge>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => togglePublish(e)}>
                        {e.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteEntry(e.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {e.body && <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{e.body}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Created {new Date(e.created_at).toLocaleDateString()}
                    {e.published_at && ` • Published ${new Date(e.published_at).toLocaleDateString()}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
