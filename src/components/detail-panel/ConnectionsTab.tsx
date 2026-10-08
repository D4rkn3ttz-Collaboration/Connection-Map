import {
  confidenceLabel,
  dateParts,
  relationLabel,
  territoryOf,
  verificationLabel,
  WEB_LABEL,
  type Layouts,
  type TerritoryRef,
} from "@/lib/detail-panel.ts";
import type { LinkLine } from "@/lib/links.ts";
import { DetailEmptyState } from "./DetailEmptyState";
import styles from "./detail-panel.module.css";

export function ConnectionsTab({
  lines,
  layouts,
  selectedId,
  unavailable,
  onSelect,
  onBack,
  onShowTerritory,
}: {
  lines: LinkLine[];
  layouts: Layouts;
  selectedId: string | null;
  unavailable: boolean;
  onSelect: (id: string) => void;
  onBack: () => void;
  onShowTerritory: (ref: TerritoryRef) => void;
}) {
  if (unavailable)
    return (
      <DetailEmptyState
        error
        title="연결 정보를 불러오지 못했습니다."
        description="페이지를 새로고침한 뒤 다시 확인해 주세요."
      />
    );
  if (!lines.length)
    return (
      <DetailEmptyState
        title="등록된 연결이 없습니다."
        description="이 영토와 다른 층을 잇는 공개 연결 정보가 아직 없습니다."
      />
    );
  const selected = lines.find((line) => line.id === selectedId);
  if (selected)
    return (
      <div>
        <button type="button" className={styles.back} onClick={onBack}>
          ← 연결 목록
        </button>
        <div className={styles.connectionHeading}>
          <span>{selected.id}</span>
          <h3>{relationLabel(selected.relType)}</h3>
        </div>
        <div className={styles.endpoints}>
          {(["open", "dark"] as const).map((web) => {
            const ref = {
              web,
              territory_id: web === "open" ? selected.openId : selected.darkId,
            };
            const item = territoryOf(layouts, ref);
            return (
              <button
                type="button"
                key={web}
                onClick={() => onShowTerritory(ref)}
              >
                <span>{WEB_LABEL[web]}</span>
                <strong>{item?.territory.name ?? ref.territory_id}</strong>
                <small>{item?.territory.islandName ?? ""}</small>
              </button>
            );
          })}
        </div>
        <dl className={styles.definitionList}>
          <div>
            <dt>검증 상태</dt>
            <dd>{verificationLabel(selected.verification)}</dd>
          </div>
          <div>
            <dt>신뢰도</dt>
            <dd>{confidenceLabel(selected.confidence)}</dd>
          </div>
          <div>
            <dt>오픈웹 관측</dt>
            <dd>{dateParts(selected.openObservedAt)?.full ?? "미등록"}</dd>
          </div>
          <div>
            <dt>다크웹 관측</dt>
            <dd>{dateParts(selected.darkObservedAt)?.full ?? "미등록"}</dd>
          </div>
          {selected.eventId && (
            <div>
              <dt>사건 ID</dt>
              <dd>{selected.eventId}</dd>
            </div>
          )}
          {selected.findingId && (
            <div>
              <dt>발견 ID</dt>
              <dd>{selected.findingId}</dd>
            </div>
          )}
        </dl>
        <p className={styles.note}>
          관측 시각은 한국 시간 기준입니다. 비공개 근거 자료는 표시하지
          않습니다.
        </p>
      </div>
    );
  return (
    <>
      <div className={styles.sectionMeta}>
        <span>연결된 플랫폼</span>
        <span>{lines.length}건</span>
      </div>
      <ul className={styles.connections}>
        {lines.map((line) => {
          const open = territoryOf(layouts, {
            web: "open",
            territory_id: line.openId,
          });
          const dark = territoryOf(layouts, {
            web: "dark",
            territory_id: line.darkId,
          });
          return (
            <li key={line.id}>
              <button
                type="button"
                onClick={() => onSelect(line.id)}
                className={styles.connectionCard}
              >
                <span className={styles.cardMeta}>
                  <span>{relationLabel(line.relType)}</span>
                  <span>신뢰도 {confidenceLabel(line.confidence)}</span>
                </span>
                <strong>
                  <i
                    style={{ backgroundColor: open?.territory.color }}
                    aria-hidden="true"
                  />
                  {open?.territory.name ?? line.openId}
                </strong>
                <span className={styles.connector} aria-hidden="true">
                  ↕
                </span>
                <strong>
                  <i
                    style={{ backgroundColor: dark?.territory.color }}
                    aria-hidden="true"
                  />
                  {dark?.territory.name ?? line.darkId}
                </strong>
                <span className={styles.cardFooter}>
                  {verificationLabel(line.verification)}
                  <span>
                    {line.id} <span aria-hidden="true">→</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
