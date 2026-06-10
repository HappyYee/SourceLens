import type { Platform } from "@/lib/types";

export function thumbClass(v?: number | null): string {
  const n = (((v ?? 0) % 4) + 4) % 4;
  return `t${n}`;
}
export function sqClass(p: Platform): string {
  if (p === "arxiv") return "s0";
  if (p === "podcast") return "s2";
  if (p === "bilibili") return "s3";
  return "s1";
}

export function hideBrokenImage(e: { currentTarget: HTMLImageElement }): void {
  e.currentTarget.style.display = "none";
}
