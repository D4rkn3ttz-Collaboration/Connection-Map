import type { Layout, Territory, Web } from "./layout.ts";
import { linksOf, type LinkLine, type Pick } from "./links.ts";

export type DetailTab = "overview" | "events" | "connections";
export type Layouts = { dark: Layout | null; open: Layout | null };
export type TerritoryRef = { web: Web; territory_id: string };
export type PanelTerritory = TerritoryRef & { territory: Territory };

/** 사건 API가 정해지면 이 형식으로 전달한다. 공개 연결 기록만 있을 때는 제목·노출 유형을 추정하지 않는다. */
export interface PanelIncident {
  id: string;
  reference: string;
  title: string | null;
  observedAt: string | null;
  territory: TerritoryRef;
  territoryName: string;
  exposureTypes: string[];
  description?: string;
  linkIds: string[];
}

export interface DetailSubject {
  key: string;
  title: string;
  eyebrow: string;
  breadcrumb: string | null;
  territories: PanelTerritory[];
  lines: LinkLine[];
  updatedAt: string | null;
}

export const WEB_LABEL: Record<Web, string> = {
  open: "오픈웹",
  dark: "다크웹",
};
const RELATION_LABEL: Record<string, string> = {
  SAME_DATASET: "동일 데이터",
  REPOST: "재게시",
  SAME_CONTENT: "동일 콘텐츠",
  SOURCE_CLAIM: "출처 언급",
  SAME_ACTOR: "동일 행위자",
  CONTACT_MATCH: "연락처 일치",
  PROMOTION_OF: "홍보",
};
export const relationLabel = (value: string) =>
  RELATION_LABEL[value] ?? (value || "유형 미등록");
export function confidenceLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["상", "높음", "high"].includes(normalized)) return "높음";
  if (["중", "중간", "medium", "mid"].includes(normalized)) return "중간";
  if (["하", "낮음", "low"].includes(normalized)) return "낮음";
  return "미등록";
}
export function verificationLabel(value?: string) {
  const labels: Record<string, string> = {
    verified: "검증 완료",
    confirmed: "검증 완료",
    candidate: "검증 전",
    pending: "검증 전",
    unverified: "검증 전",
    excluded: "제외",
    rejected: "제외",
  };
  return value ? (labels[value.toLowerCase()] ?? value) : "미등록";
}

export function territoryOf(
  layouts: Layouts,
  ref: TerritoryRef,
): PanelTerritory | null {
  const territory = layouts[ref.web]?.territories.find(
    (item) => item.id === ref.territory_id,
  );
  return territory ? { ...ref, territory } : null;
}

export function detailSubject(
  pick: Pick | null,
  layouts: Layouts,
  lines: LinkLine[],
): DetailSubject | null {
  if (!pick) return null;
  if (pick.kind === "link") {
    const line = lines.find((item) => item.id === pick.link_id);
    if (!line) return null;
    const open = territoryOf(layouts, {
      web: "open",
      territory_id: line.openId,
    });
    const dark = territoryOf(layouts, {
      web: "dark",
      territory_id: line.darkId,
    });
    if (!open || !dark) return null;
    return {
      key: `link:${line.id}`,
      title: `${open.territory.name} - ${dark.territory.name}`,
      eyebrow: "선택한 연결",
      breadcrumb: `${open.territory.islandName} · ${dark.territory.islandName}`,
      territories: [open, dark],
      lines: [line],
      updatedAt: null,
    };
  }
  const layout = layouts[pick.web];
  if (!layout) return null;
  const territories = layout.territories
    .filter((item) =>
      pick.kind === "territory"
        ? item.id === pick.territory_id
        : item.island === pick.island_id,
    )
    .map((territory) => ({
      web: pick.web,
      territory_id: territory.id,
      territory,
    }));
  if (!territories.length) return null;
  const title =
    pick.kind === "territory"
      ? territories[0].territory.name
      : territories[0].territory.islandName;
  return {
    key: `${pick.web}:${pick.kind}:${pick.kind === "territory" ? pick.territory_id : pick.island_id}`,
    title,
    eyebrow:
      pick.kind === "territory"
        ? `${territories[0].territory.islandName} 영토`
        : `${WEB_LABEL[pick.web]} 섬`,
    breadcrumb:
      pick.kind === "territory"
        ? null
        : `${WEB_LABEL[pick.web]} · 영토 ${territories.length}개`,
    territories,
    lines: linksOf(lines, pick, layouts).lines,
    updatedAt: layout.asOf,
  };
}

