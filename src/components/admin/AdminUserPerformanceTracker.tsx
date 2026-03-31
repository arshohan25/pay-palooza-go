import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search, Gift, Award, TrendingUp, Users, ChevronDown, ChevronUp,
  Star, Unlock, Percent, RefreshCw, Loader2, Ban, ChevronLeft, ChevronRight,
} from "lucide-react";
import { getCachedSession } from "@/hooks/use-auth";

interface UserPerf {
  user_id: string;
  phone: string | null;
  name: string | null;
  created_at: string;
  total_txns: number;
  monthly_txns: number;
  total_volume: number;
  last_active: string | null;
  txn_breakdown: Record<string, number>;
}

interface UserReward {
  id: string;
  user_id: string;
  reward_type: string;
  reward_value: any;
  reason: string | null;
  status: string;
  expires_at: string | null;
  created_by: string;
  created_at: string;
}

const BADGE_THRESHOLDS = { power: 50, active: 20, basic: 5 };

function getBadge(totalTxns: number, createdAt: string): string {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  if (ageDays < 7) return "New";
  if (totalTxns >= BADGE_THRESHOLDS.power) return "Power";
  if (totalTxns >= BADGE_THRESHOLDS.active) return "Active";
  if (totalTxns >= BADGE_THRESHOLDS.basic) return "Basic";
  return "New";
}

const BADGE_COLORS: Record<string, string> = {
  Power: "bg-primary/15 text-primary border-primary/30",
  Active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  Basic: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  New: "bg-muted text-muted-foreground border-border",
};

function activityScore(u: UserPerf): number {
  const ageDays = Math.max(1, (Date.now() - new Date(u.created_at).getTime()) / 86400000);
  const recency = u.last_active ? Math.max(0, 30 - (Date.now() - new Date(u.last_active).getTime()) / 86400000) / 30 : 0;
  return Math.min(100, Math.round((u.total_txns / ageDays) * 50 + recency * 50));
}

type SortKey = "phone" | "badge" | "total_txns" | "monthly_txns" | "total_volume" | "last_active" | "score";

