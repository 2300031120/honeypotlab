import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Platform from "./Platform";

vi.mock("./utils/publicTelemetry", () => ({
  fetchPublicTelemetrySnapshot: vi.fn(),
}));

vi.mock("./utils/seo", () => ({
  useSeo: vi.fn(),
}));

vi.mock("./hooks/usePageAnalytics", () => ({
  usePageAnalytics: vi.fn(),
}));

vi.mock("./utils/analytics", () => ({
  trackCtaClick: vi.fn(),
  trackEvent: vi.fn(),
  trackPageVisit: vi.fn(),
}));

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe("Platform", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { fetchPublicTelemetrySnapshot } = await import("./utils/publicTelemetry");
    fetchPublicTelemetrySnapshot.mockResolvedValue({
      summary: {
        active_decoys: 0,
        live_sessions: 0,
        total_events: 0,
        unique_ips: 0,
      },
      feed: [],
      ai_summary: "",
    });
  });

  it("shows honest waiting states instead of seeded attacker paths", async () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Platform />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No active lures yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for live replay steps/i)).toBeInTheDocument();
    expect(screen.getByText(/No live AI summary yet/i)).toBeInTheDocument();
    expect(screen.queryByText("/login-shadow")).not.toBeInTheDocument();
    expect(screen.queryByText("/admin-vault")).not.toBeInTheDocument();
  });
});
