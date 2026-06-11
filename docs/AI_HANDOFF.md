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

### Feed-Style Sources

Status: latest refresh is routed through thin platform adapters.

- RSS, podcast, GitHub releases Atom, and arXiv latest refresh now have `PlatformAdapter` entries.
- Feed adapters are latest-only; backfill remains unsupported with the existing user-facing message.
- Fetchable platform membership is derived from the adapter registry instead of a separate fetcher list.
- Local verification on 2026-06-11: a temporary RSS Room/binding refreshed successfully, feed backfill returned the expected unsupported error, full refresh included the RSS binding, and the temporary Room was deleted after validation.

## 5. Current Known Problems

- Existing X Items already stored before the quote-card mapping fix are not rewritten automatically.
- X quote extraction is still incomplete. Local G1 prep stats on 2026-06-11 for the real `@elonmusk` Room: 86 quote items, 0 missing raw, 0 missing `quoted`, 86 with `quoted.url` missing, 0 normal quoted URLs, and 0 link cards. This points to quote URL synthesis/parsing rather than display fallback.
- `npm run build` can warn that Google Fonts CSS download optimization failed when external network access to fonts.googleapis.com is flaky; build still completes.
- X Debug Panel is optional observability work, not the current blocker.
- Remote Fetch Worker has not been implemented.
- P1 availability / unavailable state has not been implemented.
- Backup script has not been implemented.

## 6. Current Next Task

Recommended next task: G1, diagnose and fix X quote-card extraction using the field-shape stats above. Do not change the F3 display shell while doing G1.

Follow-up direction:

- X, Bilibili, YouTube, RSS, podcast, GitHub, and arXiv now have `PlatformAdapter` implementations and registry entries.
- `fetchForBinding` now dispatches through the adapter registry for all fetchable platforms.
- Fetchability is derived from the registry.
- `src/lib/report.ts` now provides shared error-code classification and a future `FetchReport` envelope; legacy result types remain in place until the Phase 2 UI ResultLine window.
- Phase 2 F1 extracted shared card atoms (`CardMedia`, `MediaGrid`, `LinkPreview`, `TagList`) and pure helpers without changing card rendering conditions.
- Phase 2 F2 moved X content blocks (`MediaGrid`, `LinkPreview`, quote fallback) into `XPostCard`; `ItemCard` now mounts the X content area as a single branch.
- Phase 2 F3 moved remaining platform card knowledge into `src/components/cards/registry.tsx` plus pure label helpers. `ItemCard` is now a shell with no platform string literals; rendering class structure was curl-diff checked against the pre-F3 page.
- Preserve the working Phase 0 behavior for YouTube, Bilibili, and X.
- Carry `truncate()` or its successor into the future `NormalizedItem` validation boundary before DB writes.
- Continue after G1 with Phase 2 F4: ResultLine + capabilities-to-UI and legacy result type consolidation.
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
- Date: 2026-06-11 12:52:36 CST
- Current status: Repository is on private GitHub `main`; Phase 2 Task F3 is implemented locally and awaiting user approval to push. F2 commit `934595f` was pushed. `ItemCard` is now a platform-agnostic shell that dispatches media/meta/content/link labels through `src/components/cards/registry.tsx`. CSS, `src/lib/**`, API routes, schema, and platform logic remain unchanged.
- What changed: Added pure card label helpers in `src/components/cards/labels.ts`; added the per-platform card renderer registry in `src/components/cards/registry.tsx`; split `CardMedia.tsx` into `VideoThumb`, `XVideoThumb`, and `IconTile`; rewired `ItemCard.tsx` to use the registry; extended card label tests. `ItemCard` grep confirms no platform string literal remains.
- Tests run: `node --test --experimental-strip-types --experimental-sqlite tests/cards.test.ts` passed with 5/5 tests; `npm test` passed with 161/161 tests; `npm run build` passed.
- Verification results: Pre/post curl class extraction on the real X Room produced identical relevant class sequences (`beforeCount=175`, `afterCount=175`, `equal=true`). Browser verification on the real X Room covered text/quote fallback and AI-pill rendering (`items=12`, `quoteFallback=10`, `brokenImages=0`, no console errors/warnings). Because current real YouTube/Bilibili items are outside the "today" view and automated clicking did not switch the segmented control, a temporary `Codex Temp F3 Visual ...` Room was created for UI branch verification and then deleted. It covered YouTube normal + Shorts labels, Bilibili normal + Short labels with `referrerPolicy=no-referrer` on both thumbnails, X text/video/link/image/quote fallback, podcast duration chip, RSS/arXiv/GitHub square cards, and manual link label `打开链接`; final temp-room metrics were `items=14`, `thumbs=5`, `plays=5`, `durs=4`, `linkCards=1`, `mediaGrids=1`, `quoteFallback=1`, `biliNoReferrerImgs=2`, `brokenImages=0`, no console errors/warnings. The temporary Room was deleted and `remainingTempRooms=0`.
- G1 prep stats: real `@elonmusk` quote items: `quoteItems=86`, `rawMissingOrInvalid=0`, `quotedNull=0`, `quotedUrlNull=86`, `quotedUrlNormal=0`, `linkCardCount=0`, link-card domain distribution `{}`.
- Known failures: No active Phase 0 P0 blocker observed. X quote extraction is still incomplete as described in §5. X latest can still have occasional transient SPA/network failures that pass on retry; record `binding.lastError` and `errorCode` in this file whenever it recurs.
- Next recommended task: G1, fix X quote URL/card extraction based on the field-shape stats, then continue Phase 2 F4.
- Summary: Phase 2 F3 keeps card HTML stable while moving platform-specific card presentation out of `ItemCard` and into a registry.
