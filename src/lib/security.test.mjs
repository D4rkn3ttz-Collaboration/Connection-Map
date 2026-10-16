// 보안 다듬기 시험 (2026-10-16) — 주소 인자는 개발 모드에서만 · 배포 화면 CSP.  npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { fileSources } from './sources.ts';
import { contentSecurityPolicy, supabaseOrigin } from './csp.ts';

const params = new URLSearchParams('?dark=/x/dark.json&open=https://example.invalid/x.json&links=data:application/json,[]');

test('배포 빌드는 ?dark · ?open · ?links 를 무시한다 — 통합 Supabase 만 읽는다', () => {
  assert.deepEqual(fileSources(params, false), { dark: null, open: null, links: null });
});

test('개발 모드는 주소 인자 파일을 받는다 — ?…=supabase 는 「통합 DB」 라는 뜻이라 받지 않는다', () => {
  assert.deepEqual(fileSources(params, true), { dark: '/x/dark.json', open: 'https://example.invalid/x.json', links: 'data:application/json,[]' });
  assert.deepEqual(fileSources(new URLSearchParams('?dark=supabase&links=supabase'), true), { dark: null, open: null, links: null });
});

test('CSP — connect-src 는 이 출처와 통합 Supabase 하나, 물건 · 기준 주소 · 양식은 막는다', () => {
  const csp = contentSecurityPolicy('https://abcd.supabase.co');
  const dir = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepEqual(dir['connect-src'], ["'self'", 'https://abcd.supabase.co']);
  assert.deepEqual(dir['default-src'], ["'self'"]);
  assert.deepEqual(dir['object-src'], ["'none'"]);
  assert.deepEqual(dir['base-uri'], ["'none'"]);
  assert.deepEqual(dir['form-action'], ["'none'"]);
  assert.ok(!dir['frame-ancestors'], 'meta 로는 frame-ancestors 를 못 건다');
  assert.ok(!csp.includes('unsafe-eval'));
  assert.deepEqual(contentSecurityPolicy(null).split('; ').find((d) => d.startsWith('connect-src')), "connect-src 'self'");
});

test('Supabase 출처 — 저장소의 data/supabase.json 은 https://<프로젝트>.supabase.co 하나, 꼴이 틀리면 null', () => {
  const cfg = JSON.parse(readFileSync(new URL('../../data/supabase.json', import.meta.url), 'utf8'));
  assert.match(supabaseOrigin(cfg) ?? '', /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
  assert.equal(supabaseOrigin({ url: 'https://evil.example.com', key: 'x'.repeat(30) }), null);
  assert.equal(supabaseOrigin(null), null);
});
