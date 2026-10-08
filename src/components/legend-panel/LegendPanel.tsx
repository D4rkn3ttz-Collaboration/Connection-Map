"use client";

import { useState } from "react";
import type { Layout } from "@/lib/layout.ts";
import styles from "./legend-panel.module.css";

type LegendItem = { name: string; color: string };

const OPEN_LEGEND: LegendItem[] = [
  { name: "코드 저장소", color: "#2868EB" },
  { name: "텍스트 호스팅", color: "#10A99F" },
  { name: "커뮤니티", color: "#F27927" },
  { name: "클라우드 스토리지", color: "#28AEE6" },
  { name: "파일 공유", color: "#8555EE" },
  { name: "백엔드 서비스", color: "#26BA58" },
  { name: "리서치 소스", color: "#E3B90B" },
  { name: "기타", color: "#C9D2DF" },
];

const DARK_LEGEND: LegendItem[] = [
  { name: "포럼", color: "#877BF3" },
  { name: "랜섬웨어", color: "#F26666" },
  { name: "텔레그램", color: "#54B8E3" },
  { name: "행위자", color: "#808DA0" },
];

function itemsFor(layout: Layout | null, fallback: LegendItem[]) {
  if (!layout?.islands.length) return fallback;
  const order = new Map(fallback.map((item, index) => [item.name, index]));
  return layout.islands
    .map((island) => ({ name: island.name, color: island.color }))
    .sort(
      (a, b) =>
        (order.get(a.name) ?? fallback.length) -
        (order.get(b.name) ?? fallback.length),
    );
}

function LegendGroup({
  badge,
  caption,
  tone,
  items,
}: {
  badge: string;
  caption: string;
  tone: "open" | "dark";
  items: LegendItem[];
}) {
  return (
    <section className={styles.group}>
      <p className={styles.groupTitle}>
        <span className={tone === "open" ? styles.openBadge : styles.darkBadge}>
          {badge}
        </span>
        <span>{caption}</span>
      </p>
      <p className={styles.sectionLabel}>
        섬 색 · {tone === "open" ? "영역" : "유형"}
      </p>
      <ul className={styles.items}>
        {items.map((item) => (
          <li key={item.name}>
            <span
              className={styles.hex}
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LegendPanel({
  openLayout,
  darkLayout,
}: {
  openLayout: Layout | null;
  darkLayout: Layout | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.mobileToggle}
        aria-expanded={mobileOpen}
        aria-controls="map-legend"
        onClick={() => setMobileOpen((open) => !open)}
      >
        범례
      </button>
      <aside
        id="map-legend"
        className={styles.panel}
        data-open={mobileOpen}
        aria-label="지도 범례"
      >
        <div className={styles.header}>
          <h2>범례</h2>
          <button
            type="button"
            className={styles.mobileClose}
            aria-label="범례 닫기"
            onClick={() => setMobileOpen(false)}
          >
            ×
          </button>
        </div>

        <LegendGroup
          badge="OPEN WEB"
          caption="오픈웹 · 표층"
          tone="open"
          items={itemsFor(openLayout, OPEN_LEGEND)}
        />
        <LegendGroup
          badge="DARK WEB"
          caption="다크웹 · 심층"
          tone="dark"
          items={itemsFor(darkLayout, DARK_LEGEND)}
        />

        <section className={styles.guide}>
          <h3>연결선 · 신뢰도</h3>
          <ul className={styles.lineItems}>
            <li>
              <span className={styles.solidLine} aria-hidden="true" />
              높음
            </li>
            <li>
              <span className={styles.dashedLine} aria-hidden="true" />
              중간
            </li>
            <li>
              <span className={styles.dottedLine} aria-hidden="true" />
              낮음
            </li>
          </ul>
        </section>

        <section className={styles.guide}>
          <h3>읽는 법</h3>
          <p>섬은 유형, 영토는 개별 대상을 뜻합니다.</p>
          <p>영토를 고르면 연결된 대상과 선이 강조됩니다.</p>
        </section>
      </aside>
    </>
  );
}
