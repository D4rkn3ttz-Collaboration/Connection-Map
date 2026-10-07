"use client";

import type { SearchHit } from "@/lib/layout.ts";

const destinations = [
  { label: "오픈웹", href: "https://openweb-map.vercel.app/", dot: "bg-[#3B82F6]" },
  { label: "연결", href: "https://d4rkn3ttz-collaboration.github.io/Connection-Map/", dot: "bg-[#8B5CF6]", current: true },
  { label: "다크웹", href: "https://darkchoco-map.h42381309.workers.dev/", dot: "bg-[#E5484D]" },
] as const;

export default function TopBar({
  query,
  onQueryChange,
  hits,
  onChoose,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  hits: SearchHit[];
  onChoose: (hit: SearchHit) => void;
}) {
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
          <a
            key={label}
            href={href}
            aria-current={"current" in item ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${"current" in item ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:bg-white/70 hover:text-ink"}`}
          >
            <span className={`size-1.5 rounded-full ${dot}`} aria-hidden="true" />
            {label}
          </a>
        ))}
      </nav>

      <div className="relative order-3 w-full sm:order-none sm:ml-auto sm:w-64 lg:w-72">
        <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && hits[0]) onChoose(hits[0]);
          }}
          placeholder="영토 찾기 — 오픈웹 · 다크웹"
          aria-label="영토 찾기"
          className="w-full rounded-md border border-line bg-white py-1.5 pl-9 pr-3 text-xs text-ink outline-none placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-accent"
        />
        {hits.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-line bg-white py-1 text-sm shadow-lg">
            {hits.map((hit) => (
              <li key={`${hit.web}:${hit.territory_id}`}>
                <button type="button" onClick={() => onChoose(hit)} className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-app focus-visible:bg-app">
                  <span>{hit.name}</span>
                  <span className="text-xs text-ink-soft">{hit.web === "dark" ? "다크웹" : "오픈웹"} · {hit.islandName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
