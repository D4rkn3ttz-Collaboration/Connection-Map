"use client";

import { useState } from "react";
import type { DetailTab, PanelIncident } from "@/lib/detail-panel.ts";
import type { Pick } from "@/lib/links.ts";

interface PanelState {
  selected: Pick | null;
  subject: Pick | null;
  tab: DetailTab;
  collapsed: boolean;
  incident: PanelIncident | null;
  revealToken: number;
}
const initial: PanelState = {
  selected: null,
  subject: null,
  tab: "overview",
  collapsed: true,
  incident: null,
  revealToken: 0,
};

/** 패널의 대상은 유지하고, 연결 카드나 사건을 선택하면 기존 Pick 계약으로 3D 강조만 바꾼다. */
export function useDetailPanel() {
  const [state, setState] = useState<PanelState>(initial);
  const select = (pick: Pick | null) =>
    setState({
      ...initial,
      selected: pick,
      subject: pick,
      tab: pick?.kind === "link" ? "connections" : "overview",
      collapsed: pick === null,
    });
  const selectTab = (tab: DetailTab) =>
    setState((current) => ({
      ...current,
      tab,
      selected: current.subject,
      incident: null,
      revealToken: 0,
    }));
  const selectLink = (id: string) =>
    setState((current) => ({
      ...current,
      tab: "connections",
      selected: { kind: "link", link_id: id },
      incident: null,
      revealToken: 0,
    }));
  const selectIncident = (incident: PanelIncident) =>
    setState((current) => ({
      ...current,
      incident,
      selected:
        incident.linkIds.length === 1
          ? { kind: "link", link_id: incident.linkIds[0] }
          : current.subject,
    }));
  const openIncident = (incident: PanelIncident) =>
    setState((current) => ({
      selected: { kind: "territory", ...incident.territory },
      subject: { kind: "territory", ...incident.territory },
      tab: "events",
      collapsed: false,
      incident,
      revealToken: current.revealToken + 1,
    }));
  return {
    ...state,
    select,
    selectTab,
    selectLink,
    selectIncident,
    openIncident,
    close: () => setState(initial),
    toggleCollapsed: () =>
      setState((current) => ({ ...current, collapsed: !current.collapsed })),
    clearLink: () =>
      setState((current) => ({
        ...current,
        selected: current.subject,
        incident: null,
        revealToken: 0,
      })),
  };
}
