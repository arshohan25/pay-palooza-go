import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { ShieldAlert, Radio, RefreshCw, User as UserIcon, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AlertRow {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  rpc_name: string;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 p-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm font-mono break-all text-foreground">{value || <span className="italic text-muted-foreground">none</span>}</div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="shrink-0 h-7 w-7 rounded-md"
        onClick={handleCopy}
        disabled={!value}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function AdminEasypayUidAlertsPanel() {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [selected, setSelected] = useState<AlertRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("easypay_uid_access_alerts" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!live) return;
    const channel = supabase
      .channel("easypay-uid-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "easypay_uid_access_alerts" },
        (payload) => {
          const row = payload.new as AlertRow;
          setRows((prev) => [row, ...prev].slice(0, 200));
          toast.error(`Unauthorized EasyPay UID access attempt`, {
            description: `${row.rpc_name} · ${row.actor_role || "anonymous"}`,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [live]);

  return (
    <>
      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            EasyPay UID Access Alerts
            {rows.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{rows.length}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={live ? "default" : "outline"}
              onClick={() => setLive((v) => !v)}
              className="rounded-full gap-1.5"
            >
              <Radio className={`h-3.5 w-3.5 ${live ? "animate-pulse" : ""}`} />
              {live ? "Live" : "Paused"}
            </Button>
            <Button size="icon" variant="outline" onClick={load} className="rounded-full">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[50vh]">
            <div className="divide-y divide-border/60">
              <AnimatePresence initial={false}>
                {rows.map((r) => (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: -6, backgroundColor: "rgba(244,63,94,0.15)" }}
                    animate={{ opacity: 1, y: 0, backgroundColor: "rgba(244,63,94,0)" }}
                    transition={{ duration: 0.6 }}
                    className="p-3 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => setSelected(r)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 h-9 w-9 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 flex items-center justify-center">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-foreground">
                            {r.rpc_name}
                          </code>
                          <Badge variant="outline" className="text-[10px]">
                            role: {r.actor_role || "none"}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground ml-auto whitespace-nowrap">
                            {formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1">
                            <UserIcon className="h-3 w-3" />
                            {r.actor_id ? r.actor_id.slice(0, 8) : "anonymous"}
                          </span>
                          {r.ip_address && <span>· {r.ip_address}</span>}
                        </div>
                        {r.payload && Object.keys(r.payload).length > 0 && (
                          <pre className="mt-1 text-[10px] rounded bg-muted/60 p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
{JSON.stringify(r.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {!loading && rows.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No unauthorized attempts logged.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              Alert Details
            </DialogTitle>
            <DialogDescription>
              Full metadata for this unauthorized EasyPay UID access attempt.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {selected && (
              <>
                <CopyField label="Actor ID" value={selected.actor_id || ""} />
                <CopyField label="Actor Role" value={selected.actor_role || ""} />
                <CopyField label="RPC Name" value={selected.rpc_name} />
                <CopyField label="IP Address" value={selected.ip_address || ""} />
                <CopyField label="User Agent" value={selected.user_agent || ""} />
                <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Payload</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 text-xs px-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(JSON.stringify(selected.payload, null, 2));
                          toast.success("Payload copied");
                        } catch {
                          toast.error("Failed to copy");
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copy JSON
                    </Button>
                  </div>
                  <pre className="text-xs font-mono bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(selected.payload, null, 2)}
                  </pre>
                </div>
                <div className="text-[11px] text-muted-foreground text-right">
                  {formatDistanceToNowStrict(new Date(selected.created_at), { addSuffix: true })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
