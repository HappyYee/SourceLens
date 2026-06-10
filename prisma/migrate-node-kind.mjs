// 把旧数据迁移到 nodeKind/roomType 拆分后的结构。运行：npm run migrate:nodekind
// 规则：旧 type=folder → nodeKind=folder, type=null；其余 → nodeKind=room（默认）, type 即 roomType。
import "./_env.mjs";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultRoomTypes } from "./_room-types.mjs";

const prisma = new PrismaClient();

async function main() {
  const folders = await prisma.room.updateMany({
    where: { type: "folder" },
    data: { nodeKind: "folder", type: null },
  });
  // 其余记录 nodeKind 默认 'room'（migrate dev 已赋默认值），type 即内容类型 key。
  await ensureDefaultRoomTypes(prisma);
  console.log("✅ 节点类型迁移完成：", {
    分区: folders.count,
    内容类型数: await prisma.roomType.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
