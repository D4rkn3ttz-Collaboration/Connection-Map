// 3D 연결 화면 시제품 — 그리기와 상관없는 계산만 둔다. node --test lib.test.mjs 로 시험한다.
//
// 받는 자료는 둘이다.
//   배치 결과   다크웹은 통합 Supabase(link-3d)의 표 public.dark_layout 이다 (2026-10-04 다크초코 결정 —
//               JSON 파일로 주고받지 않는다). 다크웹 지도 자동 갱신이 배포할 때마다 표를 통째로 새로 바꾼다.
//               공개 열쇠로 읽는다. 같은 꼴의 파일도 받는다(`?dark=<주소>`, `rowsToLayout`).
//               오픈웹 판은 꼴을 닥스훈트가 정한다(2026-10-06) — 정해질 때까지 같은 칸 꼴 파일을 받아 그린다
//   연결        Supabase link-3d 공개 뷰(links_public) 줄 목록. 피해 조직 · 근거 칸은 뷰에 없다
//
// **받은 값은 데이터로만 쓴다.** 글자는 화면에 글자로만 넣고(main.js 는 textContent 만 쓴다),
// 색은 #RRGGBB 꼴만 받는다. 모양이 틀린 줄은 버리고 몇 줄 버렸는지만 센다.

export const SQ3 = Math.sqrt(3);

/**
 * 섬 가운데가 높게 쌓는 블록 높이 — 층(계단)마다 하나. 앞이 가장자리, 뒤가 가운데다
 * (설계서 3.5 「3D 블록 높이는 표시 규칙이며 데이터와 무관」). 매끈한 경사면은 그물처럼 보인다는 피드백으로
 * 피그마 「③-0 기본 · 원형 판넬 · 쌓인 블록」 처럼 낮고 평평한 층 세 단으로 끊었다(2026-10-07).
 * 값은 그 화면 PNG 에서 잰 칸 너비 대비 옆면 높이다(칸 반지름 1 기준, Figma 원본 값이 아니다 — PNG 로 잼)
 */
export const H_TIERS = [0.3, 0.8, 1.4];
/** 고른 것과 상관없는 블록이 내려앉는 높이 (설계서 4.4 「바닥으로 내려가며 흐리게」) */
export const H_FLOOR = 0.12;

/**
 * 두 판 사이 높이 = 판 반지름 × 이 비율. 피그마 「③-0」 화면 PNG 에서 잰 값이다 — 판 둘레 타원의 가로 반지름과
 * 두 판 가운데 사이 화면 거리, 기울기 30° 로 거꾸로 풀면 약 1.8 이 나온다(2026-10-07, 전에는 0.9. PNG 로 잼)
 */
export const GAP_RATIO = 1.8;
/** 카메라 기울기(설계서 4.4 「기울기 고정」)와 세로 화각 */
export const TILT_DEG = 30;
export const FOV_DEG = 30;

const RE_COLOR = /^#[0-9A-Fa-f]{6}$/;
const RE_ISLAND = /^[A-Z][A-Z_]{0,31}$/;
const MAX_TEXT = 80;
const MAX_CELLS = 4000;

const isInt = (v) => Number.isInteger(v) && Math.abs(v) < 100000;
const text = (v, max = MAX_TEXT) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

/**
 * 배치 결과 파일을 읽어 그릴 꼴로 바꾼다.
 *
 * @param raw  받은 JSON
 * @param web  'dark' | 'open'. 파일의 web 과 다르면 멈춘다 — 판을 바꿔 그리면 연결선이 거꾸로 선다
 * @returns {{web, asOf, quarter, territories, islands, skipped}}
 */
