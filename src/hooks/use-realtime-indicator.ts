import { useState, useCallback, useRef } from "react";

export function useRealtimeIndicator(duration = 3000) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), duration);
  }, [duration]);

  return { visible, flash };
}
