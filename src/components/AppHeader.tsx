import { Bell, Search } from "lucide-react";
import { motion } from "framer-motion";

const AppHeader = () => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-center justify-between py-1"
    >
      {/* Left: mobile logo + greeting / desktop greeting */}
      <div className="flex items-center gap-3">
        <div className="md:hidden w-10 h-10 gradient-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-glow shrink-0">
          ₿
        </div>
        <div className="md:hidden">
          <p className="text-[11px] text-muted-foreground font-medium">Welcome back 👋</p>
          <p className="text-[15px] font-bold text-foreground leading-tight">Tanvir Hasan</p>
        </div>
        <div className="hidden md:block">
          <p className="text-[22px] font-bold text-foreground leading-tight">Good morning, Tanvir 👋</p>
          <p className="text-sm text-muted-foreground font-medium">Here's your financial overview</p>
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.90 }}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-elevated transition-all duration-150 tap-target"
          aria-label="Search"
        >
          <Search size={17} strokeWidth={2} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.90 }}
          className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-card border border-border/60 shadow-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:shadow-elevated transition-all duration-150 tap-target"
          aria-label="Notifications"
        >
          <Bell size={17} strokeWidth={2} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-card" />
        </motion.button>
      </div>
    </motion.header>
  );
};

export default AppHeader;
