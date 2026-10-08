import test from "node:test";
import assert from "node:assert/strict";
import { parseLayout } from "./layout.ts";
import { matchLinks } from "./links.ts";
import {
  confidenceLabel,
  dateParts,
  detailSubject,
  incidentsInRange,
  incidentGroups,
  publicIncidents,
  relationLabel,
  sortIncidents,
  verificationLabel,
} from "./detail-panel.ts";
import { DARK, OPEN } from "./fixtures.mjs";

const layouts = {
  dark: parseLayout(DARK, "dark"),
  open: parseLayout(OPEN, "open"),
};
const rows = [
  {
    link_id: "LNK-1",
    dark_territory: "forum-a",
    open_territory: "paste-1",
    rel_type: "REPOST",
    confidence: "상",
    verify_status: "VERIFIED",
    event_id: "EVENT-1",
    finding_id: "FIND-1",
    dark_observed_at: "2026-09-30T16:00:00Z",
    open_observed_at: "2026-09-29T12:30:00Z",
  },
  {
    link_id: "LNK-2",
    dark_territory: "forum-a",
    open_territory: "paste-2",
    rel_type: "SAME_DATASET",
    confidence: "중",
    event_id: "EVENT-1",
    finding_id: "FIND-2",
    dark_observed_at: "2026-09-30T16:00:00Z",
    open_observed_at: "2026-09-30T16:10:00Z",
  },
];
const lines = matchLinks(rows, layouts.dark, layouts.open).lines;

test("상세 패널은 영토·섬·연결 선택을 같은 데이터로 해석한다", () => {
  const territory = detailSubject(
    { kind: "territory", web: "open", territory_id: "paste-1" },
    layouts,
    lines,
  );
  assert.equal(territory.title, "PasteSite");
  assert.equal(territory.breadcrumb, "텍스트 호스팅 > PasteSite");
  assert.deepEqual(
    territory.lines.map((line) => line.id),
    ["LNK-1"],
  );
  const island = detailSubject(
    { kind: "island", web: "dark", island_id: "FORUM" },
    layouts,
    lines,
  );
  assert.equal(island.title, "포럼");
  assert.equal(island.territories.length, 2);
  assert.equal(island.lines.length, 2);
  const link = detailSubject(
    { kind: "link", link_id: "LNK-1" },
    layouts,
    lines,
  );
  assert.equal(link.title, "PasteSite - Alpha Forum");
  assert.deepEqual(
    link.territories.map((t) => t.web),
    ["open", "dark"],
  );
});

test("없는 영토·섬·연결은 다른 영토의 상세 정보로 대체하지 않는다", () => {
  for (const pick of [
    null,
    { kind: "territory", web: "dark", territory_id: "missing" },
    { kind: "island", web: "open", island_id: "MISSING" },
    { kind: "link", link_id: "missing" },
  ]) {
    assert.equal(detailSubject(pick, layouts, lines), null);
  }
  assert.equal(
    detailSubject(
      { kind: "territory", web: "open", territory_id: "paste-1" },
      { dark: layouts.dark, open: null },
      lines,
    ),
    null,
  );
});

test("공개 필드의 검증 상태·관측일·사건 ID만 연결 모델에 보존한다", () => {
  assert.equal(lines[0].verification, "VERIFIED");
  assert.equal(lines[0].eventId, "EVENT-1");
  assert.equal(lines[0].findingId, "FIND-1");
  assert.equal(lines[0].openObservedAt, rows[0].open_observed_at);
  const parsed = matchLinks(
    [{ ...rows[0], description: "비공개 설명", victim: "비공개 조직" }],
    layouts.dark,
    layouts.open,
  ).lines[0];
  assert.equal("description" in parsed, false);
  assert.equal("victim" in parsed, false);
});

test("공개 연결의 같은 사건은 합치고 오픈웹·다크웹 ID는 구분한다", () => {
  const original = structuredClone(lines);
  const subject = detailSubject(
    { kind: "territory", web: "dark", territory_id: "forum-a" },
    layouts,
    lines,
  );
  const incidents = publicIncidents(subject);
  assert.equal(incidents.length, 1);
  assert.deepEqual(incidents[0].linkIds, ["LNK-1", "LNK-2"]);
  assert.equal(incidents[0].title, null, "공개 뷰에 없는 제목을 만들지 않는다");
  assert.deepEqual(
    incidents[0].exposureTypes,
    [],
    "관계 유형을 노출 정보 유형으로 둔갑시키지 않는다",
  );
  assert.deepEqual(lines, original);
  const sameIds = [{ ...lines[0], findingId: "EVENT-1" }];
  const link = detailSubject(
    { kind: "link", link_id: "LNK-1" },
    layouts,
    sameIds,
  );
  assert.equal(publicIncidents(link).length, 2);
});

