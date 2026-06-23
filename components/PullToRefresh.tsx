"use client";
import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
}

export default function PullToRefresh({
  children,
  onRefresh,
  threshold = 120,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isAtTop = useRef(true);

  const isMobile = useCallback(() => {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  const checkAtTop = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollTop <= 0;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile()) return;
    isAtTop.current = checkAtTop();
    if (!isAtTop.current) return;
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [checkAtTop, isMobile]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile() || !isPulling || !isAtTop.current || refreshing) return;
    currentY.current = e.touches[0].clientY;
    const delta = Math.max(0, currentY.current - startY.current);
    const damped = Math.min(delta * 0.5, threshold * 1.6);
    setPullDistance(damped);
    if (containerRef.current) {
      containerRef.current.style.transform = `translateY(${damped}px)`;
    }
  }, [isMobile, isPulling, refreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!isMobile() || !isPulling) return;
    setIsPulling(false);

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold);
      if (containerRef.current) {
        containerRef.current.style.transition = "transform 0.2s ease";
        containerRef.current.style.transform = `translateY(${threshold}px)`;
      }
      try {
        await onRefresh();
      } finally {
        setPullDistance(0);
        if (containerRef.current) {
          containerRef.current.style.transition = "transform 0.25s ease-out";
          containerRef.current.style.transform = "translateY(0px)";
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.style.transition = "";
            }
          }, 250);
        }
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
      if (containerRef.current) {
        containerRef.current.style.transition = "transform 0.25s ease-out";
        containerRef.current.style.transform = "translateY(0px)";
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.transition = "";
          }
        }, 250);
      }
    }
  }, [isMobile, isPulling, onRefresh, pullDistance, refreshing, threshold]);

  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.style.transform = "";
        containerRef.current.style.transition = "";
      }
    };
  }, []);

  return (
    <div className="relative overflow-hidden flex-1">
      {/* Pull indicator */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex flex-col items-center justify-end pointer-events-none transition-opacity duration-200"
        style={{
          height: `${Math.max(pullDistance, 0)}px`,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div className="flex items-center justify-center w-10 h-10 mb-2">
          {refreshing ? (
            <Loader2 className="w-6 h-6 text-ocean animate-spin" />
          ) : (
            <div
              className="w-6 h-6 rounded-full border-2 border-ocean border-t-transparent transition-transform duration-100"
              style={{
                transform: `rotate(${Math.min((pullDistance / threshold) * 360, 360)}deg)`,
              }}
            />
          )}
        </div>
        <p className="text-xs text-muted font-medium pb-2">
          {refreshing ? "Refreshing..." : pullDistance >= threshold ? "Release to refresh" : "Pull to refresh"}
        </p>
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto overscroll-y-contain"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