export function parseLayout(raw, web) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.territories)) {
    throw new Error('배치 결과 꼴이 아닙니다 (territories 목록이 없음)');
  }
  if (raw.web !== web) throw new Error(`${web} 판에 ${String(raw.web)} 자료가 왔습니다`);
  if (raw.grid && raw.grid.coords !== 'axial') throw new Error('좌표가 axial 이 아닙니다');

  const territories = [];
  const seenId = new Set();
  const seenCell = new Set();
  let skipped = 0;
  let cellCount = 0;
  for (const row of raw.territories) {
    const id = text(row?.territory_id);
    const name = text(row?.territory_name);
    const island = typeof row?.island_id === 'string' && RE_ISLAND.test(row.island_id) ? row.island_id : null;
    const cells = Array.isArray(row?.cells) ? row.cells : null;
    if (!id || !name || !island || !cells || !cells.length || seenId.has(id)) {
      skipped++;
      continue;
    }
    const good = [];
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
      kind: text(row.kind, 40) ?? '',
      color: typeof row.color === 'string' && RE_COLOR.test(row.color) ? row.color : '#9AA3B2',
      cells: good,
    });
  }

  const islands = [];
  const byIsland = new Map();
  for (const t of territories) {
    if (!byIsland.has(t.island)) {
      const isl = { id: t.island, name: t.islandName, color: t.color, territories: [] };
      byIsland.set(t.island, isl);
      islands.push(isl);
    }
    byIsland.get(t.island).territories.push(t);
  }

  return {
    web,
    asOf: text(raw.as_of, 40),
    quarter: text(raw.quarter, 16),
    territories,
    islands,
    skipped,
  };
}

/** axial [q, r] → 판 위 자리. 뾰족 위 육각, 칸 반지름 1 (export.ts grid 와 같은 식) */
export function axialToXZ(q, r) {
  return { x: SQ3 * (q + r / 2), z: 1.5 * r };
}

