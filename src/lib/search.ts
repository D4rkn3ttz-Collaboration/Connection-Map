import type { PanelIncident } from "./detail-panel.ts";
import { fold, type Layout, type Web } from "./layout.ts";
import type { LinkLine } from "./links.ts";

export type SearchCategory = "incident" | "platform" | "territory" | "actor" | "relation";
export type SearchResult = {
  id: string;
  web: Web;
  category: SearchCategory;
  title: string;
  subtitle: string;
  color?: string;
  count?: number;
  target:
    | { kind: "territory"; web: Web; territory_id: string }
    | { kind: "incident"; incident: PanelIncident }
    | { kind: "link"; link_id: string };
};

export const SEARCH_GROUPS: Record<Web, { category: SearchCategory; label: string }[]> = {
  open: [
    { category: "incident", label: "사건" },
    { category: "platform", label: "플랫폼" },
    { category: "territory", label: "영토" },
  ],
  dark: [
    { category: "territory", label: "엔티티" },
    { category: "actor", label: "행위자" },
    { category: "incident", label: "사건" },
    { category: "relation", label: "관계" },
  ],
};

const matches = (query: string, ...values: (string | null | undefined)[]) =>
  values.some((value) => fold(value).includes(query));

export function searchAll(
  layouts: { open: Layout | null; dark: Layout | null },
  incidents: readonly PanelIncident[],
  lines: readonly LinkLine[],
  query: string,
): SearchResult[] {
  const q = fold(query);
  if (!q) return [];
  const results: SearchResult[] = [];
  const incidentCounts = new Map<string, number>();
  const darkEvents = new Map<string, Set<string>>();
  const relationCounts = new Map<string, number>();
  for (const incident of incidents) {
    const key = `${incident.territory.web}:${incident.territory.territory_id}`;
    incidentCounts.set(key, (incidentCounts.get(key) ?? 0) + 1);
    if (!matches(q, incident.title, incident.reference, incident.territoryName)) continue;
    results.push({
      id: `incident:${incident.id}`, web: "open", category: "incident",
      title: incident.title || incident.reference,
      color: layouts.open?.territories.find((territory) => territory.id === incident.territory.territory_id)?.color,
      subtitle: `${incident.territoryName}${incident.observedAt ? ` · ${incident.observedAt.slice(0, 10)}` : ""}`,
      target: { kind: "incident", incident },
    });
  }
  for (const line of lines) {
    for (const [web, id] of [["open", line.openId], ["dark", line.darkId]] as const) {
      const key = `${web}:${id}`;
      relationCounts.set(key, (relationCounts.get(key) ?? 0) + 1);
    }
    if (line.eventId) {
      const key = `dark:${line.darkId}`;
      const events = darkEvents.get(key) ?? new Set<string>();
      events.add(line.eventId);
      darkEvents.set(key, events);
    }
  }
  for (const [key, events] of darkEvents) incidentCounts.set(key, events.size);
  const name = (web: Web, id: string) => layouts[web]?.territories.find((t) => t.id === id)?.name ?? id;
  for (const web of ["open", "dark"] as const) {
    for (const territory of layouts[web]?.territories ?? []) {
      if (!matches(q, territory.name, territory.id)) continue;
      const actor = web === "dark" && (territory.island === "ACTOR" || territory.kind.includes("행위자"));
      const category: SearchCategory = web === "open"
        ? territory.id.startsWith("platform-") ? "platform" : "territory"
        : actor ? "actor" : "territory";
      const key = `${web}:${territory.id}`;
      const incidentCount = incidentCounts.get(key) ?? 0;
      const relationCount = relationCounts.get(key) ?? 0;
      const result: SearchResult = {
        id: `territory:${key}`, web, category, title: territory.name, color: territory.color,
        subtitle: [territory.islandName, territory.kind && territory.kind !== territory.islandName ? territory.kind : "", incidentCount ? `사건 ${incidentCount}건` : "", relationCount ? `관계 ${relationCount}건` : ""].filter(Boolean).join(" · "),
        count: incidentCount || undefined,
        target: { kind: "territory", web, territory_id: territory.id },
      };
      results.push(result);
      if (actor) results.push({ ...result, id: `actor:${key}`, category: "territory" });
    }
  }
  const seenDarkEvents = new Set<string>();
  for (const line of lines) {
    const darkName = name("dark", line.darkId);
    const openName = name("open", line.openId);
    if (line.eventId) {
      const key = `${line.darkId}:${line.eventId}`;
      if (!seenDarkEvents.has(key) && matches(q, line.eventId, darkName)) {
        seenDarkEvents.add(key);
        const incident: PanelIncident = {
          id: `dark:${line.darkId}:${line.eventId}`, reference: line.eventId,
          title: null, observedAt: line.darkObservedAt ?? null,
          territory: { web: "dark", territory_id: line.darkId },
          territoryName: darkName, exposureTypes: [], linkIds: [line.id],
        };
        results.push({
          id: `incident:${incident.id}`, web: "dark", category: "incident",
          title: line.eventId, subtitle: `${darkName} · 연결 기록`,
          color: layouts.dark?.territories.find((territory) => territory.id === line.darkId)?.color,
          target: { kind: "incident", incident },
        });
      }
    }
    if (!matches(q, darkName, openName, line.id, line.relType)) continue;
    results.push({
      id: `link:${line.id}`, web: "dark", category: "relation",
      title: `${darkName} → ${openName}`,
      color: layouts.dark?.territories.find((territory) => territory.id === line.darkId)?.color,
      subtitle: line.relType ? `${line.relType} · ${line.id}` : line.id,
      target: { kind: "link", link_id: line.id },
    });
  }
  return results.sort((a, b) => {
    const aStarts = fold(a.title).startsWith(q) ? 0 : 1;
    const bStarts = fold(b.title).startsWith(q) ? 0 : 1;
    return aStarts - bStarts || a.title.localeCompare(b.title, "ko");
  });
}
