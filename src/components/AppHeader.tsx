import { Bell, Search, Sun, Moon, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import { useNotifications } from "@/hooks/use-notifications";
import { useI18n } from "@/lib/i18n";

interface AppHeaderProps {
  onSignOut?: () => void;
}

const AppHeader = ({ onSignOut }: AppHeaderProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const { unreadCount } = useNotifications();

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center justify-between py-1"
      >
        {/* Left — Logout (branded) */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onSignOut}
          className="flex items-center gap-2 px-3 py-2 rounded-2xl gradient-primary border border-primary/30 shadow-glow text-primary-foreground hover:shadow-glow-lg transition-all duration-150 tap-target"
          aria-label={t("signOut")}
        >
          <LogOut size={15} strokeWidth={2} />
          <span className="text-[13px] font-semibold">{t("logout")}</span>
        </motion.button>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Dark mode toggle */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={toggleTheme}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-primary/10 border border-primary/25 shadow-card flex items-center justify-center text-primary hover:bg-primary/15 hover:shadow-elevated transition-all duration-150 tap-target overflow-hidden"
            aria-label={t("ahToggleDark")}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mounted && (
                <motion.span
                  key={isDark ? "moon" : "sun"}
                  initial={{ opacity: 0, rotate: -30, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 30, scale: 0.6 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="flex items-center justify-center"
                >
                  {isDark ? <Moon size={17} strokeWidth={2} /> : <Sun size={17} strokeWidth={2} />}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Search */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-primary/10 border border-primary/25 shadow-card flex items-center justify-center text-primary hover:bg-primary/15 hover:shadow-elevated transition-all duration-150 tap-target"
            aria-label="Search"
          >
            <Search size={17} strokeWidth={2} />
          </motion.button>

          {/* Bell + badge */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => setShowNotif(true)}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl gradient-primary border border-primary/30 shadow-glow flex items-center justify-center text-primary-foreground hover:shadow-glow-lg transition-all duration-150 tap-target"
            aria-label="Notifications"
          >
            <Bell size={17} strokeWidth={2} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-accent text-accent-foreground text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-background"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.header>

      <NotificationCenter open={showNotif} onClose={() => setShowNotif(false)} />
    </>
  );
};

export default AppHeader;
