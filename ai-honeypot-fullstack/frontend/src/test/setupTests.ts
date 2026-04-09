import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  const win = window as typeof window & {
    matchMedia?: (query: string) => MediaQueryList;
    ResizeObserver?: typeof ResizeObserver;
    IntersectionObserver?: typeof IntersectionObserver;
  };

  if (!win.matchMedia) {
    win.matchMedia = () =>
      ({
      matches: false,
      media: "",
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
  }

  if (!win.scrollTo) {
    win.scrollTo = () => undefined;
  }

  if (!win.ResizeObserver) {
    win.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  if (!win.IntersectionObserver) {
    class MockIntersectionObserver implements IntersectionObserver {
      root: Element | Document | null = null;
      rootMargin = "";
      thresholds: ReadonlyArray<number> = [];

      constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}

      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }

    win.IntersectionObserver = MockIntersectionObserver;
  }
}

