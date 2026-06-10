import type { PlatformAdapter } from "./types.ts";
import { xAdapter } from "./x.ts";

const ADAPTERS: Record<string, PlatformAdapter> = {
  x: xAdapter,
};

export function getAdapter(platform: string): PlatformAdapter | undefined {
  return ADAPTERS[platform];
}
