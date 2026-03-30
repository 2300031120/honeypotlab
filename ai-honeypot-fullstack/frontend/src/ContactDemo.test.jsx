import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach, vi } from "vitest";
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

  beforeEach(() => {
    vi.clearAllMocks();
    axios.get.mockResolvedValue({
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
    const leadActions = submitButton.closest(".lead-actions");
    expect(leadActions).not.toBeNull();
    const switchCta = within(leadActions).getByRole("link", { name: /contact team/i });
    await user.click(switchCta);

    expect(trackCtaClick).toHaveBeenCalledWith("switch_to_contact", "/demo");
  });

  it("tracks demo submit conversion events", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/demo?utm_source=ads&utm_medium=search&utm_campaign=pilot");

    axios.post.mockResolvedValue({
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
    await user.type(screen.getByLabelText(/email/i), "arun@company.com");
    await user.type(screen.getByLabelText(/organization/i), "Acme Security");
    await user.type(screen.getByLabelText(/use case/i), "SOC demo");
    await user.type(screen.getByLabelText(/message/i), "Need walkthrough for SOC pilot evaluation.");
    await user.type(screen.getByPlaceholderText(/enter answer/i), "4");

    await user.click(screen.getByRole("button", { name: /request demo/i }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/demo/submit"),
        expect.objectContaining({
          name: "Arun Kumar",
          email: "arun@company.com",
          source: "/demo",
          utm_source: "ads",
          utm_medium: "search",
          utm_campaign: "pilot",
        })
      );
    });

    const trackedEvents = trackEvent.mock.calls.map((call) => call[0]);
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
});
