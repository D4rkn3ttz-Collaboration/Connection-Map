"use client";

import { useState } from "react";
import {
  dateParts,
  incidentGroups,
  incidentsInRange,
  type PanelIncident,
} from "@/lib/detail-panel.ts";
import { DetailEmptyState } from "./DetailEmptyState";
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
  unavailable,
  onSelect,
  onSelectLink,
}: {
  name: string;
  incidents: PanelIncident[];
  selectedId: string | null;
  unavailable: boolean;
  onSelect: (incident: PanelIncident) => void;
  onSelectLink: (id: string) => void;
}) {
  const [now] = useState(() => Date.now());
  const [period, setPeriod] = useState<Period>("90");
  const [editingDates, setEditingDates] = useState(false);
  const [customRange, setCustomRange] = useState({
    from: koreanDate(now, 90),
    to: koreanDate(now),
  });
  const [limit, setLimit] = useState(5);
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
  const groups = incidentGroups(visible.slice(0, limit));
  const selected = visible.find((item) => item.id === selectedId);
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
          · 최근 {Math.min(limit, visible.length)}건
        </span>
      </div>
      <div className={filters.periods} role="group" aria-label="사건 기간">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            aria-pressed={period === preset.id}
            onClick={() => {
              setPeriod(preset.id);
              setLimit(5);
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
                setCustomRange((current) => ({
                  ...current,
                  from: event.target.value,
                }));
                setPeriod("custom");
                setLimit(5);
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
                setCustomRange((current) => ({
                  ...current,
                  to: event.target.value,
                }));
                setPeriod("custom");
                setLimit(5);
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
                        className={timeline.event}
                        aria-pressed={selectedId === incident.id}
                        onClick={() => onSelect(incident)}
                      >
                        <span className={timeline.dot} aria-hidden="true" />
                        <span className={timeline.metadata}>
                          <time dateTime={incident.observedAt ?? undefined}>
                            {dateParts(incident.observedAt)?.short ??
                              "시각 미등록"}
                          </time>
                          {incident.exposureTypes.map((tag) => (
                            <span className={timeline.tag} key={tag}>
                              {tag}
                            </span>
                          ))}
                          {incident.status && (
                            <span className={timeline.tag}>{incident.status}</span>
                          )}
                        </span>
                        <strong>
                          {incident.title
                            ? `${incident.reference} · ${incident.title}`
                            : incident.reference}
                        </strong>
                        <span className={timeline.caption}>
                          {incident.territoryName}
                          {incident.linkIds.length > 0 &&
                            ` · 연결 ${incident.linkIds.length}건`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          {limit < visible.length && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setLimit((value) => value + 5)}
            >
              사건 더 보기 <span aria-hidden="true">↓</span>
            </button>
          )}
          {selected && (
            <section
              className={timeline.selected}
              aria-label="선택한 사건 정보"
            >
              <h3>{selected.reference}</h3>
              {selected.description && <p>{selected.description}</p>}
              {selected.status && <p>상태: {selected.status}</p>}
              {!selected.title && (
                <p>공개 정보에는 사건 제목과 설명이 포함되어 있지 않습니다.</p>
              )}
              {selected.linkIds.map((id) => (
                <button
                  type="button"
                  className={styles.textButton}
                  key={id}
                  onClick={() => onSelectLink(id)}
                >
                  {id} 연결 보기 <span aria-hidden="true">→</span>
                </button>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
