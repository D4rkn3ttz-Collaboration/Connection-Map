// 3D 표시 규칙(층 높이 · 카메라 · 확대) 시험.  npm test (= node --experimental-strip-types --test src/lib/*.test.mjs)
// 옛 시제품 lib.test.mjs 의 시험 번호를 그대로 둔다(2026-10-07 TypeScript 로 옮김)

import test from 'node:test';
import assert from 'node:assert/strict';
import { axialToXZ, parseLayout } from './layout.ts';
import {
  FOCUS_ZOOM,
  FRONT_DEG,
  GAP_RATIO,
  H_TIERS,
  ZOOM_MAX,
  ZOOM_MIN,
  blockHeights,
  clampTarget,
  clampZoom,
  fitCamera,
  focusAngle,
  pinchZoom,
  projectPoint,
  rayPlaneY,
  rotateY,
  shortestTurn,
  tierOf,
  wheelZoom,
  zoomToward,
} from './scene.ts';
import { DARK } from './fixtures.mjs';

test('4. 섬 가운데 칸이 가장 높고 가장자리가 가장 낮다 — 높이는 층 몇 단으로만', () => {
  const TOP = H_TIERS[H_TIERS.length - 1];
  const lay = parseLayout({
    web: 'dark',
    territories: [{ island_id: 'FORUM', territory_id: 'a', territory_name: 'A',
      cells: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] }],
  }, 'dark');
  const h = blockHeights(lay);
  assert.equal(h.get('0,0'), TOP);
  for (const k of ['1,0', '-1,0', '0,1', '0,-1', '1,-1', '-1,1']) assert.equal(h.get(k), H_TIERS[0], k);
  // 칸이 하나인 섬은 가장 높다
  const one = blockHeights(parseLayout(DARK, 'dark'));
  assert.equal(one.get('10,0'), TOP);

  // 반지름 4 육각 섬(61칸): 층 값만 나오고, 층마다 칸이 있고, 가운데에서 멀어질수록 낮아지기만 한다
  const cells = [];
  for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) if (Math.abs(q + r) <= 4) cells.push([q, r]);
  const big = blockHeights(parseLayout({ web: 'dark', territories: [
    { island_id: 'FORUM', territory_id: 'a', territory_name: 'A', cells: cells.slice(0, 30) },
    { island_id: 'FORUM', territory_id: 'b', territory_name: 'B', cells: cells.slice(30) }] }, 'dark'));
  assert.equal(big.size, 61);
  const used = new Set(big.values());
  for (const v of used) assert.ok(H_TIERS.includes(v), v);
  assert.equal(used.size, H_TIERS.length, '층마다 칸이 있다');
  const byDist = cells.map(([q, r]) => [Math.hypot(axialToXZ(q, r).x, axialToXZ(q, r).z), big.get(`${q},${r}`)]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < byDist.length; i++) assert.ok(byDist[i][1] <= byDist[i - 1][1], '멀어지는데 높아졌다');
  // 층 나누기: 0 은 가운데 층, 1 은 가장자리 층, 범위를 넘지 않는다
  assert.equal(tierOf(0), H_TIERS.length - 1);
  assert.equal(tierOf(1), 0);
  assert.equal(tierOf(0.99, 4), 0);
  assert.equal(tierOf(0.1, 4), 3);
});