/** 칸 가운데들의 평균 */
export function centerOf(cells) {
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
export function plateBounds(layout) {
  const all = layout.territories.flatMap((t) => t.cells);
  const c = centerOf(all);
  let r = 0;
  for (const [q, rr] of all) {
    const p = axialToXZ(q, rr);
    r = Math.max(r, Math.hypot(p.x - c.x, p.z - c.z));
  }
  return { cx: c.x, cz: c.z, radius: r + 1.5 };
}

/**
 * 섬 가운데에서 떨어진 정도(0 = 무게중심, 1 = 가장 먼 칸) → 층 번호(0 = 가장자리 층).
 * 넓이로 나눈다 — 층마다 섬 넓이가 비슷하게 돌아가 가운데 층도 몇 칸으로 쪼그라들지 않는다
 */
export function tierOf(dist, tiers = H_TIERS.length) {
  const k = Math.floor((1 - dist * dist) * tiers);
  return Math.min(tiers - 1, Math.max(0, k));
}

/**
 * 칸마다 블록 높이. **섬 가운데가 높다** — 섬 칸들의 무게중심에서 멀수록 한 층씩 낮아진다.
 * 데이터와 상관없는 표시 규칙이다(설계서 3.5). 같은 칸이면 늘 같은 높이다.
 * @returns {Map<string, number>} "q,r" → 높이 (H_TIERS 값 가운데 하나)
 */
export function blockHeights(layout) {
  const out = new Map();
  for (const isl of layout.islands) {
    const cells = isl.territories.flatMap((t) => t.cells);
    const c = centerOf(cells);
    let dmax = 0;
    const d = cells.map(([q, r]) => {
      const p = axialToXZ(q, r);
      const v = Math.hypot(p.x - c.x, p.z - c.z);
      dmax = Math.max(dmax, v);
      return v;
    });
    cells.forEach(([q, r], i) => {
      out.set(`${q},${r}`, H_TIERS[tierOf(dmax > 0 ? d[i] / dmax : 0)]);
    });
  }
  return out;
}

/**
 * 판 위 한 점을 카메라 화면 좌표(-1 ~ 1)로. 카메라는 x = 0 에서 기울기 tilt 로 (0, lookY, 0) 을 내려다본다 —
 * three.js PerspectiveCamera(fov 는 세로 화각)와 같은 식이다. 카메라 뒤에 있는 점은 null
 * @param p    [x, y, z] (판 가운데가 원점, 위가 +y, 카메라 쪽이 +z)
 * @param cam  {{dist, lookY, aspect, fov?, tilt?}}
 */
export function projectPoint([x, y, z], { dist, lookY, aspect, fov = FOV_DEG, tilt = TILT_DEG }) {
  const t = (tilt * Math.PI) / 180;
  const s = Math.sin(t);
  const c = Math.cos(t);
  // 카메라에서 본 점. 앞(f) = (0, -s, -c), 위(u) = (0, c, -s), 오른쪽 = +x
  const ry = y - lookY - dist * s;
  const rz = z - dist * c;
  const depth = -s * ry - c * rz;
  if (depth <= 1e-6) return null;
  const f = Math.tan((fov * Math.PI) / 360);
  return { x: x / (depth * f * aspect), y: (c * ry - s * rz) / (depth * f) };
}

/**
 * 두 판이 다 들어오는 카메라 자리. 기울기는 고정이고(설계서 4.4) 거리와 바라보는 높이만 정한다.
 * 두 판 둘레(블록 꼭대기 높이까지)를 원근 그대로 화면에 투영해 가장 바깥 점이 화면 끝에서 margin 만큼 안에 들게 하고,
 * 위아래 여백이 같게 바라보는 높이를 옮긴다. 판은 둥글어서 어느 각도로 돌려도 같다
 * @param o {{radius, gap, top, aspect, margin?}}  top = 블록 가장 높은 곳
 * @returns {{dist, lookY}}
 */
export function fitCamera({ radius, gap, top = 0, aspect, margin = 0.06, fov = FOV_DEG, tilt = TILT_DEG }) {
  const pts = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * 2 * Math.PI;
    const x = radius * Math.cos(a);
    const z = radius * Math.sin(a);
    for (const y of [-0.8, top, gap - 0.8, gap + top]) pts.push([x, y, z]);
  }
  const extent = (dist, lookY) => {
    let w = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of pts) {
      const v = projectPoint(p, { dist, lookY, aspect, fov, tilt });
      if (!v) return { w: Infinity, lo: -Infinity, hi: Infinity };
      w = Math.max(w, Math.abs(v.x));
      lo = Math.min(lo, v.y);
      hi = Math.max(hi, v.y);
    }
    return { w, lo, hi };
  };
  const span = (e) => Math.max(e.w, (e.hi - e.lo) / 2);
  // 거리는 이분 찾기로 — 멀어질수록 화면 속 크기는 줄어든다
  const fitDist = (lookY) => {
    let lo = radius * 0.2;
    let hi = radius * 60;
    for (let k = 0; k < 50; k++) {
      const mid = (lo + hi) / 2;
      if (span(extent(mid, lookY)) > 1 - margin) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  let lookY = gap / 2;
  let dist = fitDist(lookY);
  for (let round = 0; round < 4; round++) {
    // 화면 위아래 여백을 맞춘다. 화면 y 1 은 그 거리에서 대략 dist·tan(fov/2) 높이다
    const e = extent(dist, lookY);
    lookY += ((e.hi + e.lo) / 2) * dist * Math.tan((fov * Math.PI) / 360) / Math.cos((tilt * Math.PI) / 180);
    dist = fitDist(lookY);
  }
  return { dist, lookY };
}

// ── 확대 · 찾은 영토 보여 주기 (2026-10-08) ────────────────────────────────
//
// 기울기는 그대로 두고(설계서 4.4 「기울기 고정」) 카메라 거리와 바라보는 점만 바꾼다.
// 확대 1 은 fitCamera 가 정한 「두 판이 다 들어오는」 거리이고, 거리는 확대에 반비례한다.
// 바라보는 점은 판 좌표(돌아가는 판 기준)로 들고 있다 — 판을 돌리면 그 점을 가운데에 둔 채 돈다.

/** 확대 범위. 1 보다 작으면 두 판보다 조금 더 멀리, 크면 가까이 */
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 6;
/** 찾은 영토로 다가갈 때 확대 — 섬 하나와 그 둘레가 한 화면에 든다 */
export const FOCUS_ZOOM = 2.6;
/** 찾은 영토가 앞쪽에서 이 각도 안에 있으면 판을 돌리지 않는다 */
export const FRONT_DEG = 60;

export function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1));
}

/** 휠 한 번 → 새 확대. 위로 굴리면(deltaY 음수) 다가간다. 줄 · 쪽 단위(deltaMode 1 · 2)도 픽셀로 바꾼다 */
export function wheelZoom(zoom, deltaY, deltaMode = 0) {
  const px = (Number(deltaY) || 0) * (deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1);
  return clampZoom(zoom * Math.exp(-Math.max(-300, Math.min(300, px)) * 0.0015));
}

