import { Home, ArrowLeftRight, QrCode, Bell, User } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { icon: Home,           label: "Home",    id: "home" },
  { icon: ArrowLeftRight, label: "History", id: "history" },
  { icon: QrCode,         label: "Scan",    id: "scan" },
  { icon: Bell,           label: "Inbox",   id: "inbox" },
  { icon: User,           label: "Account", id: "account" },
];

interface SideNavProps {
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

const SideNav = ({ activeTab = "home", onTabChange }: SideNavProps) => {
  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border shadow-card z-40">
      {/* Logo / Brand */}
      <div className="px-6 py-6 flex items-center gap-3 border-b border-border">
        <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-lg shadow-glow">
          ₿
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">BkashClone</p>
          <p className="text-[10px] text-muted-foreground">Mobile Financial</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              whileTap={{ scale: 0.97 }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "gradient-primary text-primary-foreground shadow-card"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon size={19} strokeWidth={isActive ? 2.5 : 2} />
              {item.label}
            </motion.button>
          );
        })}
      </nav>

      {/* User card at bottom */}
      <div className="px-4 pb-6">
        <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            T
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Tanvir Hasan</p>
            <p className="text-[10px] text-muted-foreground truncate">01712-345678</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default SideNav;
