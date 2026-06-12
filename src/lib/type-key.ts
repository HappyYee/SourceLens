// roomType key 自动生成（纯函数，可被 node --test 直跑）。
// 用户只填显示名；key = slug 化 + 冲突追加 _2/_3…（路由约束 ^[a-z0-9_]+$）。
// 不复用 authprofile.slug：那是目录名语义（空值回退 "main"），此处空值应回退 "type"。
export function uniqueTypeKey(displayName: string, existingKeys: Iterable<string>): string {
  const existing = new Set(existingKeys);
  const base =
    displayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "type";
  if (!existing.has(base)) return base;
  for (let i = 2; ; i++) {
    const k = `${base}_${i}`;
    if (!existing.has(k)) return k;
  }
}
