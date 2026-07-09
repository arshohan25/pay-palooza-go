import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShieldBan, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

const BLOCKED_KEY = "ep_blocked_users";

interface BlockedProfile {
  user_id: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface BlockedUsersPageProps {
  onBack: () => void;
}

const BlockedUsersPage = ({ onBack }: BlockedUsersPageProps) => {
  const { t } = useI18n();
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(BLOCKED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    setBlockedIds(ids);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    supabase
      .rpc("get_blocked_user_profiles", { p_user_ids: ids } as any)
      .then(({ data, error }) => {
        if (!error && data) {
          setProfiles(data as unknown as BlockedProfile[]);
        }
        setLoading(false);
      });
  }, []);

  const handleUnblock = (userId: string) => {
    const updated = blockedIds.filter((id) => id !== userId);
    localStorage.setItem(BLOCKED_KEY, JSON.stringify(updated));
    setBlockedIds(updated);
    setProfiles((prev) => prev.filter((p) => p.user_id !== userId));
    toast.success(t("buUnblocked"));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4 pb-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Blocked Users</h1>
          <p className="text-xs text-muted-foreground">
            Manage users you've blocked from messaging
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : blockedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <ShieldBan size={28} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">No blocked users</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
            Users you block from chat will appear here
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-3xl border border-border/60 shadow-card overflow-hidden">
          <AnimatePresence initial={false}>
            {blockedIds.map((id) => {
              const profile = profiles.find((p) => p.user_id === id);
              const name = profile?.name || "Unknown";
              const phone = profile?.phone || id.slice(0, 8) + "…";
              const avatar = profile?.avatar_url;

              return (
                <motion.div
                  key={id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 last:border-0"
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      className="w-10 h-10 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                      <UserX size={16} className="text-destructive" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground truncate">
                      {name}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {phone}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 rounded-xl"
                    onClick={() => handleUnblock(id)}
                  >
                    Unblock
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default BlockedUsersPage;
