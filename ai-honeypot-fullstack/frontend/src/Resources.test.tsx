import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Resources from "./Resources";

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

describe("Resources", () => {
  it("renders the technical review hub and its resource sections", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Resources />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: /one technical review hub for security, architecture, deployment, and integrations/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /start with the runbook, then follow the operator workflow/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /readable architecture that preserves attacker evidence end to end/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /grounded in isolated decoys, bounded access, and disclosure language/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /rollout checks that keep the trust story grounded in reality/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /connect website, edge, and provider signals through one ingest contract/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /quick answers for the questions technical evaluators usually ask/i })).toBeInTheDocument();
  });

  it("links the review hub to the existing public pages", () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Resources />
      </MemoryRouter>
    );

    const architectureLink = screen.getAllByRole("link", { name: /view architecture/i });
    expect(architectureLink.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /open security/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /open deployment/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /open integrations/i }).length).toBeGreaterThan(0);
  });
});