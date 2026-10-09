// 3D 장면의 표시 규칙 — 블록 높이 · 카메라 · 확대 · 찾은 영토 쪽 각도. 그리기 도구(three.js)와 상관없는 계산이다.
// 시험은 scene.test.mjs.

import { axialToXZ, centerOf, type Layout } from "./layout.ts";

/**
 * 섬 가운데를 높게 쌓는 블록 높이 — 층(계단)마다 하나. 배열 앞이 가장자리 층, 뒤가 가운데 층이다
 * (설계서 3.5 「3D 블록 높이는 표시 규칙이며 데이터와 무관」). 매끈한 경사면은 그물처럼 보인다는 피드백으로
 * Figma 「③-0 기본 · 원형 판넬 · 쌓인 블록」 처럼 낮고 평평한 층 세 단으로 끊었다(2026-10-07).
 * 값은 그 화면 PNG 에서 칸 너비 대비 옆면 높이를 재어 칸 반지름(1) 단위로 바꾼 것이다(Figma 원본 값이 아니다 — PNG 로 잼)
 */
export const H_TIERS = [0.3, 0.8, 1.4];
export const H_TOP = H_TIERS[H_TIERS.length - 1];
/** 고른 것과 상관없는 블록이 내려앉는 높이 (Figma ③-1 「연한 색 · 납작하게」) */
export const H_FLOOR = 0.08;

/**
 * 두 판 사이 높이 = 판 반지름 × 이 비율. Figma 「③-0」 화면 PNG 에서 잰 값이다 — 판 둘레 타원의 가로 반지름과
 * 두 판 가운데 사이 화면 거리, 기울기 30° 로 거꾸로 풀면 약 1.8 이 나온다(2026-10-07, 옛 시제품 0.9. PNG 로 잼)
 */
export const GAP_RATIO = 1.8;
/**
 * 카메라 기울기(설계서 4.4 「기울기 고정」)와 세로 화각. Figma ③-0 에서 두 판은 같은 크기로 보인다(원근이 거의 없다) —
 * 화각을 좁혀 멀리서 보게 했다(옛 시제품 30° 에서는 카메라에 가까운 위 판이 20% 크게 보였다).
 * 12° 는 그 화면 PNG 에서 두 판 크기가 비슷해지도록 맞춘 값이다(Figma 원본 값이 아니다 — PNG 로 잼)
 */
export const TILT_DEG = 30;
export const FOV_DEG = 12;
/** 처음 회전 각 (설계서 4.4 「초기 160°」) */
export const START_ANGLE = 160;

/**
 * 섬 가운데에서 떨어진 정도(0 = 무게중심, 1 = 가장 먼 칸) → 층 번호(0 = 가장자리 층).
 * 넓이로 나눈다 — 층마다 섬 넓이가 비슷하게 돌아가 가운데 층도 몇 칸으로 쪼그라들지 않는다
 */
export function tierOf(dist: number, tiers = H_TIERS.length): number {
  const k = Math.floor((1 - dist * dist) * tiers);
  return Math.min(tiers - 1, Math.max(0, k));
}

/**
 * 칸마다 블록 높이. **섬 가운데가 높다** — 섬 칸들의 무게중심에서 멀수록 한 층씩 낮아진다.
 * 데이터와 상관없는 표시 규칙이다(설계서 3.5). 같은 칸이면 늘 같은 높이다.
 * @returns "q,r" → 높이 (H_TIERS 값 가운데 하나)
 */
