// 연결 · 고르기 시험.  npm test (= node --experimental-strip-types --test src/lib/*.test.mjs)
// 옛 시제품 lib.test.mjs 의 시험 번호를 그대로 둔다(2026-10-07 TypeScript 로 옮김)

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLayout } from './layout.ts';
import { LINKS_VIEW_SELECT, confidenceRank, focusOf, lineStyle, linksMissing, linksOf, matchLinks, pickedLines, strandsOf } from './links.ts';
import { DARK, OPEN } from './fixtures.mjs';

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
  const d = parseLayout(DARK, 'dark');
  const o = parseLayout(OPEN, 'open');
  const L = { dark: d, open: o };
  const lines = [
    { id: '1', darkId: 'forum-a', openId: 'paste-1' },
    { id: '2', darkId: 'forum-b', openId: 'paste-2' },
  ];
  assert.deepEqual([...linksOf(lines, { kind: 'territory', web: 'dark', territory_id: 'forum-a' }, L).other], ['paste-1']);
  assert.deepEqual([...linksOf(lines, { kind: 'territory', web: 'open', territory_id: 'paste-2' }, L).other], ['forum-b']);
  assert.deepEqual([...linksOf(lines, { kind: 'island', web: 'dark', island_id: 'FORUM' }, L).other].sort(), ['paste-1', 'paste-2']);
  assert.equal(linksOf(lines, { kind: 'territory', web: 'dark', territory_id: 'ransomware-c' }, L).lines.length, 0);
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

test('17. 고른 것 → 높이를 지킬 영토 · 그릴 선 — 영토 · 섬 · 관계 하나 · 없는 것 · 전체 관계 보기 (2026-10-07)', () => {
  const d = parseLayout(DARK, 'dark');
  const o = parseLayout(OPEN, 'open');
  const L = { dark: d, open: o };
  const lines = [
    { id: 'LNK-1', darkId: 'forum-a', openId: 'paste-1', relType: '', confidence: '상' },
    { id: 'LNK-2', darkId: 'forum-b', openId: 'paste-1', relType: '', confidence: '중' },
  ];
  // 아무것도 안 고름 — 다 그대로, 선 없음. 전체 관계 보기면 선 전부
  let f = focusOf(null, L, lines);
  assert.equal(f.keep.dark, null);
  assert.equal(f.keep.open, null);
  assert.equal(f.lines.length, 0);
  assert.equal(focusOf(null, L, lines, true).lines.length, 2);
  // 영토 — 그 영토 + 반대쪽 이어진 영토
  f = focusOf({ kind: 'territory', web: 'open', territory_id: 'paste-1' }, L, lines);
  assert.deepEqual([...f.keep.open], ['paste-1']);
  assert.deepEqual([...f.keep.dark].sort(), ['forum-a', 'forum-b']);
  assert.equal(f.lines.length, 2);
  assert.equal(f.lonely, false);
  // 이어진 것이 없는 영토 — 그 영토만, 「다른 층과 연결 없음」
  f = focusOf({ kind: 'territory', web: 'dark', territory_id: 'ransomware-c' }, L, lines);
  assert.deepEqual([...f.keep.dark], ['ransomware-c']);
  assert.equal(f.keep.open.size, 0);
  assert.equal(f.lonely, true);
  // 섬 — 섬 영토 전부
  f = focusOf({ kind: 'island', web: 'dark', island_id: 'FORUM' }, L, lines);
  assert.deepEqual([...f.keep.dark].sort(), ['forum-a', 'forum-b']);
  // 관계 하나(Figma ③-3) — 그 두 영토와 그 선만
  f = focusOf({ kind: 'link', link_id: 'LNK-2' }, L, lines);
  assert.deepEqual([...f.keep.dark], ['forum-b']);
  assert.deepEqual([...f.keep.open], ['paste-1']);
  assert.deepEqual(f.lines.map((l) => l.id), ['LNK-2']);
  // 없는 영토 · 섬 · 관계 · 없는 판은 아무것도 안 고른 것
  for (const p of [{ kind: 'territory', web: 'dark', territory_id: 'nope' }, { kind: 'island', web: 'dark', island_id: 'NOPE' },
                   { kind: 'link', link_id: 'LNK-9' }]) {
    assert.equal(focusOf(p, L, lines).keep.dark, null, JSON.stringify(p));
  }
  assert.equal(focusOf({ kind: 'territory', web: 'open', territory_id: 'paste-1' }, { dark: d, open: null }, lines).keep.open, null);
  // 연결선 꼴은 신뢰도대로 — 높음 실선 · 중간 파선 · 낮음 점선, 빈 값 · 모르는 값은 옅은 선(아래)
  assert.equal(lineStyle('상').dashed, false);
  assert.equal(lineStyle('높음').dashed, false);
  assert.ok(lineStyle('중').dashed && lineStyle('중간').dash > lineStyle('하').dash, '파선이 점선보다 길다');
  assert.ok(lineStyle('낮음').dashed);
  assert.equal(lineStyle('').dashed, false);
  assert.equal(lineStyle('???').dashed, false);
  // 빈 신뢰도 · 모르는 값은 옅은 선 — 「높음」 실선과 구분된다(2026-10-08)
  assert.equal(lineStyle('').faint, true);
  assert.equal(lineStyle('???').faint, true);
  for (const c of ['상', '높음', '중', '하', '낮음']) assert.equal(lineStyle(c).faint, false, c);
});

