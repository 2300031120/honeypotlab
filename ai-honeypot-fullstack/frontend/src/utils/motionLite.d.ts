import * as React from "react";

export const motion: {
  [key: string]: React.ComponentType<any>;
};

export const AnimatePresence: React.FC<{
  children?: React.ReactNode;
  mode?: string;
}>;

export function useAnimation(): {
  start: (...args: any[]) => Promise<void>;
  set: (...args: any[]) => Promise<void>;
  stop: (...args: any[]) => void;
};
