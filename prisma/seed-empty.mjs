// 空白初始状态：确保默认内容类型 + 一个"未分类"分区(folder)，不建任何 source / item。
// 用于 npm run seed（默认）与 npm run seed:empty。绝不伪造关注对象。
import "./_env.mjs";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultRoomTypes } from "./_room-types.mjs";

const prisma = new PrismaClient();

async function main() {
  await ensureDefaultRoomTypes(prisma);
  const count = await prisma.room.count();
  if (count === 0) {
    await prisma.room.create({
      data: { name: "未分类", nodeKind: "folder", type: null, importance: 3, sortOrder: 0 },
    });
    console.log('✅ 已创建空白初始状态：分区"未分类" + 默认内容类型（无 source、无 item）。');
  } else {
    console.log(`已有 ${count} 个 Room，仅确保默认内容类型就绪。`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
