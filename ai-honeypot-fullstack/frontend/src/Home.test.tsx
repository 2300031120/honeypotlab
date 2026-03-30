// @ts-nocheck
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

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

vi.mock("./utils/auth", () => ({
  isAuthenticated: vi.fn(() => false),
}));

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe("Home", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { fetchPublicTelemetrySnapshot } = await import("./utils/publicTelemetry");
    fetchPublicTelemetrySnapshot.mockResolvedValue({
      summary: {},
      feed: [],
      ai_summary: "",
    });
  });

  it("renders the streamlined marketing homepage immediately", async () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Home />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /turn public attack traffic into deception telemetry/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Platform" }).length).toBeGreaterThan(0);
    expect((await screen.findAllByRole("link", { name: /request demo/i })).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: /open public snapshot/i })).toHaveAttribute(
      "href",
      "/api/public/telemetry/snapshot"
    );
    expect(screen.queryByRole("button", { name: /enter the honeypot/i })).not.toBeInTheDocument();
  });
});
