// 자료 받기 — 다크웹 판 · 오픈웹 판 · 연결. 화면(닥스훈트 앱)이 한 번 받아 3D 와 둘레 기능에 같이 넘긴다.
//
//   ?dark=<주소>    다크웹 배치 결과 파일(같은 칸 꼴). 없으면 통합 Supabase 표 public.dark_layout
//   ?open=<주소>    오픈웹 배치 결과 파일. 없으면 통합 Supabase 표 public.open_layout
//                   사건은 public.incidents · incidents_data_types 에서 읽는다
//   ?links=<주소>   연결 줄 목록(JSON 배열). 없으면(또는 supabase) 통합 Supabase 공개 뷰 links_public.
//                   뷰가 없거나 공개 읽기가 안 열렸으면 연결선 없이 그리고 「연결 자료 없음」 까닭을 낸다
//
// 받은 글자는 화면에 글자로만 넣는다. innerHTML 에 자료를 넣지 않는다.

import cfgRaw from "../../data/supabase.json";
import { parseLayout, type Layout } from "./layout.ts";
import { LINKS_VIEW_SELECT, linksMissing, matchLinks, type LinkLine } from "./links.ts";
import { parseOpenIncidents } from "./open-incidents.ts";
import type { PanelIncident } from "./detail-panel.ts";
import { DARK_TABLE_SELECT, OPEN_INCIDENT_SELECT, OPEN_INCIDENT_TYPES_SELECT, OPEN_TABLE_SELECT, parseSupabaseConfig, rowsToLayout, type SupabaseConfig } from "./supabase.ts";

export interface SceneData {
  dark: Layout | null;
  open: Layout | null;
  lines: LinkLine[];
  incidents: PanelIncident[];
  /** 사람이 읽는 상태 글 — 판마다 어디서 몇 곳을 받았는지, 못 받았으면 까닭 */
  status: { dark: string; open: string; incidents: string; links: string };
  /** 진짜 오류가 난 판(빨갛게 보일 것) */
  bad: { dark: boolean; open: boolean; incidents: boolean; links: boolean };
}

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`응답 ${r.status}`);
  return r.json();
}

/** 공개 열쇠는 apikey 머리글에만 — 공개 열쇠라 익명 역할로 읽힌다 */
async function getSupabase(cfg: SupabaseConfig, path: string): Promise<Response> {
  return fetch(cfg.url + path, { cache: "no-store", headers: { apikey: cfg.key, Accept: "application/json" } });
}

