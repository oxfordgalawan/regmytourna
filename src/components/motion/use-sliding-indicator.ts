"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Box = { left: number; top: number; width: number; height: number };

/**
 * Tracks the element marked `data-active="true"` inside a container and returns
 * a style for one absolutely-positioned highlight that glides between items
 * (instead of each item toggling its own background).
 *
 * The container must be `position: relative`. Pass anything that changes when
 * the active item changes as `activeKey`.
 */
export function useSlidingIndicator<T extends HTMLElement>(activeKey: unknown) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    const measure = () => {
      const active = container.querySelector<HTMLElement>('[data-active="true"]');
      setBox(
        active
          ? {
              left: active.offsetLeft,
              top: active.offsetTop,
              width: active.offsetWidth,
              height: active.offsetHeight,
            }
          : null
      );
    };

    // first placement snaps; every move after that glides
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      measure();
      raf2 = requestAnimationFrame(() => setAnimate(true));
    });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer.disconnect();
    };
  }, [activeKey]);

  const style: React.CSSProperties = box
    ? {
        transform: `translate(${box.left}px, ${box.top}px)`,
        width: box.width,
        height: box.height,
        opacity: 1,
        transition: animate
          ? "transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1), width 380ms cubic-bezier(0.2, 0.8, 0.2, 1), height 380ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms"
          : "none",
      }
    : { opacity: 0, width: 0, height: 0 };

  // until measured, callers paint the active item themselves so nothing is unreadable
  return { ref, style, ready: box !== null };
}