test('14. 카메라는 기울기 고정으로 두 판을 다 담는다 — 화면을 거의 채우고 위아래 여백이 같다 (2026-10-07)', () => {
  const look = { dist: 100, lookY: 20, aspect: 1.6 };
  const c = projectPoint([0, 20, 0], look);
  assert.ok(Math.abs(c.x) < 1e-9 && Math.abs(c.y) < 1e-9, '바라보는 점은 화면 가운데');
  assert.equal(projectPoint([0, 20 + 100 * Math.sin(Math.PI / 6) + 1, 100 * Math.cos(Math.PI / 6) + 5], look), null, '카메라 뒤는 null');
  assert.ok(projectPoint([0, 0, 30], look).y < projectPoint([0, 0, -30], look).y, '카메라 쪽 가장자리가 화면 아래');

  const radius = 40;
  const gap = radius * GAP_RATIO;
  const top = H_TIERS[H_TIERS.length - 1];
  for (const aspect of [16 / 9, 1, 0.5]) {
    const cam = fitCamera({ radius, gap, top, aspect });
    let w = 0;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < 360; i += 3) {
      const a = (i * Math.PI) / 180;
      for (const y of [-0.8, top, gap - 0.8, gap + top]) {
        const v = projectPoint([radius * Math.cos(a), y, radius * Math.sin(a)], { ...cam, aspect });
        assert.ok(v, '판이 카메라 뒤로 가지 않는다');
        w = Math.max(w, Math.abs(v.x));
        lo = Math.min(lo, v.y);
        hi = Math.max(hi, v.y);
      }
    }
    const span = Math.max(w, (hi - lo) / 2);
    assert.ok(span <= 0.95 && span > 0.9, `화면 끝에서 폭 · 높이의 3% 안 (aspect ${aspect}: ${span.toFixed(3)})`);
    assert.ok(Math.abs(hi + lo) < 0.02, `위아래 여백이 같다 (aspect ${aspect}: ${(hi + lo).toFixed(3)})`);
  }
  // 판 사이가 넓을수록 · 화면이 좁을수록 멀리서 본다
  assert.ok(fitCamera({ radius, gap: radius * 0.9, top, aspect: 1.6 }).dist < fitCamera({ radius, gap, top, aspect: 1.6 }).dist);
  assert.ok(fitCamera({ radius, gap, top, aspect: 0.5 }).dist > fitCamera({ radius, gap, top, aspect: 1.6 }).dist);
});

test('15. 확대 — 범위 안에서만, 휠 위로 · 손가락 벌리기는 다가가기, 짚은 점은 화면 제자리 (2026-10-07)', () => {
  assert.equal(clampZoom(100), ZOOM_MAX);
  assert.equal(clampZoom(0), ZOOM_MIN);
  assert.equal(clampZoom(NaN), 1);
  assert.ok(wheelZoom(1, -100) > 1 && wheelZoom(1, 100) < 1, '위로 굴리면 다가간다');
  assert.ok(Math.abs(wheelZoom(wheelZoom(2, -120), 120) - 2) < 1e-9, '같은 만큼 되굴리면 제자리');
  assert.equal(wheelZoom(1, -3, 1), wheelZoom(1, -48), '줄 단위는 16 픽셀');
  assert.equal(wheelZoom(1, -1e9), wheelZoom(1, -300), '한 번에 너무 많이 가지 않는다');
  assert.equal(wheelZoom(ZOOM_MAX, -100), ZOOM_MAX);
  assert.equal(pinchZoom(1, 100, 200), 2);
  assert.equal(pinchZoom(2, 0, 50), 2, '거리 0 은 무시');

  // 짚은 점은 확대 전후 화면 같은 자리에 남는다 (카메라 = 바라보는 점 + 기울기 방향 × 거리)
  const aspect = 1.6;
  const fitDist = 200;
  const camAt = (t, zoom) => ({ dist: fitDist / zoom, lookY: t.y, aspect });
  const P = { x: 25, y: 3, z: -10 };
  const T0 = { x: 0, y: 36, z: 0 };
  const T1 = zoomToward(T0, P, 1, 2.5);
  const shift = (t) => [P.x - t.x, P.y, P.z - t.z]; // 카메라가 x · z 로 옮겨 간 만큼 점을 반대로 옮겨 투영한다
  const before = projectPoint(shift(T0), camAt(T0, 1));
  const after = projectPoint(shift(T1), camAt(T1, 2.5));
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9, '짚은 점이 움직였다');
  assert.deepEqual(zoomToward(T0, P, 2, 2), T0, '확대가 그대로면 바라보는 점도 그대로');
});

