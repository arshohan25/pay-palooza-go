import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search, ShieldOff, Smartphone } from "lucide-react";

interface Row {
  id: string;
  user_id: string;
  phone: string;
  portal: string;
  device_fp: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  token_expires_at: string | null;
}

const PORTALS = ["all", "customer", "agent", "merchant", "distributor", "super_distributor", "admin"];

/**
 * Device trust manager — admins can audit the 90-day device bindings created by
 * first-login OTP verification and revoke trust for a lost/stolen handset.
 */
const AdminTrustedDevices = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState("all");
  const [status, setStatus] = useState("active");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trusted_devices")
      .select("id, user_id, phone, portal, device_fp, created_at, last_seen_at, revoked_at, token_expires_at")
      .order("last_seen_at", { ascending: false })
      .limit(400);
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-trusted-devices")
      .on("postgres_changes", { event: "*", schema: "public", table: "trusted_devices" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const revoke = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("admin_revoke_trusted_device" as any, { _id: id });
    setBusyId(null);
    if (error) return toast.error(error.message);
    if (data === false) return toast.info("Device trust was already revoked");
    toast.success("Device trust revoked — next login needs a fresh OTP");
    load();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (portal !== "all" && r.portal !== portal) return false;
      if (status === "active" && r.revoked_at) return false;
      if (status === "revoked" && !r.revoked_at) return false;
      if (!q) return true;
      return r.phone?.toLowerCase().includes(q) || r.device_fp?.toLowerCase().includes(q);
    });
  }, [rows, search, portal, status]);

  const stats = useMemo(
    () => ({
      active: rows.filter((r) => !r.revoked_at).length,
      revoked: rows.filter((r) => r.revoked_at).length,
      multi: new Set(
        rows
          .filter((r) => !r.revoked_at)
          .map((r) => r.phone)
          .filter((p, _i, arr) => arr.filter((x) => x === p).length > 1),
      ).size,
    }),
    [rows],
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="w-4 h-4 text-primary" /> Trusted Devices
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {stats.active} active bindings · {stats.revoked} revoked · {stats.multi} numbers on multiple devices
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search phone or device fingerprint"
              className="pl-9"
            />
          </div>
          <Select value={portal} onValueChange={setPortal}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PORTALS.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">
                  {p === "all" ? "All portals" : p.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading devices…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No devices match these filters.</p>
        )}
        {filtered.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-2 rounded-2xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium tabular-nums">{r.phone}</p>
                <Badge variant="outline" className="text-[10px] capitalize">{r.portal?.replace("_", " ")}</Badge>
                {r.revoked_at ? (
                  <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">Revoked</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">Trusted</Badge>
                )}
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{r.device_fp}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Last seen {new Date(r.last_seen_at).toLocaleString()} · bound {new Date(r.created_at).toLocaleDateString()}
                {r.token_expires_at && <> · expires {new Date(r.token_expires_at).toLocaleDateString()}</>}
              </p>
            </div>
            {!r.revoked_at && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-destructive"
                onClick={() => revoke(r.id)}
                disabled={busyId === r.id}
              >
                {busyId === r.id ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ShieldOff className="w-3.5 h-3.5 mr-1.5" />
                )}
                Revoke trust
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AdminTrustedDevices;