/** 두 손가락 사이가 d0 → d1 이 되면. 벌리면 다가간다 */
export function pinchZoom(zoom, d0, d1) {
  return d0 > 0 && d1 > 0 ? clampZoom((zoom * d1) / d0) : clampZoom(zoom);
}

/**
 * 한 점을 짚고 다가가기 · 물러나기 — 짚은 점이 화면에서 제자리에 남도록 바라보는 점을 옮긴다(지도 앱의 휠 확대와 같다).
 * 기울기가 고정이라 바라보는 점 → 카메라 방향은 그대로고 거리만 바뀐다. 바라보는 점 T, 짚은 점 P, 거리 d → d' 이면
 * 카메라도 P 와 이은 선 위에 남는다: T' = P + (T − P)·d'/d, d'/d = zoomFrom/zoomTo
 */
export function zoomToward(target, point, zoomFrom, zoomTo) {
  const k = zoomFrom / zoomTo;
  return {
    x: point.x + (target.x - point.x) * k,
    y: point.y + (target.y - point.y) * k,
    z: point.z + (target.z - point.z) * k,
  };
}

/**
 * 바라보는 점이 판 밖으로 나가지 않게 묶는다. 확대 1 이하면 처음 자리(home)에 붙고, 다가갈수록 멀리 갈 수 있다
 * (2 × (1 − 1/확대) 만큼, 확대 2 부터는 판 끝 · 바닥까지). 짚은 점을 향해 다가가면 바라보는 점은 1 − 1/확대 만큼만
 * 움직이므로 판 위 점은 묶임에 안 걸리고, 찾은 영토는 판 가장자리여도 화면 가운데에 온다. 물러나면 저절로 처음 화면으로 돌아온다
 * @param o {{radius, ylo, yhi, zoom}} ylo · yhi = 바라보는 점이 갈 수 있는 높이(아래 판 바닥 ~ 위 판 꼭대기)
 */
export function clampTarget(t, home, { radius, ylo, yhi, zoom }) {
  const free = Math.min(1, 2 * Math.max(0, 1 - 1 / Math.max(zoom, 1)));
  let dx = t.x - home.x;
  let dz = t.z - home.z;
  const r = Math.hypot(dx, dz);
  const rmax = radius * free;
  if (r > rmax) {
    const s = r > 0 ? rmax / r : 0;
    dx *= s;
    dz *= s;
  }
  const lo = home.y + (Math.min(ylo, home.y) - home.y) * free;
  const hi = home.y + (Math.max(yhi, home.y) - home.y) * free;
  return { x: home.x + dx, y: Math.min(hi, Math.max(lo, t.y)), z: home.z + dz };
}

/** 판 좌표 → 판을 deg 만큼 돌린 뒤 자리. three.js rotation.y 와 같은 방향이다 */
export function rotateY({ x, z }, deg) {
  const a = (deg * Math.PI) / 180;
  return { x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) };
}

