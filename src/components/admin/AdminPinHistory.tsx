import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, RefreshCw, Search, Shield, RotateCcw, Smartphone, Clock } from "lucide-react";

interface PinChangeRecord {
  id: string;
  user_id: string;
  change_type: string;
  method: string;
  changed_by: string | null;
  device_info: string | null;
  created_at: string;
  profile?: { name: string | null; phone: string | null };
  admin_profile?: { name: string | null; phone: string | null };
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  self_change: { label: "Self Change", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  admin_reset: { label: "Admin Reset", color: "bg-amber-500/10 text-amber-600 border-amber-200" },
  forgot_pin: { label: "Forgot PIN", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
};

const METHOD_LABELS: Record<string, string> = {
  manual: "Manual Entry",
  otp_verified: "OTP Verified",
  admin_panel: "Admin Panel",
};

export default function AdminPinHistory() {
  const [records, setRecords] = useState<PinChangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pin_change_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data && data.length > 0) {
      // Fetch profiles for user_ids and changed_by
      const userIds = [...new Set([
        ...data.map(r => r.user_id),
        ...data.filter(r => r.changed_by).map(r => r.changed_by!),
      ])];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);

      const enriched = data.map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) ?? null,
        admin_profile: r.changed_by ? profileMap.get(r.changed_by) ?? null : null,
      }));

      setRecords(enriched as any);
    } else {
      setRecords([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? records.filter(r =>
        r.profile?.phone?.includes(search) ||
        r.profile?.name?.toLowerCase().includes(search.toLowerCase()) ||
        r.user_id.includes(search)
      )
    : records;

  // Stats
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = records.filter(r => r.created_at?.startsWith(today)).length;
  const adminResets = records.filter(r => r.change_type === "admin_reset").length;
  const forgotPin = records.filter(r => r.change_type === "forgot_pin").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">PIN Change History</h3>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={14} className="mr-1" />Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Key className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{records.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Clock className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{todayCount}</p>
          <p className="text-xs text-muted-foreground">Today</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <Shield className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{adminResets}</p>
          <p className="text-xs text-muted-foreground">Admin Resets</p>
        </CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
          <RotateCcw className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{forgotPin}</p>
          <p className="text-xs text-muted-foreground">Forgot PIN</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by phone, name, or user ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PIN change records found</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const typeInfo = TYPE_LABELS[r.change_type] ?? { label: r.change_type, color: "bg-muted text-muted-foreground" };
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{r.profile?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{r.profile?.phone || r.user_id.slice(0, 8) + "…"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${typeInfo.color}`}>
                        {typeInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {METHOD_LABELS[r.method] || r.method}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.admin_profile
                        ? <span className="font-medium text-foreground">{r.admin_profile.name || r.admin_profile.phone}</span>
                        : r.changed_by
                          ? r.changed_by.slice(0, 8) + "…"
                          : <span className="text-muted-foreground/50">Self</span>
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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