export function blockHeights(layout: Layout): Map<string, number> {
  const out = new Map<string, number>();
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

export interface Look {
  dist: number;
  lookY: number;
  aspect: number;
  fov?: number;
  tilt?: number;
}

/**
 * 판 위 한 점을 카메라 화면 좌표(-1 ~ 1)로. 카메라는 x = 0 에서 기울기 tilt 로 (0, lookY, 0) 을 내려다본다 —
 * three.js PerspectiveCamera(fov 는 세로 화각)와 같은 식이다. 카메라 뒤에 있는 점은 null
 * @param p  [x, y, z] (판 가운데가 원점, 위가 +y, 카메라 쪽이 +z)
 */
export function projectPoint([x, y, z]: [number, number, number], { dist, lookY, aspect, fov = FOV_DEG, tilt = TILT_DEG }: Look): { x: number; y: number } | null {
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
 * 두 판이 다 들어오는 카메라 자리(확대 1). 기울기는 고정이고(설계서 4.4) 거리와 바라보는 높이만 정한다.
 * 두 판 둘레(블록 꼭대기 높이까지)를 원근 그대로 화면에 투영해 가장 바깥 점이 화면 끝에서 margin 만큼 안에 들게 하고,
 * 위아래 여백이 같게 바라보는 높이를 옮긴다. 판은 둥글어서 어느 각도로 돌려도 같다
 */
export function fitCamera({
  radius,
  gap,
  top = 0,
  aspect,
  margin = 0.06,
  fov = FOV_DEG,
  tilt = TILT_DEG,
}: {
  radius: number;
  gap: number;
  top?: number;
  aspect: number;
  margin?: number;
  fov?: number;
  tilt?: number;
}): { dist: number; lookY: number } {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * 2 * Math.PI;
    const x = radius * Math.cos(a);
    const z = radius * Math.sin(a);
    for (const y of [-0.8, top, gap - 0.8, gap + top]) pts.push([x, y, z]);
  }
  const extent = (dist: number, lookY: number) => {
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
  const span = (e: { w: number; lo: number; hi: number }) => Math.max(e.w, (e.hi - e.lo) / 2);
  // 거리는 이분 찾기로 — 멀어질수록 화면 속 크기는 줄어든다
  const fitDist = (lookY: number) => {
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
    lookY += (((e.hi + e.lo) / 2) * dist * Math.tan((fov * Math.PI) / 360)) / Math.cos((tilt * Math.PI) / 180);
    dist = fitDist(lookY);
  }
  return { dist, lookY };
}

// ── 확대 · 찾은 영토 보여 주기 ────────────────────────────────────────────────
//
// 기울기는 그대로 두고(설계서 4.4 「기울기 고정」) 카메라 거리와 바라보는 점만 바꾼다.
// 확대 1 은 fitCamera 가 정한 「두 판이 다 들어오는」 거리이고, 거리는 확대에 반비례한다.
// 바라보는 점은 판 좌표(돌아가는 판 기준)로 들고 있다 — 판을 돌리면 그 점을 가운데에 둔 채 돈다.
// 확대는 휠 · 두 손가락으로만 한다(Figma 에 확대 단추가 없다).

export interface P3 {
  x: number;
  y: number;
  z: number;
}

/** 확대 범위. 1 보다 작으면 두 판보다 조금 더 멀리, 크면 가까이 */
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 6;
/** 찾은 영토로 다가갈 때 확대 — 섬 하나와 그 둘레가 한 화면에 든다 */
export const FOCUS_ZOOM = 2.6;
/** 찾은 영토가 앞쪽에서 이 각도 안에 있으면 판을 돌리지 않는다 */
export const FRONT_DEG = 60;

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(z) ? z : 1));
}

/** 휠 한 번 → 새 확대. 위로 굴리면(deltaY 음수) 다가간다. 줄 · 쪽 단위(deltaMode 1 · 2)도 픽셀로 바꾼다 */
export function wheelZoom(zoom: number, deltaY: number, deltaMode = 0): number {
  const px = (Number(deltaY) || 0) * (deltaMode === 1 ? 16 : deltaMode === 2 ? 400 : 1);
  return clampZoom(zoom * Math.exp(-Math.max(-300, Math.min(300, px)) * 0.0015));
}

