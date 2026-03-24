import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Landmark, Plus, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePlatformBanks } from "@/hooks/use-platform-banks";

async function auditLog(action: string, entityId: string, details: any) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    supabase.from("audit_logs").insert({
      actor_id: session.user.id, action, entity_type: "platform_bank", entity_id: entityId, details
    }).then();
  }
}

export default function AdminBankListManager() {
  const { banks, loading, refetch } = usePlatformBanks(true);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = banks.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.short_code.toLowerCase().includes(search.toLowerCase())
  );

  const addBank = async () => {
    if (!newName.trim() || !newCode.trim()) {
      toast.error("Bank name and short code are required");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("platform_banks").insert({
      name: newName.trim(),
      short_code: newCode.trim().toUpperCase(),
      sort_order: banks.length + 1,
    } as any);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Bank already exists" : error.message);
    } else {
      toast.success("Bank added");
      auditLog("create_bank", "new", { name: newName.trim(), short_code: newCode.trim().toUpperCase() });
      setNewName("");
      setNewCode("");
      refetch();
    }
    setAdding(false);
  };

  const toggleBank = async (id: string, active: boolean) => {
    await supabase.from("platform_banks").update({ is_active: !active } as any).eq("id", id);
    toast.success(!active ? "Bank activated" : "Bank deactivated");
    refetch();
  };

  const deleteBank = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await supabase.from("platform_banks").delete().eq("id", id);
    toast.success("Bank deleted");
    refetch();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Landmark className="w-5 h-5 text-primary" /> Platform Bank List
      </h3>

      {/* Add new bank */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Add New Bank</p>
          <div className="flex gap-2">
            <Input placeholder="Bank name" value={newName} onChange={e => setNewName(e.target.value)} className="h-10 rounded-lg flex-1" />
            <Input placeholder="Code" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} className="h-10 rounded-lg w-24" maxLength={8} />
            <Button size="sm" onClick={addBank} disabled={adding} className="h-10 px-4 rounded-lg">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search banks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-lg" />
      </div>

      {/* Bank list */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0 max-h-[400px] overflow-y-auto">
          <div className="divide-y divide-border/50">
            {filtered.map(b => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-primary">{b.short_code.slice(0, 3)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground">{b.short_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={b.is_active ? "default" : "secondary"} className="text-[10px]">
                    {b.is_active ? "Active" : "Off"}
                  </Badge>
                  <Switch checked={b.is_active} onCheckedChange={() => toggleBank(b.id, b.is_active)} />
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive/70 hover:text-destructive" onClick={() => deleteBank(b.id, b.name)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {!loading && filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No banks found</p>}
        </CardContent>
      </Card>
      <p className="text-[10px] text-muted-foreground text-center">{banks.length} banks total · {banks.filter(b => b.is_active).length} active</p>
    </div>
  );
}
