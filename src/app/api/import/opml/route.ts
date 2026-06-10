import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseOpml } from "@/lib/opml";

export const dynamic = "force-dynamic";

// 导入 OPML：每个 feed → 一个 rss room；文件夹 → folder 分区。
// body 可为 { opml: "<xml>" } 或直接 text/xml 正文。
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  let text = "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    text = typeof body.opml === "string" ? body.opml : "";
  } else {
    text = await req.text();
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "OPML 内容为空" }, { status: 400 });
  }

  const feeds = parseOpml(text);
  if (feeds.length === 0) {
    return NextResponse.json({ error: "未从 OPML 解析到任何 feed" }, { status: 400 });
  }

  const folderIds = new Map<string, string>();
  let order = await prisma.room.count({ where: { parentId: null } });
  let created = 0;

  for (const f of feeds) {
    let parentId: string | null = null;
    if (f.folder) {
      let fid = folderIds.get(f.folder);
      if (!fid) {
        const fr = await prisma.room.create({
          data: { name: f.folder, type: "folder", importance: 3, sortOrder: order++ },
        });
        fid = fr.id;
        folderIds.set(f.folder, fid);
      }
      parentId = fid;
    }
    const room = await prisma.room.create({
      data: {
        name: f.title,
        type: "person",
        importance: 3,
        parentId,
        sortOrder: parentId ? 0 : order++,
      },
    });
    await prisma.sourceBinding.create({
      data: { roomId: room.id, platform: "rss", feedUrl: f.xmlUrl, label: "OPML" },
    });
    created += 1;
  }

  return NextResponse.json({ feeds: created, folders: folderIds.size });
}
