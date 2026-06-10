// 演示数据（假名人/公司/source/item）：结构镜像 reference/prototype.html。
// 仅供演示，运行：npm run seed:demo（默认 npm run seed 不再灌这些假数据）。
import "./_env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function minAgo(min) {
  return new Date(Date.now() - min * 60_000);
}
function dayAt(dayOffset, hh = 12, mm = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d;
}

async function makeRoom({
  name,
  type = "person",
  importance = 3,
  parentId = null,
  sortOrder = 0,
  bindings = [],
  items = [],
}) {
  const room = await prisma.room.create({
    data: {
      name,
      nodeKind: type === "folder" ? "folder" : "room",
      type: type === "folder" ? null : type,
      importance,
      parentId,
      sortOrder,
    },
  });
  const bindingByPlatform = {};
  for (const b of bindings) {
    const sb = await prisma.sourceBinding.create({
      data: {
        roomId: room.id,
        platform: b.platform,
        feedUrl: b.feedUrl ?? null,
        query: b.query ?? null,
        label: b.label ?? null,
      },
    });
    bindingByPlatform[b.platform] = sb.id;
  }
  let i = 0;
  for (const it of items) {
    const bindingId = bindingByPlatform[it.platform];
    if (!bindingId) continue;
    await prisma.item.create({
      data: {
        bindingId,
        roomId: room.id,
        platform: it.platform,
        externalId: `seed-${room.id}-${i++}`,
        title: it.title ?? null,
        aiTitle: it.aiTitle ?? null,
        excerpt: it.excerpt ?? null,
        url: it.url ?? "#",
        thumbnailUrl: it.thumbnailUrl ?? null,
        durationSec: it.durationSec ?? null,
        publishedAt: it.publishedAt,
      },
    });
  }
  return room;
}

