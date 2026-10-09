// 배치 결과(판 하나의 영토 · 칸) — 그리기와 상관없는 계산만 둔다. 시험은 layout.test.mjs.
//
// 다크웹 판은 통합 Supabase(link-3d) 표 public.dark_layout 이다(2026-10-04 다크초코 결정). 다크웹 지도 자동 갱신이
// 배포할 때마다 표를 통째로 새로 바꾼다. 오픈웹 판은 같은 칸 꼴의 public.open_layout 에서 받는다.
//
// **받은 값은 데이터로만 쓴다.** 글자는 화면에 글자로만 넣고, 색은 #RRGGBB 꼴만 받는다.
// 모양이 틀린 줄은 버리고 몇 줄 버렸는지만 센다.

export type Web = "dark" | "open";
export type Cell = [number, number];

export interface Territory {
  id: string;
  name: string;
  island: string;
  islandName: string;
  kind: string;
  color: string;
  cells: Cell[];
}

export interface Island {
  id: string;
  name: string;
  color: string;
  territories: Territory[];
}

export interface Layout {
  web: Web;
  asOf: string | null;
  quarter: string | null;
  territories: Territory[];
  islands: Island[];
  skipped: number;
}

export const SQ3 = Math.sqrt(3);

const RE_COLOR = /^#[0-9A-Fa-f]{6}$/;
const RE_ISLAND = /^[A-Z][A-Z_]{0,31}$/;
const MAX_TEXT = 80;
const MAX_CELLS = 4000;

const isInt = (v: unknown): v is number => Number.isInteger(v) && Math.abs(v as number) < 100000;

/** 비지 않은 글자(앞뒤 공백 뺌)만. 길면 버린다 */
export function text(v: unknown, max = MAX_TEXT): string | null {
  return typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
}

type Row = Record<string, unknown>;

/**
 * 배치 결과를 읽어 그릴 꼴로 바꾼다.
 * @param web  'dark' | 'open'. 자료의 web 과 다르면 멈춘다 — 판을 바꿔 그리면 연결선이 거꾸로 선다
 */
export function parseLayout(raw: unknown, web: Web): Layout {
  const r = raw as Row | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.territories)) {
    throw new Error("배치 결과 꼴이 아니다 (territories 목록이 없음)");
  }
  if (r.web !== web) throw new Error(`${web} 판에 ${String(r.web)} 자료가 왔다`);
  const grid = r.grid as Row | undefined;
  if (grid && grid.coords !== "axial") throw new Error("좌표가 axial 이 아니다");

  const territories: Territory[] = [];
  const seenId = new Set<string>();
  const seenCell = new Set<string>();
  let skipped = 0;
  let cellCount = 0;
  for (const row of r.territories as Row[]) {
    const id = text(row?.territory_id);
    const name = text(row?.territory_name);
    const island = typeof row?.island_id === "string" && RE_ISLAND.test(row.island_id) ? row.island_id : null;
    const cells = Array.isArray(row?.cells) ? (row.cells as unknown[]) : null;
    if (!id || !name || !island || !cells || !cells.length || seenId.has(id)) {
      skipped++;
      continue;
    }
    const good: Cell[] = [];
    for (const c of cells) {
      if (!Array.isArray(c) || c.length !== 2 || !isInt(c[0]) || !isInt(c[1])) continue;
      const k = `${c[0]},${c[1]}`;
      if (seenCell.has(k)) continue;
      seenCell.add(k);
      good.push([c[0], c[1]]);
    }
    if (!good.length || cellCount + good.length > MAX_CELLS) {
      skipped++;
      continue;
    }
    cellCount += good.length;
    seenId.add(id);
    territories.push({
      id,
      name,
      island,
      islandName: text(row.island_name, 40) ?? island,
      kind: text(row.kind, 40) ?? "",
      color: typeof row.color === "string" && RE_COLOR.test(row.color) ? row.color : "#9AA3B2",
      cells: good,
    });
  }

  const islands: Island[] = [];
  const byIsland = new Map<string, Island>();
  for (const t of territories) {
    let isl = byIsland.get(t.island);
    if (!isl) {
      isl = { id: t.island, name: t.islandName, color: t.color, territories: [] };
      byIsland.set(t.island, isl);
      islands.push(isl);
    }
    isl.territories.push(t);
  }

  return { web, asOf: text(r.as_of, 40), quarter: text(r.quarter, 16), territories, islands, skipped };
}

