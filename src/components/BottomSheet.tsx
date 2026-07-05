import { motion, useMotionValue, animate, useDragControls, PanInfo } from "framer-motion";
import { useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";

/**
 * BottomSheet — Uber-style sliding panel with 3 snap points.
 * States (measured in px from the bottom of the viewport):
 *  - collapsed:      handle + search bar visible
 *  - half:           vehicle selection + pricing
 *  - full:           full-height content (trip details, driver card)
 */

export type SheetState = "collapsed" | "half" | "full";

interface Props {
  state: SheetState;
  onStateChange: (s: SheetState) => void;
  /** heights in px */
  heights?: { collapsed: number; half: number; full: number };
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  state,
  onStateChange,
  heights = { collapsed: 148, half: 380, full: 640 },
  children,
  className,
}: Props) {
  const y = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Stop touch/pointer/wheel events on the sheet from reaching the map underneath.
  const stopTouch = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  // Only the handle initiates a sheet drag — inner scroll & buttons stay untouched.
  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    dragControls.start(e, { snapToCursor: false });
  };



  const heightFor = (s: SheetState) => heights[s];

  useEffect(() => {
    const target = window.innerHeight - heightFor(state);
    const controls = animate(y, target, {
      type: "spring",
      damping: 32,
      stiffness: 320,
      mass: 0.9,
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, heights.collapsed, heights.half, heights.full]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const vh = window.innerHeight;
    const current = vh - y.get(); // exposed height
    const velocity = info.velocity.y;
    const points: SheetState[] = ["collapsed", "half", "full"];
    let next: SheetState = state;
    if (velocity < -400) {
      const i = points.indexOf(state);
      next = points[Math.min(i + 1, 2)];
    } else if (velocity > 400) {
      const i = points.indexOf(state);
      next = points[Math.max(i - 1, 0)];
    } else {
      // snap to nearest by exposed height
      const diffs = points.map((p) => ({ p, d: Math.abs(current - heightFor(p)) }));
      diffs.sort((a, b) => a.d - b.d);
      next = diffs[0].p;
    }
    onStateChange(next);
  };

  return (
    <motion.div
      ref={containerRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md",
        "rounded-t-[28px] bg-card text-card-foreground",
        "shadow-xl-soft border-t border-border/60",
        "flex flex-col overflow-hidden",
        className,
      )}
      style={{
        y,
        height: heights.full,
        top: "auto",
        // Prevent the browser from routing gestures on the sheet to the map behind it
        touchAction: "pan-y",
      }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{
        top: window.innerHeight - heights.full,
        bottom: window.innerHeight - heights.collapsed,
      }}
      dragElastic={0.02}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      // Isolate all touch/pointer/wheel events from the underlying Google Map
      onPointerDown={stopTouch}
      onPointerMove={stopTouch}
      onPointerUp={stopTouch}
      onTouchStart={stopTouch}
      onTouchMove={stopTouch}
      onTouchEnd={stopTouch}
      onWheel={stopTouch}
    >
      <button
        type="button"
        onPointerDown={startDrag}
        onClick={() => {
          const order: SheetState[] = ["collapsed", "half", "full"];
          const i = order.indexOf(state);
          onStateChange(order[Math.min(i + 1, 2)]);
        }}
        className="w-full pt-3 pb-2 grid place-items-center cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
        aria-label="اسحب للتبديل"
      >
        <span className="block h-1.5 w-12 rounded-full bg-muted-foreground/30" />
      </button>
      <div
        className="flex-1 overflow-y-auto scrollbar-hide overscroll-contain"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>
    </motion.div>
  );
}

