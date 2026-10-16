"use client";

// 상단 검색·3D 장면·상세 패널이 하나의 선택 상태를 공유한다.

import { useEffect, useMemo, useRef, useState } from "react";

import LinkScene3D, { type LinkScene3DHandle, type TerritoryRef } from "@/components/LinkScene3D";
import TopBar from "@/components/TopBar";
import { DetailPanel } from "@/components/detail-panel/DetailPanel";
import { LegendPanel } from "@/components/legend-panel/LegendPanel";
import { useDetailPanel } from "@/hooks/useDetailPanel";
import { confidenceLabel, relationLabel } from "@/lib/detail-panel.ts";
import type { Layout } from "@/lib/layout.ts";
import { searchAll, type SearchResult } from "@/lib/search.ts";
import { confidenceRank, focusOf, type Pick } from "@/lib/links.ts";
import { loadSceneData, type SceneData } from "@/lib/load.ts";
import { START_ANGLE } from "@/lib/scene.ts";

const WEB_LABEL = { dark: "다크웹", open: "오픈웹" } as const;

function nameOf(layouts: { dark: Layout | null; open: Layout | null }, t: TerritoryRef | null) {
  const hit = t ? layouts[t.web]?.territories.find((x) => x.id === t.territory_id) : null;
  return hit ? `${hit.name} · ${WEB_LABEL[t!.web]} ${hit.islandName}` : null;
}

