// 다크웹 사건 — 통합 Supabase 공개 표 public.dark_events(다크웹 지도가 구운 사건)를 상세 패널 사건으로. 시험은 dark-incidents.test.mjs.
//
// 표에는 분류 값 · 번호만 있다(자료 제목 · 대상 조직 · 원문 · 핸들이 없다 — 다크초코 반출 규칙). 그래서 제목 자리에는
// 사건 종류(피해 주장 · 판매 …)를 쓴다. 2D 다크웹 지도도 제목에 조직 이름이 드는 사건은 분류로 지은 제목을 쓴다.
// 2D 처럼 행위자 영토에서도 그 행위자의 사건을 센다. 허위 · 반출 제외 사건은 표에 오기 전에 빠진다.

import type { PanelIncident } from "./detail-panel.ts";
import type { Layout } from "./layout.ts";

type Row = Record<string, unknown>;

/** 이름표는 2D 다크웹 지도와 같다(apps/map src/lib/events.ts · relations.ts) */
const KIND: Record<string, string> = {
  data_post: "데이터 게시",
  claim: "피해 주장",
  sale: "판매",
  access_sale: "접근 구매",
  repost: "재게시",
  official: "공식 발표",
};
const VERDICT: Record<string, string> = {
  confirmed: "확인됨",
  high: "신뢰성 높음",
  unverified: "검증 전",
  unknown: "미확인",
  low: "신뢰성 낮음",
};
const SIZE: Record<string, string> = { large: "규모 큼", medium: "규모 중간", small: "규모 작음" };
const RISK: Record<string, string> = { high: "위험도 높음", medium: "위험도 중간", low: "위험도 낮음" };

function text(v: unknown, max = 40): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** 게시 시각. 날짜만 온 값은 한국 시각 0시로 둔다 — 그대로 두면 UTC 0시라 화면에 09:00 이 찍힌다 */
function postedAt(v: unknown): string | null {
  const s = text(v, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00+09:00`;
  return s && Number.isFinite(Date.parse(s)) ? s : null;
}

/** dark_events 줄 → 패널 사건. 영토가 판에 없거나 번호가 틀린 줄은 버린다 */
export function parseDarkIncidents(eventRows: unknown, layout: Layout): PanelIncident[] {
  if (!Array.isArray(eventRows)) throw new Error("dark_events 응답이 목록이 아닙니다");
  const territories = new Map(layout.territories.map((t) => [t.id, t]));
  const out: PanelIncident[] = [];
  for (const raw of eventRows) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Row;
    const reference = text(row.event_id, 20);
    if (!/^(LEAK|INC)-\d{1,6}$/.test(reference)) continue;
    const home = territories.get(text(row.territory_id, 80));
    if (!home) continue;
    const leak = Array.isArray(row.leak_items) ? row.leak_items.map((x) => text(x, 20)).filter(Boolean) : [];
    const value = typeof row.size_value === "number" && Number.isFinite(row.size_value) ? row.size_value : null;
    const size = SIZE[text(row.size)];
    const parts = [
      size && value !== null ? `${size}(${value}${text(row.size_unit, 10)})` : size,
      RISK[text(row.risk)],
      text(row.industry, 20) && `산업 ${text(row.industry, 20)}`,
      row.repost === true && "재게시",
      row.scam === true && "사기 의심",
      text(row.confirm, 20) && `외부 확인: ${text(row.confirm, 20)}`,
    ].filter(Boolean) as string[];
    const base = {
      reference,
      title: KIND[text(row.kind)] ?? "다크웹 게시",
      observedAt: postedAt(row.posted_at),
      exposureTypes: leak,
      status: VERDICT[text(row.verdict)],
      description: parts.join(" · ") || undefined,
      linkIds: [] as string[],
    };
    // 게시처 영토, 그리고 행위자 영토(있으면) — 2D 와 같이 두 곳에서 센다
    const actor = territories.get(text(row.actor_territory_id, 80));
    for (const t of actor && actor.id !== home.id ? [home, actor] : [home]) {
      out.push({
        ...base,
        id: `dark:${t.id}:${reference}`,
        territory: { web: "dark", territory_id: t.id },
        territoryName: t.name,
      });
    }
  }
  return out;
}
