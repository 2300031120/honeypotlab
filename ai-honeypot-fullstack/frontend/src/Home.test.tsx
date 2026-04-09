import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";
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

vi.mock("./utils/authProviders", () => ({
  loadAuthProviders: vi.fn(),
}));

vi.mock("./utils/auth", () => ({
  AUTH_CHANGED_EVENT: "auth-changed",
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
    const mockedTelemetry = vi.mocked(fetchPublicTelemetrySnapshot);
    const { loadAuthProviders } = await import("./utils/authProviders");
    const mockedProviders = vi.mocked(loadAuthProviders);
    mockedProviders.mockResolvedValue({
      googleEnabled: false,
      serverGoogleClientId: "",
      signupEnabled: true,
    });
    mockedTelemetry.mockResolvedValue({
      summary: {},
      feed: [],
      ai_summary: "",
    } as unknown as PublicTelemetrySnapshot);
  });

  it("renders the streamlined marketing homepage immediately", async () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Home />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /turn exposed login, admin, and api routes into early attacker intelligence/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Platform" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Integrations" }).length).toBeGreaterThan(0);
    expect((await screen.findAllByRole("link", { name: /request demo/i })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /view sample incident/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /see the platform from armed decoy routes to analyst-ready evidence/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /view integrations/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /choose behavior capture over passive dashboards, lab demos, or log-only summaries/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /answers buyers usually need before they commit to a pilot/i })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /open public snapshot/i })).toHaveAttribute(
      "href",
      "/api/public/telemetry/snapshot"
    );
    expect(screen.getAllByText(/cloudflare worker relay/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/waiting for live attacker events/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enter the honeypot/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /built for real rollout conversations, not lab-only hype/i })).toBeInTheDocument();
  }, 20000);

  it("treats the public snapshot as demo-safe telemetry on the homepage", async () => {
    const { fetchPublicTelemetrySnapshot } = await import("./utils/publicTelemetry");
    const mockedTelemetry = vi.mocked(fetchPublicTelemetrySnapshot);
    mockedTelemetry.mockResolvedValue({
      scope: "public_demo",
      summary: {
        total_events: 8,
        critical_events: 4,
        blocked_ips: 0,
        live_sessions: 0,
        unique_ips: 8,
        active_decoys: 8,
        threat_score: 82,
        top_target: "/.env",
      },
      feed: [
        {
          id: "public-demo-1",
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
        <Home />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/^demo-safe telemetry$/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/^8 demo events$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^live telemetry$/i)).not.toBeInTheDocument();
  });
});
