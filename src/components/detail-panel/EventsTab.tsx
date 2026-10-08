"use client";

import { useState } from "react";
import {
  dateParts,
  incidentGroups,
  type PanelIncident,
} from "@/lib/detail-panel.ts";
import { DetailEmptyState } from "./DetailEmptyState";
import styles from "./detail-panel.module.css";
import timeline from "./event-timeline.module.css";

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
  const [limit, setLimit] = useState(5);
  const groups = incidentGroups(incidents.slice(0, limit));
  const selected = incidents.find((item) => item.id === selectedId);
  if (unavailable)
    return (
      <DetailEmptyState
        error
        title="사건 정보를 불러오지 못했습니다."
        description="페이지를 새로고침한 뒤 다시 확인해 주세요."
      />
    );
  if (!incidents.length)
    return (
      <DetailEmptyState
        title="표시할 사건 기록이 없습니다."
        description="현재 공개 연결 정보에 이 영토의 사건이 등록되어 있지 않습니다."
      />
    );
  return (
    <>
      <div className={styles.sectionMeta}>
        <span>{name} 사건 · 최신순</span>
        <span>최근 {Math.min(limit, incidents.length)}건</span>
      </div>
      <p className={styles.note}>공개 연결 기록 · 한국 시간</p>
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
                        {dateParts(incident.observedAt)?.short ?? "시각 미등록"}
                      </time>
                      {incident.exposureTypes.map((tag) => (
                        <span className={timeline.tag} key={tag}>
                          {tag}
                        </span>
                      ))}
                    </span>
                    <strong>
                      {incident.title
                        ? `${incident.reference} · ${incident.title}`
                        : incident.reference}
                    </strong>
                    <span className={timeline.caption}>
                      {incident.territoryName} · 연결 {incident.linkIds.length}
                      건
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {limit < incidents.length && (
        <button
          type="button"
          className={styles.textButton}
          onClick={() => setLimit((value) => value + 5)}
        >
          사건 더 보기 <span aria-hidden="true">↓</span>
        </button>
      )}
      {selected && (
        <section className={timeline.selected} aria-label="선택한 사건 정보">
          <h3>{selected.reference}</h3>
          {selected.description && <p>{selected.description}</p>}
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
  );
}
