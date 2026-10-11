"use client";

import { useEffect, useRef, useState } from "react";
import {
  dateParts,
  incidentGroups,
  incidentsInRange,
  type PanelIncident,
} from "@/lib/detail-panel.ts";
import { useIncidentPopup } from "@/hooks/useIncidentPopup";
import { DetailEmptyState } from "./DetailEmptyState";
import { IncidentDetailsDialog } from "./IncidentDetailsDialog";
import { IncidentMetaTags } from "./IncidentMetaTags";
import styles from "./detail-panel.module.css";
import filters from "./incident-filters.module.css";
import timeline from "./event-timeline.module.css";

type Period = "7" | "30" | "90" | "all" | "custom";
const presets = [
  { id: "7", label: "7일" },
  { id: "30", label: "30일" },
  { id: "90", label: "90일" },
  { id: "all", label: "전체" },
] as const;

function koreanDate(now: number, daysBefore = 0) {
  return new Date(now + (9 * 60 * 60 - daysBefore * 24 * 60 * 60) * 1000)
    .toISOString()
    .slice(0, 10);
}

export function EventsTab({
  name,
  incidents,
  selectedId,
  revealOnMount,
  unavailable,
  onSelect,
  onSelectLink,
}: {
  name: string;
  incidents: PanelIncident[];
  selectedId: string | null;
  revealOnMount: boolean;
  unavailable: boolean;
  onSelect: (incident: PanelIncident) => void;
  onSelectLink: (id: string) => void;
}) {
  const [now] = useState(() => Date.now());
  const [period, setPeriod] = useState<Period>("all");
  const [editingDates, setEditingDates] = useState(false);
  const [customRange, setCustomRange] = useState({
    from: koreanDate(now, 90),
    to: koreanDate(now),
  });
  const { popup, popupRef, closeButtonRef, open, close } = useIncidentPopup();
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!revealOnMount) return;
    const frame = requestAnimationFrame(() => {
      const trigger = selectedRef.current;
      const incident = incidents.find((item) => item.id === selectedId);
      if (!trigger || !incident) return;
      trigger.scrollIntoView({ block: "center" });
      open(incident, trigger);
    });
    return () => cancelAnimationFrame(frame);
  }, [incidents, open, revealOnMount, selectedId]);
  const range =
    period === "all"
      ? null
      : period === "custom"
        ? customRange
        : { from: koreanDate(now, Number(period)), to: koreanDate(now) };
  const visible = incidentsInRange(
    incidents,
    range?.from ?? null,
    range?.to ?? null,
  );
  const groups = incidentGroups(visible);
  if (unavailable)
    return (
      <DetailEmptyState
        error
        title="사건 정보를 불러오지 못했습니다."
        description="페이지를 새로고침한 뒤 다시 확인해 주세요."
      />
    );
  return (
    <>
      <div className={styles.sectionMeta}>
        <span>{name} 사건 · 최신순</span>
        <span>
          {period === "custom"
            ? "지정 기간"
            : period === "all"
              ? "전체"
              : `${period}일`}{" "}
          · {visible.length}건
        </span>
      </div>
      <div className={filters.periods} role="group" aria-label="사건 기간">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            aria-pressed={period === preset.id}
            onClick={() => {
              close(false);
              setPeriod(preset.id);
              setEditingDates(false);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className={filters.dateRange}>
        <span>{range ? `${range.from} — ${range.to}` : "전체 기간"}</span>
        <button
          type="button"
          aria-expanded={editingDates}
          onClick={() => {
            if (!editingDates && range) setCustomRange(range);
            setEditingDates((open) => !open);
          }}
        >
          변경 <span aria-hidden="true">⌄</span>
        </button>
      </div>
      {editingDates && (
        <div className={filters.dateInputs}>
          <label>
            시작
            <input
              type="date"
              value={customRange.from}
              max={customRange.to}
              onChange={(event) => {
                close(false);
                setCustomRange((current) => ({
                  ...current,
                  from: event.target.value,
                }));
                setPeriod("custom");
              }}
            />
          </label>
          <label>
            종료
            <input
              type="date"
              value={customRange.to}
              min={customRange.from}
              onChange={(event) => {
                close(false);
                setCustomRange((current) => ({
                  ...current,
                  to: event.target.value,
                }));
                setPeriod("custom");
              }}
            />
          </label>
        </div>
      )}
      <p className={styles.note}>오픈웹 사건 및 공개 연결 기록 · 한국 시간</p>
      {!incidents.length ? (
        <DetailEmptyState
          title="표시할 사건 기록이 없습니다."
          description="이 영토에 등록된 사건이 없습니다."
        />
      ) : !visible.length ? (
        <DetailEmptyState
          title="선택한 기간에 사건이 없습니다."
          description="다른 기간을 선택하거나 전체 기록을 확인해 주세요."
        />
      ) : (
        <>
          <div className={timeline.timeline}>
            {groups.map(({ month, items }) => (
              <section key={month} aria-label={`${month} 사건`}>
                <h3>{month}</h3>
                <ol>
                  {items.map((incident) => (
                    <li key={incident.id}>
                      <button
                        type="button"
                        ref={selectedId === incident.id ? selectedRef : undefined}
                        className={timeline.event}
                        aria-pressed={selectedId === incident.id}
                        aria-haspopup="dialog"
                        aria-expanded={popup?.incident.id === incident.id}
                        aria-controls={popup?.incident.id === incident.id ? `incident-popup-${incident.id}` : undefined}
                        onClick={(event) => {
                          onSelect(incident);
                          open(incident, event.currentTarget);
                        }}
                      >
                        <span className={timeline.dot} aria-hidden="true" />
                        <span className={timeline.metadata}>
                          <time dateTime={incident.observedAt ?? undefined}>
                            {dateParts(incident.observedAt)?.short ??
                              "시각 미등록"}
                          </time>
                          <IncidentMetaTags
                            status={incident.status}
                            exposureTypes={incident.exposureTypes}
                          />
                        </span>
                        <strong>
                          {incident.title
                            ? `${incident.reference} · ${incident.title}`
                            : incident.reference}
                        </strong>
                        {incident.linkIds.length > 0 && (
                          <span className={timeline.caption}>연결 {incident.linkIds.length}건</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
      {popup && (
        <IncidentDetailsDialog
          incident={popup.incident}
          position={popup.position}
          popupRef={popupRef}
          closeButtonRef={closeButtonRef}
          onClose={close}
          onSelectLink={onSelectLink}
        />
      )}
    </>
  );
}
