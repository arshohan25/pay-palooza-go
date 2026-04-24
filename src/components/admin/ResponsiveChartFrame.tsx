import { ReactNode, useEffect, useRef, useState } from "react";

interface ResponsiveChartFrameProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveChartFrame({ children, className = "h-56 md:h-64" }: ResponsiveChartFrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const lastWidthRef = useRef(0);
  const rafRef = useRef<number>();
  const [chartKey, setChartKey] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (!width || Math.abs(width - lastWidthRef.current) < 2) return;
      lastWidthRef.current = width;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => setChartKey((key) => key + 1));
    });

    observer.observe(frame);
    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div ref={frameRef} className={`w-full min-w-0 overflow-hidden ${className}`}>
      <div key={chartKey} className="h-full w-full min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}