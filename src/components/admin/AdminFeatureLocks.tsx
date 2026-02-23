import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Lock, Unlock, Plus, Search, Trash2, Clock, Ban, User,
  Store, UserCheck, X, Loader2, Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const LOCKABLE_FEATURES = [
  { value: "send_money", label: "Send Money" },
  { value: "cash_out", label: "Cash Out" },
  { value: "cash_in", label: "Cash In" },
  { value: "add_money", label: "Add Money" },
  { value: "payment", label: "Payment" },
  { value: "mobile_recharge", label: "Mobile Recharge" },
  { value: "pay_bill", label: "Pay Bill" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "qr_scan", label: "QR Scan" },
  { value: "support_chat", label: "Support Chat" },
  { value: "savings", label: "Savings" },
  { value: "all_transactions", label: "All Transactions" },
];

const DURATION_OPTIONS = [
  { value: "permanent", label: "Permanent" },
  { value: "1h", label: "1 Hour" },
  { value: "6h", label: "6 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "custom", label: "Custom Date" },
];

interface FeatureLock {
  id: string;
  target_user_id: string;
  feature: string;
  reason: string | null;
  locked_by: string;
  locked_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface UserResult {
  user_id: string;
  name: string | null;
  phone: string;
  status: string;
}

function getExpiresAt(duration: string, customDate?: string): string | null {
  if (duration === "permanent") return null;
  if (duration === "custom" && customDate) return new Date(customDate).toISOString();
  const now = new Date();
  const map: Record<string, number> = {
    "1h": 3600000,
    "6h": 21600000,
    "24h": 86400000,
    "7d": 604800000,
    "30d": 2592000000,
  };
  if (map[duration]) return new Date(now.getTime() + map[duration]).toISOString();
  return null;
}

function isExpired(lock: FeatureLock) {
  return lock.expires_at && new Date(lock.expires_at) < new Date();
}

export default function AdminFeatureLocks() {
  const { user } = useAuth();
  const [locks, setLocks] = useState<FeatureLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // New lock form
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [selectedFeature, setSelectedFeature] = useState("");
  const [duration, setDuration] = useState("permanent");
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  const fetchLocks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feature_locks")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200);
    setLocks((data as FeatureLock[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLocks();
  }, [fetchLocks]);

  // Realtime: auto-refresh when locks change
  useEffect(() => {
    const channel = supabase
      .channel("admin-feature-locks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_locks" }, () => {
        fetchLocks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLocks]);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setUserResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, name, phone, status")
      .or(`phone.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(10);
    setUserResults((data as UserResult[] | null) ?? []);
    setSearching(false);
  }, []);

  const createLock = async () => {
    if (!selectedUser || !selectedFeature || !user) return;
    setSaving(true);
    const expiresAt = getExpiresAt(duration, customDate);

    const { error } = await supabase.from("feature_locks").insert({
      target_user_id: selectedUser.user_id,
      feature: selectedFeature,
      reason: reason || null,
      locked_by: user.id,
      expires_at: expiresAt,
    } as any);

    if (error) {
      toast.error("Failed to create lock");
    } else {
      toast.success(`${LOCKABLE_FEATURES.find(f => f.value === selectedFeature)?.label} locked for ${selectedUser.name || selectedUser.phone}`);
      resetForm();
      setDialogOpen(false);
      fetchLocks();
    }
    setSaving(false);
  };

  const removeLock = async (lockId: string) => {
    const { error } = await supabase
      .from("feature_locks")
      .update({ is_active: false } as any)
      .eq("id", lockId);
    if (error) {
      toast.error("Failed to remove lock");
    } else {
      toast.success("Feature unlocked");
      setLocks(prev => prev.filter(l => l.id !== lockId));
    }
  };

  const resetForm = () => {
    setUserSearch("");
    setUserResults([]);
    setSelectedUser(null);
    setSelectedFeature("");
    setDuration("permanent");
    setCustomDate("");
    setReason("");
  };

  const filteredLocks = locks.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.feature.includes(q) || l.target_user_id.includes(q) || l.reason?.toLowerCase().includes(q);
  });

  const featureLabel = (f: string) => LOCKABLE_FEATURES.find(x => x.value === f)?.label || f;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Feature Locks</h3>
          <Badge variant="secondary" className="text-xs">{locks.length} active</Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Lock Feature
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-destructive" /> Lock a Feature
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* User search */}
              <div className="space-y-2">
                <Label>Target User</Label>
                {selectedUser ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedUser.name || "—"}</span>
                    <span className="text-xs text-muted-foreground">{selectedUser.phone}</span>
                    <Button variant="ghost" size="icon" className="ml-auto h-6 w-6" onClick={() => setSelectedUser(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by phone or name…"
                        className="pl-10"
                        value={userSearch}
                        onChange={e => {
                          setUserSearch(e.target.value);
                          searchUsers(e.target.value);
                        }}
                      />
                      {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    {userResults.length > 0 && (
                      <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                        {userResults.map(u => (
                          <button
                            key={u.user_id}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors text-sm"
                            onClick={() => { setSelectedUser(u); setUserResults([]); setUserSearch(""); }}
                          >
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium">{u.name || "—"}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{u.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Feature selection */}
              <div className="space-y-2">
                <Label>Feature to Lock</Label>
                <Select value={selectedFeature} onValueChange={setSelectedFeature}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select feature…" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCKABLE_FEATURES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {duration === "custom" && (
                  <Input
                    type="datetime-local"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea
                  placeholder="e.g. Suspicious activity detected…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="resize-none h-20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={createLock}
                disabled={!selectedUser || !selectedFeature || saving}
                className="gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Lock Feature
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search active locks */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter locks…"
          className="pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Active locks table */}
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" /> Active Feature Locks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Feature</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Reason</th>
                    <th className="text-left px-4 py-3 font-medium">Expires</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Locked At</th>
                    <th className="text-left px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocks.map(lock => {
                    const expired = isExpired(lock);
                    return (
                      <tr key={lock.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${expired ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          {lock.target_user_id.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="destructive" className="text-xs gap-1">
                            <Lock className="w-3 h-3" />
                            {featureLabel(lock.feature)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate hidden md:table-cell">
                          {lock.reason || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {expired ? (
                            <Badge variant="outline" className="text-xs text-amber-600">Expired</Badge>
                          ) : lock.expires_at ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(lock.expires_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Permanent</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                          {new Date(lock.locked_at).toLocaleString("en-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            onClick={() => removeLock(lock.id)}
                          >
                            <Unlock className="w-3 h-3" /> Unlock
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filteredLocks.length === 0 && (
            <div className="text-center py-12">
              <Unlock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No active feature locks</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
