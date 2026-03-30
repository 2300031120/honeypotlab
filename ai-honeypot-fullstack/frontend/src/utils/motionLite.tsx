import React, { useMemo } from "react";

const MOTION_ONLY_PROPS = new Set([
  "animate",
  "exit",
  "initial",
  "layout",
  "layoutId",
  "transition",
  "variants",
  "whileHover",
  "whileTap",
  "whileDrag",
  "whileInView",
  "viewport",
  "drag",
  "dragConstraints",
  "dragElastic",
  "dragMomentum",
  "dragTransition",
  "onAnimationStart",
  "onAnimationComplete",
  "transformTemplate",
]);

const cache = new Map<string, React.ComponentType<any>>();

function createMotionComponent(tag: string) {
  if (cache.has(tag)) {
    return cache.get(tag);
  }

  const Component = React.forwardRef<HTMLElement, Record<string, any>>(({ children, ...props }, ref) => {
    const domProps: Record<string, any> = { ref };
    Object.entries(props).forEach(([key, value]) => {
      if (!MOTION_ONLY_PROPS.has(key)) {
        domProps[key] = value;
      }
    });
    return React.createElement(tag, domProps, children);
  });

  Component.displayName = `MotionLite(${tag})`;
  cache.set(tag, Component);
  return Component;
}

export const motion = new Proxy(
  {} as Record<string, React.ComponentType<any>>,
  {
    get(_target, tag: string) {
      return createMotionComponent(String(tag));
    },
  }
);

export function AnimatePresence({ children }: { children?: React.ReactNode; mode?: string }) {
  return <>{children}</>;
}

export function useAnimation(): {
  start: (...args: any[]) => Promise<void>;
  set: (...args: any[]) => Promise<void>;
  stop: (...args: any[]) => void;
} {
  return useMemo(
    () => ({
      start: async (..._args: any[]) => undefined,
      set: async (..._args: any[]) => undefined,
      stop: (..._args: any[]) => undefined,
    }),
    []
  );
}
