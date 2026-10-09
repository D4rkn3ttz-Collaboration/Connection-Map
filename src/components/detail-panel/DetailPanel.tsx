"use client";

import { useId, useMemo } from "react";
import {
  detailSubject,
  subjectIncidents,
  type DetailTab,
  type Layouts,
  type PanelIncident,
  type TerritoryRef,
} from "@/lib/detail-panel.ts";
import type { LinkLine, Pick } from "@/lib/links.ts";
import { DetailTabs } from "./DetailTabs";
import { OverviewTab } from "./OverviewTab";
import { EventsTab } from "./EventsTab";
import { ConnectionsTab } from "./ConnectionsTab";
import { EcosystemOverview } from "./EcosystemOverview";
import styles from "./detail-panel.module.css";

export interface DetailPanelProps {
  subject: Pick | null;
  selected: Pick | null;
  layouts: Layouts;
  loading?: boolean;
  lines: LinkLine[];
  tab: DetailTab;
  collapsed: boolean;
  selectedIncidentId: string | null;
  revealToken: number;
  connectionsUnavailable?: boolean;
  incidentsUnavailable?: boolean;
  /** Supabase 오픈웹 사건. 다크웹 연결 기록의 사건 ID와 합쳐 표시한다. */
  incidents?: PanelIncident[];
  onTab: (tab: DetailTab) => void;
  onCollapse: () => void;
  onClose: () => void;
  onSelectIncident: (incident: PanelIncident) => void;
  onSelectLink: (id: string) => void;
  onBack: () => void;
  onShowTerritory: (territory: TerritoryRef) => void;
  onShowIsland: (island: Extract<Pick, { kind: "island" }>) => void;
}

export function DetailPanel(props: DetailPanelProps) {
  const id = useId();
  const subject = useMemo(
    () => detailSubject(props.subject, props.layouts, props.lines),
    [props.subject, props.layouts, props.lines],
  );
  const incidents = useMemo(() => {
    if (!subject) return [];
    return subjectIncidents(subject, props.incidents);
  }, [subject, props.incidents]);
  return (
    <div className={styles.shell} data-collapsed={props.collapsed}>
      <button
        type="button"
        className={styles.collapse}
        aria-label={props.collapsed ? "상세 보기" : "상세 패널 접기"}
        aria-expanded={!props.collapsed}
        aria-controls={`${id}-detail`}
        onClick={props.onCollapse}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d={props.collapsed ? "m5 3 3 3-3 3" : "m7 3-3 3 3 3"}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </svg>
      </button>
      <aside
        className={styles.panel}
        id={`${id}-detail`}
        hidden={props.collapsed}
        aria-label={subject ? `${subject.title} 상세 패널` : "상세 패널"}
      >
        <header className={styles.header} data-summary={!subject}>
          <p className={styles.eyebrow}>
            {subject?.eyebrow ?? "오픈웹 · 다크웹"}
          </p>
          <button
            type="button"
            className={styles.close}
            aria-label="상세 패널 닫기"
            onClick={props.onClose}
          >
            ×
          </button>
          <h2>{subject?.title ?? "전체 현황"}</h2>
          {subject?.breadcrumb && (
            <p className={styles.breadcrumb}>{subject.breadcrumb}</p>
          )}
        </header>
        {subject ? (
          <>
            <DetailTabs
              id={id}
              active={props.tab}
              eventCount={incidents.length}
              connectionCount={subject.lines.length}
              onSelect={props.onTab}
            />
            <div
              key={`${subject.key}:${props.tab}:${props.revealToken}`}
              className={styles.content}
              role="tabpanel"
              id={`${id}-${props.tab}-panel`}
              aria-labelledby={`${id}-${props.tab}`}
              tabIndex={0}
            >
              {props.tab === "overview" && (
                <OverviewTab
                  subject={subject}
                  eventCount={incidents.length}
                  onTab={props.onTab}
                  onShowTerritory={props.onShowTerritory}
                />
              )}
              {props.tab === "events" && (
                <EventsTab
                  name={subject.title}
                  incidents={incidents}
                  selectedId={props.selectedIncidentId}
                  revealOnMount={props.revealToken > 0}
                  unavailable={
                    incidents.length === 0 &&
                    ((subject.territories.some((item) => item.web === "open") &&
                      Boolean(props.incidentsUnavailable)) ||
                      (!props.incidents && Boolean(props.connectionsUnavailable)))
                  }
                  onSelect={props.onSelectIncident}
                  onSelectLink={props.onSelectLink}
                />
              )}
              {props.tab === "connections" && (
                <ConnectionsTab
                  lines={subject.lines}
                  layouts={props.layouts}
                  selectedId={
                    props.selected?.kind === "link" ? props.selected.link_id : null
                  }
                  unavailable={Boolean(props.connectionsUnavailable)}
                  onSelect={props.onSelectLink}
                  onBack={props.onBack}
                  onShowTerritory={props.onShowTerritory}
                />
              )}
            </div>
          </>
        ) : (
          <div className={styles.content}>
            <EcosystemOverview
              layouts={props.layouts}
              loading={Boolean(props.loading)}
              onShowIsland={props.onShowIsland}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
