// 배치 결과 시험.  npm test (= node --experimental-strip-types --test src/lib/*.test.mjs)
// 옛 시제품 lib.test.mjs 의 시험 번호를 그대로 둔다(2026-10-07 TypeScript 로 옮김)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  axialToXZ,
  edgeSegments,
  parseLayout,
  plateBounds,
  searchTerritories,
} from './layout.ts';
import { DARK, OPEN } from './fixtures.mjs';

test('1. 배치 결과를 읽고 섬마다 묶는다', () => {
  const d = parseLayout(DARK, 'dark');
  assert.equal(d.territories.length, 3);
  assert.deepEqual(d.islands.map((i) => [i.id, i.territories.length]), [['FORUM', 2], ['RANSOMWARE', 1]]);
  assert.equal(d.quarter, '2026-Q4');
  assert.equal(d.skipped, 0);
});

test('2. 모양이 틀린 줄은 버리고 센다 — 색 · 칸 · 섬 코드 · 겹친 칸', () => {
  const raw = structuredClone(DARK);
  raw.territories.push(
    { island_id: 'FORUM', territory_id: 'x1', territory_name: 'X1', cells: [[0, 0]] }, // 칸이 forum-a 와 겹침 → 칸 없음
    { island_id: 'forum', territory_id: 'x2', territory_name: 'X2', cells: [[5, 5]] }, // 섬 코드 꼴 아님
    { island_id: 'FORUM', territory_id: 'x3', territory_name: 'X3', cells: [[5.5, 5]] }, // 정수 아님
    { island_id: 'FORUM', territory_id: 'x4', territory_name: '<b>X4</b>', cells: [[7, 7]], color: 'red' },
  );
  const d = parseLayout(raw, 'dark');
  assert.equal(d.skipped, 3);
  const x4 = d.territories.find((t) => t.id === 'x4');
  assert.equal(x4.color, '#9AA3B2', '색 꼴이 아니면 기본 회색');
  assert.equal(x4.name, '<b>X4</b>', '글자는 그대로 두고 화면이 글자로만 넣는다');
});

test('3. 판이 바뀐 자료 · 꼴이 아닌 자료는 멈춘다', () => {
  assert.throws(() => parseLayout(DARK, 'open'), /open 판에 dark/);
  assert.throws(() => parseLayout({ web: 'dark' }, 'dark'), /territories/);
  assert.throws(() => parseLayout({ ...DARK, grid: { coords: 'offset' } }, 'dark'), /axial/);
});

test('5. 영토 경계는 다른 영토와 맞닿은 변과 바깥 변이다', () => {
  const lay = parseLayout(DARK, 'dark');
  const segs = edgeSegments(lay);
  // forum-a 세 칸은 서로 두 변씩(0,0–1,0 · 0,0–0,1 · 1,0–0,1) 붙어 안쪽 변이 3쌍 → 18 − 6 = 12 변
  // forum-b 한 칸 6 변, ransomware-c 한 칸 6 변
  assert.equal(segs.length, 12 + 6 + 6);
  // 변 길이는 칸 반지름(1)과 같다
  for (const s of segs) assert.ok(Math.abs(Math.hypot(s.a.x - s.b.x, s.a.z - s.b.z) - 1) < 1e-9);
  // 변 가운데는 칸 가운데에서 √3/2 떨어져 있다
  for (const s of segs) {
    const c = axialToXZ(s.q, s.r);
    const m = { x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2 };
    assert.ok(Math.abs(Math.hypot(m.x - c.x, m.z - c.z) - Math.sqrt(3) / 2) < 1e-9);
  }
});

test('6. 이웃 칸 각도가 axial 좌표와 맞다 — 맞닿은 두 칸의 공유 변은 한 번만 경계가 아니다', () => {
  // (0,0) 과 (1,-1) 이 같은 영토면 둘 사이 변이 경계에서 빠진다
  const lay = parseLayout({ web: 'dark', territories: [
    { island_id: 'FORUM', territory_id: 'a', territory_name: 'A', cells: [[0, 0], [1, -1]] }] }, 'dark');
  assert.equal(edgeSegments(lay).length, 10);
});

test('9. 판 반지름은 모든 칸을 담고, 검색은 두 판에서 앞에서 맞는 것부터', () => {
  const d = parseLayout(DARK, 'dark');
  const b = plateBounds(d);
  for (const t of d.territories) for (const [q, r] of t.cells) {
    const p = axialToXZ(q, r);
    assert.ok(Math.hypot(p.x - b.cx, p.z - b.cz) + 1 <= b.radius);
  }
  const o = parseLayout(OPEN, 'open');
  assert.deepEqual(searchTerritories([d, o], 'a').map((h) => h.name), ['Alpha Forum', 'Beta', 'Gamma', 'PasteSite']);
  assert.deepEqual(searchTerritories([d, o], 'pas').map((h) => h.web), ['open']);
  assert.deepEqual(searchTerritories([d, o], '  '), []);
});
