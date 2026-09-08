import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommandCenterLauncher, { OPEN_COMMAND_CENTER_EVENT, openCommandCenter } from "./CommandCenterLauncher";

vi.mock("./PublicCommandCenter", () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="command-center">
        <button type="button" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}));

const routerFuture = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

function renderLauncher() {
  return render(
    <MemoryRouter initialEntries={["/"]} future={routerFuture}>
      <CommandCenterLauncher />
    </MemoryRouter>
  );
}

async function openWithShortcut(event: { key: string; ctrlKey?: boolean; metaKey?: boolean }) {
  await act(async () => {
    fireEvent.keyDown(window, event);
  });
}

describe("CommandCenterLauncher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    renderLauncher();
    expect(screen.queryByTestId("command-center")).toBeNull();
  });

  it("opens the command center on Ctrl+K", async () => {
    renderLauncher();
    await openWithShortcut({ key: "k", ctrlKey: true });
    expect(await screen.findByTestId("command-center")).toBeInTheDocument();
  });

  it("opens the command center on Cmd+K", async () => {
    renderLauncher();
    await openWithShortcut({ key: "k", metaKey: true });
    expect(await screen.findByTestId("command-center")).toBeInTheDocument();
  });

  it("ignores Ctrl+K when the target is an editable field", async () => {
    render(
      <MemoryRouter initialEntries={["/"]} future={routerFuture}>
        <CommandCenterLauncher />
        <input data-testid="field" />
      </MemoryRouter>
    );
    const field = screen.getByTestId("field");
    await act(async () => {
      fireEvent.keyDown(field, { key: "k", ctrlKey: true });
    });
    expect(screen.queryByTestId("command-center")).toBeNull();
  });

  it("opens when the openCommandCenter event fires", async () => {
    renderLauncher();
    await act(async () => {
      openCommandCenter();
    });
    expect(await screen.findByTestId("command-center")).toBeInTheDocument();
  });

  it("responds to the OPEN_COMMAND_CENTER_EVENT dispatched by the window", async () => {
    renderLauncher();
    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_COMMAND_CENTER_EVENT));
    });
    expect(await screen.findByTestId("command-center")).toBeInTheDocument();
  });

  it("closes via onClose", async () => {
    renderLauncher();
    await openWithShortcut({ key: "k", ctrlKey: true });
    await screen.findByTestId("command-center");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "close" }));
    });
    await waitFor(() => {
      expect(screen.queryByTestId("command-center")).toBeNull();
    });
  });
});