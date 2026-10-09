import { dateParts, WEB_LABEL, type Layouts } from "@/lib/detail-panel.ts";
import type { Pick } from "@/lib/links.ts";
import styles from "./ecosystem-overview.module.css";

interface EcosystemOverviewProps {
  layouts: Layouts;
  loading: boolean;
  onShowIsland: (island: Extract<Pick, { kind: "island" }>) => void;
}

const WEBS = ["open", "dark"] as const;

export function EcosystemOverview({ layouts, loading, onShowIsland }: EcosystemOverviewProps) {
  return (
    <div className={styles.overview} aria-busy={loading}>
      <dl className={styles.totals} aria-label="영토 현황">
        {WEBS.map((web) => (
          <div key={web}>
            <dt>{WEB_LABEL[web]} 영토</dt>
            <dd>
              {layouts[web] ? (
                <>
                  {layouts[web].territories.length.toLocaleString("ko-KR")}
                  <span>개</span>
                </>
              ) : (
                <span className={styles.pending}>
                  {loading ? "불러오는 중" : "확인 불가"}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {WEBS.map((web) => {
        const layout = layouts[web];
        const updated = layout?.asOf ? dateParts(layout.asOf) : null;

        return (
          <section key={web} className={styles.section} aria-label={`${WEB_LABEL[web]} 현황`}>
            <div className={styles.sectionTitle}>
              <h3>{WEB_LABEL[web]}</h3>
              {layout && <span>{layout.islands.length}개 유형</span>}
            </div>
            {layout?.islands.length ? (
              <ul className={styles.types}>
                {layout.islands.map((island) => (
                  <li key={`${web}:${island.id}`}>
                    <button
                      type="button"
                      className={styles.typeLink}
                      onClick={() => onShowIsland({ kind: "island", web, island_id: island.id })}
                    >
                      <span
                        className={styles.hex}
                        style={{ backgroundColor: island.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.typeName}>{island.name}</span>
                      <span className={styles.typeCount}>
                        {island.territories.length.toLocaleString("ko-KR")}개
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.message} role="status">
                {loading
                  ? "현황을 불러오고 있습니다."
                  : layout
                    ? "등록된 영토가 없습니다."
                    : "현황을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요."}
              </p>
            )}

            {updated && (
              <p className={styles.updated}>
                자료 기준 <time dateTime={layout?.asOf ?? undefined}>{updated.full}</time> · 한국 시간
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
