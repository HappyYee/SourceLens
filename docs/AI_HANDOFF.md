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

Status: usable.

- Supports `@handle`, channel links, and `UC...` channel IDs.
- Supports latest refresh.
- Supports backfill.
- Latest refresh, backfill, and playlist-tag sync now pass an explicit per-request HTTP proxy dispatcher from `resolveRefreshNetwork`.
- If no proxy env var is exported, YouTube foreign refresh falls back to `http://127.0.0.1:33210`, matching the X foreign-refresh default.
- YouTube network failures are wrapped with Chinese guidance instead of leaking bare `fetch failed`.
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

Status: P0 can fetch real posts; login-state display fix has been implemented in code.

- `@elonmusk` has been fetched successfully with 40 posts.
- Code can parse text, image, video, link, and quote posts.
- Replies and reposts are filtered by default.
- `AuthProfile` `checkLoginStatus` no longer treats missing SPA account-menu UI as `expired`; uncertain states return `needs_check`.
- `SingletonLock` / profile-busy launch errors now map to a friendly message instead of a long Chromium log.
- Successful X refresh/backfill now marks the X `AuthProfile` as `logged_in` to clear stale expired UI.
- Quote cards now dedupe quoted-tweet URLs, prefer quoted `screen_name` for titles, strip trailing bare `t.co` links from excerpts, and render a fallback quote line if no x.com quote card is present.

## 5. Current Known Problems

- Existing X Items already stored before the quote-card mapping fix are not rewritten automatically.
- X login-state and profile-busy fixes still need real local profile hand verification in the Settings UI.
- YouTube proxy fix still needs real local hand verification against the affected `@MeiTouJun` source in a dev shell without exported `HTTPS_PROXY`.
- X Debug Panel is optional observability work, not the current blocker.
- Remote Fetch Worker has not been implemented.
- P1 availability / unavailable state has not been implemented.
- Backup script has not been implemented.

## 6. Current Next Task

Recommended next task: hand-verify YouTube refresh/backfill/playlist-tag sync in the local UI.

Verification direction:

- Start `npm run dev` from a shell without exported `HTTPS_PROXY`; refresh `https://www.youtube.com/@MeiTouJun`.
- Verify latest refresh no longer shows bare `fetch failed`.
- Verify backfill and playlist-tag sync also use the same proxy behavior.
- If the local HTTP proxy is not listening on `127.0.0.1:33210`, export the actual `HTTPS_PROXY` and record the port as a follow-up.
- Confirm Bilibili and X behavior is unchanged.
- With a logged-in `x-main` profile, Settings -> X -> "检查登录状态" should show logged in, or `needs_check` only if genuinely uncertain.
- With the X login window still open, check/refresh should show a friendly profile-busy message.
- Refreshing the `@elonmusk` Source successfully should mark the X `AuthProfile` as `logged_in`.
- Room timeline quote cards should either show a quoted x.com card or the fallback "引用了一条推文".
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
- Date: 2026-06-10 23:06:58 CST
- Current status: Repository is on private GitHub `main`; YouTube, Bilibili P0, and X P0 are usable. YouTube per-request proxy support is implemented locally for latest refresh, backfill, and playlist-tag sync.
- What changed: YouTube connector functions now accept an optional per-request `proxyUrl`, use an undici dispatcher when it is an HTTP(S) proxy, and wrap YouTube network failures with Chinese guidance. `fetcher.ts` now passes the `resolveRefreshNetwork` proxy into YouTube refresh/backfill/tag sync.
- Tests run: `node --test --experimental-strip-types --experimental-sqlite tests/proxy.test.ts` passed; `node --test --experimental-strip-types --experimental-sqlite tests/network.test.ts` passed; `npm test` passed with 128/128 tests; `npm run build` passed.
- Known failures: No automated test failure observed. Real local YouTube hand verification is still pending in a dev shell without exported `HTTPS_PROXY`.
- Next recommended task: Verify YouTube latest refresh, backfill, and playlist-tag sync against the affected source in the local browser.
- Summary: YouTube network path aligned with X-style explicit proxy resolution without schema changes or new dependencies.
