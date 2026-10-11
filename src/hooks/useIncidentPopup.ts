"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PanelIncident } from "@/lib/detail-panel.ts";

function popupPosition(trigger: HTMLButtonElement): CSSProperties {
  const margin = 16;
  const width = Math.min(380, window.innerWidth - margin * 2);
  const panel = trigger.closest("[data-detail-panel]")?.getBoundingClientRect();
  const anchor = trigger.getBoundingClientRect();
  const leftOfPanel = (panel?.left ?? anchor.left) - width - margin;
  const fitsLeft = leftOfPanel >= margin;
  const top = Math.max(72, Math.min(fitsLeft ? anchor.top : 100, window.innerHeight - 320));

  return {
    left: fitsLeft ? leftOfPanel : (window.innerWidth - width) / 2,
    top,
    width,
    maxHeight: Math.min(520, window.innerHeight - top - margin),
  };
}

interface IncidentPopup {
  incident: PanelIncident;
  trigger: HTMLButtonElement;
  position: CSSProperties;
}

export function useIncidentPopup() {
  const [popup, setPopup] = useState<IncidentPopup | null>(null);
  const popupRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupId = popup?.incident.id;
  const trigger = popup?.trigger;

  const close = useCallback((restoreFocus = true) => {
    setPopup(null);
    if (restoreFocus && triggerRef.current?.isConnected) {
      triggerRef.current.focus({ preventScroll: true });
    }
  }, []);

  const open = useCallback((incident: PanelIncident, button: HTMLButtonElement) => {
    triggerRef.current = button;
    setPopup({ incident, trigger: button, position: popupPosition(button) });
  }, []);

  useEffect(() => {
    if (popupId) closeButtonRef.current?.focus({ preventScroll: true });
  }, [popupId]);

  useEffect(() => {
    if (!trigger) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!popupRef.current?.contains(event.target) && !trigger.contains(event.target)) close(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const reposition = (event: Event) => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      if (!trigger.isConnected) {
        close(false);
        return;
      }
      setPopup((current) =>
        current?.trigger === trigger ? { ...current, position: popupPosition(trigger) } : current,
      );
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [trigger, close]);

  return { popup, popupRef, closeButtonRef, open, close };
}
