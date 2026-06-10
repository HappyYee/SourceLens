// 本地存储目录管理。默认项目内 ./data；将来整体迁到移动硬盘只需设 SOURCELENS_DATA_DIR + DATABASE_URL。
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

/** 数据根目录：优先 SOURCELENS_DATA_DIR（外置盘用），否则项目内 ./data。 */
export function getDataDir(): string {
  const env = process.env.SOURCELENS_DATA_DIR;
  return env ? resolve(env) : resolve(process.cwd(), "data");
}

/**
 * 校验并准备数据目录。
 * - 显式配置了 SOURCELENS_DATA_DIR 却不存在（如移动硬盘没挂载）→ 抛错，绝不退回项目目录静默写入。
 * - 默认本地目录则自动创建所需子目录。
 */
export function assertDataDir(): string {
  const dir = getDataDir();
  const external = !!process.env.SOURCELENS_DATA_DIR;
  if (external && !existsSync(dir)) {
    throw new Error(
      `SourceLens 数据目录不存在（移动硬盘是否已挂载？）：${dir}。已停止，未在项目目录内静默建库。`,
    );
  }
  for (const sub of ["", "db", "cache/thumbnails", "exports", "logs", "browser-profiles"]) {
    const p = sub ? join(dir, sub) : dir;
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
  return dir;
}

export const dataPaths = {
  db: () => join(getDataDir(), "db"),
  thumbnails: () => join(getDataDir(), "cache", "thumbnails"),
  exports: () => join(getDataDir(), "exports"),
  logs: () => join(getDataDir(), "logs"),
  browserProfiles: () => join(getDataDir(), "browser-profiles"),
};