/** from → to 로 가장 짧게 도는 각(도, -180 ~ 180) */
export function shortestTurn(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * 판 위 점 (x, z) 를 보여 줄 회전 각(0 ~ 360). 지금 각에서 그 점이 앞(카메라 쪽)에서 FRONT_DEG 안이면 그대로,
 * 아니면(옆 · 뒤쪽) 그 점이 바로 앞에 오게 돌린다. 판 가운데 점은 어느 쪽이든 보이니 돌리지 않는다
 */
export function focusAngle(x, z, current, keep = FRONT_DEG) {
  if (Math.hypot(x, z) < 1e-6) return current;
  const p = rotateY({ x, z }, current);
  const off = (Math.atan2(p.x, p.z) * 180) / Math.PI;
  if (Math.abs(off) <= keep) return current;
  const a = (-Math.atan2(x, z) * 180) / Math.PI;
  return ((a % 360) + 360) % 360;
}

/** 반직선이 높이 y 의 평면과 만나는 점. 위쪽으로 나가거나 평면과 나란하면 null */
export function rayPlaneY(o, d, y) {
  if (Math.abs(d.y) < 1e-9) return null;
  const s = (y - o.y) / d.y;
  if (s <= 0) return null;
  return { x: o.x + d.x * s, y, z: o.z + d.z * s };
}

/** axial 이웃 여섯. i 번째 이웃은 판 위 각도 NEIGHBOR_DEG[i] 쪽이다 */
export const NEIGHBORS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const NEIGHBOR_DEG = [0, -60, -120, 180, 120, 60];

/**
 * 영토 경계 — 이웃 칸이 다른 영토이거나 비어 있는 변. 2D 지도의 영토 사이 선과 같은 자리다.
 * 변 끝점은 칸 가운데에서 이웃 쪽 각도 ±30° 의 꼭짓점이다(칸 반지름 1).
 * @returns {{q, r, a: {x, z}, b: {x, z}}[]}
 */
export function edgeSegments(layout) {
  const owner = new Map();
  for (const t of layout.territories) for (const [q, r] of t.cells) owner.set(`${q},${r}`, t.id);
  const out = [];
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

const fold = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

function finder(layout) {
  const byId = new Map();
  const byName = new Map();
  for (const t of layout?.territories ?? []) {
    byId.set(fold(t.id), t);
    if (!byName.has(fold(t.name))) byName.set(fold(t.name), t);
  }
  return (v) => byId.get(fold(v)) ?? byName.get(fold(v)) ?? null;
}

/**
 * 연결 공개 뷰 줄을 두 판의 영토에 잇는다. 영토 칸 값은 영토 번호나 이름 어느 쪽이어도 된다
 * (link-3d 표 칸은 글자다 — 어느 것을 넣을지는 두 팀이 정한다). 양 끝이 다 맞아야 선이 된다.
 * @returns {{lines: {id, darkId, openId, relType, confidence}[], unmatched: number}}
 */
export function matchLinks(rows, dark, open) {
  const findDark = finder(dark);
  const findOpen = finder(open);
  const lines = [];
  let unmatched = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
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
      relType: text(row.rel_type, 32) ?? '',
      confidence: text(row.confidence, 4) ?? '',
    });
  }
  return { lines, unmatched };
}

/**
 * 고른 것에서 반대쪽 층으로 이어진 영토.
 * @param sel {{kind: 'territory', web, id} | {kind: 'island', web, island, ids: string[]}}
 * @returns {{lines, other: Set<string>}} 그 선택에 걸린 선과 반대쪽 영토 id
 */
export function linksOf(lines, sel) {
  if (!sel) return { lines: [], other: new Set() };
  const mine = sel.kind === 'territory' ? new Set([sel.id]) : new Set(sel.ids);
  const key = sel.web === 'dark' ? 'darkId' : 'openId';
  const otherKey = sel.web === 'dark' ? 'openId' : 'darkId';
  const hit = lines.filter((l) => mine.has(l[key]));
  return { lines: hit, other: new Set(hit.map((l) => l[otherKey])) };
}

/**
 * 이름으로 찾기 — 두 판 모두. 앞에서 맞는 것을 먼저, 그다음 가운데서 맞는 것.
 * @returns {{web, id, name, islandName}[]}
 */
export function searchTerritories(layouts, query, limit = 8) {
  const q = fold(query);
  if (!q) return [];
  const head = [];
  const mid = [];
  for (const lay of layouts) {
    if (!lay) continue;
    for (const t of lay.territories) {
      const n = fold(t.name);
      const hit = { web: lay.web, id: t.id, name: t.name, islandName: t.islandName };
      if (n.startsWith(q)) head.push(hit);
      else if (n.includes(q)) mid.push(hit);
    }
  }
  return [...head, ...mid].slice(0, limit);
}

// ── 통합 Supabase ────────────────────────────────────────────────────────────

/** 다크웹 판 표에서 받는 칸. 표 칸 그대로다(README 「다크웹 판」) */
export const DARK_TABLE_SELECT =
  'territory_id,island_id,island_name,territory_name,aliases,kind,cells,color,quarter,as_of';

/**
 * 연결 공개 뷰에서 받는 칸. 뷰 칸(README 「연결」) 가운데 선을 긋는 데 쓰는 것만
 */
