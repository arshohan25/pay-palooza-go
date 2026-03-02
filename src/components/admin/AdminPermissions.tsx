import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type PermType = "contacts" | "camera" | "location" | "sms_read";
const PERM_TYPES: PermType[] = ["contacts", "camera", "location", "sms_read"];

interface UserPerm {
  user_id: string;
  name: string | null;
  phone: string;
  permissions: Record<PermType, string>;
  updated_at: string | null;
}

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  granted: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", label: "Granted" },
  denied: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Denied" },
  prompt: { className: "bg-muted text-muted-foreground", label: "Prompt" },
  unsupported: { className: "bg-muted text-muted-foreground", label: "N/A" },
};

export default function AdminPermissions() {
  const [data, setData] = useState<UserPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch all permissions
    const { data: perms } = await supabase
      .from("user_permissions" as any)
      .select("*")
      .order("updated_at", { ascending: false });

    // Fetch profiles for name/phone
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, name, phone");

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    
    // Group by user
    const userMap = new Map<string, UserPerm>();
    
    for (const p of (perms ?? []) as any[]) {
      if (!userMap.has(p.user_id)) {
        const profile = profileMap.get(p.user_id);
        userMap.set(p.user_id, {
          user_id: p.user_id,
          name: profile?.name ?? null,
          phone: profile?.phone ?? "—",
          permissions: { contacts: "--", camera: "--", location: "--", sms_read: "--" },
          updated_at: p.updated_at,
        });
      }
      const entry = userMap.get(p.user_id)!;
      entry.permissions[p.permission as PermType] = p.status;
      if (p.updated_at > (entry.updated_at ?? "")) entry.updated_at = p.updated_at;
    }

    setData(Array.from(userMap.values()));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search)
  );

  // Summary stats
  const stats = PERM_TYPES.map(p => ({
    type: p,
    granted: data.filter(u => u.permissions[p] === "granted").length,
  }));

  const handleExport = () => {
    const header = ["Name", "Phone", ...PERM_TYPES, "Last Updated"].join(",");
    const rows = filtered.map(u =>
      [u.name || "—", u.phone, ...PERM_TYPES.map(p => u.permissions[p]), u.updated_at || "—"].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "permissions_export.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported permissions data");
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.type} className="border-0 shadow-[var(--shadow-card)]">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{s.granted}</p>
              <p className="text-xs text-muted-foreground capitalize">{s.type.replace("_", " ")} granted</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone…" className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="icon" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={handleExport}>
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  {PERM_TYPES.map(p => (
                    <th key={p} className={`text-left px-4 py-3 font-medium capitalize ${p === "sms_read" ? "hidden md:table-cell" : ""}`}>{p.replace("_", " ")}</th>
                  ))}
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.phone}</td>
                    {PERM_TYPES.map(p => {
                      const s = u.permissions[p];
                      const badge = STATUS_BADGE[s] || STATUS_BADGE.prompt;
                      return (
                        <td key={p} className={`px-4 py-3 ${p === "sms_read" ? "hidden md:table-cell" : ""}`}>
                          {s === "--" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Badge variant="secondary" className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {u.updated_at ? new Date(u.updated_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {loading ? "Loading…" : "No permission data yet"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
