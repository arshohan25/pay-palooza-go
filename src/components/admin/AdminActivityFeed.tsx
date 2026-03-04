import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ArrowLeftRight, Users, ShieldAlert, Scale, ScanFace, Package,
  Store, UserCheck, Settings, MessageCircle, Wallet, Trash2, Radio,
  Filter, Plus, RefreshCw, X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";

interface ActivityEvent {
  id: string;
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  summary: string;
  timestamp: string;
}

const TABLE_META: Record<string, { icon: typeof Users; colorClass: string; label: string }> = {
  transactions: { icon: ArrowLeftRight, label: "Transaction", colorClass: "text-emerald-500 bg-emerald-500/10" },
  profiles: { icon: Users, label: "User", colorClass: "text-blue-500 bg-blue-500/10" },
  fraud_alerts: { icon: ShieldAlert, label: "Fraud Alert", colorClass: "text-red-500 bg-red-500/10" },
  disputes: { icon: Scale, label: "Dispute", colorClass: "text-amber-500 bg-amber-500/10" },
  kyc_verifications: { icon: ScanFace, label: "KYC", colorClass: "text-violet-500 bg-violet-500/10" },
  orders: { icon: Package, label: "Order", colorClass: "text-cyan-500 bg-cyan-500/10" },
  agents: { icon: UserCheck, label: "Agent", colorClass: "text-emerald-600 bg-emerald-600/10" },
  merchants: { icon: Store, label: "Merchant", colorClass: "text-purple-500 bg-purple-500/10" },
  fee_config: { icon: Settings, label: "Fee Config", colorClass: "text-muted-foreground bg-muted" },
  support_conversations: { icon: MessageCircle, label: "Support", colorClass: "text-pink-500 bg-pink-500/10" },
  platform_treasury: { icon: Wallet, label: "Treasury", colorClass: "text-yellow-600 bg-yellow-600/10" },
};

const EVENT_VERB: Record<string, string> = { INSERT: "New", UPDATE: "Updated", DELETE: "Removed" };

function buildSummary(table: string, eventType: string, payload: any): string {
  const verb = EVENT_VERB[eventType] ?? eventType;
  const row = payload.new ?? payload.old ?? {};
  const meta = TABLE_META[table];
  const label = meta?.label ?? table;

  if (table === "transactions" && row.amount) {
    return `${verb} ${row.type ?? "txn"}: ৳${Number(row.amount).toLocaleString()}`;
  }
  if (table === "fraud_alerts") {
    return `${verb}: ${row.rule_triggered ?? "alert"} (${row.severity ?? "medium"})`;
  }
  if (table === "profiles" && eventType === "INSERT") {
    return `New user: ${row.phone ?? "unknown"}`;
  }
  if (table === "profiles" && eventType === "UPDATE") {
    return `User profile updated`;
  }
  if (table === "kyc_verifications") {
    return `KYC ${row.status ?? "submission"} ${eventType === "INSERT" ? "received" : "updated"}`;
  }
  if (table === "orders") {
    return `Order ${row.order_num ?? ""} ${eventType === "UPDATE" ? `→ ${row.status}` : "created"}`;
  }
  if (table === "disputes") {
    return `Dispute ${eventType === "INSERT" ? "filed" : `status → ${row.status}`}`;
  }
  return `${verb} ${label.toLowerCase()}`;
}

function RelativeTime({ timestamp }: { timestamp: string }) {
  const [text, setText] = useState(() => formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true }));
  useEffect(() => {
    const id = setInterval(() => setText(formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true })), 10_000);
    return () => clearInterval(id);
  }, [timestamp]);
  return <span className="text-[10px] text-muted-foreground whitespace-nowrap">{text}</span>;
}

const LISTENED_TABLES = [
  "transactions", "profiles", "fraud_alerts", "disputes",
  "kyc_verifications", "orders", "agents", "merchants",
  "fee_config", "support_conversations", "platform_treasury",
];

const MAX_EVENTS = 200;

const ALL_TABLES = new Set(LISTENED_TABLES);
const ALL_EVENT_TYPES = new Set<ActivityEvent["eventType"]>(["INSERT", "UPDATE", "DELETE"]);

