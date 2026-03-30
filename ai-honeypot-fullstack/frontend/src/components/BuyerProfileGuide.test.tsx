// @ts-nocheck
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BuyerProfileGuide from "./BuyerProfileGuide";
import { trackCtaClick } from "../utils/analytics";

vi.mock("../utils/analytics", () => ({
  trackCtaClick: vi.fn(),
  trackEvent: vi.fn(),
  trackPageVisit: vi.fn(),
}));

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

describe("BuyerProfileGuide", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("switches profiles and remembers the selected operating profile", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter future={routerFuture}>
        <BuyerProfileGuide pagePath="/" />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /operate one deception workflow across many customer domains/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /lean soc profile/i }));

    expect(screen.getByRole("heading", { name: /reduce noise and preserve attacker path for a smaller security team/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("public_site_home_profile")).toBe("lean_soc");
    expect(trackCtaClick).toHaveBeenCalledWith("profile_lean_soc", "/");
  });
});
