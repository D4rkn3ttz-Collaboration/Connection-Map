"use client";

// 손잡이 시험용 화면 — 닥스훈트 화면이 들어올 자리다. 3D 컴포넌트를 감싸는 쪽이 할 일을 가장 작게 해 둔다:
// 자료를 한 번 받아 넘기고, 고른 것(selected)을 들고, 찾기 → show(), 「전체 관계 보기」 · 회전 슬라이더를 값으로 넘긴다.
// 자리는 Figma ③-0 을 따랐다(토글 오른쪽 위 · 안내 알약 왼쪽 아래 · 회전 슬라이더 오른쪽 아래). 모양은 닥스훈트가 정한다.

import { useEffect, useMemo, useRef, useState } from "react";

import LinkScene3D, { type LinkScene3DHandle, type TerritoryRef } from "@/components/LinkScene3D";
import { searchTerritories, type Layout } from "@/lib/layout.ts";
import { focusOf, type Pick } from "@/lib/links.ts";
import { loadSceneData, type SceneData } from "@/lib/load.ts";
import { START_ANGLE } from "@/lib/scene.ts";

const WEB_LABEL = { dark: "다크웹", open: "오픈웹" } as const;

function nameOf(layouts: { dark: Layout | null; open: Layout | null }, t: TerritoryRef | null) {
  const hit = t ? layouts[t.web]?.territories.find((x) => x.id === t.territory_id) : null;
  return hit ? `${hit.name} · ${WEB_LABEL[t!.web]} ${hit.islandName}` : null;
}

export default function Demo() {
  const [data, setData] = useState<SceneData | null>(null);
  const [selected, setSelected] = useState<Pick | null>(null);
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
    if (selected?.kind === "territory") {
      const f = focusOf(selected, layouts, lines);
      const n = nameOf(layouts, selected) ?? selected.territory_id;
      return `${n} — ${f.lonely ? "다른 층과 연결 없음" : `반대쪽 연결 ${f.lines.length}건`}`;
    }
    if (hover) return nameOf(layouts, hover) ?? "";
    return "영토 클릭 → 연결된 영토와 선 표시";
  })();

  const choose = (h: TerritoryRef) => {
    scene.current?.show(h);
    setQuery("");
  };

  return (
    <main className="flex h-full flex-col gap-3 p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold">연결 생태계</h1>
        <p className="text-sm text-ink-soft">3D 장면 확인용 화면 — 둘레(머리띠 · 범례 · 패널)는 닥스훈트 화면이 들어온다</p>
      </header>

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-line bg-white">
        <LinkScene3D
          ref={scene}
          className="absolute inset-0"
          dark={layouts.dark}
          open={layouts.open}
          lines={lines}
          selected={selected}
          onSelect={setSelected}
          onHover={setHover}
          showAllLinks={showAll}
          angle={angle}
          onAngleChange={setAngle}
        />

        <div className="absolute left-4 right-[9.5rem] top-4 sm:right-auto sm:w-64">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) choose(hits[0]);
            }}
            placeholder="영토 찾기 — 오픈웹 · 다크웹"
            aria-label="영토 찾기"
            className="w-full rounded-lg border border-line bg-white/95 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {hits.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-lg border border-line bg-white text-sm shadow-sm">
              {hits.map((h) => (
                <li key={`${h.web}:${h.territory_id}`}>
                  <button type="button" onClick={() => choose(h)} className="flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-app focus-visible:bg-app">
                    <span>{h.name}</span>
                    <span className="text-xs text-ink-soft">
                      {WEB_LABEL[h.web]} · {h.islandName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
          (["dark", "open", "links"] as const).map((k) => (
            <li key={k} className={data.bad[k] ? "text-accent" : undefined}>
              {data.status[k]}
            </li>
          ))
        ) : (
          <li>다크웹 배치 결과를 받는 중</li>
        )}
      </ul>
    </main>
  );
}
