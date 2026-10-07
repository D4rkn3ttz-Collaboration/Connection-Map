// 연결(두 판 사이 선)과 고르기 — 그리기와 상관없는 계산. 시험은 links.test.mjs.
//
// 연결은 Supabase link-3d 공개 뷰(links_public) 줄 목록이다. 피해 조직 · 근거 칸은 뷰에 없다.

import { fold, text, type Layout, type Territory, type Web } from "./layout.ts";

/** 연결 공개 뷰에서 받는 칸. 뷰 칸 가운데 선을 긋는 데 쓰는 것만 */
export const LINKS_VIEW_SELECT = "link_id,rel_type,confidence,dark_territory,open_territory";

export interface LinkLine {
  id: string;
  darkId: string;
  openId: string;
  relType: string;
  confidence: string;
}

function finder(layout: Layout | null | undefined) {
  const byId = new Map<string, Territory>();
  const byName = new Map<string, Territory>();
  for (const t of layout?.territories ?? []) {
    byId.set(fold(t.id), t);
    if (!byName.has(fold(t.name))) byName.set(fold(t.name), t);
  }
  return (v: unknown) => byId.get(fold(v)) ?? byName.get(fold(v)) ?? null;
}

/**
 * 연결 공개 뷰 줄을 두 판의 영토에 잇는다. 영토 칸 값은 영토 번호나 이름 어느 쪽이어도 된다
 * (link-3d 표 칸은 글자다 — 약속은 영토 번호). 양 끝이 다 맞아야 선이 된다.
 */
export function matchLinks(rows: unknown, dark: Layout | null | undefined, open: Layout | null | undefined): { lines: LinkLine[]; unmatched: number } {
  const findDark = finder(dark);
  const findOpen = finder(open);
  const lines: LinkLine[] = [];
  let unmatched = 0;
  for (const row of Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []) {
    const d = findDark(row?.dark_territory);
    const o = findOpen(row?.open_territory);
    if (!d || !o) {
      unmatched++;
      continue;
    }
    lines.push({
      id: text(row.link_id, 32) ?? `${o.id}→${d.id}`,
      darkId: d.id,
      openId: o.id,
      relType: text(row.rel_type, 32) ?? "",
      confidence: text(row.confidence, 4) ?? "",
    });
  }
  return { lines, unmatched };
}

/**
 * 밖(닥스훈트 화면)과 주고받는 「고른 것」. 영토는 늘 영토 번호(territory_id)로 가리킨다(2026-10-07 약속).
 * 칸 이름은 표 칸과 같게 밑줄로 둔다
 */
export type Pick =
  | { kind: "territory"; web: Web; territory_id: string }
  | { kind: "island"; web: Web; island_id: string }
  | { kind: "link"; link_id: string };

export interface Focus {
  /** 판마다 높이를 지키는 영토. null 이면 그 판은 다 그대로(아무것도 안 고름) */
  keep: { dark: Set<string> | null; open: Set<string> | null };
  /** 그릴 연결선 */
  lines: LinkLine[];
  /** 고른 것이 있는데 반대쪽 층과 이어진 것이 없다 */
  lonely: boolean;
}

/**
 * 고른 것 → 높이를 지킬 영토와 그릴 선(설계서 4.4 · Figma ③-1 ~ ③-3).
 * 고른 영토(섬)와 반대쪽 층에서 그것과 이어진 영토만 쌓인 높이를 지키고 나머지는 납작하게 흐려진다.
 * 관계 하나를 고르면 그 두 영토만. 없는 영토 · 섬 · 관계를 가리키면 아무것도 안 고른 것으로 본다.
 * showAll 이면(「전체 관계 보기」) 고른 것과 상관없이 선을 모두 그린다
 */
export function focusOf(pick: Pick | null, layouts: { dark: Layout | null; open: Layout | null }, lines: LinkLine[], showAll = false): Focus {
  const none: Focus = { keep: { dark: null, open: null }, lines: showAll ? lines : [], lonely: false };
  if (!pick) return none;
  if (pick.kind === "link") {
    const l = lines.find((x) => x.id === pick.link_id);
    if (!l) return none;
    return { keep: { dark: new Set([l.darkId]), open: new Set([l.openId]) }, lines: showAll ? lines : [l], lonely: false };
  }
  const lay = layouts[pick.web];
  const ids =
    pick.kind === "territory"
      ? lay?.territories.some((t) => t.id === pick.territory_id)
        ? [pick.territory_id]
        : []
      : (lay?.territories.filter((t) => t.island === pick.island_id).map((t) => t.id) ?? []);
  if (!ids.length) return none;
  const mine = new Set(ids);
  const key = pick.web === "dark" ? "darkId" : "openId";
  const otherKey = pick.web === "dark" ? "openId" : "darkId";
  const hit = lines.filter((l) => mine.has(l[key]));
  const keep = { dark: null as Set<string> | null, open: null as Set<string> | null };
  keep[pick.web] = mine;
  keep[pick.web === "dark" ? "open" : "dark"] = new Set(hit.map((l) => l[otherKey]));
  return { keep, lines: showAll ? lines : hit, lonely: hit.length === 0 };
}

/** 고른 영토 · 섬에서 반대쪽 층으로 이어진 선과 영토 — 패널 「연결」 탭이 쓴다(focusOf 의 짧은 꼴) */
export function linksOf(lines: LinkLine[], pick: Pick | null, layouts: { dark: Layout | null; open: Layout | null }): { lines: LinkLine[]; other: Set<string> } {
  if (!pick || pick.kind === "link") return { lines: [], other: new Set() };
  const f = focusOf(pick, layouts, lines);
  return { lines: f.lines, other: f.keep[pick.web === "dark" ? "open" : "dark"] ?? new Set() };
}

/**
 * 연결선 꼴 — 신뢰도대로(Figma 범례 「연결선 · 신뢰도」): 높음 실선 · 중간 파선 · 낮음 점선.
 * 모르는 값은 실선(선을 숨기지 않는다). dash · gap 은 판 단위(칸 반지름 1)다
 */
export function lineStyle(confidence: string): { dashed: boolean; dash: number; gap: number } {
  const c = fold(confidence);
  if (["중", "중간", "medium", "mid"].includes(c)) return { dashed: true, dash: 1.6, gap: 1 };
  if (["하", "낮음", "low"].includes(c)) return { dashed: true, dash: 0.35, gap: 0.8 };
  return { dashed: false, dash: 0, gap: 0 };
}

/**
 * 연결 공개 뷰 응답이 「아직 자료가 없다」 는 뜻인지 가른다. 그렇다면 까닭 글자, 아니면 null(진짜 오류).
 *   404 · PGRST205 · 42P01   뷰가 없다
 *   42501                    뷰는 있는데 공개 읽기 허용(grant)이 없다 (PostgREST 는 401 로 준다)
 * 그 밖의 401 · 403(틀렸거나 거둔 열쇠 따위)은 진짜 오류다 — 「자료 없음」 으로 덮으면 열쇠 문제가 안 보인다
 */
export function linksMissing(status: number, body: unknown): string | null {
  const b = body as { code?: unknown } | null;
  const code = typeof b?.code === "string" ? b.code : "";
  if (status === 404 || code === "PGRST205" || code === "42P01") return "link-3d 공개 뷰(links_public)가 아직 없다";
  if (code === "42501") return "공개 뷰에 공개 읽기 허용이 아직 없다";
  return null;
}
