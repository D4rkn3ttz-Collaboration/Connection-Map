import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDarkIncidents } from './dark-incidents.ts';
import { detailSubject, subjectIncidents } from './detail-panel.ts';
import { parseLayout } from './layout.ts';
import { matchLinks } from './links.ts';
import { DARK, OPEN } from './fixtures.mjs';

// 가짜 판 — 포럼 영토 둘 · 행위자 영토 하나
const dark = parseLayout({
  ...DARK,
  territories: [
    ...DARK.territories,
    { web: 'dark', island_id: 'ACTOR', island_name: '행위자', territory_id: 'actor-x', territory_name: 'xhandle',
      kind: '행위자', cells: [[30, 30]], color: '#808DA0' },
  ],
}, 'dark');

const row = (over) => ({
  event_id: 'LEAK-1', territory_id: 'forum-a', actor_territory_id: null, posted_at: '2026-09-01', kind: 'sale',
  verdict: 'high', size: 'large', size_value: 3.5, size_unit: 'GB', risk: 'high', leak_items: ['이메일', '전화'],
  industry: '교육', country: 'KR', repost: false, scam: false, confirm: null, ...over,
});

test('21. 다크웹 사건 표 → 패널 사건 — 제목은 사건 종류, 행위자 영토에서도 센다, 틀린 줄은 버린다 (2026-10-09)', () => {
  const out = parseDarkIncidents([
    row({ actor_territory_id: 'actor-x' }),
    row({ event_id: 'LEAK-2', territory_id: 'forum-b', kind: null, verdict: 'unverified', size: 'unknown', size_value: null, posted_at: '2026-09-02T10:00:00+00:00', repost: true }),
    row({ event_id: 'nope', territory_id: 'forum-a' }),          // 번호가 틀렸다
    row({ event_id: 'LEAK-3', territory_id: 'forum-gone' }),     // 판에 없는 영토
    'x',
  ], dark);
  assert.deepEqual(out.map((i) => i.id), ['dark:forum-a:LEAK-1', 'dark:actor-x:LEAK-1', 'dark:forum-b:LEAK-2']);
  const [a, actor, b] = out;
  assert.equal(a.reference, 'LEAK-1');
  assert.equal(a.title, '판매');
  assert.equal(a.status, '신뢰성 높음');
  assert.deepEqual(a.exposureTypes, ['이메일', '전화']);
  assert.equal(a.description, '규모 큼(3.5GB) · 위험도 높음 · 산업 교육');
  assert.equal(a.observedAt, '2026-09-01T00:00:00+09:00', '날짜만 온 값은 한국 시각 0시');
  assert.equal(actor.territoryName, 'xhandle');
  assert.equal(b.title, '다크웹 게시', '종류가 없으면');
  assert.equal(b.status, '검증 전');
  assert.equal(b.observedAt, '2026-09-02T10:00:00+00:00');
  assert.match(b.description, /재게시/);
  assert.throws(() => parseDarkIncidents({}, dark));
});

test('22. 같은 사건이 연결 줄에도 있으면 패널에 한 번만 — 연결 번호가 붙는다 (2026-10-09)', () => {
  const open = parseLayout(OPEN, 'open');
  const lines = matchLinks([{ link_id: 'LNK-1', dark_territory: 'forum-a', open_territory: 'paste-1', event_id: 'LEAK-1' }], dark, open).lines;
  const subject = detailSubject({ kind: 'territory', web: 'dark', territory_id: 'forum-a' }, { dark, open }, lines);
  const merged = subjectIncidents(subject, parseDarkIncidents([row({})], dark));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, '판매');
  assert.deepEqual(merged[0].linkIds, ['LNK-1']);
});
