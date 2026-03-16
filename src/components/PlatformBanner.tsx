import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Info, AlertTriangle, Wrench, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: number;
}

const typeConfig: Record<string, { icon: typeof Info; bg: string; border: string; text: string }> = {
  info: { icon: Info, bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-700 dark:text-blue-300" },
  warning: { icon: AlertTriangle, bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-700 dark:text-amber-300" },
  maintenance: { icon: Wrench, bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-700 dark:text-orange-300" },
  success: { icon: CheckCircle, bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-300" },
};

export default function PlatformBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("dismissed_announcements");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("platform_announcements")
        .select("id, title, message, type, priority")
        .eq("is_active", true)
        .lte("starts_at", new Date().toISOString())
        .or("ends_at.is.null,ends_at.gt." + new Date().toISOString())
        .order("priority", { ascending: false })
        .limit(5);
      if (data) setAnnouncements(data);
    };
    load();
  }, []);

  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    sessionStorage.setItem("dismissed_announcements", JSON.stringify([...next]));
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-2 mb-4">
      <AnimatePresence>
        {visible.map(a => {
          const cfg = typeConfig[a.type] || typeConfig.info;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 flex items-start gap-3`}
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${cfg.text}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${cfg.text}`}>{a.title}</p>
                <p className={`text-xs ${cfg.text} opacity-80`}>{a.message}</p>
              </div>
              <button onClick={() => dismiss(a.id)} className={`shrink-0 p-1 rounded-lg hover:bg-black/5 ${cfg.text}`}>
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
