// lib.js 시험.  npm test (= node --test lib.test.mjs)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GAP_RATIO,
  H_TIERS,
  LINKS_VIEW_SELECT,
  axialToXZ,
  blockHeights,
  edgeSegments,
  fitCamera,
  linksMissing,
  linksOf,
  matchLinks,
  parseLayout,
  parseSupabaseConfig,
  plateBounds,
  projectPoint,
  rowsToLayout,
  searchTerritories,
  tierOf,
} from './lib.js';

// 가짜 이름만 쓴다
const DARK = {
  format: 'darkchoco-dark-layout', version: 1, web: 'dark', baked: true,
  as_of: '2026-10-04T11:16:55+09:00', quarter: '2026-Q4',
  grid: { coords: 'axial', orientation: 'pointy', hex_size: 10 },
  territories: [
    { web: 'dark', island_id: 'FORUM', island_name: '포럼', territory_id: 'forum-a', territory_name: 'Alpha Forum',
      aliases: [], kind: '포럼', cells: [[0, 0], [1, 0], [0, 1]], color: '#877BF3', as_of: 'x' },
    { web: 'dark', island_id: 'FORUM', island_name: '포럼', territory_id: 'forum-b', territory_name: 'Beta',
      aliases: [], kind: '포럼', cells: [[1, 1]], color: '#877BF3', as_of: 'x' },
    { web: 'dark', island_id: 'RANSOMWARE', island_name: '랜섬웨어', territory_id: 'ransomware-c', territory_name: 'Gamma',
      aliases: [], kind: '랜섬웨어 그룹', cells: [[10, 0]], color: '#F26666', as_of: 'x' },
  ],
};
const OPEN = {
  web: 'open',
  territories: [
    { island_id: 'TEXT_HOSTING', island_name: '텍스트 호스팅', territory_id: 'paste-1', territory_name: 'PasteSite',
      cells: [[0, 0]], color: '#2CBFAF' },
  ],
};

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

test('7. 연결 줄은 영토 번호나 이름으로 잇고, 한쪽이라도 없으면 버린다', () => {
  const d = parseLayout(DARK, 'dark');
  const o = parseLayout(OPEN, 'open');
  const rows = [
    { link_id: 'LNK-0001', rel_type: 'SAME_DATASET', confidence: '상', dark_territory: 'alpha forum', open_territory: 'PasteSite' },
    { link_id: 'LNK-0002', rel_type: 'REPOST', dark_territory: 'forum-b', open_territory: 'paste-1' },
    { link_id: 'LNK-0003', dark_territory: 'Nowhere', open_territory: 'PasteSite' },
    { link_id: 'LNK-0004', dark_territory: 'Beta', open_territory: null },
  ];
  const { lines, unmatched } = matchLinks(rows, d, o);
  assert.deepEqual(lines.map((l) => [l.id, l.darkId, l.openId]), [['LNK-0001', 'forum-a', 'paste-1'], ['LNK-0002', 'forum-b', 'paste-1']]);
  assert.equal(unmatched, 2);
  assert.deepEqual(matchLinks(rows, d, null).lines, [], '오픈웹 판이 없으면 선도 없다');
});

