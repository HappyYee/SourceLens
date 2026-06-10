// AuthProfile 的纯路径逻辑：生成专用 profile 目录名、校验路径在数据目录内。
import { join, resolve } from "node:path";
// 显式 .ts 后缀：让本模块在 node --test（原生 ESM）下也能直接 import 运行。
import { getDataDir } from "./storage.ts";

export function slug(s: string): string {
  return (
    (s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "main"
  );
}

/** profile 目录名（不含路径），如 x-main / bilibili-main。纯函数。 */
export function profileDirName(platform: string, name: string): string {
  return `${slug(platform)}-${slug(name)}`;
}

/** target 是否在 base 目录内（防止 profileDir 指向项目外/危险路径）。纯函数。 */
export function isWithin(base: string, target: string): boolean {
  const b = resolve(base);
  const t = resolve(target);
  return t === b || t.startsWith(b + "/");
}

/** AuthProfile 专用 profile 目录：data/browser-profiles/<platform>-<name>。 */
export function authProfileDir(platform: string, name: string): string {
  return join(getDataDir(), "browser-profiles", profileDirName(platform, name));
}

/** profile 目录是否安全（在 data/browser-profiles 下）。 */
export function isSafeProfileDir(dir: string): boolean {
  return isWithin(join(getDataDir(), "browser-profiles"), dir);
}
