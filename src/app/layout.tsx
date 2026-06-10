import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { getNavTree } from "@/lib/data";
import type { NavData } from "@/lib/types";

export const metadata: Metadata = {
  title: "源镜 SourceLens",
  description: "Follow sources, not feeds. 个人信源操作系统 (Attention OS)",
};

const EMPTY: NavData = { tree: [], stats: { sources: 0, updated: 0 } };

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // DB 尚未迁移/为空时优雅降级为空侧栏（首页会给出引导）。
  let data: NavData = EMPTY;
  try {
    data = await getNavTree();
  } catch {
    data = EMPTY;
  }

  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Sidebar tree={data.tree} stats={data.stats} />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
