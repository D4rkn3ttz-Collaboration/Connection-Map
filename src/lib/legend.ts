import type { Layout } from "./layout.ts";

export type LegendItem = { name: string; color: string };

const OPEN_LEGEND: (LegendItem & { source: string })[] = [
  { name: "오픈마켓", color: "#E3B90B", source: "Open Marketplace" },
  { name: "텍스트 호스팅", color: "#10A99F", source: "Text Hosting" },
  { name: "백엔드 서비스", color: "#26BA58", source: "Backend Service" },
  { name: "코드 호스팅", color: "#2868EB", source: "Code Hosting" },
  { name: "파일 호스팅", color: "#8555EE", source: "File Hosting" },
  { name: "공식 웹사이트", color: "#28AEE6", source: "Official Website" },
  { name: "커뮤니티", color: "#F27927", source: "Community" },
];

const normalized = (value: string) =>
  value.toLowerCase().replace(/[\s_-]/g, "");

/** 오픈웹 범례는 고정된 7개 유형을 한글로 표시하고, 배치 자료가 있으면 해당 섬의 색을 쓴다. */
export function openLegendItems(layout: Layout | null): LegendItem[] {
  return OPEN_LEGEND.map(({ name, color, source }) => {
    const keys = [normalized(name), normalized(source)];
    const island = layout?.islands.find(
      (item) =>
        keys.includes(normalized(item.name)) ||
        keys.includes(normalized(item.id)),
    );
    return { name, color: island?.color ?? color };
  });
}
