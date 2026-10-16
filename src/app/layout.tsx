import type { Metadata } from "next";
import cfgRaw from "../../data/supabase.json";
import { contentSecurityPolicy, supabaseOrigin } from "@/lib/csp.ts";
import "./globals.css";

export const metadata: Metadata = {
  title: "연결 3D",
  description: "오픈웹 · 다크웹 두 판과 그 사이 연결을 3D 로 보여 준다",
  robots: { index: false, follow: false },
};

// 배포 빌드에만 CSP 를 meta 로 넣는다(lib/csp.ts). 개발 모드는 React 새로고침이 eval 을 써서 넣지 않는다
const CSP = process.env.NODE_ENV === "production" ? contentSecurityPolicy(supabaseOrigin(cfgRaw)) : null;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>{CSP && <meta httpEquiv="Content-Security-Policy" content={CSP} />}</head>
      <body className="h-full">{children}</body>
    </html>
  );
}
