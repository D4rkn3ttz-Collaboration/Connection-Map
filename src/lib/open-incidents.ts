import type { PanelIncident } from "./detail-panel.ts";
import type { Layout } from "./layout.ts";

type Row = Record<string, unknown>;

function rows(value: unknown, table: string): Row[] {
  if (!Array.isArray(value)) throw new Error(`${table} 응답이 목록이 아닙니다`);
  return value.filter((item): item is Row =>
    item !== null && typeof item === "object" && !Array.isArray(item),
  );
}

function positiveId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function date(value: unknown): string | null {
  const result = text(value);
  return result && Number.isFinite(Date.parse(result)) ? result : null;
}

/** 2D 지도의 incident/platform ID를 3D 오픈웹 영토와 연결한다. */
export function parseOpenIncidents(
  incidentRows: unknown,
  dataTypeRows: unknown,
  layout: Layout,
): PanelIncident[] {
  const territories = new Map(layout.territories.map((item) => [item.id, item]));
  const types = new Map<number, Row[]>();
  for (const item of rows(dataTypeRows, "incidents_data_types")) {
    const id = positiveId(item.incident_id);
    if (id === null) continue;
    const group = types.get(id) ?? [];
    group.push(item);
    types.set(id, group);
  }

  const incidents: PanelIncident[] = [];
  const seen = new Set<number>();
  for (const item of rows(incidentRows, "incidents")) {
    const id = positiveId(item.id);
    const platformId = positiveId(item.platform_id);
    if (id === null || platformId === null || seen.has(id)) continue;
    const territoryId = `platform-${platformId}`;
    const territory = territories.get(territoryId);
    if (!territory) continue;
    seen.add(id);
    const dataTypes = types.get(id) ?? [];
    const descriptions = dataTypes
      .map((type) => {
        const detail = text(type.description);
        const name = text(type.name);
        return detail ? [name, detail].filter(Boolean).join(": ") : "";
      })
      .filter(Boolean);
    const reference = `incident-${id}`;
    incidents.push({
      id: `open:${territoryId}:${reference}`,
      reference,
      title: text(item.title) || null,
      observedAt: date(item.published_at) ?? date(item.created_at),
      territory: { web: "open", territory_id: territoryId },
      territoryName: territory.name,
      exposureTypes: [
        ...new Set(dataTypes.map((type) => text(type.category)).filter(Boolean)),
      ],
      status: text(item.status) || undefined,
      description: descriptions.join("\n") || undefined,
      linkIds: [],
    });
  }
  return incidents;
}
