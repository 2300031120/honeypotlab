import { useEffect } from "react";

type ScrollRevealOptions = {
  enabled?: boolean;
  rootMargin?: string;
  threshold?: number;
  revealClassName?: string;
  visibleClassName?: string;
  baseDelayMs?: number;
  stepDelayMs?: number;
  refreshToken?: unknown;
};

export function useScrollReveal(
  selector: string,
  {
    enabled = true,
    rootMargin = "0px 0px -10% 0px",
    threshold = 0.14,
    revealClassName = "reveal-ready",
    visibleClassName = "is-visible",
    baseDelayMs = 0,
    stepDelayMs = 48,
    refreshToken,
  }: ScrollRevealOptions = {}
): void {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (nodes.length === 0) {
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    nodes.forEach((node, index) => {
      node.classList.add(revealClassName);
      node.style.setProperty("--reveal-delay", `${baseDelayMs + index * stepDelayMs}ms`);
      if (!enabled || prefersReducedMotion) {
        node.classList.add(visibleClassName);
      }
    });

    if (!enabled || prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const element = entry.target as HTMLElement;
            element.classList.add(visibleClassName);
            observer.unobserve(element);
          }
        }
      },
      { root: null, rootMargin, threshold }
    );

    nodes.forEach((node) => {
      if (!node.classList.contains(visibleClassName)) {
        observer.observe(node);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [
    selector,
    enabled,
    rootMargin,
    threshold,
    revealClassName,
    visibleClassName,
    baseDelayMs,
    stepDelayMs,
    refreshToken,
  ]);
}
