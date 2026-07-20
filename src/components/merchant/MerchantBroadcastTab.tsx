import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Send, Users, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const AUDIENCES = [
  { id: "all", labelKey: "mbrAudAll" as TranslationKey },
  { id: "recent_30d", labelKey: "mbrAudRecent" as TranslationKey },
  { id: "inactive_60d", labelKey: "mbrAudInactive" as TranslationKey },
  { id: "gold_silver", labelKey: "mbrAudGoldSilver" as TranslationKey },
] as const;

type Audience = typeof AUDIENCES[number]["id"];


interface Broadcast {
  id: string;
  title: string;
  message: string;
  audience: string;
  status: string;
  recipients_count: number;
  delivered_count: number;
  failed_count: number;
  created_at: string;
}

export default function MerchantBroadcastTab({ merchantId }: { merchantId: string }) {
  const { t } = useI18n();

  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("recent_30d");
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from("merchant_broadcasts")
      .select("*")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data || []) as Broadcast[]);
  }, [merchantId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCount(true);
    setCount(null);
    (async () => {
      const { data, error } = await supabase.rpc("get_merchant_broadcast_audience_count", {
        p_merchant_id: merchantId,
        p_audience: audience,
      });
      if (!cancelled) {
        setCount(error ? 0 : Number(data ?? 0));
        setLoadingCount(false);
      }
    })();
    return () => { cancelled = true; };
  }, [audience, merchantId]);

  const send = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Missing content", description: "Title and message are required.", variant: "destructive" });
      return;
    }
    if (!count || count < 1) {
      toast({ title: "No recipients", description: "This audience is empty.", variant: "destructive" });
      return;
    }
    if (!confirm(`Send this broadcast to ${count} customer${count === 1 ? "" : "s"}?`)) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-broadcast-send", {
        body: { merchantId, title: title.trim(), message: message.trim(), audience, channel: "inapp" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Broadcast sent", description: `Delivered to ${(data as any).delivered} customers.` });
      setTitle(""); setMessage("");
      loadHistory();
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
        <Megaphone size={18} className="text-primary" /> Broadcast
      </h3>

      <Card className="border-0 shadow-elevated">
        <CardContent className="p-4 space-y-3">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">AUDIENCE</label>
            <div className="grid grid-cols-2 gap-2">
              {AUDIENCES.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    audience === a.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-foreground border-border"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
              <Users size={12} />
              {loadingCount ? "Counting…" : `${count ?? 0} customer${count === 1 ? "" : "s"} match`}
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">TITLE</label>
            <Input value={title} onChange={e => setTitle(e.target.value.slice(0, 120))} placeholder="Weekend flash sale" maxLength={120} />
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1.5 block">MESSAGE</label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 500))}
              placeholder="20% off all items until Sunday. Show this message at checkout."
              rows={4}
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{message.length}/500</p>
          </div>

          <Button onClick={send} disabled={sending || !title.trim() || !message.trim() || !count} className="w-full">
            {sending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
            Send broadcast
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">Max 5 broadcasts per day.</p>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-foreground">Recent broadcasts</h4>
          {history.map(b => (
            <Card key={b.id} className="border-0 shadow-elevated">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{b.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{b.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })} · {b.audience}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${
                    b.status === "sent" ? "bg-emerald-500/10 text-emerald-700 border-emerald-200" :
                    b.status === "failed" ? "bg-red-500/10 text-red-700 border-red-200" :
                    "bg-amber-500/10 text-amber-700 border-amber-200"
                  }`}>
                    {b.status === "sent" ? <CheckCircle2 size={9} className="mr-0.5" /> :
                     b.status === "failed" ? <AlertCircle size={9} className="mr-0.5" /> :
                     <Loader2 size={9} className="mr-0.5 animate-spin" />}
                    {b.delivered_count}/{b.recipients_count}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