async function main() {
  // 幂等：清空后重建
  await prisma.item.deleteMany();
  await prisma.sourceBinding.deleteMany();
  await prisma.room.deleteMany();

  await makeRoom({
    name: "Elon Musk",
    type: "person",
    importance: 5,
    sortOrder: 0,
    bindings: [{ platform: "x" }, { platform: "youtube" }, { platform: "rss" }],
    items: [
      { platform: "x", aiTitle: "关于 Starship 下次试飞窗口的简短更新", excerpt: "示例推文 · AI 拟题", publishedAt: minAgo(120) },
      { platform: "youtube", title: "示例：发射任务全程回放", excerpt: "频道更新 · 含发射与回收画面", durationSec: 2538, publishedAt: minAgo(300) },
      { platform: "x", aiTitle: "转发了一条关于能源存储的图表", excerpt: "示例推文 · 引用转发", publishedAt: dayAt(1, 23, 40) },
      { platform: "rss", title: "示例博客：年度技术路线说明", excerpt: "个人站点更新 · 长文", publishedAt: dayAt(1, 18, 2) },
      { platform: "youtube", title: "示例：工厂参观短片", excerpt: "频道更新", durationSec: 535, publishedAt: dayAt(3, 10, 0) },
    ],
  });

  const lab = await makeRoom({ name: "AI 实验室", type: "folder", importance: 3, sortOrder: 1 });
  const anthropic = await makeRoom({
    name: "Anthropic",
    type: "company",
    importance: 5,
    parentId: lab.id,
    sortOrder: 0,
    bindings: [{ platform: "rss" }, { platform: "x" }],
    items: [
      { platform: "rss", title: "示例：新模型发布说明", excerpt: "官方博客 · 产品公告", publishedAt: minAgo(60) },
      { platform: "x", title: "示例推文：研究方向更新", excerpt: "官方账号", publishedAt: minAgo(180) },
      { platform: "rss", title: "示例：可解释性研究新进展", excerpt: "研究博客", publishedAt: dayAt(1, 15, 30) },
    ],
  });
  await makeRoom({
    name: "Dario Amodei",
    type: "person",
    importance: 4,
    parentId: anthropic.id,
    sortOrder: 0,
    bindings: [{ platform: "x" }, { platform: "rss" }],
    items: [
      { platform: "x", aiTitle: "对一篇行业报告的简短评论", excerpt: "示例推文 · AI 拟题", publishedAt: minAgo(240) },
      { platform: "rss", title: "示例长文：关于扩展规律的思考", excerpt: "个人随笔", publishedAt: dayAt(4, 13, 0) },
    ],
  });
  await makeRoom({
    name: "Anthropic Research",
    type: "lab",
    importance: 3,
    parentId: anthropic.id,
    sortOrder: 1,
    bindings: [{ platform: "arxiv" }, { platform: "rss" }],
    items: [
      { platform: "arxiv", title: "示例论文：一种新的对齐方法", excerpt: "arXiv cs.AI · 预印本", publishedAt: minAgo(360) },
      { platform: "arxiv", title: "示例论文：长上下文评测基准", excerpt: "arXiv cs.CL", publishedAt: dayAt(2, 11, 0) },
    ],
  });
  await makeRoom({
    name: "OpenAI",
    type: "company",
    importance: 4,
    parentId: lab.id,
    sortOrder: 1,
    bindings: [{ platform: "rss" }, { platform: "x" }],
    items: [
      { platform: "rss", title: "示例：产品更新日志", excerpt: "官方博客", publishedAt: minAgo(300) },
      { platform: "x", title: "示例推文：开发者公告", excerpt: "官方账号", publishedAt: dayAt(1, 20, 15) },
    ],
  });
  await makeRoom({
    name: "xAI",
    type: "company",
    importance: 3,
    parentId: lab.id,
    sortOrder: 2,
    bindings: [{ platform: "x" }, { platform: "rss" }],
    items: [{ platform: "x", aiTitle: "发布了一段产品演示", excerpt: "示例推文 · AI 拟题", publishedAt: minAgo(150) }],
  });

  const sci = await makeRoom({ name: "科学家观察", type: "folder", importance: 3, sortOrder: 2 });
  await makeRoom({
    name: "Yann LeCun",
    type: "person",
    importance: 4,
    parentId: sci.id,
    sortOrder: 0,
    bindings: [{ platform: "x" }, { platform: "arxiv" }],
    items: [
      { platform: "x", aiTitle: "关于世界模型的一段长推文", excerpt: "示例推文 · AI 拟题", publishedAt: minAgo(200) },
      { platform: "arxiv", title: "示例论文：自监督表征学习", excerpt: "arXiv · 合作者", publishedAt: dayAt(1, 14, 0) },
    ],
  });
  await makeRoom({
    name: "Andrej Karpathy",
    type: "person",
    importance: 3,
    parentId: sci.id,
    sortOrder: 1,
    bindings: [{ platform: "x" }, { platform: "youtube" }],
    items: [
      { platform: "youtube", title: "示例：从零实现一个小型模型", excerpt: "教学视频更新", durationSec: 7110, publishedAt: minAgo(90) },
      { platform: "x", aiTitle: "分享了一份学习路线笔记", excerpt: "示例推文 · AI 拟题", publishedAt: dayAt(1, 9, 30) },
    ],
  });

  const media = await makeRoom({ name: "开源 · 论文 · 节目", type: "folder", importance: 2, sortOrder: 3 });
  await makeRoom({
    name: "某 AI 播客",
    type: "podcast",
    importance: 2,
    parentId: media.id,
    sortOrder: 0,
    bindings: [{ platform: "podcast" }, { platform: "rss" }],
    items: [{ platform: "podcast", title: "示例：第 112 期 · 与一位研究员对谈", excerpt: "播客更新", durationSec: 4360, publishedAt: dayAt(1, 21, 0) }],
  });

  const counts = {
    rooms: await prisma.room.count(),
    bindings: await prisma.sourceBinding.count(),
    items: await prisma.item.count(),
  };
  console.log("✅ seed 完成：", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
