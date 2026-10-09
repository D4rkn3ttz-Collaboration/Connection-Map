"use client";

// 연결 3D 장면 컴포넌트 — 다크초코가 맡는 「3D 공간 안」 전부(Figma ③-0 ~ ③-3).
// 둘레 화면(머리띠 · 범례 · 검색 창 · 상세 패널 · 토글 · 안내 알약 · 회전 슬라이더)은 닥스훈트 화면이 이 컴포넌트를 감싸 만든다.
// 손잡이(props · 콜백 · show())는 README 「3D 컴포넌트」 에 적었다.
//
// 「무엇을 골랐나」 는 감싸는 화면이 들고 있다(selected). 이 컴포넌트는 눌린 것을 onSelect 로 알리고, 받은 selected 를 그린다.

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import type { Layout, Web } from "@/lib/layout.ts";
import type { LinkLine, Pick } from "@/lib/links.ts";
import { SceneView } from "./scene3d/SceneView.ts";

export type TerritoryRef = { web: Web; territory_id: string };

export interface LinkScene3DHandle {
  /** 찾은 영토 보여 주기 — 그 영토를 고르고(onSelect), 판 옆 · 뒤쪽이면 앞으로 돌리고, 다가간다. 없는 영토면 false */
  show(t: TerritoryRef): boolean;
  /** 섬 전체를 고르고(onSelect) 가운데로 이동한다. */
  showIsland(island: Extract<Pick, { kind: "island" }>): boolean;
}

export interface LinkScene3DProps {
  /** 다크웹 판(아래). src/lib/load.ts 또는 parseLayout 으로 만든 것 */
  dark: Layout | null;
  /** 오픈웹 판(위). 아직 없으면 null — 빈 원판만 그린다 */
  open: Layout | null;
  /** 두 판 사이 연결(matchLinks 결과) */
  lines: LinkLine[];
  /** 지금 고른 것 — 감싸는 화면이 들고 있다. null 이면 아무것도 안 고름 */
  selected: Pick | null;
  /** 영토를 눌렀다(같은 영토를 다시 누르거나 빈 곳을 누르거나 Esc 면 null) */
  onSelect(pick: Pick | null): void;
  /** 마우스를 올린 영토가 바뀌었다 */
  onHover?(t: TerritoryRef | null): void;
  /** 「전체 관계 보기」 — 고른 것과 상관없이 연결선을 모두 그린다 */
  showAllLinks?: boolean;
  /** 회전 각(0 ~ 360, 처음 160). 주지 않으면 장면이 혼자 들고 있다 */
  angle?: number;
  /** 끌기 · show() 로 회전 각이 바뀌었다(정수 도) */
  onAngleChange?(deg: number): void;
  className?: string;
  ref?: Ref<LinkScene3DHandle>;
}

/** 카드 안 배경 — 위는 흰색, 아래로 짙은 남색(설계서 「연결 3D 배경 그라데이션」 · Figma ③-0) */
const BACKGROUND = "linear-gradient(180deg, #FFFFFF 0%, #F2F5FB 35%, #C5CDE3 62%, #6C7CA8 84%, #34426E 100%)";

export default function LinkScene3D(props: LinkScene3DProps) {
  const { dark, open, lines, selected, showAllLinks = false, angle, className, ref } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<SceneView | null>(null);
  const [failed, setFailed] = useState(false);
  // 콜백은 늘 최신 것을 부른다 — 장면을 다시 만들지 않으려고 ref 로 든다
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let view: SceneView;
    try {
      view = new SceneView(canvas, {
        onPick: (t) => {
          const cur = latest.current.selected;
          const same = t && cur?.kind === "territory" && cur.web === t.web && cur.territory_id === t.territory_id;
          latest.current.onSelect(t && !same ? { kind: "territory", ...t } : null);
        },
        onHover: (t) => latest.current.onHover?.(t),
        onAngle: (deg) => latest.current.onAngleChange?.(deg),
      });
    } catch {
      // WebGL 이 꺼진 브라우저 — 화면 전체를 오류로 내리지 않고 이 카드에만 알린다
      queueMicrotask(() => setFailed(true));
      return;
    }
    viewRef.current = view;
    const d = latest.current;
    view.setData(d.dark, d.open, d.lines);
    view.setFocus(d.selected, d.showAllLinks ?? false);
    if (d.angle != null) view.setAngle(d.angle);
    const onResize = () => view.resize();
    // 미리보기 창처럼 ResizeObserver 가 안 도는 곳도 있어 창 크기 바뀜도 같이 듣는다
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
    if (canvas.parentElement) ro?.observe(canvas.parentElement);
    window.addEventListener("resize", onResize);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented || !latest.current.selected) return;
      // 입력 칸(검색 · 날짜 등)에서 누른 Esc 는 그 칸 몫이다 — 목록을 닫으려다 고르기 · 패널까지 풀리지 않게
      const target = ev.target instanceof Element ? ev.target : null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      latest.current.onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      view.dispose();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    viewRef.current?.setData(dark, open, lines);
  }, [dark, open, lines]);

  useEffect(() => {
    viewRef.current?.setFocus(selected, showAllLinks);
  }, [selected, showAllLinks, dark, open, lines]);

  useEffect(() => {
    if (angle != null) viewRef.current?.setAngle(angle);
  }, [angle]);

  useImperativeHandle(
    ref,
    () => ({
      show(t) {
        const ok = viewRef.current?.show(t.web, t.territory_id) ?? false;
        if (ok) latest.current.onSelect({ kind: "territory", web: t.web, territory_id: t.territory_id });
        return ok;
      },
      showIsland(island) {
        const ok = viewRef.current?.showIsland(island.web, island.island_id) ?? false;
        if (ok) latest.current.onSelect(island);
        return ok;
      },
    }),
    [],
  );

  return (
    // 크기 · 자리는 감싸는 쪽이 className 으로 준다(예: absolute inset-0). 안 주면 부모를 꽉 채운다
    <div className={`overflow-hidden ${className ?? "relative h-full w-full"}`} style={{ background: BACKGROUND }}>
      {failed && (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
          이 브라우저에서는 3D(WebGL)를 그릴 수 없다
        </p>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full cursor-grab touch-none"
        aria-label="오픈웹(위) · 다크웹(아래) 3D 연결 판 — 끌어서 돌리고, 휠 · 두 손가락으로 다가간다"
      />
    </div>
  );
}