export const LINKS_VIEW_SELECT = 'link_id,rel_type,confidence,dark_territory,open_territory';

/**
 * 연결 공개 뷰 응답이 「아직 자료가 없다」 는 뜻인지 가른다. 그렇다면 까닭 글자, 아니면 null(진짜 오류).
 * 뷰가 없거나 닫혀 있어도 3D 는 연결선 없이 그려져야 하고, 뷰가 열리면 고칠 것 없이 선이 그려져야 한다
 * (뷰는 2026-10-06 에 만들었다).
 *   404 · PGRST205 · 42P01   뷰가 없다 (PostgREST 「schema cache 에 없음」 · Postgres 「relation does not exist」)
 *   42501                    뷰는 있는데 공개 읽기 허용(grant)이 없다 (PostgREST 는 401 로 준다)
 * 그 밖의 401 · 403(틀렸거나 거둔 열쇠 따위)은 진짜 오류다 — 「자료 없음」 으로 덮으면 열쇠 문제가 안 보인다
 */
export function linksMissing(status, body) {
  const code = typeof body?.code === 'string' ? body.code : '';
  if (status === 404 || code === 'PGRST205' || code === '42P01') return 'link-3d 공개 뷰(links_public)가 아직 없다';
  if (code === '42501') return '공개 뷰에 공개 읽기 허용이 아직 없다';
  return null;
}

/**
 * 표 줄 목록 → 배치 결과 꼴. 줄마다 분기 · 시각이 붙어 있으니 파일 머리로 올린다.
 * 줄이 없으면 멈춘다 — 표가 아직 안 채워졌다(자동 갱신이 쓰기 열쇠로 채운다)
 */
export function rowsToLayout(rows, web) {
  if (!Array.isArray(rows)) throw new Error('표 응답이 줄 목록이 아닙니다');
  if (rows.length === 0) throw new Error('표가 비어 있습니다 — 지도 자동 갱신이 아직 안 채웠습니다');
  const quarters = new Set(rows.map((r) => r?.quarter).filter((q) => typeof q === 'string'));
  if (quarters.size > 1) throw new Error(`표에 분기가 섞여 있습니다 (${quarters.size}개)`);
  // 표 칸은 timestamptz 라 UTC(+00:00)로 온다. 가장 늦은 순간을 한국 시각 글자로 바꾼다 — 화면은 시간대 없이
  // 「2026-10-05 12:20」 처럼 보이므로 UTC 글자를 그대로 두면 9시간 어긋나 보인다(2026-10-05 검토). export.ts kstIso 와 같다
  const times = rows.map((r) => Date.parse(r?.as_of)).filter(Number.isFinite);
  const asOf = times.length ? new Date(Math.max(...times) + 9 * 3600e3).toISOString().slice(0, 19) + '+09:00' : null;
  return {
    web,
    as_of: asOf,
    quarter: [...quarters][0] ?? null,
    grid: { coords: 'axial' },
    territories: rows.map((r) => ({ ...r, web })),
  };
}

/**
 * `data/supabase.json` — `{"url": "https://<프로젝트>.supabase.co", "key": "<공개 열쇠>"}`.
 * **주소는 https 의 supabase.co 만 받는다** — 열쇠가 다른 곳으로 가지 않게. 공개 열쇠는 원래 화면에 실리는
 * 값이지만 저장소에는 넣지 않는다(data/ 는 gitignore)
 */
export function parseSupabaseConfig(raw) {
  const url = typeof raw?.url === 'string' ? raw.url.trim().replace(/\/+$/, '') : '';
  const key = typeof raw?.key === 'string' ? raw.key.trim() : '';
  let host = '';
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && !u.pathname.replace(/\/+$/, '') && !u.search) host = u.hostname;
  } catch {
    host = '';
  }
  if (!/^[a-z0-9-]+\.supabase\.co$/.test(host)) throw new Error('주소가 https://<프로젝트>.supabase.co 꼴이 아닙니다');
  if (!/^[A-Za-z0-9._-]{20,}$/.test(key)) throw new Error('공개 열쇠가 비었거나 꼴이 아닙니다');
  return { url: `https://${host}`, key };
}