export default function Demo() {
  const [data, setData] = useState<SceneData | null>(null);
  const panel = useDetailPanel();
  const { selected } = panel;
  const [hover, setHover] = useState<TerritoryRef | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [linkMode, setLinkMode] = useState<"summary" | "full">("full");
  const [filterOpen, setFilterOpen] = useState(false);
  const [excludedConfidences, setExcludedConfidences] = useState<Set<number>>(() => new Set());
  const [excludedRelations, setExcludedRelations] = useState<Set<string>>(() => new Set());
  const [angle, setAngle] = useState(START_ANGLE);
  const [query, setQuery] = useState("");
  const scene = useRef<LinkScene3DHandle>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("connection-map-link-mode") === "summary") queueMicrotask(() => setLinkMode("summary"));
    } catch { /* 저장소 접근이 막혀도 기본 모드로 계속한다. */ }
  }, []);

  const chooseLinkMode = (mode: "summary" | "full") => {
    setLinkMode(mode);
    try { window.localStorage.setItem("connection-map-link-mode", mode); } catch { /* 세션 동안은 선택을 유지한다. */ }
  };

  useEffect(() => {
    let live = true;
    loadSceneData(new URLSearchParams(window.location.search)).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, []);

  const layouts = useMemo(() => ({ dark: data?.dark ?? null, open: data?.open ?? null }), [data]);
  const allLines = useMemo(() => data?.lines ?? [], [data]);
  const confidenceOptions = useMemo(
    () => [...new Set(allLines.map((line) => confidenceRank(line.confidence)))].sort((a, b) => b - a),
    [allLines],
  );
  const relationOptions = useMemo(
    () => [...new Set(allLines.map((line) => line.relType))].sort((a, b) => relationLabel(a).localeCompare(relationLabel(b), "ko")),
    [allLines],
  );
  const lines = useMemo(
    () => allLines.filter((line) =>
      !excludedConfidences.has(confidenceRank(line.confidence)) && !excludedRelations.has(line.relType)),
    [allLines, excludedConfidences, excludedRelations],
  );
  const hits = useMemo(() => searchAll(layouts, data?.incidents ?? [], lines, query), [layouts, data?.incidents, lines, query]);

  useEffect(() => {
    if (selected?.kind === "link" && !lines.some((line) => line.id === selected.link_id)) panel.select(null);
  }, [lines, selected, panel]);

  const toggleConfidence = (rank: number) => setExcludedConfidences((current) => {
    const next = new Set(current);
    if (next.has(rank)) next.delete(rank);
    else next.add(rank);
    return next;
  });
  const toggleRelation = (type: string) => setExcludedRelations((current) => {
    const next = new Set(current);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    return next;
  });

  const guide = (() => {
    if (panel.incident) return `${panel.incident.reference} 선택 · 연결 ${panel.incident.linkIds.length}건`;
    if (selected?.kind === "link") return `${selected.link_id} 선택 · 연결된 두 영토 표시`;
    if (selected?.kind === "territory") {
      const f = focusOf(selected, layouts, lines);
      const n = nameOf(layouts, selected) ?? selected.territory_id;
      return `${n} — ${f.lonely ? "다른 층과 연결 없음" : `반대쪽 연결 ${f.lines.length}건`}`;
    }
    if (selected?.kind === "island") {
      const island = layouts[selected.web]?.islands.find((item) => item.id === selected.island_id);
      return island
        ? `${WEB_LABEL[selected.web]} · ${island.name} 선택 · 영토 ${island.territories.length}개`
        : "영토 클릭 → 연결된 영토와 선 표시";
    }
    if (hover) return nameOf(layouts, hover) ?? "";
    return "영토 클릭 → 연결된 영토와 선 표시";
  })();

  const choose = (h: TerritoryRef) => {
    // WebGL을 사용할 수 없는 환경에서도 검색 결과의 상세 정보를 연다.
    if (!scene.current?.show(h)) panel.select({ kind: "territory", ...h });
    setQuery("");
  };

  const chooseSearch = (hit: SearchResult) => {
    if (hit.target.kind === "territory") choose(hit.target);
    if (hit.target.kind === "link") {
      panel.select({ kind: "link", link_id: hit.target.link_id });
      setQuery("");
    }
    if (hit.target.kind === "incident") {
      scene.current?.show(hit.target.incident.territory);
      panel.openIncident(hit.target.incident);
      setQuery("");
    }
  };

  const chooseIsland = (island: Extract<Pick, { kind: "island" }>) => {
    if (!scene.current?.showIsland(island)) panel.select(island);
    setQuery("");
  };

  return (
    <main className="flex h-full flex-col bg-app">
      <TopBar query={query} onQueryChange={setQuery} hits={hits} onChoose={chooseSearch} />

      <div className="relative flex min-h-0 flex-1">
        <LegendPanel openLayout={layouts.open} darkLayout={layouts.dark} />

        <section className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5" aria-label="연결 생태계 지도">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-lg font-bold">연결 생태계</h2>
            <p className="text-sm text-ink-soft">오픈웹 · 다크웹 플랫폼과 연결 정보</p>
          </div>

          <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-line bg-white">
            <LinkScene3D
              ref={scene}
              className="absolute inset-0"
              dark={layouts.dark}
              open={layouts.open}
              lines={lines}
              selected={selected}
              onSelect={panel.select}
              onHover={setHover}
              showAllLinks={showAll}
              linkMode={linkMode}
              angle={angle}
              onAngleChange={setAngle}
            />

            <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border border-line bg-white/95 p-1 text-xs shadow-sm">
              <label className="flex cursor-pointer items-center gap-1.5 px-2">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-accent" />
                관계선
              </label>
              <div className="flex rounded-full bg-slate-100 p-0.5" role="group" aria-label="관계선 보기 방식">
                {(["summary", "full"] as const).map((mode) => (
                  <button key={mode} type="button" aria-pressed={linkMode === mode} onClick={() => chooseLinkMode(mode)}
                    className={`rounded-full px-2.5 py-1 ${linkMode === mode ? "bg-white font-semibold text-accent shadow-sm" : "text-ink-soft"}`}>
                    {mode === "summary" ? "요약 보기" : "전체 보기"}
                  </button>
                ))}
              </div>
            </div>

            <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col items-start gap-2 text-xs">
              <button type="button" aria-label={filterOpen ? "연결선 필터 접기" : "연결선 필터 펼치기"}
                aria-expanded={filterOpen} aria-controls="link-filters" title="연결선 필터"
                onClick={() => setFilterOpen((open) => !open)}
                className="flex size-10 items-center justify-center rounded-xl border border-line bg-white/95 text-ink shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
              </button>
              <div id="link-filters" inert={!filterOpen} aria-hidden={!filterOpen}
                className={`grid w-52 origin-top transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none ${filterOpen ? "grid-rows-[1fr] translate-y-0 opacity-100" : "pointer-events-none grid-rows-[0fr] -translate-y-2 opacity-0"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="max-h-[min(50vh,300px)] overflow-y-auto rounded-xl border border-line bg-white/95 p-3 shadow-sm">
                  <fieldset className="space-y-1.5">
                    <legend className="mb-2 font-semibold">신뢰도</legend>
                    {confidenceOptions.map((rank) => (
                      <label key={rank} className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={!excludedConfidences.has(rank)} onChange={() => toggleConfidence(rank)} className="accent-accent" />
                        {rank === 0 ? "미등록" : confidenceLabel(rank === 3 ? "상" : rank === 2 ? "중" : "하")}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="mt-3 space-y-1.5 border-t border-line pt-3">
                    <legend className="font-semibold">연결 유형</legend>
                    {relationOptions.map((type) => (
                      <label key={type} className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={!excludedRelations.has(type)} onChange={() => toggleRelation(type)} className="accent-accent" />
                        {relationLabel(type)}
                      </label>
                    ))}
                  </fieldset>
                  {!allLines.length && <p className="text-ink-soft">표시할 연결 자료가 없습니다.</p>}
                  </div>
                </div>
              </div>
            </div>

            <p className="absolute bottom-4 left-4 max-w-[calc(100%-2rem)] truncate rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs sm:max-w-[55%]" role="status">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-[#3B82F6] align-middle" />
              {guide}
            </p>

            <label className="absolute bottom-4 right-4 hidden items-center gap-2 rounded-xl border border-line bg-white/95 px-3 py-1.5 text-xs text-ink-soft sm:flex">
              회전
              <input type="range" min={0} max={360} step={1} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-36 accent-accent" />
              <output className="w-9 text-right font-medium tabular-nums text-accent">{angle}°</output>
            </label>
          </div>
        </section>

        <DetailPanel
          subject={panel.subject}
          selected={selected}
          layouts={layouts}
          loading={!data}
          lines={lines}
          incidents={data?.incidents}
          incidentsUnavailable={data?.bad.incidents}
          tab={panel.tab}
          collapsed={panel.collapsed}
          selectedIncidentId={panel.incident?.id ?? null}
          revealToken={panel.revealToken}
          connectionsUnavailable={data?.bad.links}
          onTab={panel.selectTab}
          onCollapse={panel.toggleCollapsed}
          onClose={panel.close}
          onSelectIncident={panel.selectIncident}
          onSelectLink={panel.selectLink}
          onBack={panel.clearLink}
          onShowTerritory={choose}
          onShowIsland={chooseIsland}
        />
      </div>
    </main>
  );
}