const EVENT_TYPE_META: Record<string, { icon: typeof Plus; label: string }> = {
  INSERT: { icon: Plus, label: "New" },
  UPDATE: { icon: RefreshCw, label: "Updated" },
  DELETE: { icon: X, label: "Removed" },
};

export default function AdminActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const idCounter = useRef(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeTables, setActiveTables] = useState<Set<string>>(() => new Set(ALL_TABLES));
  const [activeEventTypes, setActiveEventTypes] = useState<Set<string>>(() => new Set(ALL_EVENT_TYPES));

  const toggleTable = (table: string) => {
    setActiveTables(prev => {
      const next = new Set(prev);
      next.has(table) ? next.delete(table) : next.add(table);
      return next;
    });
  };

  const toggleEventType = (et: string) => {
    setActiveEventTypes(prev => {
      const next = new Set(prev);
      next.has(et) ? next.delete(et) : next.add(et);
      return next;
    });
  };

  const filtersActive = activeTables.size < ALL_TABLES.size || activeEventTypes.size < ALL_EVENT_TYPES.size;

  const filteredEvents = useMemo(
    () => events.filter(e => activeTables.has(e.table) && activeEventTypes.has(e.eventType)),
    [events, activeTables, activeEventTypes],
  );

  const pushEvent = useCallback((table: string, eventType: string, payload: any) => {
    const evt: ActivityEvent = {
      id: `evt-${++idCounter.current}`,
      table,
      eventType: eventType as ActivityEvent["eventType"],
      summary: buildSummary(table, eventType, payload),
      timestamp: new Date().toISOString(),
    };
    setEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS));
  }, []);

  useEffect(() => {
    let channel = supabase.channel("admin-activity-feed");
    LISTENED_TABLES.forEach(table => {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => pushEvent(table, payload.eventType, payload),
      );
    });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pushEvent]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-foreground">Activity Feed</span>
          {events.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {filtersActive ? `${filteredEvents.length}/${events.length}` : `(${events.length})`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={filtersOpen ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setFiltersOpen(o => !o)}
          >
            <Filter className="w-3 h-3 mr-1" />
            {filtersActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </Button>
          {events.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setEvents([])}>
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleContent>
          <div className="px-3 py-2 border-b border-border space-y-2">
            {/* Event type chips */}
            <div className="flex flex-wrap gap-1">
              {(Object.entries(EVENT_TYPE_META) as [string, typeof EVENT_TYPE_META["INSERT"]][]).map(([et, meta]) => {
                const active = activeEventTypes.has(et);
                const Icon = meta.icon;
                return (
                  <Button
                    key={et}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="h-5 px-1.5 text-[10px] gap-1"
                    onClick={() => toggleEventType(et)}
                  >
                    <Icon className="w-2.5 h-2.5" /> {meta.label}
                  </Button>
                );
              })}
            </div>
            {/* Table chips */}
            <div className="flex flex-wrap gap-1">
              {LISTENED_TABLES.map(table => {
                const meta = TABLE_META[table];
                if (!meta) return null;
                const active = activeTables.has(table);
                const Icon = meta.icon;
                return (
                  <Button
                    key={table}
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="h-5 px-1.5 text-[10px] gap-1"
                    onClick={() => toggleTable(table)}
                  >
                    <Icon className="w-2.5 h-2.5" /> {meta.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Events list */}
      <ScrollArea className="flex-1">
        {filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Radio className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-xs text-muted-foreground">
              {events.length === 0 ? "Listening for changes…" : "No events match filters"}
            </p>
            {events.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">Events will appear here in real time</p>
            )}
          </div>
        )}
        <AnimatePresence initial={false}>
          {filteredEvents.map(evt => {
            const meta = TABLE_META[evt.table] ?? TABLE_META.profiles;
            const Icon = meta.icon;
            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: 20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: -20, height: 0 }}
                transition={{ duration: 0.25 }}
                className="px-3 py-2 border-b border-border/50 last:border-0"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${meta.colorClass}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground leading-snug truncate">{evt.summary}</p>
                    <RelativeTime timestamp={evt.timestamp} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
