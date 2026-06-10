// 默认内容类型（roomType）。folder 是 nodeKind，不在此表。
export const DEFAULT_ROOM_TYPES = [
  ["person", "人物"],
  ["company", "公司"],
  ["lab", "实验室"],
  ["project", "项目"],
  ["podcast", "播客"],
  ["youtube_channel", "YouTube 频道"],
  ["idol_group", "偶像团体"],
  ["idol_member", "偶像成员"],
];

export async function ensureDefaultRoomTypes(prisma) {
  for (let i = 0; i < DEFAULT_ROOM_TYPES.length; i++) {
    const [key, displayName] = DEFAULT_ROOM_TYPES[i];
    await prisma.roomType.upsert({
      where: { key },
      update: {}, // 不覆盖用户已改的 displayName
      create: { key, displayName, sortOrder: i, builtin: true },
    });
  }
}
