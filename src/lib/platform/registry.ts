import type { PlatformAdapter } from "./types.ts";
import { bilibiliAdapter } from "./bilibili.ts";
import { xAdapter } from "./x.ts";
import { youtubeAdapter } from "./youtube.ts";

const ADAPTERS: Record<string, PlatformAdapter> = {
  bilibili: bilibiliAdapter,
  x: xAdapter,
  youtube: youtubeAdapter,
};

export function getAdapter(platform: string): PlatformAdapter | undefined {
  return ADAPTERS[platform];
}
