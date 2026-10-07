import type { NextConfig } from "next";

// GitHub Pages 에 정적 파일로 올린다(.github/workflows/pages.yml). 서버가 도는 곳이 없다.
// 주소가 https://d4rkn3ttz-collaboration.github.io/Connection-Map/ 이라 모든 경로 앞에 /Connection-Map 이 붙는다 —
// 로컬 `npm run dev` 도 http://localhost:3004/Connection-Map 에서 연다
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Connection-Map",
  images: { unoptimized: true },
};

export default nextConfig;
