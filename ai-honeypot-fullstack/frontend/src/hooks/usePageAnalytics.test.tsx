// @ts-nocheck
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { usePageAnalytics } from "./usePageAnalytics";
import { trackEvent, trackPageVisit } from "../utils/analytics";

vi.mock("../utils/analytics", () => ({
  trackEvent: vi.fn(),
  trackPageVisit: vi.fn(),
}));

function Probe({ pageName = "probe_page" }) {
  usePageAnalytics(pageName);
  return <div>probe</div>;
}

describe("usePageAnalytics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.history.pushState({}, "", "/platform");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks page visit on mount and engagement on unmount", () => {
    const { unmount } = render(<Probe pageName="platform_page" />);

    expect(trackPageVisit).toHaveBeenCalledWith("platform_page", "/platform");

    vi.advanceTimersByTime(15000);
    expect(trackEvent).toHaveBeenCalledWith(
      "page_engagement_heartbeat",
      expect.objectContaining({
        category: "engagement",
        pagePath: "/platform",
      })
    );

    unmount();
    expect(trackEvent).toHaveBeenCalledWith(
      "page_engagement",
      expect.objectContaining({
        category: "engagement",
        pagePath: "/platform",
      })
    );
  });
});

