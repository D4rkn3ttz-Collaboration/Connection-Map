// 통합 Supabase 시험.  npm test (= node --experimental-strip-types --test src/lib/*.test.mjs)
// 옛 시제품 lib.test.mjs 의 시험 번호를 그대로 둔다(2026-10-07 TypeScript 로 옮김)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseLayout } from './layout.ts';
import { parseSupabaseConfig, rowsToLayout } from './supabase.ts';
import { DARK } from './fixtures.mjs';

test('10. 통합 DB 표 줄을 배치 결과 꼴로 — 분기 · 시각을 머리로 올리고, 빈 표 · 섞인 분기는 멈춘다', () => {
  // 표 줄에는 web 칸이 없다
  const rows = DARK.territories.map((t) => {
    const r = { ...t, quarter: '2026-Q4', as_of: '2026-10-05T12:20:53+09:00' };
    delete r.web;
    return r;
  });
  const lay = parseLayout(rowsToLayout(rows, 'dark'), 'dark');
  assert.equal(lay.territories.length, 3);
  assert.equal(lay.quarter, '2026-Q4');
  assert.equal(lay.asOf, '2026-10-05T12:20:53+09:00');
  // 표는 UTC 로 돌려준다 — 같은 순간이면 한국 시각 글자로, 여럿이면 가장 늦은 순간
  const utc = rows.map((r, i) => ({ ...r, as_of: i ? '2026-10-05T03:20:53+00:00' : '2026-10-05T03:10:00+00:00' }));
  assert.equal(rowsToLayout(utc, 'dark').as_of, '2026-10-05T12:20:53+09:00');
  assert.equal(rowsToLayout(rows.map((r) => ({ ...r, as_of: 'x' })), 'dark').as_of, null);
  assert.throws(() => rowsToLayout([], 'dark'), /비어 있다/);
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

test('13. 저장소에 든 설정 파일은 공개 열쇠뿐이다 — 비밀 열쇠 · JWT(옛 anon · service_role) · 다른 칸이 들어오면 실패 (2026-10-06)', () => {
  const raw = JSON.parse(readFileSync(new URL('../../data/supabase.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(raw).sort(), ['key', 'url'], '주소 · 열쇠 말고 다른 칸을 두지 않는다');
  const cfg = parseSupabaseConfig(raw);
  assert.match(cfg.key, /^sb_publishable_[A-Za-z0-9_-]+$/, '공개 열쇠(sb_publishable_) 꼴이어야 한다');
  assert.ok(!/^sb_secret_/.test(cfg.key) && !/^eyJ/.test(cfg.key), '비밀 열쇠 · JWT 는 넣지 않는다');
});