async function getTableRows(cfg: SupabaseConfig, table: string, columns: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  const pageSize = 500;
  while (true) {
    const r = await getSupabase(cfg, `/rest/v1/${table}?select=${columns}&order=id.asc&limit=${pageSize}&offset=${rows.length}`);
    if (!r.ok) throw new Error(`${table} 조회 실패 (HTTP ${r.status})`);
    const page: unknown = await r.json();
    if (!Array.isArray(page)) throw new Error(`${table} 응답이 목록이 아닙니다`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

const when = (s: string | null) => (s ? s.replace("T", " ").slice(0, 16) : "?");

export async function loadSceneData(params: URLSearchParams): Promise<SceneData> {
  // 옛 시제품 주소의 ?dark=supabase · ?links=supabase 는 「통합 DB 에서」 라는 뜻이었다 — 같게 받는다
  const file = (k: string) => {
    const v = params.get(k);
    return v && v !== "supabase" ? v : null;
  };
  const src = { dark: file("dark"), open: file("open"), links: file("links") };
  const out: SceneData = {
    dark: null,
    open: null,
    lines: [],
    incidents: [],
    status: { dark: "", open: "", incidents: "", links: "" },
    bad: { dark: false, open: false, incidents: false, links: false },
  };
  let cfg: SupabaseConfig | null = null;
  let cfgErr = "";
  try {
    cfg = parseSupabaseConfig(cfgRaw);
  } catch (e) {
    cfgErr = `data/supabase.json — ${(e as Error).message}`;
  }

  try {
    if (src.dark) {
      out.dark = parseLayout(await getJson(src.dark), "dark");
    } else {
      if (!cfg) throw new Error(cfgErr);
      const r = await getSupabase(cfg, `/rest/v1/dark_layout?select=${DARK_TABLE_SELECT}&order=territory_id.asc`);
      if (!r.ok) throw new Error(`통합 DB 응답 ${r.status}`);
      out.dark = parseLayout(rowsToLayout(await r.json(), "dark"), "dark");
    }
    const d = out.dark;
    out.status.dark = `다크웹(${src.dark ? "파일" : "통합 DB"}) ${d.quarter?.replace("-", " ") ?? ""} · 영토 ${d.territories.length} · 자료 ${when(d.asOf)}${d.skipped ? ` · 버린 줄 ${d.skipped}` : ""}`;
  } catch (e) {
    out.status.dark = `다크웹 배치 결과를 못 읽었다 (${(e as Error).message})`;
    out.bad.dark = true;
  }

  try {
    if (src.open) {
      out.open = parseLayout(await getJson(src.open), "open");
    } else {
      if (!cfg) throw new Error(cfgErr);
      const r = await getSupabase(cfg, `/rest/v1/open_layout?select=${OPEN_TABLE_SELECT}&order=territory_id.asc`);
      if (!r.ok) throw new Error(`통합 DB 응답 ${r.status}`);
      out.open = parseLayout(rowsToLayout(await r.json(), "open"), "open");
    }
    const o = out.open;
    out.status.open = `오픈웹(${src.open ? "파일" : "통합 DB"}) ${o.quarter?.replace("-", " ") ?? ""} · 영토 ${o.territories.length} · 자료 ${when(o.asOf)}${o.skipped ? ` · 버린 줄 ${o.skipped}` : ""}`;
  } catch (e) {
    out.status.open = `오픈웹 배치 결과를 못 읽었다 (${(e as Error).message})`;
    out.bad.open = true;
  }

  if (out.open) {
    try {
      if (!cfg) throw new Error(cfgErr);
      const [incidents, types] = await Promise.all([
        getTableRows(cfg, "incidents", OPEN_INCIDENT_SELECT),
        getTableRows(cfg, "incidents_data_types", OPEN_INCIDENT_TYPES_SELECT),
      ]);
      out.incidents = parseOpenIncidents(incidents, types, out.open);
      out.status.incidents = `오픈웹 사건 ${out.incidents.length}건`;
    } catch (e) {
      out.status.incidents = `오픈웹 사건을 못 읽었다 (${(e as Error).message})`;
      out.bad.incidents = true;
    }
  } else {
    out.status.incidents = "오픈웹 영토를 읽지 못해 사건을 표시할 수 없다";
  }

  try {
    let rows: unknown;
    let from = "파일";
    if (src.links) {
      const raw = await getJson(src.links);
      rows = Array.isArray(raw) ? raw : (raw as { rows?: unknown })?.rows;
    } else {
      if (!cfg) throw new Error(cfgErr);
      from = "통합 DB";
      const r = await getSupabase(cfg, `/rest/v1/links_public?select=${LINKS_VIEW_SELECT}&order=link_id.asc`);
      if (!r.ok) {
        let body: unknown = null;
        try {
          body = await r.json();
        } catch {
          body = null;
        }
        const why = linksMissing(r.status, body);
        if (!why) throw new Error(`통합 DB 응답 ${r.status}`);
        out.status.links = `연결 자료 없음 — ${why}`;
        return out;
      }
      rows = await r.json();
    }
    const n = Array.isArray(rows) ? rows.length : 0;
    if (n === 0) {
      out.status.links = `연결 자료 없음 — ${from === "통합 DB" ? "공개 뷰에 나올 줄(DB 반영 · 확정)이 아직 없다" : "파일에 줄이 없다"}`;
      return out;
    }
    const res = matchLinks(rows, out.dark, out.open);
    out.lines = res.lines;
    out.status.links = !out.open
      ? `연결(${from}) ${n}줄 · 오픈웹 판이 없어 선은 아직 못 긋는다`
      : `연결(${from}) ${res.lines.length}건${res.unmatched ? ` · 양 끝을 못 찾은 줄 ${res.unmatched}` : ""}`;
  } catch (e) {
    out.status.links = `연결 자료를 못 읽었다 (${(e as Error).message})`;
    out.bad.links = true;
  }
  return out;
}
