import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach, vi, type Mock } from "vitest";
import axios from "axios";
import ContactDemo from "./ContactDemo";
import { trackCtaClick, trackEvent } from "./utils/analytics";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("./utils/analytics", () => ({
  trackEvent: vi.fn(),
  trackCtaClick: vi.fn(),
  trackPageVisit: vi.fn(),
}));

vi.mock("./utils/seo", () => ({
  useSeo: () => undefined,
}));

describe("ContactDemo tracking", () => {
  const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };
  const mockedAxios = axios as unknown as { get: Mock; post: Mock };
  const mockedTrackEvent = vi.mocked(trackEvent);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: {
        enabled: true,
        challenge_id: "challenge-1",
        prompt: "What is 2 + 2?",
      },
    });
  });

  it("tracks CTA click when switching from demo to contact", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/demo");

    render(
      <MemoryRouter initialEntries={["/demo"]} future={routerFuture}>
        <ContactDemo mode="demo" />
      </MemoryRouter>
    );

    const submitButton = await screen.findByRole("button", { name: /request demo/i });
    const leadActions = submitButton.closest(".lead-actions") as HTMLElement | null;
    expect(leadActions).not.toBeNull();
    if (!leadActions) {
      throw new Error("Lead actions container not found.");
    }
    const switchCta = within(leadActions).getByRole("link", { name: /contact team/i });
    await user.click(switchCta);

    expect(trackCtaClick).toHaveBeenCalledWith("switch_to_contact", "/demo");
  });

  it("tracks demo submit conversion events with the shorter required form", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/demo?utm_source=ads&utm_medium=search&utm_campaign=pilot");

    mockedAxios.post.mockResolvedValue({
      data: {
        id: 321,
        status: "received",
        duplicate: false,
        is_repeat: false,
        lead_status: "new",
        spam_blocked: false,
        message: "Thanks. Our team will contact you shortly.",
      },
    });

    render(
      <MemoryRouter initialEntries={["/demo"]} future={routerFuture}>
        <ContactDemo mode="demo" />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/name/i), "Arun Kumar");
    await user.type(screen.getByLabelText(/work email/i), "arun@company.com");
    await user.type(screen.getByLabelText(/company/i), "Acme Security");
    await user.type(screen.getByPlaceholderText(/enter answer/i), "4");

    await user.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      const [, payload] = mockedAxios.post.mock.calls[0] as [string, Record<string, unknown>];
      expect(payload).toMatchObject({ referral_code: "" });
      expect(payload).not.toHaveProperty("website");
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/demo/submit"),
        expect.objectContaining({
          name: "Arun Kumar",
          email: "arun@company.com",
          organization: "Acme Security",
          use_case: "Demo for exposed login, admin, and API routes",
          message: "Need a walkthrough focused on exposed routes, analyst evidence, and rollout fit.",
          source: "/demo",
          utm_source: "ads",
          utm_medium: "search",
          utm_campaign: "pilot",
        }),
        expect.objectContaining({
          timeout: 20000,
        })
      );
    });

    const trackedEvents = mockedTrackEvent.mock.calls.map((call) => call[0]);
    expect(trackedEvents).toContain("lead_form_submit_attempt");
    expect(trackedEvents).toContain("lead_form_submit_success");
    expect(trackEvent).toHaveBeenCalledWith(
      "lead_form_submit_success",
      expect.objectContaining({
        requestType: "demo",
        leadId: 321,
      })
    );
  });

  it("appends the preferred meeting window to demo requests when provided", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/demo");

    mockedAxios.post.mockResolvedValue({
      data: {
        id: 654,
        status: "received",
        duplicate: false,
        is_repeat: false,
        lead_status: "new",
        spam_blocked: false,
        message: "Thanks. Demo request captured.",
      },
    });

    render(
      <MemoryRouter initialEntries={["/demo"]} future={routerFuture}>
        <ContactDemo mode="demo" />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/name/i), "Niharika");
    await user.type(screen.getByLabelText(/work email/i), "niharika@company.com");
    await user.type(screen.getByLabelText(/company/i), "Sentinel Labs");
    fireEvent.change(screen.getByLabelText(/preferred meeting window/i), {
      target: { value: "2026-05-10T10:30" },
    });
    await user.type(screen.getByPlaceholderText(/enter answer/i), "4");

    await user.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining("/demo/submit"),
        expect.objectContaining({
          message: expect.stringContaining("Preferred meeting window:"),
        }),
        expect.objectContaining({
          timeout: 20000,
        })
      );
    });
  });
});
