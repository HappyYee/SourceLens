// SQLite 数据库文件定位（纯函数，可被 node --test 直跑）。
// 镜像 Prisma 的 sqlite url 语义：file: 前缀、相对路径相对 schema.prisma 所在目录解析。
// 保证"Prisma 读哪个文件，备份/导出就操作哪个文件"。
import { isAbsolute, resolve } from "node:path";

/** 把 DATABASE_URL（file:...）解析为绝对文件路径；query 参数（?connection_limit 等）剥离。 */
export function resolveSqliteUrl(url: string, schemaDir: string): string {
  let p = url.trim();
  if (p.startsWith("file:")) p = p.slice("file:".length);
  const q = p.indexOf("?");
  if (q >= 0) p = p.slice(0, q);
  if (!p) throw new Error("DATABASE_URL 为空或无法解析");
  return isAbsolute(p) ? p : resolve(schemaDir, p);
}

/** 文件名时间戳：YYYYMMDD-HHmmss（本地时间）。 */
export function timestampSlug(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}