/** 두 손가락 사이가 d0 → d1 이 되면. 벌리면 다가간다 */
export function pinchZoom(zoom: number, d0: number, d1: number): number {
  return d0 > 0 && d1 > 0 ? clampZoom((zoom * d1) / d0) : clampZoom(zoom);
}

/**
 * 한 점을 짚고 다가가기 · 물러나기 — 짚은 점이 화면에서 제자리에 남도록 바라보는 점을 옮긴다(지도 앱의 휠 확대와 같다).
 * 기울기가 고정이라 바라보는 점 → 카메라 방향은 그대로고 거리만 바뀐다. 바라보는 점 T, 짚은 점 P, 거리 d → d' 이면
 * 카메라도 P 와 이은 선 위에 남는다: T' = P + (T − P)·d'/d, d'/d = zoomFrom/zoomTo
 */
export function zoomToward(target: P3, point: P3, zoomFrom: number, zoomTo: number): P3 {
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
 * @param o  ylo · yhi = 바라보는 점이 갈 수 있는 높이(아래 판 바닥 ~ 위 판 꼭대기)
 */
export function clampTarget(t: P3, home: P3, { radius, ylo, yhi, zoom }: { radius: number; ylo: number; yhi: number; zoom: number }): P3 {
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
export function rotateY({ x, z }: { x: number; z: number }, deg: number): { x: number; z: number } {
  const a = (deg * Math.PI) / 180;
  return { x: x * Math.cos(a) + z * Math.sin(a), z: -x * Math.sin(a) + z * Math.cos(a) };
}

/** from → to 로 가장 짧게 도는 각(도, -180 ~ 180) */
export function shortestTurn(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** 0 ~ 360 으로 */
export function normAngle(a: number): number {
  return ((a % 360) + 360) % 360;
}

/**
 * 판 위 점 (x, z) 를 보여 줄 회전 각(0 ~ 360). 지금 각에서 그 점이 앞(카메라 쪽)에서 FRONT_DEG 안이면 그대로,
 * 아니면(옆 · 뒤쪽) 그 점이 바로 앞에 오게 돌린다. 판 가운데 점은 어느 쪽이든 보이니 돌리지 않는다
 */
export function focusAngle(x: number, z: number, current: number, keep = FRONT_DEG): number {
  if (Math.hypot(x, z) < 1e-6) return current;
  const p = rotateY({ x, z }, current);
  const off = (Math.atan2(p.x, p.z) * 180) / Math.PI;
  if (Math.abs(off) <= keep) return current;
  return normAngle((-Math.atan2(x, z) * 180) / Math.PI);
}

/** 반직선이 높이 y 의 평면과 만나는 점. 뒤쪽으로 나가거나 평면과 나란하면 null */
export function rayPlaneY(o: P3, d: P3, y: number): P3 | null {
  if (Math.abs(d.y) < 1e-9) return null;
  const s = (y - o.y) / d.y;
  if (s <= 0) return null;
  return { x: o.x + d.x * s, y, z: o.z + d.z * s };
}

/**
 * 점들의 평균에서 가장 가까운 점의 자리(같으면 앞의 것). 없으면 -1.
 * 연결선 끝 · 찾은 영토 자리를 영토 칸 위에 두려고 쓴다 — 모양이 고르지 않은 영토는 칸들의 평균이 그 영토 칸 밖
 * (빈 자리나 이웃 영토 위)에 떨어질 수 있다(2026-10-09 결정)
 */
export function nearestToMean(pts: { x: number; z: number }[]): number {
  if (!pts.length) return -1;
  let mx = 0;
  let mz = 0;
  for (const p of pts) {
    mx += p.x;
    mz += p.z;
  }
  mx /= pts.length;
  mz /= pts.length;
  let best = 0;
  let bd = Infinity;
  pts.forEach((p, i) => {
    const d = (p.x - mx) ** 2 + (p.z - mz) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}
