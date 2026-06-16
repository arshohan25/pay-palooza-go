import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import {
  Activity, MousePointerClick, Eye, QrCode, ArrowLeftRight, ShieldCheck,
  Radio, Search, ChevronDown, ChevronUp, RefreshCw, Filter, User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface ActivityRow {
  id: string;
  user_id: string;
  session_id: string | null;
  event_type: string;
  event_name: string;
  route: string | null;
  target: string | null;
  metadata: Record<string, unknown> | null;
  device_fingerprint: string | null;
  user_agent: string | null;
  ip_address: string | null;
  easypay_uid: string | null;
  created_at: string;
}

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  tap: { label: "Tap", icon: MousePointerClick, color: "bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30" },
  screen_view: { label: "Screen", icon: Eye, color: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30" },
  qr: { label: "QR", icon: QrCode, color: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
  transaction: { label: "Txn", icon: ArrowLeftRight, color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" },
  auth: { label: "Auth", icon: ShieldCheck, color: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30" },
  custom: { label: "Event", icon: Activity, color: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30" },
};

interface Props {
  /** When provided, scope feed to a single user */
  userId?: string;
}

export default function AdminUserActivityPanel({ userId }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [search, setSearch] = useState("");
  const [uidFilter, setUidFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [phoneMap, setPhoneMap] = useState<Record<string, string>>({});
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("user_activity_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (userId) q = q.eq("user_id", userId);
    const { data } = await q;
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  // Realtime
  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel(`activity-${userId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_activity_logs",
          ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
        },
        (payload) => {
          setRows((prev) => [payload.new as ActivityRow, ...prev].slice(0, 200));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [live, userId]);

  // Look up phone numbers for global view (uses a ref to avoid effect re-runs on phoneMap change)
  useEffect(() => {
    if (userId) return;
    const ids = Array.from(new Set(rows.map((r) => r.user_id))).filter(
      (id) => !fetchedIdsRef.current.has(id)
    );
    if (ids.length === 0) return;
    ids.forEach((id) => fetchedIdsRef.current.add(id));
    supabase
      .from("profiles")
      .select("user_id, phone, name")
      .in("user_id", ids)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        setPhoneMap((prev) => {
          const next = { ...prev };
          (data as any[]).forEach((p) => {
            next[p.user_id] = p.name || p.phone || String(p.user_id).slice(0, 8);
          });
          return next;
        });
      });
  }, [rows, userId]);

  const filtered = useMemo(() => {
    const uidQ = uidFilter.trim().toUpperCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.event_type !== typeFilter) return false;
      if (uidQ && !(r.easypay_uid || "").toUpperCase().includes(uidQ)) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        r.event_name.toLowerCase().includes(s) ||
        (r.target || "").toLowerCase().includes(s) ||
        (r.route || "").toLowerCase().includes(s) ||
        (r.easypay_uid || "").toLowerCase().includes(s) ||
        (phoneMap[r.user_id] || "").toLowerCase().includes(s)
      );
    });
  }, [rows, typeFilter, search, uidFilter, phoneMap]);

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search event, target, route…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-full"
            data-track="off"
          />
        </div>
        {!userId && (
          <div className="relative w-[170px]">
            <Input
              placeholder="EP UID…"
              value={uidFilter}
              onChange={(e) => setUidFilter(e.target.value)}
              className="rounded-full font-mono text-xs uppercase"
              data-track="off"
            />
          </div>
        )}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] rounded-full" data-track="off">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="tap">Taps</SelectItem>
            <SelectItem value="screen_view">Screens</SelectItem>
            <SelectItem value="qr">QR</SelectItem>
            <SelectItem value="transaction">Transactions</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={live ? "default" : "outline"}
          onClick={() => setLive((v) => !v)}
          className="rounded-full gap-1.5"
          data-track="off"
        >
          <Radio className={`h-3.5 w-3.5 ${live ? "animate-pulse" : ""}`} />
          {live ? "Live" : "Paused"}
        </Button>
        <Button size="icon" variant="outline" onClick={load} className="rounded-full" data-track="off">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Counts */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} of {rows.length} events
        {live && <span className="ml-2 text-emerald-600 dark:text-emerald-400">● streaming</span>}
      </div>

      {/* List */}
      <ScrollArea className="h-[60vh] rounded-2xl border bg-card/40 backdrop-blur">
        <div className="divide-y divide-border/60">
          <AnimatePresence initial={false}>
            {filtered.map((r) => {
              const meta = TYPE_META[r.event_type] || TYPE_META.custom;
              const Icon = meta.icon;
              const isOpen = expanded === r.id;
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 hover:bg-muted/40 transition"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (r.easypay_uid) {
                        navigate(`/admin/users/${r.easypay_uid}`);
                      } else {
                        setExpanded(isOpen ? null : r.id);
                      }
                    }}
                    className="w-full text-left flex items-start gap-3"
                    data-track="off"
                    title={r.easypay_uid ? `Open ${r.easypay_uid}` : "Toggle details"}
                  >
                    <div className={`shrink-0 h-9 w-9 rounded-xl border flex items-center justify-center ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{r.event_name}</span>
                        {r.target && (
                          <Badge variant="outline" className="text-[10px] font-normal max-w-[200px] truncate">
                            {r.target}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
                          {formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                        {!userId && (
                          <span className="inline-flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            {phoneMap[r.user_id] || r.user_id.slice(0, 8)}
                          </span>
                        )}
                        {r.easypay_uid && (
                          <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            {r.easypay_uid}
                          </code>
                        )}
                        {r.route && <span className="truncate">· {r.route}</span>}
                        {r.ip_address && <span>· {r.ip_address}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : r.id); }}
                      className="p-1 rounded hover:bg-muted"
                      aria-label="Toggle details"
                      data-track="off"
                    >
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="mt-2 ml-12 text-[11px] rounded-lg bg-muted/60 p-2 overflow-x-auto">
                      <pre className="whitespace-pre-wrap break-all">
{JSON.stringify(
  {
    metadata: r.metadata,
    session_id: r.session_id,
    user_agent: r.user_agent,
    device_fingerprint: r.device_fingerprint,
    created_at: r.created_at,
  },
  null,
  2
)}
                      </pre>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {!loading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No activity yet.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
