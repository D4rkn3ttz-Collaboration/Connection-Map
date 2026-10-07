import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "연결 3D",
  description: "오픈웹 · 다크웹 두 판과 그 사이 연결을 3D 로 보여 준다",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
