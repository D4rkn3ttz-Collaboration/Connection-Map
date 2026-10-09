import {
  dateParts,
  WEB_LABEL,
  type DetailSubject,
  type DetailTab,
  type TerritoryRef,
} from "@/lib/detail-panel.ts";
import styles from "./detail-panel.module.css";

export function OverviewTab({
  subject,
  eventCount,
  onTab,
  onShowTerritory,
}: {
  subject: DetailSubject;
  eventCount: number;
  onTab: (tab: DetailTab) => void;
  onShowTerritory: (territory: TerritoryRef) => void;
}) {
  return (
    <div className={styles.overview}>
      <h3 className={styles.sectionHeading}>영토 정보</h3>
      <dl className={styles.definitionList}>
        <div>
          <dt>구분</dt>
          <dd>
            {[
              ...new Set(
                subject.territories.map((item) => WEB_LABEL[item.web]),
              ),
            ].join(" · ")}
          </dd>
        </div>
        <div>
          <dt>플랫폼 유형</dt>
          <dd>
            {[
              ...new Set(
                subject.territories.map((item) => item.territory.islandName),
              ),
            ].join(" · ")}
          </dd>
        </div>
        {subject.updatedAt && (
          <div>
            <dt>자료 기준</dt>
            <dd>
              {dateParts(subject.updatedAt)?.full ?? "미등록"}
              <small>한국 시간</small>
            </dd>
          </div>
        )}
      </dl>
      <div className={styles.metrics}>
        <button type="button" onClick={() => onTab("events")}>
          <span>등록된 사건</span>
          <strong>
            {eventCount}
            <small>건</small>
          </strong>
        </button>
        <button type="button" onClick={() => onTab("connections")}>
          <span>플랫폼 연결</span>
          <strong>
            {subject.lines.length}
            <small>건</small>
          </strong>
        </button>
      </div>
      <p className={styles.note}>오픈웹 사건 및 공개 연결 기록 기준입니다.</p>
      <h3 className={styles.sectionHeading}>
        {subject.territories.length > 1 ? "포함된 영토" : "선택한 영토"}
      </h3>
      <ul className={styles.territories}>
        {subject.territories.map((item) => (
          <li key={`${item.web}:${item.territory_id}`}>
            <button type="button" onClick={() => onShowTerritory(item)}>
              <i
                style={{ backgroundColor: item.territory.color }}
                aria-hidden="true"
              />
              <span>
                <strong>{item.territory.name}</strong>
                <small>
                  {WEB_LABEL[item.web]} · {item.territory.islandName}
                </small>
              </span>
              <span className={styles.arrow} aria-hidden="true">
                ↗
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