test("같은 사건의 관측일은 유효한 최초 시각을 쓰고 연결 순서에 의존하지 않는다", () => {
  const duplicated = [
    { ...lines[0], darkObservedAt: undefined },
    { ...lines[1], darkObservedAt: "2026-10-02T00:00:00Z" },
    { ...lines[0], id: "LNK-3", darkObservedAt: "2026-09-30T00:00:00Z" },
  ];
  for (const list of [duplicated, [...duplicated].reverse()]) {
    const subject = detailSubject(
      { kind: "territory", web: "dark", territory_id: "forum-a" },
      layouts,
      list,
    );
    assert.equal(
      publicIncidents(subject)[0].observedAt,
      "2026-09-30T00:00:00Z",
    );
  }
});

test("연결 없는 영토와 사건 ID 없는 연결에 예시 사건을 넣지 않는다", () => {
  const subject = detailSubject(
    { kind: "territory", web: "dark", territory_id: "ransomware-c" },
    layouts,
    lines,
  );
  assert.deepEqual(subject.lines, []);
  assert.deepEqual(publicIncidents(subject), []);
  const plain = matchLinks(
    [
      {
        link_id: "LNK-3",
        dark_territory: "forum-a",
        open_territory: "paste-1",
      },
    ],
    layouts.dark,
    layouts.open,
  ).lines;
  assert.deepEqual(
    publicIncidents(
      detailSubject({ kind: "link", link_id: "LNK-3" }, layouts, plain),
    ),
    [],
  );
});

test("사건은 최신순·한국 시간 월별로 정렬하고 날짜 미등록 항목은 마지막에 둔다", () => {
  const subject = detailSubject(
    { kind: "island", web: "open", island_id: "TEXT_HOSTING" },
    layouts,
    lines,
  );
  const incidents = publicIncidents(subject);
  assert.deepEqual(
    incidents.map((item) => item.reference),
    ["FIND-2", "FIND-1"],
  );
  assert.deepEqual(
    incidentGroups(incidents).map((group) => group.month),
    ["2026-10", "2026-09"],
  );
  assert.equal(dateParts("2026-09-30T16:00:00Z").full, "2026-10-01 01:00");
  assert.equal(dateParts("not-a-date"), null);
  const unknown = { ...incidents[0], id: "unknown", observedAt: null };
  const list = [unknown, ...incidents];
  assert.equal(sortIncidents(list).at(-1).id, "unknown");
  assert.equal(list[0], unknown, "입력 배열은 바꾸지 않는다");
  assert.equal(incidentGroups(list).at(-1).month, "날짜 미등록");
});

test("사건 기간 필터는 한국 시간 날짜의 시작과 끝을 포함한다", () => {
  const incidents = [
    { id: "before", observedAt: "2026-09-30T14:59:59Z" },
    { id: "start", observedAt: "2026-09-30T15:00:00Z" },
    { id: "end", observedAt: "2026-10-01T14:59:59Z" },
    { id: "after", observedAt: "2026-10-01T15:00:00Z" },
    { id: "missing", observedAt: null },
  ];
  assert.deepEqual(
    incidentsInRange(incidents, "2026-10-01", "2026-10-01").map((item) => item.id),
    ["start", "end"],
  );
  assert.equal(incidentsInRange(incidents, null, null).length, 5);
  assert.deepEqual(incidentsInRange(incidents, "2026-10-02", "2026-10-01"), []);
});

test("검증 상태가 없거나 새로운 유형이면 검증 완료로 추정하지 않는다", () => {
  assert.equal(verificationLabel(), "미등록");
  assert.equal(verificationLabel("VERIFIED"), "검증 완료");
  assert.equal(verificationLabel("candidate"), "검증 전");
  assert.equal(confidenceLabel("???"), "미등록");
  assert.equal(confidenceLabel("하"), "낮음");
  assert.equal(relationLabel("REPOST"), "재게시");
  assert.equal(relationLabel("NEW_TYPE"), "NEW_TYPE");
});
