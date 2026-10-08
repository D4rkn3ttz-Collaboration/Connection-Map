import assert from "node:assert/strict";
import test from "node:test";
import { openLegendItems } from "./legend.ts";

const expected = [
  "코드 호스팅",
  "오픈마켓",
  "텍스트 호스팅",
  "백엔드 서비스",
  "공식 웹사이트",
  "파일 호스팅",
  "커뮤니티",
];

const colors = [
  "#447AFF",
  "#ECBB21",
  "#2CBFAF",
  "#38CB6E",
  "#976CF7",
  "#4CC4F9",
  "#FA812D",
];

test("오픈웹 범례는 배치 자료가 없어도 지정된 7개 유형만 표시한다", () => {
  const items = openLegendItems(null);
  assert.deepEqual(items.map((item) => item.name), expected);
  assert.deepEqual(items.map((item) => item.color), colors);
});

test("배치 자료의 영문 유형은 한글로 표시하고 실제 섬 색을 사용한다", () => {
  const items = openLegendItems({
    islands: [
      { id: "CODE_HOSTING", name: "Code Hosting", color: "#123456" },
      { id: "OPEN_MARKETPLACE", name: "Open Marketplace", color: "#ABCDEF" },
      { id: "OTHER", name: "Other", color: "#000000" },
    ],
  });
  assert.deepEqual(
    items.map((item) => item.name),
    expected,
  );
  assert.equal(
    items.find((item) => item.name === "코드 호스팅")?.color,
    "#123456",
  );
  assert.equal(
    items.find((item) => item.name === "오픈마켓")?.color,
    "#ABCDEF",
  );
});
