import { ArrowLeft, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

interface FlowHeaderProps {
  title: string;
  tagline?: string;
  icon?: LucideIcon;
  onBack?: () => void;
  right?: ReactNode;
  sticky?: boolean;
}

/**
 * Unified EasyPay flow header — used across Gift Cards, Coupons,
 * Donations, Insurance and other transactional flows.
 *
 * - `gradient-hero` (brand green → deep green) background
 * - white/15 pill for back button & trailing icon (ring-1 ring-white/20)
 * - Title + optional tagline, left-aligned
 */
export default function FlowHeader({
  title,
  tagline,
  icon: Icon,
  onBack,
  right,
  sticky = true,
}: FlowHeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <div
      className={`${sticky ? "sticky top-0" : ""} z-30 gradient-hero text-primary-foreground backdrop-blur-xl border-b border-primary/30 shadow-glow`}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleBack}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </motion.button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-primary-foreground tracking-tight leading-tight truncate">
            {title}
          </h1>
          {tagline && (
            <p className="text-[10px] text-primary-foreground/80 truncate">{tagline}</p>
          )}
        </div>

        {right ?? (Icon && (
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center ring-1 ring-white/20">
            <Icon className="w-4 h-4 text-primary-foreground" />
          </div>
        ))}
      </div>
    </div>
  );
}
