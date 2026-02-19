import { Bell, Search, Sun, Moon, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import { INITIAL_NOTIFICATIONS } from "@/components/NotificationCenter";

interface AppHeaderProps {
  onSignOut?: () => void;
}

const AppHeader = ({ onSignOut }: AppHeaderProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted]       = useState(false);
  const [showNotif, setShowNotif]   = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  // Track unread count independently so badge survives panel close/reopen
  const [unreadCount, setUnreadCount] = useState(
    () => INITIAL_NOTIFICATIONS.filter((n) => !n.read).length,
  );

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const handleSignOut = () => {
    setShowLogout(false);
    sessionStorage.removeItem("mfs_authenticated");
    onSignOut?.();
  };

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="flex items-center justify-between py-1"
      >
        {/* Left — avatar with logout + greeting */}
        <div className="flex items-center gap-3">
          {/* Avatar circle — tap to show logout */}
          <div className="relative md:hidden">
            <motion.button
              whileTap={{ scale: 0.90 }}
              onClick={() => setShowLogout((v) => !v)}
              className="w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-glow shrink-0 relative overflow-hidden"
              aria-label="Account menu"
            >
              <AnimatePresence mode="wait" initial={false}>
                {showLogout ? (
                  <motion.span
                    key="logout-icon"
                    initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 20 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center justify-center"
                  >
                    <LogOut size={16} strokeWidth={2.2} />
                  </motion.span>
                ) : (
                  <motion.span
                    key="logo"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.18 }}
                  >
                    ৳
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Logout popup */}
            <AnimatePresence>
              {showLogout && (
                <>
                  <motion.div
                    key="logout-backdrop"
                    className="fixed inset-0 z-[40]"
                    onClick={() => setShowLogout(false)}
                  />
                  <motion.button
                    key="logout-popup"
                    initial={{ opacity: 0, scale: 0.85, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    onClick={handleSignOut}
                    className="absolute top-12 left-0 z-[41] flex items-center gap-2 px-4 py-2.5 bg-card border border-border/60 rounded-2xl shadow-float text-[13px] font-semibold text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
                  >
                    <LogOut size={14} strokeWidth={2.2} />
                    Sign Out
                  </motion.button>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Greeting + name */}
          <div className="md:hidden">
            <p className="text-[11px] text-muted-foreground font-medium">Welcome back 👋</p>
            <p className="text-[15px] font-bold text-foreground leading-tight">Tanvir Hasan</p>
          </div>

          <div className="hidden md:block">
            <p className="text-[22px] font-bold text-foreground leading-tight">Good morning, Tanvir 👋</p>
            <p className="text-sm text-muted-foreground font-medium">Here's your financial overview</p>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Dark mode toggle */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={toggleTheme}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-elevated transition-all duration-150 tap-target overflow-hidden"
            aria-label="Toggle dark mode"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mounted && (
                <motion.span
                  key={isDark ? "moon" : "sun"}
                  initial={{ opacity: 0, rotate: -30, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0,   scale: 1   }}
                  exit={{   opacity: 0, rotate:  30,  scale: 0.6 }}
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
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-elevated transition-all duration-150 tap-target"
            aria-label="Search"
          >
            <Search size={17} strokeWidth={2} />
          </motion.button>

          {/* Bell + badge */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => { setShowNotif(true); setUnreadCount(0); }}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-elevated transition-all duration-150 tap-target"
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
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 gradient-send text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-background"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.header>

      {/* Notification Center */}
      <NotificationCenter open={showNotif} onClose={() => setShowNotif(false)} />
    </>
  );
};

export default AppHeader;
