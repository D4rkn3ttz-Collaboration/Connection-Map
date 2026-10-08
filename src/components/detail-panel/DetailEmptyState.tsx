import styles from "./detail-panel.module.css";

export function DetailEmptyState({
  title,
  description,
  error = false,
}: {
  title: string;
  description: string;
  error?: boolean;
}) {
  return (
    <div className={styles.empty} role={error ? "alert" : "status"}>
      <span className={styles.emptyIcon} aria-hidden="true">
        —
      </span>
      <p>{title}</p>
      <span>{description}</span>
    </div>
  );
}
