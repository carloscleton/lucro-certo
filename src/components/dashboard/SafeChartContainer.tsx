import React, { useState, useEffect, useRef } from 'react';

interface SafeChartContainerProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * SafeChartContainer ensures that Recharts components are only rendered
 * when their container has a measured width and height greater than zero.
 * This prevents the annoying "width(0) and height(0)" console warnings.
 */
export function SafeChartContainer({ children, fallback, className = "w-full h-full relative" }: SafeChartContainerProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      
      const { width, height } = entries[0].contentRect;
      
      // Only update if we actually have dimensions > 0
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
        // We can disconnect once we have the first real dimension 
        // if we trust the layout, but ResponsiveContainer needs ongoing updates.
        // So we keep it observing.
      }
    });

    observer.observe(containerRef.current);
    
    // Initial check
    const initialRect = containerRef.current.getBoundingClientRect();
    if (initialRect.width > 0 && initialRect.height > 0) {
      setDimensions({ width: initialRect.width, height: initialRect.height });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ minHeight: '1px', minWidth: '1px' }}>
      {dimensions ? (
        children
      ) : (
        fallback || (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-sm">Preparando gráfico...</div>
          </div>
        )
      )}
    </div>
  );
}
