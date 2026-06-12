# SourceLens AI Handoff

## 0. Purpose

This file is the shared context file for ChatGPT Pro, Claude 20x, Codex, and Claude Cowork Pro.

All AI collaborators must read this file before acting. Local executors must update it after meaningful local work so the next AI starts from the same facts.

## 1. Project Identity

SourceLens is a personal source-first information system. It helps the user follow sources they explicitly choose instead of accepting platform recommendation feeds.

Core product objects:

- Folder: a structural section for organizing rooms.
- Room: one attention object, such as a person, company, lab, project, or topic.
- Source: one platform/feed attached to a Room.
- Item: one normalized timeline card from a source.
- Timeline: Room items merged by timestamp.

SourceLens is designed around user-controlled sources, not platform ranking. Captured content is part of the user's local information profile. Do not fake Rooms, Sources, or Items to make a feature appear complete. Do not upload `.env`, `data/db`, or `data/browser-profiles`.

## 2. Current Tech Stack

- Next.js 14 App Router
- React
- TypeScript
- Prisma
- SQLite
- Playwright / `playwright-core`
- `undici`
- `rss-parser`
- Node >= 20

## 3. Core Architecture

- Folder: a structural partition. It organizes the sidebar/tree and does not collect content directly.
- Room: a content room. It owns source bindings and shows a unified timeline.
- RoomType: user-defined or built-in content type metadata for Rooms.
- SourceBinding: one platform/source configuration attached to one Room.
- Item: a normalized timeline card, with platform metadata, media, links, timestamps, and dedupe keys.
- AuthProfile: a local browser login profile for platforms that need user-owned login state.
- `data/db`: local SQLite storage. It is private local data and must not be uploaded.
- `data/browser-profiles`: local Playwright/Chromium login state. It is private local auth state and must not be uploaded.
- Platform runtime adapters live behind the server-side registry. UI-facing platform knowledge must come only from the client-safe static capability table in `src/lib/platform/capabilities.ts`; do not import the registry or adapters from client components or client-safe helpers. Dynamic imports are still statically analyzed by webpack and can leak server-only dependencies such as Playwright into the client bundle. Consistency between the static table and runtime adapters is pinned by `tests/platform.test.ts`.

## 4. Platform Status

### YouTube

Status: usable. Latest refresh, backfill, playlist-tag sync, and availability checking.

- Inputs: `@handle`, channel links, `UC...` IDs. Dedupe `externalId=videoId`.
- Per-request HTTP proxy dispatcher (foreign default `http://127.0.0.1:33210` when no env proxy); network failures carry Chinese guidance, never bare `fetch failed`.
- Normal videos + Shorts (`videoKind`, with deprecated `youtubeKind` read-fallback); playlists are tags, not cards.
- Availability: `videos.list` absence marks items `unavailable` with a 「源头已下架」 badge; re-sighting self-heals.

### Bilibili

Status: P0 usable.

- UP owner public videos; logged-in browser-profile fallback; WBI signing fixed; thumbnails use `referrerPolicy=no-referrer`.
- No downloader; no comments/danmaku/dynamics/articles; availability checking deliberately deferred (rate-safe evidence design needed).

### X

Status: usable through the local logged-in profile. ~264 real items including 212 quote cards.

- Parses text/image/video/link/quote; replies and reposts filtered by default.
- Login check returns `needs_check` when uncertain (never false `expired`); profile-busy maps to a friendly message; successful refresh marks the profile `logged_in`.
- Quote extraction supports both legacy and `result.core` user shapes, prefers `quoted_status_permalink`, normalizes twitter.com→x.com, dedupes quote links; excerpts strip trailing bare t.co; emoji-safe truncation before all DB writes.

### Feed-Style Sources

Status: RSS / podcast / GitHub releases / arXiv latest refresh via thin adapters (latest-only; backfill intentionally unsupported).

## 5. Current Known Problems

