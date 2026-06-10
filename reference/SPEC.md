# 源镜 SourceLens — 项目构建文档 (v0)

> 一句话：由你选择源头、按你设定的顺序排列、由 AI 在边缘降噪的个人信源操作系统（Attention OS）。
> 本文件是交给实现方（Cowork）的构建说明书。请从上到下阅读，按"分阶段任务"的顺序构建。

---

## 0. 给实现方（Cowork）的指令

1. **按阶段顺序构建**（Phase 0 → 4）。每完成一个阶段，先把应用跑起来、逐条核对该阶段的"验收标准"，通过后再进入下一阶段。
2. **v0 必须能完全离线跑通**：不依赖任何付费服务、不需要任何 API key。AI 功能是可选增强，缺 key 时优雅降级（见 §6）。
3. **依赖保持最小**：不引入 Redis、消息队列、Supabase、鉴权库、向量数据库。单用户本地应用，能简单就简单。
4. **`reference/prototype.html` 是界面与交互的唯一真源**：布局、配色、字体、卡片样式、导航折叠、回溯切换、重要度方块——都以它为准，本文件的文字描述与它冲突时以原型为准。
5. 只有当某个决策本文件没有覆盖时，才向用户提问；其余按本文件执行。

---

## 1. 产品是什么 / 不是什么

**是什么**：一个网站。打开后是一片按重要性排序的方块网格，每个方块是一个 **Room**。Room = 一个你关注的对象（一个人 / 一家公司 / 一个实验室 / 一个项目），不是一个平台。这个对象在各平台（X、YouTube、博客、arXiv…）的发布，全部汇进它这一个 Room，**按时间穿成一条时间线**。你既能看它今天的发布轨迹，也能回溯过去。Room 之间可嵌套，但嵌套**只是文件夹式的组织关系**——子 Room 各自独立收集，数据不汇入父级。

**核心交互**：
- 首页：重要性排序的方块网格（块大小/位置由用户设的重要度决定，**不是算法推断**）。
- 左侧：经典的个人 Room 管理——自定义分区、排序、折叠/展开。
- 进入 Room：看到该对象的全平台合并时间线；每条是一张"启动器"卡片（封面/时长/标题/简介 + 原文链接），**点出去看原文，源镜不替你读完内容**。

**不是什么 / v0 明确不做**（防止范围蔓延）：
- ❌ 用户账号 / 登录鉴权（单用户本地）
- ❌ AI 生成用户画像、AI 给内容打重要性分、AI 替你读完/听完内容
- ❌ 向量库 / RAG / "问我的信息源"
- ❌ 推荐流、热榜、无限滚动
- ❌ 移动 App、浏览器插件
- ❌ 多用户、信源包市场、团队协作
- ❌ 付费 X API（v0 用手动粘贴过渡）

这些都属于后续阶段，不在 v0。

---

## 2. 技术选型（v0）

| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | **Next.js（App Router）+ TypeScript** | 一个进程同时跑 UI + API + 抓取逻辑；就是"网站"形态；对 AI 编程友好 |
| 样式 | **Tailwind CSS** | 与原型一致；快 |
| 数据库 | **SQLite + Prisma** | 本地单文件 DB，无需数据库服务器；Prisma schema 即规格，迁移清晰 |
| 抓取 | **`rss-parser`** + 自写少量 URL 构造器 | RSS/Atom 通吃；几乎所有 v0 数据源都能化成 feed，零 key |
| AI（可选） | **`@anthropic-ai/sdk`**，仅用于"无标题推文拟题" | 缺 key 时降级为截断首句 |
| 调度 | 手动"刷新"按钮 + 可选 `setInterval` | 单用户本地无需队列 |

**运行环境**：Node 20+。

---

## 3. 仓库结构

```
sourcelens/
├─ reference/prototype.html          # 设计与交互的唯一真源（用户会放进来）
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts                        # 可选示例数据
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                    # 首页（方块网格 + 侧栏）
│  │  ├─ room/[id]/page.tsx          # Room 时间线
│  │  ├─ settings/page.tsx           # 增删改 Room / 绑定、导出/删除
│  │  └─ api/                        # 见 §7
│  ├─ components/                    # Sidebar, HomeGrid, RoomTile, RoomTimeline, ItemCard ...
│  ├─ lib/
│  │  ├─ db.ts                       # Prisma client 单例
│  │  ├─ connectors/                 # feed.ts, arxiv.ts, github.ts, youtube.ts, podcast.ts, index.ts
│  │  ├─ normalize.ts                # 解析结果 → 统一 Item
│  │  └─ ai/title.ts                 # 拟题（带降级）
├─ .env                             # ANTHROPIC_API_KEY=（可选，可留空）
└─ package.json
```

---

## 4. 数据模型（Prisma schema）

把下面内容放进 `prisma/schema.prisma`：

