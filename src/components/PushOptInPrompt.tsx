import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const DISMISS_KEY = "push_optin_dismissed_at";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

export default function PushOptInPrompt() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const { supported, configured, permission, subscribed, subscribe, busy } = usePushSubscription();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || !supported || !configured) return;
    if (permission !== "default" || subscribed) return;
    const last = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) return;
    const tm = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(tm);
  }, [user, supported, configured, permission, subscribed]);

  const enable = async () => {
    const r = await subscribe();
    if (r.ok) {
      toast({ title: t("popEnabled") });
      setVisible(false);
    } else {
      toast({ title: t("popFailed"), description: r.error, variant: "destructive" });
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="fixed bottom-20 left-3 right-3 z-50 max-w-md mx-auto"
        >
          <div className="relative bg-card/95 backdrop-blur-xl border border-border/70 rounded-2xl p-4 shadow-2xl">
            <button onClick={dismiss}
              aria-label={t("ipDismiss")}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center">
              <X size={13} className="text-muted-foreground" />
            </button>
            <div className="flex items-start gap-3 pr-7">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Bell size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold text-foreground">{t("popTitle")}</p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">
                  {t("popDesc")}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button onClick={enable} disabled={busy} size="sm" className="rounded-xl h-8 text-[12px] gap-1.5 flex-1">
                    {busy && <Loader2 size={12} className="animate-spin" />}
                    {t("popEnable")}
                  </Button>
                  <Button onClick={dismiss} variant="outline" size="sm" className="rounded-xl h-8 text-[12px]">
                    {t("popNotNow")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
