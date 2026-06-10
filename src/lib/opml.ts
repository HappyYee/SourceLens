// OPML 解析（纯函数，可测试）。把订阅导出文件拆成 feed 列表 + 所属文件夹。
// 每个带 xmlUrl 的 outline = 一个 feed；不带 xmlUrl 的 outline = 文件夹（其名作为父分区）。

export interface OpmlFeed {
  folder: string | null;
  title: string;
  xmlUrl: string;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? decodeXml(m[1]) : "";
}

export function parseOpml(xml: string): OpmlFeed[] {
  const feeds: OpmlFeed[] = [];
  const stack: { name: string | null; folder: boolean }[] = [];
  const tagRe = /<\/outline\s*>|<outline\b([^>]*?)(\/?)>/gi;

  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(xml))) {
    if (m[0].toLowerCase().startsWith("</")) {
      stack.pop();
      continue;
    }
    const attrs = m[1] || "";
    const selfClose = m[2] === "/";
    const xmlUrl = attr(attrs, "xmlUrl");
    const title = attr(attrs, "title") || attr(attrs, "text");

    const curFolder = [...stack].reverse().find((s) => s.folder)?.name ?? null;

    if (xmlUrl) {
      feeds.push({ folder: curFolder, title: title || xmlUrl, xmlUrl });
      if (!selfClose) stack.push({ name: title || null, folder: false });
    } else if (!selfClose) {
      // 无 xmlUrl 且有子节点 → 文件夹
      stack.push({ name: title || null, folder: true });
    }
  }
  return feeds;
}
