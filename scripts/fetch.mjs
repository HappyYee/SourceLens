// npm run fetch —— 触发本地服务的 /api/refresh（需 dev / start 正在运行）。
// 不引入队列：单用户本地，按需手动或用 cron 调本脚本。
const base = process.env.SOURCELENS_URL || "http://localhost:3000";
const force = process.argv.includes("--force");

try {
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ force }),
  });
  const j = await res.json();
  console.log(`refresh @ ${base}:`, j);
} catch (e) {
  console.error(`无法连接 ${base}，请先 npm run dev。`, e?.message ?? e);
  process.exit(1);
}
