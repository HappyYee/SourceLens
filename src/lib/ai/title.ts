// 拟题。X 第一版用规则（不用模型）：去 URL / @回复 / RT 前缀 → 首句 → 截断；纯媒体/纯链接走兜底。
// 可选 ANTHROPIC_API_KEY 时 generateTitle 才走模型；缺 key 一律规则降级。应用无 key 也完整可用。

import { truncate } from "../text.ts";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

/** 清洗正文用于拟题：去转发前缀、开头 @回复、URL，折叠空白。纯函数。 */
export function stripForTitle(text: string): string {
  return (text || "")
    .replace(/\r/g, " ")
    .replace(/^\s*RT\s+@\w+:\s*/i, "") // 转发前缀
    .replace(/^(?:@\w+\s+)+/, "") // 开头的 @回复
    .replace(/https?:\/\/\S+/g, " ") // 链接
    .replace(/\s+/g, " ")
    .trim();
}

/** 规则拟题（不用模型）：取首句、截断 ~40 字；纯媒体或纯链接走兜底。纯函数。 */
export function ruleTitle(text: string, opts?: { hasMedia?: boolean }): string {
  const cleaned = stripForTitle(text);
  if (!cleaned) {
    if (opts?.hasMedia) return "分享了一张图片";
    if (/https?:\/\//.test(text || "")) return "分享了一条链接";
    return "发布了一条短更新";
  }
  const first = cleaned.split(/[。！？.!?\n]/)[0]?.trim() || cleaned;
  return truncate(first, 40);
}

/** 兼容旧名：等价于规则拟题。 */
export function degradeTitle(text: string): string {
  return ruleTitle(text);
}

function cleanModelTitle(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^["「『（(]+/, "")
    .replace(/["」』）)]+$/, "")
    .trim();
  return truncate(cleaned, 24);
}

async function viaAnthropic(text: string): Promise<string | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 64,
      system:
        "用一句不超过 12 字的中文短标题概括用户给的文本，直接输出标题本身，不要引号、不要前后缀、不要解释。",
      messages: [{ role: "user", content: text.slice(0, 1200) }],
    }),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  const content = (data as { content?: unknown }).content;
  const first = Array.isArray(content) ? content[0] : undefined;
  const raw =
    first && typeof first === "object" && (first as { type?: string }).type === "text"
      ? String((first as { text?: string }).text ?? "")
      : "";
  const title = cleanModelTitle(raw);
  return title || null;
}

/** 有 key 走模型（失败回落规则），无 key 直接规则。文本空返回 null。 */
export async function generateTitle(text?: string | null): Promise<string | null> {
  const clean = text?.trim();
  if (!clean) return null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const title = await viaAnthropic(clean);
      if (title) return title;
    } catch {
      // 失败 → 规则降级
    }
  }
  return ruleTitle(clean);
}
