import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, Shield, UserCog, Search, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Override {
  id: string;
  user_id: string | null;
  feature_key: string;
  visibility: string;
  group_type: string | null;
  group_value: string | null;
  created_at: string;
}

interface FeatureToggle {
  feature_key: string;
  label: string;
}

const BADGES = ["new", "basic", "active", "power"] as const;
const ROLES = ["user", "admin", "agent", "merchant", "distributor", "super_distributor"] as const;
const VIS_OPTIONS = [
  { value: "visible", label: "Visible", color: "text-emerald-500" },
  { value: "disabled", label: "Disabled", color: "text-amber-500" },
  { value: "hidden", label: "Hidden", color: "text-destructive" },
];

export default function AdminUserFeatureAccess() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [features, setFeatures] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkVis, setBulkVis] = useState("");

  // Individual user search
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [userOverrides, setUserOverrides] = useState<Override[]>([]);
  const [deleteOverride, setDeleteOverride] = useState<Override | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ov }, { data: ft }] = await Promise.all([
      supabase.from("user_feature_overrides").select("*").order("created_at", { ascending: false }),
      supabase.from("global_feature_toggles").select("feature_key, label").order("sort_order"),
    ]);
    setOverrides((ov as Override[] | null) ?? []);
    setFeatures((ft as FeatureToggle[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-user-feature-overrides")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_feature_overrides" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  // Get current visibility for a group cell
  const getGroupVis = (groupType: string, groupValue: string, featureKey: string) => {
    const match = overrides.find(
      (o) => o.user_id == null && o.group_type === groupType && o.group_value === groupValue && o.feature_key === featureKey
    );
    return match?.visibility ?? "—";
  };

  // Set visibility for a group cell
  const setGroupVis = async (groupType: string, groupValue: string, featureKey: string, visibility: string) => {
    setSaving(true);
    const existing = overrides.find(
      (o) => o.user_id == null && o.group_type === groupType && o.group_value === groupValue && o.feature_key === featureKey
    );

    if (visibility === "—") {
      // Remove override
      if (existing) {
        await supabase.from("user_feature_overrides").delete().eq("id", existing.id);
        toast.success("Override removed");
      }
    } else if (existing) {
      await supabase.from("user_feature_overrides").update({ visibility } as any).eq("id", existing.id);
      toast.success("Override updated");
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("user_feature_overrides").insert({
        user_id: null,
        feature_key: featureKey,
        visibility,
        group_type: groupType,
        group_value: groupValue,
        created_by: session?.user?.id,
      } as any);
      toast.success("Override added");
    }
    setSaving(false);
  };

  // Search users
  const searchUsers = async () => {
    if (!searchPhone.trim()) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, name, phone")
      .ilike("phone", `%${searchPhone.trim()}%`)
      .limit(10);
    setSearchResults((data ?? []) as any[]);
  };

  // Load user-specific overrides
  const loadUserOverrides = async (userId: string) => {
    const { data } = await supabase
      .from("user_feature_overrides")
      .select("*")
      .eq("user_id", userId);
    setUserOverrides((data as Override[] | null) ?? []);
  };

  const selectUser = (u: { id: string; name: string; phone: string }) => {
    setSelectedUser(u);
    loadUserOverrides(u.id);
  };

  const setUserVis = async (featureKey: string, visibility: string) => {
    if (!selectedUser) return;
    setSaving(true);
    const existing = userOverrides.find((o) => o.feature_key === featureKey);

    if (visibility === "—") {
      if (existing) {
        await supabase.from("user_feature_overrides").delete().eq("id", existing.id);
        toast.success("User override removed");
      }
    } else if (existing) {
      await supabase.from("user_feature_overrides").update({ visibility } as any).eq("id", existing.id);
      toast.success("User override updated");
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("user_feature_overrides").insert({
        user_id: selectedUser.id,
        feature_key: featureKey,
        visibility,
        group_type: null,
        group_value: null,
        created_by: session?.user?.id,
      } as any);
      toast.success("User override added");
    }
    await loadUserOverrides(selectedUser.id);
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteOverride) return;
    await supabase.from("user_feature_overrides").delete().eq("id", deleteOverride.id);
    toast.success("Override deleted");
    setDeleteOverride(null);
  };

  // Count overrides per group
  const badgeCounts = BADGES.map((b) => ({
    badge: b,
    count: overrides.filter((o) => o.group_type === "usage_badge" && o.group_value === b).length,
  }));
  const roleCounts = ROLES.map((r) => ({
    role: r,
    count: overrides.filter((o) => o.group_type === "role" && o.group_value === r).length,
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggleFeatureSelection = (key: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAllFeatures = () => {
    if (selectedFeatures.size === features.length) {
      setSelectedFeatures(new Set());
    } else {
      setSelectedFeatures(new Set(features.map((f) => f.feature_key)));
    }
  };

  const bulkApply = async (groupType: string, groups: readonly string[]) => {
    if (!bulkGroup || !bulkVis || selectedFeatures.size === 0) return;
    setSaving(true);
    const keys = Array.from(selectedFeatures);
    await Promise.all(keys.map((key) => setGroupVis(groupType, bulkGroup, key, bulkVis)));
    setSelectedFeatures(new Set());
    setBulkGroup("");
    setBulkVis("");
    setSaving(false);
    toast.success(`Applied to ${keys.length} features`);
  };

  const renderGroupGrid = (groupType: string, groups: readonly string[], label: string) => (
    <div className="space-y-3">
      {/* Bulk toolbar */}
      {selectedFeatures.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/60 border">
          <Badge variant="secondary" className="text-xs">{selectedFeatures.size} selected</Badge>
          <Select value={bulkGroup} onValueChange={setBulkGroup}>
            <SelectTrigger className="h-7 text-[11px] w-[110px]">
              <SelectValue placeholder={`Pick ${label}`} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkVis} onValueChange={setBulkVis}>
            <SelectTrigger className="h-7 text-[11px] w-[100px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="—">— Default</SelectItem>
              {VIS_OPTIONS.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  <span className={v.color}>{v.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-7 text-xs gap-1" disabled={!bulkGroup || !bulkVis || saving} onClick={() => bulkApply(groupType, groups)}>
            <Save className="w-3 h-3" /> Apply
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setSelectedFeatures(new Set()); setBulkGroup(""); setBulkVis(""); }}>
            <X className="w-3 h-3" /> Clear
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedFeatures.size === features.length && features.length > 0}
                  onCheckedChange={toggleAllFeatures}
                />
              </TableHead>
              <TableHead className="min-w-[160px]">Feature</TableHead>
              {groups.map((g) => (
                <TableHead key={g} className="text-center capitalize min-w-[100px]">
                  {g}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {groupType === "usage_badge"
                      ? badgeCounts.find((b) => b.badge === g)?.count ?? 0
                      : roleCounts.find((r) => r.role === g)?.count ?? 0}
                  </Badge>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {features.map((f) => (
              <TableRow key={f.feature_key} className={selectedFeatures.has(f.feature_key) ? "bg-muted/40" : ""}>
                <TableCell>
                  <Checkbox
                    checked={selectedFeatures.has(f.feature_key)}
                    onCheckedChange={() => toggleFeatureSelection(f.feature_key)}
                  />
                </TableCell>
                <TableCell className="font-medium text-sm">
                  {f.label}
                  <span className="block text-[10px] font-mono text-muted-foreground">{f.feature_key}</span>
                </TableCell>
                {groups.map((g) => {
                  const currentVis = getGroupVis(groupType, g, f.feature_key);
                  return (
                    <TableCell key={g} className="text-center">
                      <Select
                        value={currentVis}
                        onValueChange={(val) => setGroupVis(groupType, g, f.feature_key, val)}
                        disabled={saving}
                      >
                        <SelectTrigger className="h-7 text-[11px] w-[90px] mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="—">— Default</SelectItem>
                          {VIS_OPTIONS.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              <span className={v.color}>{v.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-foreground">User Feature Access</h3>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Override feature visibility per usage badge, role, or individual user
        </p>
      </div>

      <Tabs defaultValue="badge" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="badge" className="gap-1 text-xs">
            <Users className="w-3.5 h-3.5" /> By Badge
          </TabsTrigger>
          <TabsTrigger value="role" className="gap-1 text-xs">
            <Shield className="w-3.5 h-3.5" /> By Role
          </TabsTrigger>
          <TabsTrigger value="user" className="gap-1 text-xs">
            <UserCog className="w-3.5 h-3.5" /> Individual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="badge" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Users are categorized: <strong>New</strong> (&lt;7 days), <strong>Basic</strong> (7-30 days, &lt;10 txn), <strong>Active</strong> (30+ days or 10+ txn), <strong>Power</strong> (90+ days &amp; 50+ txn)
          </p>
          {renderGroupGrid("usage_badge", BADGES, "Badge")}
        </TabsContent>

        <TabsContent value="role" className="mt-4">
          {renderGroupGrid("role", ROLES, "Role")}
        </TabsContent>

        <TabsContent value="user" className="mt-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by phone..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              className="max-w-xs"
            />
            <Button onClick={searchUsers} size="sm" variant="outline" className="gap-1">
              <Search className="w-3.5 h-3.5" /> Search
            </Button>
          </div>

          {searchResults.length > 0 && !selectedUser && (
            <div className="border rounded-lg divide-y">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium">{u.name || "No name"}</p>
                  <p className="text-xs text-muted-foreground">{u.phone}</p>
                </button>
              ))}
            </div>
          )}

          {selectedUser && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{selectedUser.name || "No name"}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedUser(null); setUserOverrides([]); }}
                >
                  Change User
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="w-[120px]">Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features.map((f) => {
                    const currentVis = userOverrides.find((o) => o.feature_key === f.feature_key)?.visibility ?? "—";
                    return (
                      <TableRow key={f.feature_key}>
                        <TableCell>
                          <span className="text-sm">{f.label}</span>
                          <span className="block text-[10px] font-mono text-muted-foreground">{f.feature_key}</span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={currentVis}
                            onValueChange={(val) => setUserVis(f.feature_key, val)}
                            disabled={saving}
                          >
                            <SelectTrigger className="h-7 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="—">— Default</SelectItem>
                              {VIS_OPTIONS.map((v) => (
                                <SelectItem key={v.value} value={v.value}>
                                  <span className={v.color}>{v.label}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOverride} onOpenChange={(o) => { if (!o) setDeleteOverride(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Override?</AlertDialogTitle>
            <AlertDialogDescription>This override will be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