test('8. 고른 영토 · 섬에서 반대쪽 층으로 이어진 영토', () => {
  const lines = [
    { id: '1', darkId: 'forum-a', openId: 'paste-1' },
    { id: '2', darkId: 'forum-b', openId: 'paste-2' },
  ];
  assert.deepEqual([...linksOf(lines, { kind: 'territory', web: 'dark', id: 'forum-a' }).other], ['paste-1']);
  assert.deepEqual([...linksOf(lines, { kind: 'territory', web: 'open', id: 'paste-2' }).other], ['forum-b']);
  assert.deepEqual([...linksOf(lines, { kind: 'island', web: 'dark', island: 'FORUM', ids: ['forum-a', 'forum-b'] }).other].sort(), ['paste-1', 'paste-2']);
  assert.equal(linksOf(lines, { kind: 'territory', web: 'dark', id: 'ransomware-c' }).lines.length, 0);
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

test('10. 통합 DB 표 줄을 배치 결과 꼴로 — 분기 · 시각을 머리로 올리고, 빈 표 · 섞인 분기는 멈춘다', () => {
  const rows = DARK.territories.map(({ web, ...r }) => ({ ...r, quarter: '2026-Q4', as_of: '2026-10-05T12:20:53+09:00' }));
  const lay = parseLayout(rowsToLayout(rows, 'dark'), 'dark');
  assert.equal(lay.territories.length, 3);
  assert.equal(lay.quarter, '2026-Q4');
  assert.equal(lay.asOf, '2026-10-05T12:20:53+09:00');
  // 표는 UTC 로 돌려준다 — 같은 순간이면 한국 시각 글자로, 여럿이면 가장 늦은 순간
  const utc = rows.map((r, i) => ({ ...r, as_of: i ? '2026-10-05T03:20:53+00:00' : '2026-10-05T03:10:00+00:00' }));
  assert.equal(rowsToLayout(utc, 'dark').as_of, '2026-10-05T12:20:53+09:00');
  assert.equal(rowsToLayout(rows.map((r) => ({ ...r, as_of: 'x' })), 'dark').as_of, null);
  assert.throws(() => rowsToLayout([], 'dark'), /비어 있습니다/);
  assert.throws(() => rowsToLayout({ rows }, 'dark'), /줄 목록/);
  assert.throws(() => rowsToLayout([...rows, { ...rows[0], territory_id: 'x', quarter: '2026-Q3' }], 'dark'), /섞여/);
});

test('11. 설정 파일 — https 의 supabase.co 주소만, 열쇠는 꼴이 맞아야', () => {
  const key = 'sb_publishable_' + 'a'.repeat(24);
  assert.deepEqual(parseSupabaseConfig({ url: 'https://abcd1234.supabase.co/', key }), { url: 'https://abcd1234.supabase.co', key });
  for (const url of ['http://abcd.supabase.co', 'https://abcd.supabase.co.evil.example', 'https://evil.example/abcd.supabase.co',
                     'https://abcd.supabase.co/rest/v1', 'https://abcd.supabase.co?x=1', 'javascript:alert(1)', '']) {
    assert.throws(() => parseSupabaseConfig({ url, key }), /주소/, url);
  }
  assert.throws(() => parseSupabaseConfig({ url: 'https://abcd.supabase.co', key: 'short' }), /열쇠/);
  assert.throws(() => parseSupabaseConfig({ url: 'https://abcd.supabase.co', key: 'a b'.repeat(10) }), /열쇠/);
  assert.throws(() => parseSupabaseConfig(null), /주소/);
});

test('12. 연결 공개 뷰 — 받는 칸은 뷰에 있는 칸뿐이고, 뷰가 없거나 닫혀 있으면 「자료 없음」 이지 오류가 아니다', () => {
  // 공개 뷰 links_public 의 칸(README 「연결」). 피해 조직 · 근거 · 설명 · 일치 항목은 없다
  const VIEW = ['link_id', 'rel_type', 'direction', 'verify_status', 'confidence', 'match_scope',
    'dark_island', 'dark_territory', 'open_island', 'open_territory',
    'dark_observed_at', 'open_observed_at', 'event_id', 'finding_id'];
  for (const c of LINKS_VIEW_SELECT.split(',')) assert.ok(VIEW.includes(c), c);
  for (const c of ['dark_territory', 'open_territory']) assert.ok(LINKS_VIEW_SELECT.split(',').includes(c), c);

  // 2026-10-05 link-3d 실제 응답(뷰를 만들기 전): 404 · PGRST205
  const notYet = { code: 'PGRST205', message: "Could not find the table 'public.links_public' in the schema cache" };
  assert.match(linksMissing(404, notYet), /아직 없다/);
  assert.match(linksMissing(404, null), /아직 없다/, '본문을 못 읽어도 404 면 뷰가 없다');
  assert.match(linksMissing(404, { code: '42P01' }), /아직 없다/);
  // 권한이 없을 때 link-3d 가 실제로 준 응답(2026-10-06): 401 · 42501
  assert.match(linksMissing(401, { code: '42501', message: 'permission denied for view links_public' }), /공개 읽기/);
  // 그 밖은 진짜 오류 — 화면에 빨갛게 적는다. 틀렸거나 거둔 열쇠(401 · 코드 없음)를 「자료 없음」 으로 덮지 않는다
  assert.equal(linksMissing(401, { message: 'Invalid API key' }), null);
  assert.equal(linksMissing(403, null), null);
  assert.equal(linksMissing(500, { code: 'XX000' }), null);
  assert.equal(linksMissing(400, { code: 'PGRST100' }), null);
});

test('13. 저장소에 든 설정 파일은 공개 열쇠뿐이다 — 비밀 열쇠 · JWT(옛 anon · service_role) · 다른 칸이 들어오면 실패 (2026-10-06)', () => {
  const raw = JSON.parse(readFileSync(new URL('./data/supabase.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(raw).sort(), ['key', 'url'], '주소 · 열쇠 말고 다른 칸을 두지 않는다');
  const cfg = parseSupabaseConfig(raw);
  assert.match(cfg.key, /^sb_publishable_[A-Za-z0-9_-]+$/, '공개 열쇠(sb_publishable_) 꼴이어야 한다');
  assert.ok(!/^sb_secret_/.test(cfg.key) && !/^eyJ/.test(cfg.key), '비밀 열쇠 · JWT 는 넣지 않는다');
});

test('14. 카메라는 기울기 고정으로 두 판을 다 담는다 — 화면을 거의 채우고 위아래 여백이 같다 (2026-10-08)', () => {
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
    assert.ok(span <= 0.95 && span > 0.9, `화면 끝에서 6% 안 (aspect ${aspect}: ${span.toFixed(3)})`);
    assert.ok(Math.abs(hi + lo) < 0.02, `위아래 여백이 같다 (aspect ${aspect}: ${(hi + lo).toFixed(3)})`);
  }
  // 판 사이가 넓을수록 · 화면이 좁을수록 멀리서 본다
  assert.ok(fitCamera({ radius, gap: radius * 0.9, top, aspect: 1.6 }).dist < fitCamera({ radius, gap, top, aspect: 1.6 }).dist);
  assert.ok(fitCamera({ radius, gap, top, aspect: 0.5 }).dist > fitCamera({ radius, gap, top, aspect: 1.6 }).dist);
});
