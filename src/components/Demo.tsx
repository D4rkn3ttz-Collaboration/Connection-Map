"use client";

// 상단 검색·3D 장면·상세 패널이 하나의 선택 상태를 공유한다.

import { useEffect, useMemo, useRef, useState } from "react";

import LinkScene3D, { type LinkScene3DHandle, type TerritoryRef } from "@/components/LinkScene3D";
import TopBar from "@/components/TopBar";
import { DetailPanel } from "@/components/detail-panel/DetailPanel";
import { LegendPanel } from "@/components/legend-panel/LegendPanel";
import { useDetailPanel } from "@/hooks/useDetailPanel";
import { searchTerritories, type Layout } from "@/lib/layout.ts";
import { focusOf } from "@/lib/links.ts";
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
  const [angle, setAngle] = useState(START_ANGLE);
  const [query, setQuery] = useState("");
  const scene = useRef<LinkScene3DHandle>(null);

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
  const lines = useMemo(() => data?.lines ?? [], [data]);
  const hits = useMemo(() => searchTerritories([layouts.dark, layouts.open], query), [layouts, query]);

  const guide = (() => {
    if (panel.incident) return `${panel.incident.reference} 선택 · 연결 ${panel.incident.linkIds.length}건`;
    if (selected?.kind === "link") return `${selected.link_id} 선택 · 연결된 두 영토 표시`;
    if (selected?.kind === "territory") {
      const f = focusOf(selected, layouts, lines);
      const n = nameOf(layouts, selected) ?? selected.territory_id;
      return `${n} — ${f.lonely ? "다른 층과 연결 없음" : `반대쪽 연결 ${f.lines.length}건`}`;
    }
    if (hover) return nameOf(layouts, hover) ?? "";
    return "영토 클릭 → 연결된 영토와 선 표시";
  })();

  const choose = (h: TerritoryRef) => {
    // WebGL을 사용할 수 없는 환경에서도 검색 결과의 상세 정보를 연다.
    if (!scene.current?.show(h)) panel.select({ kind: "territory", ...h });
    setQuery("");
  };

  return (
    <main className="flex h-full flex-col bg-app">
      <TopBar query={query} onQueryChange={setQuery} hits={hits} onChoose={choose} />

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
              angle={angle}
              onAngleChange={setAngle}
            />

            <label className="absolute right-4 top-4 flex cursor-pointer items-center gap-2 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-accent" />
              전체 관계 보기
            </label>

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

          <ul className="space-y-0.5 text-xs text-ink-soft">
            {data ? (
              (["dark", "open", "incidents", "links"] as const).map((k) => (
                <li key={k} className={data.bad[k] ? "text-accent" : undefined}>
                  {data.status[k]}
                </li>
              ))
            ) : (
              <li>다크웹 배치 결과를 받는 중</li>
            )}
          </ul>
        </section>

        <DetailPanel
          subject={panel.subject}
          selected={selected}
          layouts={layouts}
          lines={lines}
          incidents={data?.incidents}
          incidentsUnavailable={data?.bad.incidents}
          tab={panel.tab}
          collapsed={panel.collapsed}
          selectedIncidentId={panel.incident?.id ?? null}
          connectionsUnavailable={data?.bad.links}
          onTab={panel.selectTab}
          onCollapse={panel.toggleCollapsed}
          onClose={panel.close}
          onSelectIncident={panel.selectIncident}
          onSelectLink={panel.selectLink}
          onBack={panel.clearLink}
          onShowTerritory={choose}
        />
      </div>
    </main>
  );
}
