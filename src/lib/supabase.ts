// 통합 Supabase(link-3d) — 받는 칸 · 표 줄 → 배치 결과 꼴 · 설정 파일. 시험은 supabase.test.mjs.

import type { Web } from "./layout.ts";

/** 다크웹 판 표에서 받는 칸. 표 칸 그대로다(README 「받는 자료」) */
export const DARK_TABLE_SELECT = "territory_id,island_id,island_name,territory_name,aliases,kind,cells,color,quarter,as_of";

/**
 * 표 줄 목록 → 배치 결과 꼴. 줄마다 분기 · 시각이 붙어 있으니 머리로 올린다.
 * 줄이 없으면 멈춘다 — 표가 아직 안 채워졌다(자동 갱신이 쓰기 열쇠로 채운다)
 */
export function rowsToLayout(rows: unknown, web: Web) {
  if (!Array.isArray(rows)) throw new Error("표 응답이 줄 목록이 아니다");
  if (rows.length === 0) throw new Error("표가 비어 있다 — 지도 자동 갱신이 아직 안 채웠다");
  const list = rows as Record<string, unknown>[];
  const quarters = new Set(list.map((r) => r?.quarter).filter((q): q is string => typeof q === "string"));
  if (quarters.size > 1) throw new Error(`표에 분기가 섞여 있다 (${quarters.size}개)`);
  // 표 칸은 timestamptz 라 UTC(+00:00)로 온다. 가장 늦은 순간을 한국 시각 글자로 바꾼다 — 화면은 시간대 없이
  // 「2026-10-05 12:20」 처럼 보이므로 UTC 글자를 그대로 두면 9시간 어긋나 보인다(2026-10-05 검토). 2D export.ts kstIso 와 같다
  const times = list.map((r) => Date.parse(String(r?.as_of))).filter(Number.isFinite);
  const asOf = times.length ? new Date(Math.max(...times) + 9 * 3600e3).toISOString().slice(0, 19) + "+09:00" : null;
  return {
    web,
    as_of: asOf,
    quarter: [...quarters][0] ?? null,
    grid: { coords: "axial" },
    territories: list.map((r) => ({ ...r, web })),
  };
}

export interface SupabaseConfig {
  url: string;
  key: string;
}

/**
 * `data/supabase.json` — `{"url": "https://<프로젝트>.supabase.co", "key": "<공개 열쇠>"}`.
 * **주소는 https 의 supabase.co 만 받는다** — 열쇠가 다른 곳으로 가지 않게. 공개 열쇠는 원래 화면에 실리는 값이다
 * (2026-10-06 결정으로 저장소에 넣는다, README 「공개 열쇠」)
 */
export function parseSupabaseConfig(raw: unknown): SupabaseConfig {
  const r = raw as { url?: unknown; key?: unknown } | null;
  const url = typeof r?.url === "string" ? r.url.trim().replace(/\/+$/, "") : "";
  const key = typeof r?.key === "string" ? r.key.trim() : "";
  let host = "";
  try {
    const u = new URL(url);
    if (u.protocol === "https:" && !u.pathname.replace(/\/+$/, "") && !u.search) host = u.hostname;
  } catch {
    host = "";
  }
  if (!/^[a-z0-9-]+\.supabase\.co$/.test(host)) throw new Error("주소가 https://<프로젝트>.supabase.co 꼴이 아니다");
  if (!/^[A-Za-z0-9._-]{20,}$/.test(key)) throw new Error("공개 열쇠가 비었거나 꼴이 아니다");
  return { url: `https://${host}`, key };
}