test('16. 바라보는 점은 판 안에 묶이고, 찾은 영토는 옆 · 뒤쪽일 때만 앞으로 돌린다 (2026-10-07)', () => {
  const home = { x: 0, y: 40, z: 0 };
  const box = { radius: 50, ylo: 0, yhi: 95 };
  assert.deepEqual(clampTarget({ x: 30, y: 0, z: 30 }, home, { ...box, zoom: 1 }), home, '확대 1 이면 처음 자리');
  assert.deepEqual(clampTarget({ x: 30, y: 0, z: 30 }, home, { ...box, zoom: 0.8 }), home);
  const far = clampTarget({ x: 500, y: -50, z: 0 }, home, { ...box, zoom: 1.25 });
  assert.ok(Math.abs(far.x - 20) < 1e-9 && far.z === 0, '확대 1.25 면 반지름의 0.4 까지');
  assert.ok(Math.abs(far.y - 24) < 1e-9, '높이도 처음 자리에서 바닥 쪽으로 0.4 까지');
  const edge = clampTarget({ x: 0, y: 3, z: -48 }, home, { ...box, zoom: 2 });
  assert.deepEqual(edge, { x: 0, y: 3, z: -48 }, '확대 2 부터는 판 가장자리 · 바닥도 화면 가운데로');
  // 판 위 점을 짚고 다가가면 묶임에 안 걸린다
  for (const P of [{ x: 50, y: 0, z: 0 }, { x: -30, y: 95, z: 40 }]) {
    for (const z of [1.3, 2, ZOOM_MAX]) {
      const t = zoomToward(home, P, 1, z);
      const c = clampTarget(t, home, { ...box, zoom: z });
      assert.ok(Math.hypot(c.x - t.x, c.y - t.y, c.z - t.z) < 1e-9, `묶였다 ${JSON.stringify(P)} ×${z}`);
    }
  }

  // 판 돌리기 · 앞으로 돌리기 각
  const r = rotateY({ x: 1, z: 0 }, 90);
  assert.ok(Math.abs(r.x) < 1e-9 && Math.abs(r.z + 1) < 1e-9, 'three.js rotation.y 와 같은 방향');
  assert.equal(shortestTurn(350, 10), 20);
  assert.equal(shortestTurn(10, 350), -20);
  assert.equal(shortestTurn(0, 180), -180);
  for (const [x, z] of [[0, -30], [30, 0], [-20, -20], [5, -40]]) {
    for (const cur of [0, 90, 160, 300]) {
      const a = focusAngle(x, z, cur);
      const p = rotateY({ x, z }, a);
      const off = Math.abs((Math.atan2(p.x, p.z) * 180) / Math.PI);
      if (a === cur) assert.ok(off <= FRONT_DEG, `이미 앞이라 그대로 (${x},${z} @${cur})`);
      else assert.ok(off < 1e-9 && p.z > 0 && a >= 0 && a < 360, `바로 앞으로 (${x},${z} @${cur})`);
    }
  }
  assert.equal(focusAngle(0, 30, 0), 0, '앞쪽이면 그대로');
  assert.equal(focusAngle(0, 0, 123), 123, '판 가운데면 돌리지 않는다');
  assert.ok(FOCUS_ZOOM > 1 && FOCUS_ZOOM <= ZOOM_MAX);

  // 반직선 · 평면
  assert.deepEqual(rayPlaneY({ x: 0, y: 10, z: 0 }, { x: 1, y: -1, z: 0 }, 0), { x: 10, y: 0, z: 0 });
  assert.equal(rayPlaneY({ x: 0, y: 10, z: 0 }, { x: 1, y: 1, z: 0 }, 0), null, '평면이 뒤쪽');
  assert.equal(rayPlaneY({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 0), null, '나란하다');
});