/** axial [q, r] → 판 위 자리. 뾰족 위 육각, 칸 반지름 1 (2D 지도 export.ts grid 와 같은 식) */
export function axialToXZ(q: number, r: number): { x: number; z: number } {
  return { x: SQ3 * (q + r / 2), z: 1.5 * r };
}

/** 칸 가운데들의 평균 */
export function centerOf(cells: Cell[]): { x: number; z: number } {
  let x = 0;
  let z = 0;
  for (const [q, r] of cells) {
    const p = axialToXZ(q, r);
    x += p.x;
    z += p.z;
  }
  return cells.length ? { x: x / cells.length, z: z / cells.length } : { x: 0, z: 0 };
}

/** 판 하나의 가운데와 반지름. 칸이 다 들어가는 원 + 칸 하나 반 여백 */
export function plateBounds(layout: Layout): { cx: number; cz: number; radius: number } {
  const all = layout.territories.flatMap((t) => t.cells);
  const c = centerOf(all);
  let r = 0;
  for (const [q, rr] of all) {
    const p = axialToXZ(q, rr);
    r = Math.max(r, Math.hypot(p.x - c.x, p.z - c.z));
  }
  return { cx: c.x, cz: c.z, radius: r + 1.5 };
}

/** axial 이웃 여섯. i 번째 이웃은 판 위 각도 NEIGHBOR_DEG[i] 쪽이다 */
export const NEIGHBORS: Cell[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const NEIGHBOR_DEG = [0, -60, -120, 180, 120, 60];

export interface Segment {
  q: number;
  r: number;
  a: { x: number; z: number };
  b: { x: number; z: number };
}

/**
 * 영토 경계 — 이웃 칸이 다른 영토이거나 비어 있는 변. 2D 지도의 영토 사이 선과 같은 자리다.
 * 변 끝점은 칸 가운데에서 이웃 쪽 각도 ±30° 의 꼭짓점이다(칸 반지름 1).
 */
export function edgeSegments(layout: Layout): Segment[] {
  const owner = new Map<string, string>();
  for (const t of layout.territories) for (const [q, r] of t.cells) owner.set(`${q},${r}`, t.id);
  const out: Segment[] = [];
  for (const t of layout.territories) {
    for (const [q, r] of t.cells) {
      const c = axialToXZ(q, r);
      NEIGHBORS.forEach(([dq, dr], i) => {
        if (owner.get(`${q + dq},${r + dr}`) === t.id) return;
        const a = ((NEIGHBOR_DEG[i] - 30) * Math.PI) / 180;
        const b = ((NEIGHBOR_DEG[i] + 30) * Math.PI) / 180;
        out.push({
          q,
          r,
          a: { x: c.x + Math.cos(a), z: c.z + Math.sin(a) },
          b: { x: c.x + Math.cos(b), z: c.z + Math.sin(b) },
        });
      });
    }
  }
  return out;
}

export const fold = (s: unknown): string => (typeof s === "string" ? s.trim().toLowerCase() : "");

export interface SearchHit {
  web: Web;
  territory_id: string;
  name: string;
  islandName: string;
}

/** 이름으로 찾기 — 두 판 모두. 앞에서 맞는 것을 먼저, 그다음 가운데서 맞는 것 */
export function searchTerritories(layouts: (Layout | null | undefined)[], query: string, limit = 8): SearchHit[] {
  const q = fold(query);
  if (!q) return [];
  const head: SearchHit[] = [];
  const mid: SearchHit[] = [];
  for (const lay of layouts) {
    if (!lay) continue;
    for (const t of lay.territories) {
      const n = fold(t.name);
      const hit = { web: lay.web, territory_id: t.id, name: t.name, islandName: t.islandName };
      if (n.startsWith(q)) head.push(hit);
      else if (n.includes(q)) mid.push(hit);
    }
  }
  return [...head, ...mid].slice(0, limit);
}