export default function AdminUserPerformanceTracker() {
  const [users, setUsers] = useState<UserPerf[]>([]);
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [badgeFilter, setBadgeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rewardDialog, setRewardDialog] = useState(false);
  const [rewardType, setRewardType] = useState<string>("coupon");
  const [rewardReason, setRewardReason] = useState("");
  const [rewardValue, setRewardValue] = useState("");
  const [rewardExpiry, setRewardExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState("performance");
  const [availableFeatures, setAvailableFeatures] = useState<{ feature_key: string; label: string }[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Reward History filters
  const [rhSearch, setRhSearch] = useState("");
  const [rhTypeFilter, setRhTypeFilter] = useState("all");
  const [rhStatusFilter, setRhStatusFilter] = useState("all");
  const [rhDateFrom, setRhDateFrom] = useState("");
  const [rhDateTo, setRhDateTo] = useState("");
  const [rhPage, setRhPage] = useState(0);
  const RH_PAGE_SIZE = 20;

  const EXCLUDED_PREFIXES = ["merchant_", "agent_", "distributor_", "super_distributor_", "team_"];

  const loadAvailableFeatures = useCallback(async () => {
    if (selected.size === 0) return;
    setFeaturesLoading(true);

    // Determine badges for selected users so we can check group overrides
    const selectedIds = Array.from(selected);
    const selectedUsers = users.filter(u => selectedIds.includes(u.user_id));
    const selectedBadges = [...new Set(selectedUsers.map(u => getBadge(u.total_txns, u.created_at).toLowerCase()))];

    const [{ data: allFeatures }, { data: userOverrides }, { data: groupOverrides }] = await Promise.all([
      supabase.from("global_feature_toggles").select("feature_key, label, is_enabled, visibility"),
      supabase.from("user_feature_overrides").select("feature_key, user_id, visibility")
        .in("user_id", selectedIds),
      supabase.from("user_feature_overrides").select("feature_key, visibility, group_type, group_value")
        .is("user_id", null)
        .eq("group_type", "usage_badge" as any)
        .in("group_value", selectedBadges),
    ]);

    const userVisibleKeys = new Set(
      (userOverrides ?? [])
        .filter((o: any) => o.visibility === "visible")
        .filter((o: any) => selectedIds.every(uid =>
          (userOverrides ?? []).some((ov: any) => ov.user_id === uid && ov.feature_key === o.feature_key && ov.visibility === "visible")
        ))
        .map((o: any) => o.feature_key)
    );

    const filtered = (allFeatures ?? [])
      .filter((f: any) => !EXCLUDED_PREFIXES.some(p => f.feature_key.startsWith(p)))
      .filter((f: any) => {
        // Resolve visibility: user override > badge override > global
        // 1. User-specific override — if 'visible' for ALL selected, skip
        if (userVisibleKeys.has(f.feature_key)) return false;

        // 2. Badge group override — takes priority over global
        const badgeOverride = (groupOverrides ?? []).find(
          (o: any) => o.feature_key === f.feature_key
        );
        if (badgeOverride) {
          // Badge says visible → user has it → skip
          // Badge says hidden/disabled → user doesn't have it → keep
          return badgeOverride.visibility !== "visible";
        }

        // 3. Global default — if globally visible, user already has it
        const globallyVisible = f.is_enabled && (f.visibility === "visible" || !f.visibility);
        return !globallyVisible;
      });

    setAvailableFeatures(filtered as { feature_key: string; label: string }[]);
    setFeaturesLoading(false);
  }, [selected, users]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: perfData }, { data: rewardData }] = await Promise.all([
      supabase.rpc("get_user_performance_stats") as any,
      (supabase.from as any)("user_rewards").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    const rewardsList = (rewardData as UserReward[]) ?? [];
    setUsers((perfData as UserPerf[]) ?? []);
    setRewards(rewardsList);

    // Resolve admin names for created_by
    const adminIds = [...new Set(rewardsList.map(r => r.created_by).filter(Boolean))];
    if (adminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("user_id, name, phone")
        .in("user_id", adminIds);
      const nameMap: Record<string, string> = {};
      (adminProfiles ?? []).forEach((p: any) => {
        nameMap[p.user_id] = p.name || p.phone || p.user_id.slice(0, 8);
      });
      setAdminNames(nameMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (rewardDialog && rewardType === "feature_unlock") loadAvailableFeatures();
  }, [rewardDialog, rewardType, loadAvailableFeatures]);

  const enriched = useMemo(() =>
    users.map(u => ({ ...u, badge: getBadge(u.total_txns, u.created_at), score: activityScore(u) })),
    [users]
  );

  // Filtered & paginated rewards for Reward History tab
  const filteredRewards = useMemo(() => {
    let list = rewards;
    if (rhSearch) {
      const q = rhSearch.toLowerCase();
      list = list.filter(r => {
        const user = enriched.find(u => u.user_id === r.user_id);
        return (user?.phone ?? "").includes(q) || (user?.name ?? "").toLowerCase().includes(q);
      });
    }
    if (rhTypeFilter !== "all") list = list.filter(r => r.reward_type === rhTypeFilter);
    if (rhStatusFilter !== "all") list = list.filter(r => {
      if (rhStatusFilter === "expired") return r.status === "active" && r.expires_at && new Date(r.expires_at) < new Date();
      if (rhStatusFilter === "revoked") return r.status === "revoked";
      return r.status === rhStatusFilter;
    });
    if (rhDateFrom) list = list.filter(r => r.created_at >= rhDateFrom);
    if (rhDateTo) list = list.filter(r => r.created_at <= rhDateTo + "T23:59:59");
    return list;
  }, [rewards, rhSearch, rhTypeFilter, rhStatusFilter, rhDateFrom, rhDateTo, enriched]);

  const rhTotalPages = Math.max(1, Math.ceil(filteredRewards.length / RH_PAGE_SIZE));
  const pagedRewards = filteredRewards.slice(rhPage * RH_PAGE_SIZE, (rhPage + 1) * RH_PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setRhPage(0); }, [rhSearch, rhTypeFilter, rhStatusFilter, rhDateFrom, rhDateTo]);

  const revokeReward = async (rewardId: string) => {
    const { error } = await (supabase.from as any)("user_rewards").update({ status: "revoked" }).eq("id", rewardId);
    if (error) toast.error("Failed to revoke");
    else { toast.success("Reward revoked"); fetchData(); }
  };

  const isExpired = (r: UserReward) => r.expires_at && new Date(r.expires_at) < new Date();

  const getStatusBadge = (r: UserReward) => {
    if (r.status === "revoked") return <Badge variant="destructive" className="text-[10px]">Revoked</Badge>;
    if (r.status === "claimed") return <Badge variant="secondary" className="text-[10px]">Claimed</Badge>;
    if (isExpired(r)) return <Badge variant="outline" className="text-[10px] border-destructive text-destructive">Expired</Badge>;
    return <Badge className="text-[10px] bg-emerald-600/15 text-emerald-600 border-emerald-600/30" variant="outline">Active</Badge>;
  };

  const filtered = useMemo(() => {
    let list = enriched;
    if (badgeFilter !== "all") list = list.filter(u => u.badge === badgeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => (u.phone ?? "").includes(q) || (u.name ?? "").toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "phone": av = a.phone ?? ""; bv = b.phone ?? ""; break;
        case "badge": av = a.badge; bv = b.badge; break;
        case "total_txns": av = a.total_txns; bv = b.total_txns; break;
        case "monthly_txns": av = a.monthly_txns; bv = b.monthly_txns; break;
        case "total_volume": av = a.total_volume; bv = b.total_volume; break;
        case "last_active": av = a.last_active ?? ""; bv = b.last_active ?? ""; break;
        case "score": av = a.score; bv = b.score; break;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [enriched, badgeFilter, search, sortKey, sortAsc]);

  const badgeCounts = useMemo(() => {
    const counts = { Power: 0, Active: 0, Basic: 0, New: 0 };
    enriched.forEach(u => { counts[u.badge as keyof typeof counts]++; });
    return counts;
  }, [enriched]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(u => u.user_id)));
  };

  const handleBulkReward = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    const session = await getCachedSession();
    if (!session?.user) { toast.error("Not authenticated"); setSubmitting(false); return; }

    let parsedValue: any = {};
    try {
      if (rewardType === "coupon") parsedValue = { code: rewardValue || `REWARD-${Date.now()}` };
      else if (rewardType === "feature_unlock") parsedValue = { feature_key: rewardValue };
      else if (rewardType === "discount") parsedValue = { percent: parseFloat(rewardValue) || 10 };
      else if (rewardType === "bonus_balance") parsedValue = { amount: parseFloat(rewardValue) || 0 };
      else parsedValue = { description: rewardValue };
    } catch { parsedValue = { value: rewardValue }; }

    const rows = Array.from(selected).map(uid => ({
      user_id: uid,
      reward_type: rewardType,
      reward_value: parsedValue,
      reason: rewardReason || null,
      status: "active",
      expires_at: rewardExpiry || null,
      created_by: session.user.id,
    }));

    const { error } = await (supabase.from as any)("user_rewards").insert(rows);
    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success(`Reward assigned to ${selected.size} user(s)`);
      // If feature_unlock, also insert user_feature_overrides
      if (rewardType === "feature_unlock" && rewardValue) {
        const overrides = Array.from(selected).map(uid => ({
          user_id: uid,
          feature_key: rewardValue,
          visibility: "visible",
        }));
        await supabase.from("user_feature_overrides").upsert(overrides as any, { onConflict: "user_id,feature_key" });
      }
      setRewardDialog(false);
      setSelected(new Set());
      setRewardReason("");
      setRewardValue("");
      setRewardExpiry("");
      fetchData();
    }
    setSubmitting(false);
  };

  const formatVolume = (v: number) => `৳${v.toLocaleString("en-BD", { maximumFractionDigits: 0 })}`;
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "2-digit" }) : "—";

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> User Performance & Rewards</h3>
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["Power", "Active", "Basic", "New"] as const).map(b => (
          <Card key={b} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setBadgeFilter(badgeFilter === b ? "all" : b)}>
            <CardContent className="p-4 text-center">
              <Badge variant="outline" className={`${BADGE_COLORS[b]} mb-1`}>{b}</Badge>
              <p className="text-2xl font-bold">{badgeCounts[b]}</p>
              <p className="text-[11px] text-muted-foreground">users</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="performance"><Users className="h-3.5 w-3.5 mr-1" /> Performance</TabsTrigger>
          <TabsTrigger value="rewards"><Gift className="h-3.5 w-3.5 mr-1" /> Reward History</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-3">
          {/* Search & Filter Bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by phone or name…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={badgeFilter} onValueChange={setBadgeFilter}>
              <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Badges</SelectItem>
                <SelectItem value="Power">Power</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Basic">Basic</SelectItem>
                <SelectItem value="New">New</SelectItem>
              </SelectContent>
            </Select>
            {selected.size > 0 && (
              <Button size="sm" onClick={() => setRewardDialog(true)} className="gap-1">
                <Gift className="h-3.5 w-3.5" /> Reward {selected.size} User{selected.size > 1 ? "s" : ""}
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={selectAll} /></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("phone")}>User <SortIcon k="phone" /></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("badge")}>Badge <SortIcon k="badge" /></TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("total_txns")}>Txns <SortIcon k="total_txns" /></TableHead>
                  <TableHead className="cursor-pointer text-right hidden md:table-cell" onClick={() => toggleSort("monthly_txns")}>Monthly <SortIcon k="monthly_txns" /></TableHead>
                  <TableHead className="cursor-pointer text-right hidden md:table-cell" onClick={() => toggleSort("total_volume")}>Volume <SortIcon k="total_volume" /></TableHead>
                  <TableHead className="cursor-pointer text-right hidden lg:table-cell" onClick={() => toggleSort("last_active")}>Last Active <SortIcon k="last_active" /></TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("score")}>Score <SortIcon k="score" /></TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                )}
                {filtered.map(u => (
                  <>
                    <TableRow key={u.user_id} className="group">
                      <TableCell><Checkbox checked={selected.has(u.user_id)} onCheckedChange={() => toggleSelect(u.user_id)} /></TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{u.phone ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[120px]">{u.name ?? ""}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={BADGE_COLORS[u.badge]}>{u.badge}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm">{u.total_txns}</TableCell>
                      <TableCell className="text-right font-mono text-sm hidden md:table-cell">{u.monthly_txns}</TableCell>
                      <TableCell className="text-right font-mono text-sm hidden md:table-cell">{formatVolume(u.total_volume)}</TableCell>
                      <TableCell className="text-right text-sm hidden lg:table-cell">{formatDate(u.last_active)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-sm font-bold ${u.score >= 70 ? "text-emerald-600" : u.score >= 40 ? "text-amber-600" : "text-muted-foreground"}`}>{u.score}</span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(u.user_id) ? s.delete(u.user_id) : s.add(u.user_id); return s; })}>
                          {expanded.has(u.user_id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded.has(u.user_id) && (
                      <TableRow key={`${u.user_id}-exp`}>
                        <TableCell colSpan={9} className="bg-muted/30 px-3 md:px-6 py-3">
                          <div className="flex flex-wrap gap-2 md:gap-3 text-xs mb-2">
                            <span className="text-muted-foreground">Account age: <b>{Math.round((Date.now() - new Date(u.created_at).getTime()) / 86400000)}d</b></span>
                            {Object.entries(u.txn_breakdown ?? {}).map(([type, count]) => (
                              <Badge key={type} variant="secondary" className="text-[10px]">{type}: {String(count)}</Badge>
                            ))}
                          </div>
                          {(() => {
                            const userRewards = rewards.filter(r => r.user_id === u.user_id);
                            if (userRewards.length === 0) return <p className="text-[11px] text-muted-foreground">No rewards assigned</p>;
                            return (
                              <div className="mt-1">
                                <p className="text-xs font-medium mb-1 flex items-center gap-1"><Gift className="h-3 w-3 text-primary" /> Reward History ({userRewards.length})</p>
                                <div className="space-y-1.5">
                                  {userRewards.map(r => (
                                    <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[11px] bg-background/60 rounded px-2 py-1.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge variant="outline" className="capitalize text-[9px]">{r.reward_type.replace("_", " ")}</Badge>
                                        <span className="truncate max-w-[100px]">{JSON.stringify(r.reward_value)}</span>
                                        {getStatusBadge(r)}
                                      </div>
                                      <div className="flex items-center gap-1.5 sm:ml-auto text-muted-foreground">
                                        <span>{formatDate(r.created_at)}</span>
                                        {r.expires_at && <span className={`text-[10px] ${isExpired(r) ? "text-destructive" : "text-muted-foreground"}`}>exp: {formatDate(r.expires_at)}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground text-right">Showing {filtered.length} of {enriched.length} users</p>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-3">
          {/* Search & Filter Controls */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 items-center">
            <div className="relative col-span-2 md:flex-1 md:min-w-[160px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by phone or name…" value={rhSearch} onChange={e => setRhSearch(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={rhTypeFilter} onValueChange={setRhTypeFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="coupon">Coupon</SelectItem>
                <SelectItem value="feature_unlock">Feature Unlock</SelectItem>
                <SelectItem value="discount">Discount</SelectItem>
                <SelectItem value="bonus_balance">Bonus Balance</SelectItem>
                <SelectItem value="custom_offer">Custom Offer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={rhStatusFilter} onValueChange={setRhStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="claimed">Claimed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={rhDateFrom} onChange={e => setRhDateFrom(e.target.value)} className="h-9" placeholder="From" />
            <Input type="date" value={rhDateTo} onChange={e => setRhDateTo(e.target.value)} className="h-9" placeholder="To" />
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden space-y-2">
            {filteredRewards.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No rewards found</p>}
            {pagedRewards.map(r => {
              const user = enriched.find(u => u.user_id === r.user_id);
              return (
                <div key={r.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-mono font-medium">{user?.phone ?? r.user_id.slice(0, 8)}</p>
                      <p className="text-[11px] text-muted-foreground">{user?.name ?? ""}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(r)}
                      {r.status === "active" && !isExpired(r) && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => revokeReward(r.id)} title="Revoke">
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <Badge variant="outline" className="capitalize text-[10px]">{r.reward_type.replace("_", " ")}</Badge>
                    <span className="text-xs text-muted-foreground truncate max-w-[140px]">{JSON.stringify(r.reward_value)}</span>
                  </div>
                  {r.reason && <p className="text-[11px] text-muted-foreground">Reason: {r.reason}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>Issued: {formatDate(r.created_at)}</span>
                    {r.expires_at && <span className={isExpired(r) ? "text-destructive" : ""}>Expires: {formatDate(r.expires_at)}</span>}
                    <span>By: {adminNames[r.created_by] ?? r.created_by?.slice(0, 8) ?? "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="rounded-xl border bg-card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="hidden lg:table-cell">Assigned By</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRewards.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No rewards found</TableCell></TableRow>
                  )}
                  {pagedRewards.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        <p className="font-mono">{enriched.find(u => u.user_id === r.user_id)?.phone ?? r.user_id.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{enriched.find(u => u.user_id === r.user_id)?.name ?? ""}</p>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{r.reward_type.replace("_", " ")}</Badge></TableCell>
                      <TableCell className="text-sm max-w-[120px] truncate">{JSON.stringify(r.reward_value)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">{r.reason ?? "—"}</TableCell>
                      <TableCell>{getStatusBadge(r)}</TableCell>
                      <TableCell className={`text-sm ${isExpired(r) ? "text-destructive" : "text-muted-foreground"}`}>
                        {r.expires_at ? formatDate(r.expires_at) : "—"}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell text-muted-foreground">
                        {adminNames[r.created_by] ?? r.created_by?.slice(0, 8) ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(r.created_at)}</TableCell>
                      <TableCell>
                        {r.status === "active" && !isExpired(r) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => revokeReward(r.id)} title="Revoke">
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {filteredRewards.length} reward{filteredRewards.length !== 1 ? "s" : ""} found
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={rhPage === 0} onClick={() => setRhPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2">{rhPage + 1} / {rhTotalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={rhPage >= rhTotalPages - 1} onClick={() => setRhPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Reward Dialog */}
      <Dialog open={rewardDialog} onOpenChange={setRewardDialog}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /> Assign Reward</DialogTitle>
            <DialogDescription>Reward {selected.size} selected user{selected.size > 1 ? "s" : ""}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Reward Type</label>
              <Select value={rewardType} onValueChange={setRewardType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coupon"><Gift className="h-3.5 w-3.5 inline mr-1" />Coupon</SelectItem>
                  <SelectItem value="feature_unlock"><Unlock className="h-3.5 w-3.5 inline mr-1" />Feature Unlock</SelectItem>
                  <SelectItem value="discount"><Percent className="h-3.5 w-3.5 inline mr-1" />Discount</SelectItem>
                  <SelectItem value="bonus_balance"><Star className="h-3.5 w-3.5 inline mr-1" />Bonus Balance</SelectItem>
                  <SelectItem value="custom_offer"><Award className="h-3.5 w-3.5 inline mr-1" />Custom Offer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {rewardType === "coupon" ? "Coupon Code" : rewardType === "feature_unlock" ? "Feature to Unlock" : rewardType === "discount" ? "Discount %" : rewardType === "bonus_balance" ? "Amount (৳)" : "Offer Description"}
              </label>
              {rewardType === "feature_unlock" ? (
                featuresLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading features…</div>
                ) : availableFeatures.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">All features already unlocked for selected user(s)</p>
                ) : (
                  <Select value={rewardValue} onValueChange={setRewardValue}>
                    <SelectTrigger><SelectValue placeholder="Select a feature…" /></SelectTrigger>
                    <SelectContent>
                      {availableFeatures.map(f => (
                        <SelectItem key={f.feature_key} value={f.feature_key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              ) : (
                <Input value={rewardValue} onChange={e => setRewardValue(e.target.value)} placeholder={rewardType === "coupon" ? "POWER50" : rewardType === "discount" ? "15" : rewardType === "bonus_balance" ? "100" : "Special offer…"} />
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reason</label>
              <Input value={rewardReason} onChange={e => setRewardReason(e.target.value)} placeholder="e.g. Power user milestone" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Expires (optional)</label>
              <Input type="date" value={rewardExpiry} onChange={e => setRewardExpiry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRewardDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkReward} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
              Apply Reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