- Transient platform/network failures (X SPA timing, occasional YouTube HTTP 404/500, GitHub transport hiccups) pass on retry; they now carry `errorCode` — record recurring patterns here with `binding.lastError`.
- `npm run build` may warn about Google Fonts download optimization when fonts.googleapis.com is flaky; build still completes.
- X image-grid rendering has no live local sample yet (logic covered by tests; verify visually when an image post lands).
- Bilibili/X/RSS availability checking is deliberately not implemented (deterministic-evidence rule).
- Remote Fetch Worker (Phase 5) is not implemented; foreign refreshes depend on the local HTTP proxy.
- Archive import (to pair with export) is not implemented.

## 6. Current Next Task

Usage observation period: use the system daily; record recurring pain into §5. Next build phase is chosen by observed need — see `docs/ROADMAP.md` "Next candidates" (Phase 5 remote worker needs a server decision; small pool items have foundations laid).

## 7. Role Split Between AIs

### ChatGPT Pro

- Product and architecture judgment.
- Prompt design.
- Multi-AI coordination.
- Requirement decomposition.
- Review Claude/Codex output before risky work.

### Claude 20x Web / Claude Code (cloud sandbox)

- Writes and self-tests most code on branch `claude/amazing-ride-oa1jss` (runs full `npm test` / `npm run build` in the sandbox; rehearses migrations on synthetic data).
- Designs phases, writes review documents before risky work, reviews merged diffs.
- Pushes only to its own branch, never directly to `main`.
- Cannot touch local `.env`, `data/db`, `data/browser-profiles`, or real platform sessions; never claims real-machine verification.

### Codex Local (verifier / merger)

- Pulls the Claude branch, re-runs tests/build locally, performs real-machine verification (profiles, real DB stats, UI walkthroughs) per checklist.
- Stops on verification anomalies and reports back; retries transient git transport errors per the documented rule.
- Merges to `main` after user confirmation (AI_HANDOFF conflicts: branch version wins) and pushes.
- Executes DB migrations only after a verified backup; updates this file after meaningful local work.
- Does not read cookies or `.env`.

### Claude Cowork Pro Local

- Local collaborative code editing.
- Best for UI work and small to medium fixes.
- Can read the local project.
- Must read `docs/AI_HANDOFF.md` before acting.
- Must update `docs/AI_HANDOFF.md` after meaningful local work.
- Should not edit the same batch of files at the same time as Codex.

## 8. Safety Rules

- Do not read `.env`.
- Do not print API keys.
- Do not read Cookies files.
- Do not print cookies.
- Do not upload `data/db`.
- Do not upload `data/browser-profiles`.
- Do not run `npm run reset:user-data` unless the user explicitly requests it.
- Do not run `npm run seed` or `npm run seed:demo` unless the user explicitly requests it.
- Do not perform platform write actions: posting, liking, reposting, commenting, following, private messaging, coin/tip/vote actions, or similar.
- Do not download X or Bilibili video files.
- Do not force push.
- Do not rewrite remote repository history.
- Do not casually upgrade Prisma major versions.
- Do not run `npm audit fix --force`.

## 9. Local Commands

Install dependencies:

```bash
npm install
# or
npm ci
```

Database setup:

```bash
npx prisma migrate dev
npx prisma generate
```

Run locally:

```bash
npm run dev
```

Test and build:

```bash
npm test
npm run build
```

When switching to a branch with Prisma schema changes, run `npx prisma generate` before `npm run build`; generating the client updates local types only and does not touch the database.

If GitHub HTTPS fetch/pull/push fails with a transient transport error such as `HTTP2 framing layer`, retry up to 4 times with backoff. If it repeats, use a one-command fallback such as `git -c http.version=HTTP/1.1 fetch origin <branch>`; do not change global git config unless the user asks.

Data scripts:

```bash
npm run backup
```

Safe anytime (hot backup): VACUUM INTO snapshot under `data/backups/` + integrity/row-count verification. Old backups are never auto-deleted.

```bash
npm run export
```

Read-only archive export (Room/RoomType/SourceBinding/Item; AuthProfile excluded by design) to `data/exports/`.

```bash
npm run reset:user-data
```

Danger: resets local user data. Run only when the user explicitly requests it.

```bash
npm run seed:empty
```

