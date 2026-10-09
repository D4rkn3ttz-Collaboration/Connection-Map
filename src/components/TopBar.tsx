"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SearchResult } from "@/lib/search.ts";
import { SEARCH_GROUPS } from "@/lib/search.ts";
import styles from "./search.module.css";

const destinations = [
  { label: "오픈웹", href: "https://openweb-map.vercel.app/", dot: "bg-[#3B82F6]" },
  { label: "연결", href: "https://d4rkn3ttz-collaboration.github.io/Connection-Map/", dot: "bg-[#8B5CF6]", current: true },
  { label: "다크웹", href: "https://darkchoco-map.darkchoco.workers.dev/", dot: "bg-[#E5484D]" },
] as const;

function Highlight({ value, query, web }: { value: string; query: string; web: "open" | "dark" }) {
  const index = value.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase());
  if (index < 0 || !query.trim()) return <>{value}</>;
  const length = query.trim().length;
  return <>{value.slice(0, index)}<mark className={web === "open" ? styles.matchOpen : styles.matchDark}>{value.slice(index, index + length)}</mark>{value.slice(index + length)}</>;
}

function ResultRow({ hit, query, onChoose }: { hit: SearchResult; query: string; onChoose: () => void }) {
  const titleRef = useRef<HTMLElement>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const showTitle = () => {
    const title = titleRef.current;
    if (!title || title.scrollWidth <= title.clientWidth) return;
    const rect = title.getBoundingClientRect();
    setTooltip({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(420, window.innerWidth - 16))),
      top: rect.bottom > window.innerHeight - 100 ? rect.top - 6 : rect.bottom + 6,
      above: rect.bottom > window.innerHeight - 100,
    });
  };
  return (
    <button type="button" className={styles.result} onClick={onChoose}
      onMouseEnter={showTitle} onMouseLeave={() => setTooltip(null)}
      onFocus={showTitle} onBlur={() => setTooltip(null)}>
      <span className={styles.icon} style={{ color: hit.color }} aria-hidden="true">{hit.category === "incident" ? "◷" : hit.category === "relation" ? "⇄" : "⬢"}</span>
      <span className={styles.resultText}>
        <strong ref={titleRef}><Highlight value={hit.title} query={query} web={hit.web} /></strong>
        <small><Highlight value={hit.subtitle} query={query} web={hit.web} /></small>
      </span>
      {hit.count ? <span className={styles.badge}>{hit.count}건</span> : null}
      {tooltip && createPortal(
        <span className={styles.titleTooltip} style={{ left: tooltip.left, top: tooltip.top, transform: tooltip.above ? "translateY(-100%)" : undefined }} role="tooltip">{hit.title}</span>,
        document.body,
      )}
    </button>
  );
}

export default function TopBar({ query, onQueryChange, hits, onChoose }: {
  query: string;
  onQueryChange: (value: string) => void;
  hits: SearchResult[];
  onChoose: (hit: SearchResult) => void;
}) {
  const [focused, setFocused] = useState(false);
  const grouped = useMemo(() => ({
    open: SEARCH_GROUPS.open.map((group) => ({ ...group, items: hits.filter((hit) => hit.web === "open" && hit.category === group.category) })),
    dark: SEARCH_GROUPS.dark.map((group) => ({ ...group, items: hits.filter((hit) => hit.web === "dark" && hit.category === group.category) })),
  }), [hits]);
  const visible = focused && Boolean(query.trim());
  const first = [...grouped.open, ...grouped.dark].flatMap((group) => group.items)[0];

  return (
    <header className="relative z-20 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line bg-white px-4 py-2.5 sm:px-6">
      <div className="flex shrink-0 items-center gap-2.5 border-r border-line pr-5">
        <svg width="27" height="27" viewBox="0 0 27 27" aria-hidden="true">
          <path d="M13.5 1.5 18.5 4.4v5.8l-5 2.9-5-2.9V4.4z" fill="#8B5CF6" />
          <path d="M6.5 13.1 11.5 16v5.8l-5 2.9-5-2.9V16z" fill="#3B82F6" />
          <path d="M20.5 13.1 25.5 16v5.8l-5 2.9-5-2.9V16z" fill="#E5484D" />
        </svg>
        <div className="leading-none">
          <h1 className="block text-sm font-extrabold tracking-tight text-ink">WEB SCOPE</h1>
          <span className="mt-1 block text-[9px] font-medium tracking-[0.16em] text-ink-soft">ECOSYSTEM MAP</span>
        </div>
      </div>
      <nav aria-label="지도 이동" className="flex shrink-0 items-center rounded-md bg-[#F0F2F5] p-0.5">
        {destinations.map(({ label, href, dot, ...item }) => (
          <a key={label} href={href} aria-current={"current" in item ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${"current" in item ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:bg-white/70 hover:text-ink"}`}>
            <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />{label}
          </a>
        ))}
      </nav>
      <div className="relative order-3 w-full sm:order-none sm:ml-auto sm:w-72 lg:w-80"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" />
        </svg>
        <input type="search" value={query} onFocus={() => setFocused(true)}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setFocused(false); event.currentTarget.blur(); }
            if (event.key === "Enter" && first) { onChoose(first); setFocused(false); }
          }}
          placeholder="사건 · 플랫폼 · 영토 · 행위자 검색"
          role="combobox" aria-autocomplete="list" aria-label="오픈웹과 다크웹 검색" aria-expanded={visible} aria-controls="search-results"
          className="w-full rounded-md border border-line bg-white py-1.5 pl-9 pr-3 text-xs text-ink outline-none placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-accent" />
        {visible && (
          <div id="search-results" className={styles.popup} role="region" aria-label="검색 결과">
            {hits.length ? (
              <div className={styles.columns}>
                {(["open", "dark"] as const).map((web) => (
                  <section key={web} className={styles.column} aria-label={web === "open" ? "오픈웹 검색 결과" : "다크웹 검색 결과"}>
                    <div className={styles.webTitle}><span className={web === "open" ? styles.openDot : styles.darkDot} />{web === "open" ? "오픈웹" : "다크웹"}</div>
                    {grouped[web].filter((group) => group.items.length).map((group) => (
                      <div key={group.category} className={styles.group}>
                        <div className={styles.groupTitle}><span>{group.label}</span><span>{group.items.length}</span></div>
                        {group.items.slice(0, 8).map((hit) => (
                          <ResultRow key={hit.id} hit={hit} query={query} onChoose={() => { onChoose(hit); setFocused(false); }} />
                        ))}
                      </div>
                    ))}
                    {!grouped[web].some((group) => group.items.length) && <p className={styles.emptyColumn}>일치하는 결과가 없습니다.</p>}
                  </section>
                ))}
              </div>
            ) : <p className={styles.empty}>일치하는 결과가 없습니다.</p>}
            <div className={styles.footer}>Enter 첫 결과 열기 <span>Esc 닫기</span></div>
          </div>
        )}
      </div>
    </header>
  );
}
