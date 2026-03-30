// @ts-nocheck
import { useEffect, useRef } from "react";
import { trackEvent, trackPageVisit } from "../utils/analytics";

export function usePageAnalytics(pageName) {
  const startRef = useRef(Date.now());
  const maxScrollRef = useRef(0);
  const heartbeatSentRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    startRef.current = Date.now();
    maxScrollRef.current = 0;
    heartbeatSentRef.current = false;

    const path = window.location.pathname || "/";
    trackPageVisit(pageName, path);

    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight || 1;
      const fullHeight = document.documentElement.scrollHeight || viewportHeight;
      const depth = Math.min(100, Math.round(((scrollTop + viewportHeight) / Math.max(fullHeight, 1)) * 100));
      if (depth > maxScrollRef.current) {
        maxScrollRef.current = depth;
      }
    };

    const heartbeat = window.setTimeout(() => {
      heartbeatSentRef.current = true;
      trackEvent("page_engagement_heartbeat", {
        category: "engagement",
        pagePath: path,
        properties: {
          page_name: pageName,
          scroll_depth: maxScrollRef.current,
          duration_ms: Date.now() - startRef.current,
        },
      });
    }, 15000);

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(heartbeat);
      trackEvent("page_engagement", {
        category: "engagement",
        pagePath: path,
        properties: {
          page_name: pageName,
          scroll_depth: maxScrollRef.current,
          duration_ms: Date.now() - startRef.current,
          heartbeat_sent: heartbeatSentRef.current,
        },
      });
    };
  }, [pageName]);
}
