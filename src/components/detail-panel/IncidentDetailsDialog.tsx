"use client";

import type { CSSProperties, RefObject } from "react";
import { createPortal } from "react-dom";
import { dateParts, type PanelIncident } from "@/lib/detail-panel.ts";
import { IncidentMetaTags } from "./IncidentMetaTags";
import styles from "./incident-details-dialog.module.css";

export function IncidentDetailsDialog({
  incident,
  position,
  popupRef,
  closeButtonRef,
  onClose,
  onSelectLink,
}: {
  incident: PanelIncident;
  position: CSSProperties;
  popupRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: (restoreFocus?: boolean) => void;
  onSelectLink: (id: string) => void;
}) {
  return createPortal(
    <section
      ref={popupRef}
      id={`incident-popup-${incident.id}`}
      className={styles.popup}
      style={position}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`incident-popup-title-${incident.id}`}
    >
      <header className={styles.header}>
        <div className={styles.topline}>
          <span>사건 설명</span>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="사건 설명 닫기"
            onClick={() => onClose()}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <h2 id={`incident-popup-title-${incident.id}`}>
          {incident.title ?? incident.reference}
        </h2>
        <div className={styles.meta}>
          <time dateTime={incident.observedAt ?? undefined}>
            {dateParts(incident.observedAt)?.full ?? "시각 미등록"}
          </time>
          <IncidentMetaTags
            status={incident.status}
            exposureTypes={incident.exposureTypes}
          />
        </div>
      </header>
      <div className={styles.content}>
        <p className={incident.description ? styles.description : styles.empty}>
          {incident.description || "등록된 설명이 없습니다."}
        </p>
        {incident.linkIds.length > 0 && (
          <div className={styles.links}>
            {incident.linkIds.map((id) => (
              <button
                type="button"
                key={id}
                onClick={() => {
                  onClose(false);
                  onSelectLink(id);
                }}
              >
                {id} 연결 보기 <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>,
    document.body,
  );
}
