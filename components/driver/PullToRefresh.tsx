import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const THRESHOLD = 65;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);
  const isPullingRef = useRef(false);

  const onTouchStart = useCallback((e) => {
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isPullingRef.current = false;
    } else {
      startY.current = null;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 5) {
      startY.current = null;
      return;
    }
    // Only intercept a clear downward pull from top — don't block normal scroll
    isPullingRef.current = true;
    setPullY(Math.min(delta * 0.45, THRESHOLD + 20));
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    const y = pullY;
    startY.current = null;
    isPullingRef.current = false;
    setPullY(0);
    if (y >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
  }, [pullY, refreshing, onRefresh]);

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
    >
      <AnimatePresence>
        {(pullY > 5 || refreshing) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: pullY || 40 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center overflow-hidden"
          >
            <div
              className={`w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center transition-all ${refreshing ? "border-t-transparent animate-spin" : ""}`}
              style={{ transform: refreshing ? undefined : `rotate(${progress * 360}deg)` }}
            >
              {!refreshing && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#3B82F6" strokeWidth="2">
                  <path d="M7 1v6l3-3M7 7l-3-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}
