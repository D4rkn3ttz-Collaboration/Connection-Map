// 시험에 쓰는 가짜 배치 결과 — 가짜 이름만 쓴다. *.test.mjs 가 아니라 시험으로 돌지 않는다
export const DARK = {
  format: 'darkchoco-dark-layout', version: 1, web: 'dark', baked: true,
  as_of: '2026-10-04T11:16:55+09:00', quarter: '2026-Q4',
  grid: { coords: 'axial', orientation: 'pointy', hex_size: 10 },
  territories: [
    { web: 'dark', island_id: 'FORUM', island_name: '포럼', territory_id: 'forum-a', territory_name: 'Alpha Forum',
      aliases: [], kind: '포럼', cells: [[0, 0], [1, 0], [0, 1]], color: '#877BF3', as_of: 'x' },
    { web: 'dark', island_id: 'FORUM', island_name: '포럼', territory_id: 'forum-b', territory_name: 'Beta',
      aliases: [], kind: '포럼', cells: [[1, 1]], color: '#877BF3', as_of: 'x' },
    { web: 'dark', island_id: 'RANSOMWARE', island_name: '랜섬웨어', territory_id: 'ransomware-c', territory_name: 'Gamma',
      aliases: [], kind: '랜섬웨어 그룹', cells: [[10, 0]], color: '#F26666', as_of: 'x' },
  ],
};
export const OPEN = {
  web: 'open',
  territories: [
    { island_id: 'TEXT_HOSTING', island_name: '텍스트 호스팅', territory_id: 'paste-1', territory_name: 'PasteSite',
      cells: [[0, 0]], color: '#2CBFAF' },
    { island_id: 'TEXT_HOSTING', island_name: '텍스트 호스팅', territory_id: 'paste-2', territory_name: 'BinSite',
      cells: [[2, 0]], color: '#2CBFAF' },
  ],
};