test('18. 같은 영토 쌍은 선 하나 — 가장 높은 신뢰도의 꼴, 전체 관계 보기에서는 고른 것만 진하게 (2026-10-09)', () => {
  const L = (id, darkId, openId, confidence) => ({ id, darkId, openId, relType: '', confidence });
  const lines = [L('A', 'd1', 'o1', '하'), L('B', 'd1', 'o1', '상'), L('C', 'd2', 'o1', ''), L('D', 'd1', 'o2', '중')];
  const all = strandsOf(lines);
  assert.equal(all.length, 3);
  const pair = all.find((s) => s.darkId === 'd1' && s.openId === 'o1');
  assert.deepEqual(pair.ids, ['A', 'B']);
  assert.equal(pair.confidence, '상', '합친 선은 가장 높은 신뢰도의 꼴');
  assert.ok(all.every((s) => s.strong), '고른 것이 없으면 다 진하다');
  // 고른 연결(A · 하)이 든 쌍만 진하고, 그 선은 고른 연결의 꼴을 따른다 — 앞뒤 차례가 바뀌어도 같다
  for (const order of [lines, [lines[1], lines[0], lines[2], lines[3]]]) {
    const s = strandsOf(order, [lines[0]]);
    const p = s.find((x) => x.darkId === 'd1' && x.openId === 'o1');
    assert.equal(p.strong, true);
    assert.equal(p.confidence, '하');
    assert.deepEqual(s.filter((x) => !x.strong).map((x) => x.ids[0]).sort(), ['C', 'D']);
  }
  // 고른 것 밖의 쌍에 연결이 둘이면 그 가운데 가장 높은 신뢰도 — 뒤 것이 높아도
  const w = [L('X', 'd3', 'o3', '하'), L('Y', 'd3', 'o3', '상'), L('Z', 'd9', 'o9', '중')];
  for (const order of [w, [w[1], w[0], w[2]]]) {
    const p = strandsOf(order, [w[2]]).find((x) => x.darkId === 'd3');
    assert.equal(p.strong, false);
    assert.equal(p.confidence, '상');
  }
  assert.ok(strandsOf(lines, []).every((s) => !s.strong), '고른 것에 이어진 연결이 없으면 다 옅다');
  assert.deepEqual([confidenceRank('상'), confidenceRank('중간'), confidenceRank('low'), confidenceRank(''), confidenceRank('???')], [3, 2, 1, 0, 0]);
  for (const c of ['상', '중', '하', '', '???']) assert.equal(lineStyle(c).faint, confidenceRank(c) === 0, c);
  assert.deepEqual(strandsOf([]), []);
});

test('20. 진하게 그릴 연결 — 전체 관계 보기를 켜고 고른 것이 있을 때만 (2026-10-09)', () => {
  const d = parseLayout(DARK, 'dark');
  const o = parseLayout(OPEN, 'open');
  const L = { dark: d, open: o };
  const t0 = d.territories[0].id;
  const lines = [{ id: 'K1', darkId: t0, openId: o.territories[0].id, relType: '', confidence: '상' }];
  const pick = { kind: 'territory', web: 'dark', territory_id: t0 };
  assert.equal(pickedLines(pick, L, lines, false), null, '끄면 null');
  assert.equal(pickedLines(null, L, lines, true), null, '고른 것이 없으면 null');
  assert.equal(pickedLines({ kind: 'territory', web: 'dark', territory_id: 'nope' }, L, lines, true), null, '없는 것을 고르면 null');
  assert.deepEqual(pickedLines(pick, L, lines, true).map((l) => l.id), ['K1']);
  const lonely = d.territories.find((t) => t.id !== t0).id;
  assert.deepEqual(pickedLines({ kind: 'territory', web: 'dark', territory_id: lonely }, L, lines, true), [], '연결 없는 영토면 []');
});
