import type { DetailTab } from "@/lib/detail-panel.ts";
import styles from "./detail-panel.module.css";

export function DetailTabs({
  id,
  active,
  eventCount,
  connectionCount,
  onSelect,
}: {
  id: string;
  active: DetailTab;
  eventCount: number;
  connectionCount: number;
  onSelect: (tab: DetailTab) => void;
}) {
  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: "overview", label: "개요" },
    { id: "events", label: "사건", count: eventCount },
    { id: "connections", label: "연결", count: connectionCount },
  ];
  return (
    <div role="tablist" aria-label="상세 정보" className={styles.tabs}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`${id}-${tab.id}`}
          aria-selected={active === tab.id}
          aria-controls={`${id}-${tab.id}-panel`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (index + tabs.length - 1) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            onSelect(tabs[next].id);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next]?.focus();
          }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={styles.count}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
