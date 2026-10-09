// 연결(두 판 사이 선)과 고르기 — 그리기와 상관없는 계산. 시험은 links.test.mjs.
//
// 연결은 Supabase link-3d 공개 뷰(links_public) 줄 목록이다. 피해 조직 · 근거 칸은 뷰에 없다.

import { fold, text, type Layout, type Territory, type Web } from "./layout.ts";

/** 연결 공개 뷰에서 받는 칸. 뷰 칸 가운데 선을 긋는 데 쓰는 것만 */
export const LINKS_VIEW_SELECT = "link_id,rel_type,confidence,dark_territory,open_territory,verify_status,direction,match_scope,dark_observed_at,open_observed_at,event_id,finding_id";

export interface LinkLine {
  id: string;
  darkId: string;
  openId: string;
  relType: string;
  confidence: string;
  verification?: string;
  direction?: string;
  matchScope?: string;
  darkObservedAt?: string;
  openObservedAt?: string;
  eventId?: string;
  findingId?: string;
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
      verification: text(row.verify_status, 40) ?? undefined,
      direction: text(row.direction, 40) ?? undefined,
      matchScope: text(row.match_scope, 80) ?? undefined,
      darkObservedAt: text(row.dark_observed_at, 40) ?? undefined,
      openObservedAt: text(row.open_observed_at, 40) ?? undefined,
      eventId: text(row.event_id, 80) ?? undefined,
      findingId: text(row.finding_id, 80) ?? undefined,
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
 * 빈 값 · 모르는 값은 옅은 가는 실선(선을 숨기지 않는다). dash · gap 은 판 단위(칸 반지름 1)다
 */
export function lineStyle(confidence: string): { dashed: boolean; dash: number; gap: number; faint: boolean } {
  const r = confidenceRank(confidence);
  if (r === 3) return { dashed: false, dash: 0, gap: 0, faint: false };
  if (r === 2) return { dashed: true, dash: 1.6, gap: 1, faint: false };
  if (r === 1) return { dashed: true, dash: 0.35, gap: 0.8, faint: false };
  // 신뢰도가 비었거나 모르는 값 — 선은 숨기지 않되 옅고 가늘게 그려 「높음」 실선과 헷갈리지 않게 한다(2026-10-08)
  return { dashed: false, dash: 0, gap: 0, faint: true };
}

/** 신뢰도 순위 — 상 3 · 중 2 · 하 1, 빈 값 · 모르는 값 0. 같은 영토 쌍을 선 하나로 합칠 때 쓴다 */
export function confidenceRank(confidence: string): number {
  const c = fold(confidence);
  if (["상", "높음", "high"].includes(c)) return 3;
  if (["중", "중간", "medium", "mid"].includes(c)) return 2;
  if (["하", "낮음", "low"].includes(c)) return 1;
  return 0;
}

/** 3D 에 긋는 선 하나 — 같은 영토 쌍의 연결을 합친 것 */
export interface Strand {
  darkId: string;
  openId: string;
  /** 이 쌍에 든 연결 번호 */
  ids: string[];
  /** 꼴을 정하는 신뢰도 — 진한 연결이 있으면 그 가운데, 없으면 쌍 전체에서 가장 높은 것 */
  confidence: string;
  /** 고른 것과 이어진 선. false 면 「전체 관계 보기」 로 함께 그린 나머지라 옅게 · 끝 동그라미 없이 그린다 */
  strong: boolean;
}

/**
 * 그릴 연결 → 3D 에 긋는 선(2026-10-09 결정).
 * 같은 영토 쌍은 같은 곡선이라 겹쳐 그리면 아래 선이 안 보인다 — 선 하나로 합치고 가장 높은 신뢰도의 꼴로 그린다.
 * picked 를 주면(`pickedLines`) 그 안의 연결이 든 선만 진하고 나머지는 옅다. 진한 선의 꼴은 진한 연결 가운데
 * 가장 높은 신뢰도를 따른다 — 연결 하나를 골랐으면 같은 쌍에 더 높은 연결이 있어도 고른 연결의 꼴이다
 */
export function strandsOf(lines: LinkLine[], picked: LinkLine[] | null = null): Strand[] {
  const on = picked ? new Set(picked.map((l) => l.id)) : null;
  const byPair = new Map<string, { s: Strand; best: number; bestStrong: number }>();
  for (const l of lines) {
    const strong = !on || on.has(l.id);
    const rank = confidenceRank(l.confidence);
    const key = `${l.darkId}\u0000${l.openId}`;
    const g = byPair.get(key);
    if (!g) {
      byPair.set(key, {
        s: { darkId: l.darkId, openId: l.openId, ids: [l.id], confidence: l.confidence, strong },
        best: rank,
        bestStrong: strong ? rank : -1,
      });
      continue;
    }
    g.s.ids.push(l.id);
    if (strong) {
      // 진한 연결이 처음 들어오면 그 꼴로 바꾼다 — 고른 연결의 꼴이 보여야 한다
      if (!g.s.strong || rank > g.bestStrong) g.s.confidence = l.confidence;
      g.s.strong = true;
      g.bestStrong = Math.max(g.bestStrong, rank);
    } else if (!g.s.strong && rank > g.best) {
      g.s.confidence = l.confidence;
    }
    g.best = Math.max(g.best, rank);
  }
  return [...byPair.values()].map((g) => g.s);
}

/**
 * 진하게 그릴 연결 — 「전체 관계 보기」 를 켜고 무언가를 골랐을 때만 그것과 이어진 연결, 아니면 null(다 진하게).
 * 없는 영토 · 섬 · 연결을 고르면 null, 연결이 없는 영토 · 섬을 고르면 [](다 옅게)
 */
export function pickedLines(
  pick: Pick | null,
  layouts: { dark: Layout | null; open: Layout | null },
  lines: LinkLine[],
  showAll: boolean,
): LinkLine[] | null {
  if (!showAll || !pick) return null;
  const sel = focusOf(pick, layouts, lines);
  return sel.keep.dark || sel.keep.open ? sel.lines : null;
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
