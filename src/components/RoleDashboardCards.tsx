import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, UserCheck, Store, Building2, Landmark, ChevronRight,
} from "lucide-react";
import { useUserRoles } from "@/hooks/use-user-roles";

interface DashboardInfo {
  role: string;
  label: string;
  description: string;
  path: string;
  icon: React.ElementType;
  gradient: string;
}

const DASHBOARDS: DashboardInfo[] = [
  {
    role: "admin",
    label: "Admin Panel",
    description: "Users, transactions & fraud alerts",
    path: "/admin",
    icon: ShieldCheck,
    gradient: "from-[hsl(0_74%_55%)] to-[hsl(350_70%_42%)]",
  },
  {
    role: "agent",
    label: "Agent Portal",
    description: "Cash-in, cash-out & float management",
    path: "/agent",
    icon: UserCheck,
    gradient: "from-[hsl(122_38%_50%)] to-[hsl(134_52%_30%)]",
  },
  {
    role: "merchant",
    label: "Merchant Portal",
    description: "QR payments, settlements & MDR",
    path: "/merchant",
    icon: Store,
    gradient: "from-[hsl(291_64%_44%)] to-[hsl(300_60%_35%)]",
  },
  {
    role: "distributor",
    label: "Distributor Portal",
    description: "Agent network & float distribution",
    path: "/distributor",
    icon: Building2,
    gradient: "from-[hsl(217_80%_50%)] to-[hsl(226_75%_40%)]",
  },
  {
    role: "super_distributor",
    label: "Super Distributor",
    description: "Regional operations & oversight",
    path: "/super-distributor",
    icon: Landmark,
    gradient: "from-[hsl(36_95%_55%)] to-[hsl(28_90%_45%)]",
  },
];

export default function RoleDashboardCards() {
  const { roles, loading } = useUserRoles();
  const navigate = useNavigate();

  const available = DASHBOARDS.filter((d) => roles.includes(d.role as any));

  if (loading || available.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">
        Your Dashboards
      </h3>
      <div className="grid gap-3">
        {available.map((d, i) => (
          <motion.button
            key={d.role}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3 }}
            onClick={() => navigate(d.path)}
            className="w-full text-left rounded-xl p-4 bg-card shadow-[var(--shadow-card)] border border-border/50 flex items-center gap-4 hover:shadow-[var(--shadow-md)] transition-shadow active:scale-[0.98]"
          >
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.gradient} flex items-center justify-center shrink-0`}
            >
              <d.icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm">{d.label}</p>
              <p className="text-xs text-muted-foreground truncate">
                {d.description}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
