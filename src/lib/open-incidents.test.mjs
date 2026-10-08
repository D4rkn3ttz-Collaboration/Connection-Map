import test from "node:test";
import assert from "node:assert/strict";

import { detailSubject, subjectIncidents } from "./detail-panel.ts";
import { parseLayout } from "./layout.ts";
import { matchLinks } from "./links.ts";
import { parseOpenIncidents } from "./open-incidents.ts";
import { DARK } from "./fixtures.mjs";

const open = parseLayout({
  web: "open",
  territories: [{
    territory_id: "platform-11",
    territory_name: "Example Code",
    island_id: "CODE",
    island_name: "코드 호스팅",
    cells: [[20, 2]],
    color: "#457AFF",
  }],
}, "open");

test("오픈웹 사건을 영토 ID와 연결하고 유형·상태·날짜를 보존한다", () => {
  const incidents = parseOpenIncidents([
    { id: 123, platform_id: 11, title: "예시 사건", status: "검토중", published_at: null, created_at: "2026-10-08T08:00:00Z" },
    { id: 124, platform_id: 99, title: "다른 영토 사건", created_at: "2026-10-08T08:00:00Z" },
  ], [
    { incident_id: 123, name: "문서", category: "파일 노출", description: "예시 설명" },
    { incident_id: 123, name: "계정", category: "계정 정보 노출", description: "다른 설명" },
  ], open);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].id, "open:platform-11:incident-123");
  assert.equal(incidents[0].title, "예시 사건");
  assert.equal(incidents[0].status, "검토중");
  assert.equal(incidents[0].observedAt, "2026-10-08T08:00:00Z");
  assert.deepEqual(incidents[0].exposureTypes, ["파일 노출", "계정 정보 노출"]);
  assert.match(incidents[0].description, /문서: 예시 설명/);
});

test("오픈웹 원본 사건과 공개 연결의 같은 사건을 한 번만 표시한다", () => {
  const dark = parseLayout(DARK, "dark");
  const lines = matchLinks([{
    link_id: "LNK-1",
    dark_territory: "forum-a",
    open_territory: "platform-11",
    finding_id: "incident-123",
  }], dark, open).lines;
  const subject = detailSubject(
    { kind: "territory", web: "open", territory_id: "platform-11" },
    { dark, open },
    lines,
  );
  const actual = parseOpenIncidents([
    { id: 123, platform_id: 11, title: "예시 사건", created_at: "2026-10-08T08:00:00Z" },
  ], [], open);
  const combined = subjectIncidents(subject, actual);
  assert.equal(combined.length, 1);
  assert.equal(combined[0].title, "예시 사건");
  assert.deepEqual(combined[0].linkIds, ["LNK-1"]);
});