Changes local database contents. Run only when the user explicitly requests it.

```bash
npm run seed:demo
```

Danger: writes demo/sample data. Run only when the user explicitly requests it.

## 10. GitHub / Repo Rules

- GitHub repo: https://github.com/HappyYee/SourceLens
- Main branch: `main`
- Repository visibility: private for now.
- Do not commit `.env`, `data/`, `node_modules/`, `.next/`, local databases, browser profiles, or generated caches.
- After local execution work, update `docs/AI_HANDOFF.md` when the shared state changes, then commit and push if the user asks.

## 11. Update Protocol

Every local AI executor must update this file after meaningful actual work. Update:

- Last updated
- Current status
- What changed
- Tests run
- Known failures
- Next recommended task

Web AI collaborators working read-only should not update this file unless the user explicitly asks.

## 12. Last Updated

- Updated by: Codex Local Executor
- Date: 2026-06-13 (Asia/Shanghai)
- Current status: UX batch U3 (settings overhaul + sidebar drag-move) has been locally verified and merged to `main`; no schema changes. UX batches U1/U2/U3 are complete. U4 small pool remains optional and should be demand-driven.
- What changed: ① Settings page split into four URL-param tabs (结构/类型/登录态/数据); sidebar 「＋新建」 deep-links to the structure tab with the create form auto-expanded. ② 所有节点 rebuilt: read-only rows (name · kind · type chip · importance dots · counts) with collapsible folder subtrees and a single inline edit panel per row (type/importance/parent/delete live only inside edit); create form collapsed by default; old SettingsManager deleted in favor of NodeManager + TypeManager. ③ Type management: key auto-generated from display name (`uniqueTypeKey`, route accepts key-less POST), unused builtin types collapsed behind a toggle. ④ Danger zone: 清空全部数据 moved into a separate red-bordered zone requiring typed confirmation 「清空」, with a backup reminder; export/OPML stay in 数据管理. ⑤ Sidebar drag-move (native HTML5 DnD, zero deps): drag onto a Room = place after it (same parent), onto a folder = move inside (end), onto the bottom 「顶层」 strip (appears while dragging) = move to top level; `POST /api/rooms/[id]/move` with pure `wouldCreateCycle`/`planSiblingOrder` (cycle-guarded, folder-only parents, sibling reindex ×10). Note: folders always sort before rooms among siblings (existing tree semantic), so dragging reorders within each group.
- Tests run: `npx prisma generate`; `npm test` 197/197; `npm run build` passed.
- Local verification: Settings tabs `/settings?tab=structure|types|auth|data` loaded with the expected headings; sidebar 「＋ 新建分区 / Room」 deep-linked to `?tab=structure&new=1` with the create form expanded. Node rows showed read-only structure with foldable folders; folder edit and room edit panels exposed the expected controls (room type/importance/parent/delete for rooms; parent/delete for folders) and 「完成」 collapsed the panel. Type tab UI created a temporary Chinese-name type with generated key `type`, expanded/collapsed 「显示未使用的内置类型（5）」, then deleted the temporary type. Data tab danger zone was present; the destructive route was not called when the confirmation word was wrong. Sidebar move semantics were verified on temporary nodes via the same `/api/rooms/[id]/move` endpoint used by drag handlers: same-parent reorder, move into folder, move to top level, and cycle rejection (`不能移入自身或其子分区`) all landed correctly; temporary nodes were cleaned up. Home unread feed/badges were visible. X/Bilibili/YouTube latest each returned HTTP 200, `ok=true`, `failedCount=0`.
- Known failures: none in code/API validation. Browser tooling could not complete native HTML5 drag/prompt interactions directly, so drag persistence was verified through the shared move API + DB and Sidebar event wiring; final hand-eye visual drag polish can be rechecked in the user's normal browser if desired.
- Next recommended task: usage observation resumes; U4 small pool (date-format unification, folder aggregation view, global read-all, export双轨合一) on demand.
- Summary: U3 — settings structure management is calm (read-only rows, edit on demand), direct (sidebar move semantics landed), and safer (destructive data action isolated behind a confirmation zone).
