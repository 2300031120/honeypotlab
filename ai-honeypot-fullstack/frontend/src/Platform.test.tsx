import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Platform from "./Platform";
import type { PublicTelemetrySnapshot } from "./utils/publicTelemetry";

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
    const mockedTelemetry = vi.mocked(fetchPublicTelemetrySnapshot);
    mockedTelemetry.mockResolvedValue({
      summary: {
        active_decoys: 0,
        live_sessions: 0,
        total_events: 0,
        unique_ips: 0,
      },
      feed: [],
      ai_summary: "",
    } as unknown as PublicTelemetrySnapshot);
  });

  it("shows sample proof when live telemetry is empty", async () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Platform />
      </MemoryRouter>
    );

    expect(await screen.findByText(/sample proof/i)).toBeInTheDocument();
    expect(screen.getByText(/sample incident:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/\/admin\/login-shadow/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/waiting for live replay steps/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no live ai summary yet/i)).not.toBeInTheDocument();
  });

  it("labels the public snapshot as demo-safe instead of live telemetry", async () => {
    const { fetchPublicTelemetrySnapshot } = await import("./utils/publicTelemetry");
    const mockedTelemetry = vi.mocked(fetchPublicTelemetrySnapshot);
    mockedTelemetry.mockResolvedValue({
      scope: "public_demo",
      summary: {
        active_decoys: 8,
        live_sessions: 0,
        total_events: 5,
        unique_ips: 5,
      },
      feed: [
        {
          id: "demo-1",
          ts: "2026-04-03T15:52:03.423897+00:00",
          path: "/.env",
          severity: "high",
          score: 92,
          event_type: "http_probe",
          ip: "203.0.113.24",
        },
      ],
      ai_summary: "Demo-safe telemetry preview active.",
    } as unknown as PublicTelemetrySnapshot);

    render(
      <MemoryRouter future={routerFuture}>
        <Platform />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /demo-safe telemetry state/i })).toBeInTheDocument();
    expect(screen.getByText(/^demo-safe telemetry$/i)).toBeInTheDocument();
    expect(screen.getByText(/^demo sessions$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^live telemetry$/i)).not.toBeInTheDocument();
  });
});
