// 清空用户业务数据：items / sources(bindings) / rooms。
// 保留：库结构、.env、migrations、data/db/sourcelens.db 文件本身。运行：npm run reset:user-data
import "./_env.mjs";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function confirm(question) {
  if (process.argv.includes("--yes")) return Promise.resolve(true);
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => {
      rl.close();
      resolve(/^y(es)?$/i.test(a.trim()));
    });
  });
}

async function main() {
  const before = {
    rooms: await prisma.room.count(),
    bindings: await prisma.sourceBinding.count(),
    items: await prisma.item.count(),
  };
  console.log("⚠ 这会清空用户数据：所有 items、sources/bindings、rooms 都会被删除。");
  console.log("   保留：库结构 / .env / migrations / 数据库文件本身。");
  console.log("   当前：", before);

  if (!(await confirm("确认清空？输入 y 继续（或加 --yes 跳过确认）："))) {
    console.log("已取消，未做任何改动。");
    return;
  }

  // 顺序：item → binding → room（避免外键问题）
  await prisma.item.deleteMany();
  await prisma.sourceBinding.deleteMany();
  await prisma.room.deleteMany();

  console.log("✅ 已清空。现在是干净空间，没有任何 Room / Source / Item。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