/** 양쪽 사건 ID는 다른 이름 공간이다. 같은 사건이 여러 연결에 쓰여도 한 번만 표시한다. */
export function publicIncidents(subject: DetailSubject): PanelIncident[] {
  const records = new Map<string, PanelIncident>();
  for (const line of subject.lines) {
    for (const item of subject.territories) {
      const isDark = item.web === "dark";
      if ((isDark ? line.darkId : line.openId) !== item.territory_id) continue;
      const reference = isDark ? line.eventId : line.findingId;
      if (!reference) continue;
      const id = `${item.web}:${item.territory_id}:${reference}`;
      const observedAt =
        (isDark ? line.darkObservedAt : line.openObservedAt) ?? null;
      const existing = records.get(id);
      if (existing) {
        if (!existing.linkIds.includes(line.id)) existing.linkIds.push(line.id);
        // 같은 사건의 여러 연결에서는 확인 가능한 최초 관측 시각을 사용한다.
        if (
          observedAt &&
          Number.isFinite(Date.parse(observedAt)) &&
          (!existing.observedAt ||
            !Number.isFinite(Date.parse(existing.observedAt)) ||
            Date.parse(observedAt) < Date.parse(existing.observedAt))
        ) {
          existing.observedAt = observedAt;
        }
        continue;
      }
      records.set(id, {
        id,
        reference,
        title: null,
        observedAt,
        territory: { web: item.web, territory_id: item.territory_id },
        territoryName: item.territory.name,
        exposureTypes: [],
        linkIds: [line.id],
      });
    }
  }
  return sortIncidents([...records.values()]);
}

export function sortIncidents(incidents: readonly PanelIncident[]) {
  const timestamp = (value: string | null) =>
    value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : -Infinity;
  return [...incidents].sort(
    (a, b) =>
      timestamp(b.observedAt) - timestamp(a.observedAt) ||
      a.id.localeCompare(b.id),
  );
}

/** 한국 시간의 시작일·종료일(양 끝 포함) 안에 관측된 사건만 남긴다. */
export function incidentsInRange(
  incidents: readonly PanelIncident[],
  from: string | null,
  to: string | null,
) {
  if (!from || !to) return [...incidents];
  const start = Date.parse(`${from}T00:00:00+09:00`);
  const end = Date.parse(`${to}T00:00:00+09:00`) + 24 * 60 * 60 * 1000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
    return [];
  return incidents.filter((incident) => {
    const observed = Date.parse(incident.observedAt ?? "");
    return Number.isFinite(observed) && observed >= start && observed < end;
  });
}

export function dateParts(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value ?? "";
  const month = `${part("year")}-${part("month")}`;
  const time = `${part("hour")}:${part("minute")}`;
  return {
    month,
    short: `${part("month")}-${part("day")} ${time}`,
    full: `${month}-${part("day")} ${time}`,
  };
}

export function incidentGroups(incidents: readonly PanelIncident[]) {
  const groups = new Map<string, PanelIncident[]>();
  for (const incident of sortIncidents(incidents)) {
    const month = dateParts(incident.observedAt)?.month ?? "날짜 미등록";
    const group = groups.get(month) ?? [];
    group.push(incident);
    groups.set(month, group);
  }
  return [...groups].map(([month, items]) => ({ month, items }));
}
