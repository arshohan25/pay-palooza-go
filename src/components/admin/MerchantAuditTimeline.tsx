import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import {
  Clock, CheckCircle2, XCircle, FileText, DollarSign, ShieldCheck,
  Upload, Store, Key, Loader2, AlertTriangle, Send,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  created: Store,
  status_change: CheckCircle2,
  kyc_change: ShieldCheck,
  kyc_upload: Upload,
  kyc_validation: ShieldCheck,
  kyc_resubmit_request: Send,
  pricing_change: DollarSign,
  admin_note: FileText,
  pin_issued: Key,
  approval: CheckCircle2,
  rejection: XCircle,
  vendor_apply: Store,
  vendor_decision: CheckCircle2,
};

function docLabel(k?: string) {
  switch (k) {
    case "nid_front": return "NID (Front)";
    case "nid_back": return "NID (Back)";
    case "trade_license": return "Trade License Document";
    case "trade_license_number": return "Trade License Number";
    case "bank_statement": return "Bank Statement";
    default: return k || "";
  }
}

function eventLabel(e: any): string {
  switch (e.event_type) {
    case "created": return `Merchant created (${e.to_value?.status ?? "?"})`;
    case "status_change": return `Status: ${e.from_value?.status ?? "?"} → ${e.to_value?.status ?? "?"}`;
    case "kyc_change": return `KYC: ${e.from_value?.kyc ?? "?"} → ${e.to_value?.kyc ?? "?"}${e.reason ? ` — ${e.reason}` : ""}`;
    case "kyc_upload": {
      const t = e.to_value ?? {};
      const uploaded = Object.entries(t).filter(([, v]) => v).map(([k]) => k.replace(/_/g, " "));
      return `KYC docs uploaded: ${uploaded.join(", ") || "—"}`;
    }
    case "pricing_change": return `Pricing: MDR ${e.from_value?.mdr}% → ${e.to_value?.mdr}%, Commission ${e.from_value?.commission}% → ${e.to_value?.commission}%, ${e.from_value?.settlement} → ${e.to_value?.settlement}`;
    case "admin_note": return `Admin note: ${e.to_value?.note ?? ""}`;
    case "approval": return `Approved${e.reason ? ` — ${e.reason}` : ""}`;
    case "rejection": return `Rejected${e.reason ? ` — ${e.reason}` : ""}`;
    case "vendor_apply": return `Applied for vendor access (${e.to_value?.store_name ?? ""})`;
    case "vendor_decision": return `Vendor application ${e.to_value?.status}${e.reason ? ` — ${e.reason}` : ""}`;
    case "pin_issued": return `Temporary PIN issued via ${e.to_value?.via ?? "SMS"}`;
    default: return e.event_type;
  }
}

export default function MerchantAuditTimeline({ merchantId }: { merchantId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("merchant_audit_events")
        .select("*").eq("merchant_id", merchantId).order("created_at", { ascending: false }).limit(200);
      if (!active) return;
      setEvents(data ?? []);
      setLoading(false);
    })();
    const ch = supabase.channel(`mat-${merchantId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "merchant_audit_events", filter: `merchant_id=eq.${merchantId}` },
        (payload) => setEvents(prev => [payload.new as any, ...prev]))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [merchantId]);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground"><Loader2 className="w-4 h-4 mx-auto animate-spin" /></div>;
  }
  if (events.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">No audit events yet.</p>;
  }

  return (
    <ScrollArea className="max-h-[500px]">
      <ol className="relative border-l border-border ml-3 space-y-4 py-2">
        {events.map((e) => {
          const Icon = ICON_MAP[e.event_type] ?? Clock;
          return (
            <li key={e.id} className="ml-6">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 ring-4 ring-background">
                <Icon className="w-3 h-3 text-primary" />
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{e.event_type}</Badge>
                <time className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </time>
              </div>
              <p className="text-sm text-foreground mt-1">{eventLabel(e)}</p>
              {e.reason && e.event_type !== "kyc_change" && e.event_type !== "approval" && e.event_type !== "rejection" && (
                <p className="text-xs text-muted-foreground mt-0.5">Reason: {e.reason}</p>
              )}
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
