import { Home, ArrowLeftRight, QrCode, Bell, User } from "lucide-react";

const navItems = [
  { icon: Home,           label: "Home",    id: "home" },
  { icon: ArrowLeftRight, label: "History", id: "history" },
  { icon: QrCode,         label: "Scan",    id: "scan", center: true },
  { icon: Bell,           label: "Inbox",   id: "inbox" },
  { icon: User,           label: "Account", id: "account" },
];

interface BottomNavProps {
  activeTab?: string;
  onTabChange?: (id: string) => void;
}

const BottomNav = ({ activeTab = "home", onTabChange }: BottomNavProps) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-elevated z-50">
      <div className="max-w-md mx-auto flex items-end justify-around px-2 pb-1 pt-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          if (item.center) {
            return (
              <button
                key={item.label}
                onClick={() => onTabChange?.(item.id)}
                className="gradient-primary -mt-6 w-14 h-14 rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow active:scale-95 transition-transform"
              >
                <item.icon size={24} />
              </button>
            );
          }
          return (
            <button
              key={item.label}
              onClick={() => onTabChange?.(item.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
