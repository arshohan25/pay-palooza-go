import { useState, useEffect } from "react";
import { useFestivalTheme } from "@/contexts/FestivalThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function FestivalOverlay() {
  const { theme, isActive } = useFestivalTheme();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (theme) {
      const dismissedId = sessionStorage.getItem("festival_dismissed");
      if (dismissedId === theme.id) setDismissed(true);
    }
  }, [theme]);

  if (!isActive || !theme || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="relative rounded-xl overflow-hidden"
        style={{ background: theme.banner_gradient || "hsl(var(--primary))" }}
      >
        <div className="relative px-4 py-4 flex items-center gap-3">
          <span className="text-2xl shrink-0">{theme.emoji}</span>
          <p className="text-white font-semibold text-sm flex-1 drop-shadow">{theme.greeting_text}</p>
          <button
            onClick={() => {
              setDismissed(true);
              sessionStorage.setItem("festival_dismissed", theme.id);
            }}
            className="shrink-0 rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
