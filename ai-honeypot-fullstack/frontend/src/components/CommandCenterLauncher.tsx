import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const OPEN_COMMAND_CENTER_EVENT = "cybersentil:open-command-center";

const PublicCommandCenter = lazy(() => import("./PublicCommandCenter"));

export function openCommandCenter() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_CENTER_EVENT));
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

export default function CommandCenterLauncher() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onOpen = () => setOpen(true);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    };

    window.addEventListener(OPEN_COMMAND_CENTER_EVENT, onOpen);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_COMMAND_CENTER_EVENT, onOpen);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <Suspense fallback={null}>
      <PublicCommandCenter open={open} onClose={() => setOpen(false)} analyticsPath={location.pathname} />
    </Suspense>
  );
}