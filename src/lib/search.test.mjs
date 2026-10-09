import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLayout } from './layout.ts';
import { searchAll } from './search.ts';

const dark = parseLayout({ web: 'dark', territories: [
  { island_id: 'ACTOR', island_name: '행위자', territory_id: 'actor-1', territory_name: 'AshleyWood2022', kind: '행위자', cells: [[0, 0]] },
] }, 'dark');
const open = parseLayout({ web: 'open', territories: [
  { island_id: 'COMMUNITY', island_name: '커뮤니티', territory_id: 'platform-1', territory_name: 'Ashley Hub', cells: [[0, 0]] },
] }, 'open');
const incident = {
  id: 'open:platform-1:incident-1', reference: 'incident-1', title: 'Ashley 자료 게시',
  observedAt: '2026-01-01T00:00:00Z', territory: { web: 'open', territory_id: 'platform-1' },
  territoryName: 'Ashley Hub', exposureTypes: [], linkIds: [],
};
const line = { id: 'LNK-1', darkId: 'actor-1', openId: 'platform-1', relType: 'SAME_ACTOR', confidence: '', eventId: 'LEAK-1' };

test('검색 결과는 웹과 분야로 나뉘고 사건·관계가 실제 자료에 연결된다', () => {
  const hits = searchAll({ open, dark }, [incident], [line], 'ashley');
  assert.deepEqual(hits.filter((h) => h.web === 'open').map((h) => h.category).sort(), ['incident', 'platform']);
  assert.deepEqual(hits.filter((h) => h.web === 'dark').map((h) => h.category).sort(), ['actor', 'incident', 'relation', 'territory']);
  assert.equal(hits.find((h) => h.category === 'incident' && h.web === 'open')?.target.kind, 'incident');
  assert.equal(hits.find((h) => h.category === 'relation')?.target.kind, 'link');
  assert.equal(hits.find((h) => h.web === 'dark' && h.category === 'actor')?.count, 1);
  assert.equal(hits.find((h) => h.web === 'dark' && h.category === 'actor')?.color, '#9AA3B2');
  assert.deepEqual(searchAll({ open, dark }, [], [], '  '), []);
});
