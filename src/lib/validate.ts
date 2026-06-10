// 纯校验/归一化工具。无外部依赖，可被 node --test 直跑。
import type { Platform } from "./types";

export const PLATFORMS: Platform[] = [
  "rss",
  "youtube",
  "bilibili",
  "arxiv",
  "github",
  "podcast",
  "x",
  "manual",
];

export const ROOM_TYPES = [
  "person",
  "company",
  "lab",
  "project",
  "podcast",
  "folder",
] as const;

export function isPlatform(v: unknown): v is Platform {
  return typeof v === "string" && (PLATFORMS as string[]).includes(v);
}

/** 重要度限制在 1..5，非法输入回落到 3。 */
export function clampImportance(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 3;
  return Math.min(5, Math.max(1, n));
}

export function normalizeRoomType(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "person";
}

/** 由 URL 自动识别平台：youtube / bilibili / x / github，其它归为 manual（通用链接）。 */
export function detectPlatform(url: string): Platform {
  const u = (url || "").toLowerCase();
  if (/(?:\/\/|\.|^)(?:youtube\.com|youtu\.be)\b/.test(u)) return "youtube";
  if (/(?:\/\/|\.|^)(?:bilibili\.com|b23\.tv)\b/.test(u)) return "bilibili";
  if (/(?:\/\/|\.|^)(?:x\.com|twitter\.com)\b/.test(u)) return "x";
  if (/(?:\/\/|\.|^)github\.com\b/.test(u)) return "github";
  return "manual";
}
