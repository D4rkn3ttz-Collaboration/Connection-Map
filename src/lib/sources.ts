// 주소 인자로 받는 자료 파일 — ?dark · ?open · ?links (load.ts 가 쓴다).
//
// **개발 모드(`npm run dev`)에서만 받는다** (2026-10-16 보안 다듬기). 배포 빌드에서 받으면 남이 만든 링크 하나
// (우리 배포 주소 + ?open=<남의 JSON>)로 우리 출처 화면에 가짜 영토 이름 · 가짜 연결선을 띄울 수 있다.
// 배포 빌드는 인자를 무시하고 통합 Supabase 만 읽는다. Next 가 빌드 때 process.env.NODE_ENV 를 글자로 바꿔 넣는다.

export const FILE_PARAMS_ALLOWED = process.env.NODE_ENV !== "production";

export interface FileSources {
  dark: string | null;
  open: string | null;
  links: string | null;
}

/** 옛 시제품 주소의 ?dark=supabase · ?links=supabase 는 「통합 DB 에서」 라는 뜻이었다 — 같게 받는다 */
export function fileSources(params: URLSearchParams, allowFiles = FILE_PARAMS_ALLOWED): FileSources {
  const file = (k: string) => {
    if (!allowFiles) return null;
    const v = params.get(k);
    return v && v !== "supabase" ? v : null;
  };
  return { dark: file("dark"), open: file("open"), links: file("links") };
}
