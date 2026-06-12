// 刷新执行计划（纯函数，可被 node --test 直跑）。
// 并行纪律：跨平台并行、平台内串行——
// 1) 同平台 binding 可能共享同一浏览器 profile（X / Bilibili 登录态），并发启动同一
//    profileDir 会触发 Chrome SingletonLock（profile_busy）；
// 2) 平台内串行同时避免对单一平台的并发请求压力（风控友好）；
// 3) 不同平台天然隔离（不同 profile、不同站点），并行将总时长从 Σ(各源) 降为 max(各平台)。
export function groupBindingsByPlatform<T extends { platform: string }>(rows: T[]): T[][] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const g = map.get(r.platform);
    if (g) g.push(r);
    else map.set(r.platform, [r]);
  }
  return [...map.values()];
}