```prisma
datasource db { provider = "sqlite"; url = "file:./sourcelens.db" }
generator client { provider = "prisma-client-js" }

// 一个 Room = 一个关注对象；也可作为纯文件夹（无 binding）承载子 Room。
// 用 parentId 自引用形成树，同时表达"分区"和"嵌套 Room"。
model Room {
  id         String   @id @default(cuid())
  name       String
  type       String   @default("person") // person | company | lab | project | podcast | folder
  importance Int      @default(3)         // 1..5，由用户手动设定
  parentId   String?
  parent     Room?    @relation("RoomTree", fields: [parentId], references: [id])
  children   Room[]   @relation("RoomTree")
  sortOrder  Int      @default(0)
  bindings   SourceBinding[]
  items      Item[]
  createdAt  DateTime @default(now())
}

// 一个 Room 绑定多条平台 feed；每条 binding 是该对象在某平台的一个来源。
model SourceBinding {
  id            String    @id @default(cuid())
  roomId        String
  room          Room      @relation(fields: [roomId], references: [id], onDelete: Cascade)
  platform      String    // rss | arxiv | github | youtube | podcast | x | manual
  feedUrl       String?   // 已解析的 feed URL（rss/youtube/github/podcast）
  query         String?   // arxiv 查询串，或其它标识
  label         String?
  enabled       Boolean   @default(true)
  intervalMin   Int       @default(60)
  lastFetchedAt DateTime?
  lastError     String?
  items         Item[]
  createdAt     DateTime  @default(now())
}

// 标准化后的内容条目。publishedAt 是时间线归并的排序键。
model Item {
  id           String   @id @default(cuid())
  bindingId    String
  binding      SourceBinding @relation(fields: [bindingId], references: [id], onDelete: Cascade)
  roomId       String   // 反范式，便于按 Room 查询时间线
  room         Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  platform     String
  externalId   String   // 平台原生 id / guid / link，用于去重
  title        String?  // 原始标题（有则存）
  aiTitle      String?  // 无标题时生成
  excerpt      String?  // 简短摘要/简介（非全文）
  url          String
  thumbnailUrl String?
  durationSec  Int?
  author       String?
  publishedAt  DateTime
  fetchedAt    DateTime @default(now())
  raw          String?  // 可选原始 JSON

  @@unique([bindingId, externalId]) // 去重
  @@index([roomId, publishedAt])
}
```

**关键查询语义**：
- Room 时间线 = 该 Room 自身所有 binding 的 Item，按 `publishedAt desc` 排序、按天分组。**不包含子 Room 的内容**（独立收集）。
- 首页 = Room 列表按 `importance desc` 排序（同分用最近一条 Item 的时间做次级排序）。

---

## 5. 连接器（§ 全部零 key，化成 feed）

v0 的关键洞察：几乎所有数据源都能变成 RSS/Atom，用一个通用解析器 + 各平台的 URL 构造器搞定。`rss-parser` 同时支持 RSS 和 Atom，并可通过 customFields 取 `media:thumbnail`、`yt:videoId`、`itunes:duration` 等。

| platform | 如何取 feed（无需 key） | 备注 |
|---|---|---|
| `rss` | 用户直接给博客/新闻的 RSS/Atom URL | 最稳的源 |
| `youtube` | `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>` | RSS 含缩略图（`media:thumbnail`）；**时长 RSS 取不到**，v0 缩略图卡片可不显示时长 |
| `arxiv` | `http://export.arxiv.org/api/query?search_query=<query>&sortBy=submittedDate&sortOrder=descending&max_results=30` | 返回 Atom；query 形如 `cat:cs.AI`、`all:world+models`、`au:LeCun` |
| `github` | `https://github.com/<owner>/<repo>/releases.atom` | release 信号密度高；也可用 `tags.atom` |
| `podcast` | 用户直接给播客 RSS URL | 标准 RSS，含 `enclosure` + `itunes:duration` → **时长可取** |
| `x` | **v0 不抓取**：手动粘贴 | 见下 |
| `manual` | 用户粘任意链接 + 可选标题/简介 | 兜底 |

**X 的处理（v0）**：提供一个"粘贴"表单——用户贴一条推文 URL（可选附上文本），存为 `platform=x` 的 Item（`url`、`excerpt`=贴的文本、`title=null`→走 AI 拟题、`publishedAt`=now 或用户填）。不做任何抓取。X 官方 API / List 同步留到后续阶段。
> 现实提醒：X 是最难稳定获取的源（Nitter 已停摆、镜像不稳、官方 API 收费）。v0 先把好办的源跑通，X 用手动过渡，完全不影响产品形态成立。

**标准化（`normalize.ts`）**：每条解析结果 → Item：
- `externalId` = `guid || id || link`
- `excerpt` = 去 HTML 后截断（约 200 字）
- `publishedAt` = `isoDate || pubDate`（解析为 DateTime）
- `thumbnailUrl` = `media:thumbnail` 或 `enclosure`（图片）
- `durationSec` = 解析 `itunes:duration`（仅 podcast；youtube 留空）
- 去重：`@@unique([bindingId, externalId])`，重复抓取不产生重复条目。

---

## 6. AI 触点（v0 仅此一处）

`src/lib/ai/title.ts`：

