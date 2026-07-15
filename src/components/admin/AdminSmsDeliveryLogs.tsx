import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessagesSquare, RefreshCw, Search } from "lucide-react";

interface SmsLog {
  id: string;
  purpose: string;
  agent_user_id: string | null;
  phone_masked: string;
  status: "sent" | "failed";
  provider_status_code: number | null;
  provider_response: string | null;
  error_message: string | null;
  issued_by: string | null;
  created_at: string;
}

export default function AdminSmsDeliveryLogs() {
  const [rows, setRows] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("sms_delivery_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows((data ?? []) as SmsLog[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-sms-delivery-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sms_delivery_logs" },
        () => void load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.phone_masked.toLowerCase().includes(q) ||
      r.purpose.toLowerCase().includes(q) ||
      (r.error_message ?? "").toLowerCase().includes(q) ||
      (r.provider_response ?? "").toLowerCase().includes(q)
    );
  });

  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <MessagesSquare className="w-4 h-4 text-primary" /> SMS Delivery Logs
        </h4>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/20">{sent} sent</Badge>
          <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/20">{failed} failed</Badge>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search phone, purpose, or error…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-7 h-8 text-xs"
        />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">No SMS logs yet.</p>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => {
              const open = expanded === r.id;
              return (
                <div key={r.id} className="text-xs">
                  <button
                    onClick={() => setExpanded(open ? null : r.id)}
                    className="w-full grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition"
                  >
                    <Badge
                      variant="outline"
                      className={
                        r.status === "sent"
                          ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/20 h-5 px-1.5 text-[10px]"
                          : "bg-rose-500/15 text-rose-700 border-rose-500/20 h-5 px-1.5 text-[10px]"
                      }
                    >
                      {r.status}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-medium truncate">+88 {r.phone_masked}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{r.purpose}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {r.provider_status_code ? `HTTP ${r.provider_status_code}` : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 space-y-2 bg-muted/20">
                      {r.error_message && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Error</p>
                          <pre className="text-[11px] bg-rose-500/10 border border-rose-500/20 rounded-md p-2 whitespace-pre-wrap break-words">{r.error_message}</pre>
                        </div>
                      )}
                      {r.provider_response && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Provider response</p>
                          <pre className="text-[11px] bg-background border rounded-md p-2 whitespace-pre-wrap break-words max-h-40 overflow-auto">{r.provider_response}</pre>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                        <div>Agent: <span className="font-mono">{r.agent_user_id?.slice(0, 8) ?? "—"}</span></div>
                        <div>Issued by: <span className="font-mono">{r.issued_by?.slice(0, 8) ?? "—"}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
