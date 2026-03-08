import { useState, useCallback, useEffect } from "react";
import { useTheme } from "next-themes";

export type IconSize = "small" | "medium" | "large";
export type GridLayout = "4x2" | "3x3";

const ICON_SIZE_KEY = "mfs_icon_size";
const GRID_LAYOUT_KEY = "mfs_grid_layout";
const COMPACT_MODE_KEY = "mfs_compact_mode";

const ICON_SIZE_MAP: Record<IconSize, number> = {
  small: 44,
  medium: 56,
  large: 68,
};

const ICON_SIZE_LABELS: Record<IconSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export function useCustomization() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [iconSize, setIconSizeState] = useState<IconSize>(() => {
    const saved = localStorage.getItem(ICON_SIZE_KEY);
    return (saved === "small" || saved === "medium" || saved === "large") ? saved : "medium";
  });

  const [gridLayout, setGridLayoutState] = useState<GridLayout>(() => {
    const saved = localStorage.getItem(GRID_LAYOUT_KEY);
    return saved === "3x3" ? "3x3" : "4x2";
  });

  const [compactMode, setCompactModeState] = useState(() => {
    return localStorage.getItem(COMPACT_MODE_KEY) === "true";
  });

  // Apply compact mode class to body
  useEffect(() => {
    document.documentElement.classList.toggle("compact-mode", compactMode);
  }, [compactMode]);

  const setIconSize = useCallback((size: IconSize) => {
    setIconSizeState(size);
    localStorage.setItem(ICON_SIZE_KEY, size);
  }, []);

  const setGridLayout = useCallback((layout: GridLayout) => {
    setGridLayoutState(layout);
    localStorage.setItem(GRID_LAYOUT_KEY, layout);
  }, []);

  const setCompactMode = useCallback((enabled: boolean) => {
    setCompactModeState(enabled);
    localStorage.setItem(COMPACT_MODE_KEY, String(enabled));
  }, []);

  const cycleTheme = useCallback(() => {
    const order = ["system", "light", "dark"];
    const idx = order.indexOf(theme ?? "system");
    const next = order[(idx + 1) % order.length];
    setTheme(next);
  }, [theme, setTheme]);

  const cycleIconSize = useCallback(() => {
    const order: IconSize[] = ["small", "medium", "large"];
    const idx = order.indexOf(iconSize);
    const next = order[(idx + 1) % order.length];
    setIconSize(next);
  }, [iconSize, setIconSize]);

  const cycleGridLayout = useCallback(() => {
    setGridLayout(gridLayout === "4x2" ? "3x3" : "4x2");
  }, [gridLayout, setGridLayout]);

  return {
    // Theme
    theme: theme ?? "system",
    resolvedTheme,
    setTheme,
    cycleTheme,
    themeLabel: theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System",
    // Icon size
    iconSize,
    iconSizePx: ICON_SIZE_MAP[iconSize],
    iconSizeLabel: ICON_SIZE_LABELS[iconSize],
    setIconSize,
    cycleIconSize,
    // Grid layout
    gridLayout,
    gridCols: gridLayout === "3x3" ? 3 : 4,
    setGridLayout,
    cycleGridLayout,
    // Compact mode
    compactMode,
    setCompactMode,
  };
}