```ts
// 仅当 Item 没有原始 title 时调用，结果写入 aiTitle。
export async function generateTitle(text?: string): Promise<string | null> {
  if (!text?.trim()) return null;
  if (process.env.ANTHROPIC_API_KEY) {
    // 调 Anthropic messages API，system 提示："用一句不超过 12 字的中文短标题概括，不要引号、不要前后缀。"
    // 失败则走下面的降级。
  }
  // 降级：取首句 / 前 ~40 字作为标题
  const firstSentence = text.split(/[。！？.!?\n]/)[0].trim();
  return firstSentence.slice(0, 40);
}
```

原则：**应用必须在没有 key 时完整可用**。AI 是副驾不是司机；智能到什么程度、在哪里智能，都是后续按需加，v0 不做画像、不做打分、不做内容总结。

---

## 7. API 路由（Next.js App Router）

- `GET /api/home` — Room 列表（按 importance 排序）+ 每个 Room 的今日更新数 + 最新 1–2 条 peek
- `GET /api/rooms` / `POST /api/rooms` — 取 Room 树 / 新建
- `PATCH /api/rooms/[id]` / `DELETE /api/rooms/[id]` — 改名/改重要度/改父级/排序 / 删除
- `POST /api/rooms/[id]/bindings` — 给 Room 加来源绑定
- `PATCH /api/bindings/[id]` / `DELETE /api/bindings/[id]` — 改/删绑定
- `GET /api/rooms/[id]/items?days=&before=` — 该 Room 的合并时间线（仅本 Room 绑定），按 `publishedAt desc`，支持回溯翻页
- `POST /api/refresh` — 抓取所有到期 binding；`POST /api/bindings/[id]/refresh` — 抓取单条
- `POST /api/items/manual` — 手动粘贴 X / 任意链接

**调度**：v0 = 首页"刷新"按钮调 `/api/refresh`；可选在服务启动时起一个 `setInterval` 定时抓取，或提供 `npm run fetch` 脚本。不引入队列。

---

## 8. 分阶段任务与验收标准

### Phase 0 — 脚手架 + 静态界面
搭 Next.js + TS + Tailwind + Prisma/SQLite；把 `reference/prototype.html` 复刻成 React 组件（用写死的示例数据）。
**验收**：首页方块网格、左侧可折叠嵌套导航、点击进入 Room 时间线、回溯切换、重要度方块——全部按原型渲染并可点击（数据可先写死）。

### Phase 1 — 数据层
落 schema + 迁移 + 可选 seed；实现 Room 与 SourceBinding 的增删改查；界面接 DB 取代写死数据。
**验收**：能新建 Room、加绑定、把 Room 嵌套进另一个 Room、设重要度；首页按重要度排序；重启后数据仍在（SQLite 文件持久化）。

### Phase 2 — 抓取与归并
实现通用 feed 连接器 + arxiv/github/youtube/podcast 的 URL 构造器 + 手动条目录入；`/api/refresh` 抓取→标准化→去重→入库。
**验收**：给某 Room 加一个真实博客 RSS / 一个 arXiv 查询 / 一个 GitHub 仓库 / 一个 YouTube 频道，点刷新后真实内容进入该 Room 时间线，**跨多个 binding 按 `publishedAt` 正确归并、按天分组**；再次刷新不产生重复；手动粘一条 X 链接能作为条目出现。

### Phase 3 — 时间线打磨 + 拟题
按类型渲染启动器卡片（视频缩略图、推文标题或 aiTitle、博客、播客时长）；今日/回溯切换；接入 `generateTitle`（降级 + 可选 API）。
**验收**：无标题条目自动得到 `aiTitle`（无 key 时为降级标题）；卡片样式与原型一致；回溯能向过去翻阅更早的天。

### Phase 4 —（可选）本地便利
OPML 导入、数据导出、删除单条/单源/清空、`.env` 配置可选 key。
**验收**：可导入一批 RSS、可导出与删除自己的数据。

---

## 9. v0 完成的定义（Definition of Done）

一个**能在本地运行的网站**：用户可以
1. 新建"对象式" Room（可嵌套，嵌套仅作组织、数据不互通）；
2. 为 Room 绑定真实的 RSS / arXiv / GitHub / YouTube / 播客源，并手动粘贴 X 条目；
3. 点"刷新"拉取真实内容；
4. 进入任一 Room，浏览**按时间归并**的全平台时间线，每条是启动器卡片（无标题者带 AI 或降级标题）；
5. 首页方块按**用户设定的重要度**排序；
6. 数据持久化在本地 SQLite 文件。

**不含**：账号、AI 打分/画像、AI 读全文、付费 X API。界面与交互对齐 `reference/prototype.html`。

---

## 10. 本地运行

```bash
npm install
npx prisma migrate dev --name init
npm run seed        # 可选：灌入示例 Room
npm run dev         # 打开 http://localhost:3000
# 拉取内容：点首页"刷新"，或 npm run fetch
```

`.env`（可选）：
```
ANTHROPIC_API_KEY=        # 留空也能跑；填了则用 AI 拟题
```

依赖（v0 最小集）：`next react react-dom typescript tailwindcss prisma @prisma/client rss-parser`，可选 `@anthropic-ai/sdk`。**不需要** Redis / Supabase / 队列 / 鉴权库。
