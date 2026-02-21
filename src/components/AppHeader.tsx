import { Bell, Sun, Moon, LogOut, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import { INITIAL_NOTIFICATIONS } from "@/components/NotificationCenter";
import { useI18n } from "@/lib/i18n";

const REGISTERED_KEY = "mfs_registered_phone";
const USER_NAME_KEY = "mfs_user_name";

interface AppHeaderProps {
  onSignOut?: () => void;
}

const AppHeader = ({ onSignOut }: AppHeaderProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(
    () => INITIAL_NOTIFICATIONS.filter((n) => !n.read).length,
  );

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const displayName = useMemo(() => {
    const stored = localStorage.getItem(USER_NAME_KEY);
    if (stored) return stored;
    const phone = localStorage.getItem(REGISTERED_KEY);
    if (phone) return `+880 ${phone.slice(0, 3)}****${phone.slice(-3)}`;
    return "User";
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const initials = useMemo(() => {
    return displayName
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";
  }, [displayName]);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center gap-3 py-2"
      >
        {/* Avatar + greeting */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-sm shadow-glow shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              {greeting} <Sparkles size={10} className="text-accent" />
            </p>
            <p className="text-[15px] font-bold text-foreground truncate leading-tight">
              {displayName}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={toggleTheme}
            className="w-9 h-9 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-center text-muted-foreground hover:text-foreground transition-all tap-target"
            aria-label="Toggle dark mode"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mounted && (
                <motion.span
                  key={isDark ? "moon" : "sun"}
                  initial={{ opacity: 0, rotate: -30, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 30, scale: 0.6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center"
                >
                  {isDark ? <Moon size={16} /> : <Sun size={16} />}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => { setShowNotif(true); setUnreadCount(0); }}
            className="relative w-9 h-9 rounded-2xl bg-card border border-border/60 shadow-xs flex items-center justify-center text-muted-foreground hover:text-foreground transition-all tap-target"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 gradient-send text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-background"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onSignOut}
            className="w-9 h-9 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-all tap-target"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </motion.button>
        </div>
      </motion.header>

      <NotificationCenter open={showNotif} onClose={() => setShowNotif(false)} />
    </>
  );
};

export default AppHeader;
