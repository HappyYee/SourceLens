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

## 4. Platform Status

### YouTube

Status: usable and locally verified after the per-request proxy fix.

- Supports `@handle`, channel links, and `UC...` channel IDs.
- Supports latest refresh.
- Supports backfill.
- Latest refresh, backfill, and playlist-tag sync now pass an explicit per-request HTTP proxy dispatcher from `resolveRefreshNetwork`.
- If no proxy env var is exported, YouTube foreign refresh falls back to `http://127.0.0.1:33210`, matching the X foreign-refresh default.
- YouTube network failures are wrapped with Chinese guidance instead of leaking bare `fetch failed`.
- Local verification on 2026-06-11: with dev started from a shell without exported proxy env vars, the `@MeiTouJun` source latest refresh, backfill, and playlist-tag sync all succeeded without bare `fetch failed`.
- Supports normal videos and Shorts.
- Playlists are used as tags, not as timeline cards.
- Dedupe key is `externalId=videoId`.
- `customTitle` is not overwritten by refreshes.

### Bilibili

Status: P0 usable.

- UP owner public videos can be fetched.
- Logged-in browser-profile fallback is working for current tested cases.
- WBI `wts` duplicate-append bug has been fixed.
- Thumbnail hotlink/referrer issue has been handled with `referrerPolicy=no-referrer`.
- Real Bilibili Items exist in the local database.
- Do not add downloader behavior.
- Do not add comments, danmaku, dynamic posts, articles, or columns in the current P0 lane.

### X

Status: P0 can fetch real posts; login-state display and emoji-safe write path have been locally verified.

- `@elonmusk` has been fetched successfully with 100 local items after backfill.
- Code can parse text, image, video, link, and quote posts.
- Replies and reposts are filtered by default.
- `AuthProfile` `checkLoginStatus` no longer treats missing SPA account-menu UI as `expired`; uncertain states return `needs_check`.
- `SingletonLock` / profile-busy launch errors now map to a friendly message instead of a long Chromium log.
- Successful X refresh/backfill now marks the X `AuthProfile` as `logged_in` to clear stale expired UI.
- Quote cards now dedupe quoted-tweet URLs, prefer quoted `screen_name` for titles, strip trailing bare `t.co` links from excerpts, and render a fallback quote line if no x.com quote card is present.
- Local verification on 2026-06-11: Settings check shows logged in after refresh, profile-busy shows a friendly message when the X login window is open, and repeated refresh keeps X item `externalId` count equal to distinct count.
- DB-bound truncation now uses `src/lib/text.ts` `truncate()` so emoji surrogate pairs are not split before Prisma/SQLite writes.

## 5. Current Known Problems

- Existing X Items already stored before the quote-card mapping fix are not rewritten automatically.
- `npm run build` can warn that Google Fonts CSS download optimization failed when external network access to fonts.googleapis.com is flaky; build still completes.
- X Debug Panel is optional observability work, not the current blocker.
- Remote Fetch Worker has not been implemented.
- P1 availability / unavailable state has not been implemented.
- Backup script has not been implemented.

## 6. Current Next Task

Recommended next task: Phase 1 Task D, add thin feed adapters and finish the `fetchForBinding` platform switch cleanup after the user provides the Task D prompt.

Follow-up direction:

- X, Bilibili, and YouTube now have `PlatformAdapter` implementations and registry entries.
- Move RSS/podcast/GitHub/arXiv feed-style sources into thin adapters.
- Derive fetchability from the registry after feeds are migrated, then remove the remaining `fetchForBinding` if-chain.
- Preserve the working Phase 0 behavior for YouTube, Bilibili, and X.
- Carry `truncate()` or its successor into the future `NormalizedItem` validation boundary before DB writes.
- Do not start schema migrations unless the user explicitly provides a migration prompt.
- Consider an X Debug Panel later for deeper observability, but it is not required for this fix.

## 7. Role Split Between AIs

### ChatGPT Pro

- Product and architecture judgment.
- Prompt design.
- Multi-AI coordination.
- Requirement decomposition.
- Review Claude/Codex output before risky work.

### Claude 20x Web / Claude Code

- Read GitHub context.
- Understand large context and propose broad plans.
- Produce complete patch plans.
- Perform code review.
- Do not depend on local `.env`, `data/db`, or `data/browser-profiles`.
- Do not claim real platform verification unless a local executor actually ran it.

### Codex Local

- Local execution.
- Run real `npm test` / `npm run build`.
- Debug real Bilibili / X / Playwright behavior when requested.
- Update `docs/AI_HANDOFF.md` after meaningful local work.
- Commit and push when requested and safe.
- Do not read cookies or `.env`.

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

Data scripts:

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

- Updated by: Codex Local
- Date: 2026-06-11 02:54:10 CST
- Current status: Repository is on private GitHub `main`; Phase 1 Task C is implemented locally. X, Bilibili, and YouTube latest refresh now route through `PlatformAdapter` + registry; YouTube backfill and sync-tags also go through the YouTube adapter while feed-style sources, schema, UI, and connector internals remain unchanged.
- What changed: Added `src/lib/platform/youtube.ts`; extended `PlatformAdapter` with optional `syncTags`; registered the YouTube adapter; removed the dedicated YouTube latest branch from `fetcher.ts`; routed YouTube backfill and playlist tag fetching through the adapter; kept tag assignment and `youtubePlaylistTags` persistence in `fetcher.ts`; expanded platform adapter tests. `connectors/index.ts` and `connectors/youtube.ts` were not modified.
- Tests run: `node --test --experimental-strip-types --experimental-sqlite tests/platform.test.ts` passed; `npm test` passed with 145/145 tests; `npm run build` passed.
- Verification results: YouTube latest passed with `added=0`, `updated=15`, `failedCount=0`, `networkLabel=国外刷新`; YouTube backfill passed with `createdCount=0`, `updatedCount=50`, `failedCount=0`, `skippedCount=0`, `fetchedCount=50`, `pageCount=1`, `hasMore=true`, `shortsCount=0`, `playlistTaggedCount=49`; YouTube sync-tags passed with `taggedCount=49`, `playlistCount=20`; Bilibili latest passed with `updated=50`, `failedCount=0`; X latest passed on first try with `added=1`, `updated=39`, `failedCount=0`, so no transient X `lastError` was recorded this round. Final counts: YouTube `totalExternalIds=50/distinct=50`, Bilibili `50/50`, X `101/101`.
- Known failures: No active Phase 0 P0 blocker observed. Existing X Items outside the verified `@elonmusk` backfill window may still need a future refresh/backfill to receive newer quote-card normalization. X latest can still have occasional transient SPA/network failures that pass on retry; record `binding.lastError` in this file whenever it recurs before Task E lands.
- Next recommended task: Wait for the user's Phase 1 Task D prompt, then migrate feed-style adapters and derive fetchability from the registry.
- Summary: Phase 1 adapter boundary now covers X, Bilibili, and YouTube, including YouTube sync-tags, while preserving the YouTube proxy/API-key behavior and connector internals.
