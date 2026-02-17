import { Bell, Search } from "lucide-react";
import { motion } from "framer-motion";

const AppHeader = () => {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between py-3"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg shadow-glow">
          ₿
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <p className="text-sm font-bold text-foreground">Tanvir Hasan</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-xl bg-card shadow-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Search size={18} />
        </button>
        <button className="relative w-9 h-9 rounded-xl bg-card shadow-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Bell size={18} />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background" />
        </button>
      </div>
    </motion.header>
  );
};

export default AppHeader;
