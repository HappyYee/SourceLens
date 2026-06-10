import type { PlatformAdapter } from "./types.ts";
import { bilibiliAdapter } from "./bilibili.ts";
import { xAdapter } from "./x.ts";

const ADAPTERS: Record<string, PlatformAdapter> = {
  bilibili: bilibiliAdapter,
  x: xAdapter,
};

export function getAdapter(platform: string): PlatformAdapter | undefined {
  return ADAPTERS[platform];
}
