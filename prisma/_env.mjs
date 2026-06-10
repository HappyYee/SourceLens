// 让独立脚本(seed/reset/backup)也能读到项目根 .env 里的 DATABASE_URL 等。
// schema 用 env("DATABASE_URL")，而 node 直跑脚本不会自动加载 .env。
import { readFileSync } from "node:fs";
try {
  const txt = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // 没有 .env 就用现有环境变量
}
