import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Info, X } from "lucide-react";

interface Incident {
  id: string;
  title: string;
  message: string;
  severity: string;
  scope: string;
  read_only: boolean;
}

const STYLE: Record<string, string> = {
  info: "bg-primary/15 text-primary border-primary/30",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};

const DISMISS_KEY = "easypay_dismissed_incidents";

function loadDismissed(): string[] {
  try { return JSON.parse(sessionStorage.getItem(DISMISS_KEY) || "[]"); } catch { return []; }
}

/**
 * Global banner for active platform incidents / maintenance windows.
 * Reads `platform_incidents` (publicly readable while active) and stays live via realtime.
 */
const IncidentBanner = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);

  const load = async () => {
    const { data } = await supabase
      .from("platform_incidents")
      .select("id, title, message, severity, scope, read_only")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(3);
    setIncidents((data ?? []) as Incident[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("public-platform-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "platform_incidents" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const visible = incidents.filter((i) => !dismissed.includes(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] flex flex-col">
      {visible.map((inc) => {
        const Icon = inc.severity === "info" ? Info : AlertTriangle;
        return (
          <div
            key={inc.id}
            className={`flex items-start gap-2 border-b px-3 py-2 backdrop-blur-md ${STYLE[inc.severity] ?? STYLE.info}`}
            role="status"
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold truncate">
                {inc.title}
                {inc.read_only && <span className="ml-2 font-normal opacity-80">(read-only mode)</span>}
              </p>
              {inc.message && <p className="opacity-90 line-clamp-2">{inc.message}</p>}
            </div>
            <button
              onClick={() => dismiss(inc.id)}
              aria-label="Dismiss notice"
              className="shrink-0 rounded-md p-1 hover:bg-foreground/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default IncidentBanner;
