import { Home, ArrowLeftRight, QrCode, Bell, User } from "lucide-react";
import { useState } from "react";

const navItems = [
  { icon: Home, label: "Home" },
  { icon: ArrowLeftRight, label: "History" },
  { icon: QrCode, label: "Scan", center: true },
  { icon: Bell, label: "Inbox" },
  { icon: User, label: "Account" },
];

const BottomNav = () => {
  const [active, setActive] = useState(0);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-elevated z-50">
      <div className="max-w-md mx-auto flex items-end justify-around px-2 pb-1 pt-1">
        {navItems.map((item, index) => {
          const isActive = active === index;
          if (item.center) {
            return (
              <button
                key={item.label}
                onClick={() => setActive(index)}
                className="gradient-primary -mt-6 w-14 h-14 rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow active:scale-95 transition-transform"
              >
                <item.icon size={24} />
              </button>
            );
          }
          return (
            <button
              key={item.label}
              onClick={() => setActive(index)}
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
