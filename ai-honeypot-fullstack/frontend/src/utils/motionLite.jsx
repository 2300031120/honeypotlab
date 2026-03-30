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

const cache = new Map();

function createMotionComponent(tag) {
  if (cache.has(tag)) {
    return cache.get(tag);
  }

  const Component = React.forwardRef(({ children, ...props }, ref) => {
    const domProps = { ref };
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
  {},
  {
    get(_target, tag) {
      return createMotionComponent(String(tag));
    },
  }
);

export function AnimatePresence({ children }) {
  return <>{children}</>;
}

export function useAnimation() {
  return useMemo(
    () => ({
      start: async () => undefined,
      set: async () => undefined,
      stop: () => undefined,
    }),
    []
  );
}
