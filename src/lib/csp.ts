// 배포 화면의 CSP — layout.tsx 가 배포 빌드에서만 meta 로 넣는다 (2026-10-16 보안 다듬기).
//
// GitHub Pages 는 응답 머리글을 못 붙여 meta 로 넣는다. 핵심은 connect-src 다 — 이 출처와 통합 Supabase 하나로 묶어,
// 코드가 무엇을 하든 화면이 다른 곳에서 자료를 받거나 보내지 못하게 한다(주소 인자는 sources.ts 가 배포에서 끈다).
// script-src 는 'unsafe-inline' 을 둔다. Next 정적 내보내기가 쪽마다 인라인 스크립트(__next_f)를 넣는데 nonce 를 못 쓰고,
// 빌드 뒤 HTML 의 meta 만 해시로 바꾸면 같은 쪽 RSC 자료 속 meta 값과 어긋나 하이드레이션 경고가 난다.
// 받은 글자는 React 글자 · 캔버스로만 넣어(innerHTML 0) 스크립트가 끼어들 자리가 없다.
// meta 로는 frame-ancestors 를 못 건다(브라우저가 무시한다). 개발 모드는 React 새로고침이 eval 을 써서 넣지 않는다.

import { parseSupabaseConfig } from "./supabase.ts";

/** data/supabase.json 의 프로젝트 출처(https://<프로젝트>.supabase.co). 꼴이 틀리면 null — 그때 connect-src 는 'self' 뿐이다 */
export function supabaseOrigin(cfgRaw: unknown): string | null {
  try {
    return new URL(parseSupabaseConfig(cfgRaw).url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(supabase: string | null): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}
