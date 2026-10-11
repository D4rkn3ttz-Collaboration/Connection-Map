import type { PanelIncident } from "@/lib/detail-panel.ts";
import styles from "./incident-meta-tags.module.css";

export function IncidentMetaTags({
  status,
  exposureTypes,
}: Pick<PanelIncident, "status" | "exposureTypes">) {
  return (
    <>
      {status && (
        <span
          className={`${styles.status} ${status === "검토중" ? styles.pending : status === "검토완료" ? styles.complete : ""}`}
        >
          {status}
        </span>
      )}
      {exposureTypes.map((type) => (
        <span className={styles.exposureTag} key={type}>
          {type}
        </span>
      ))}
    </>
  );
}
