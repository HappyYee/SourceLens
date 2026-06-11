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

Status: usable and locally verified after the per-request proxy fix.

- Supports `@handle`, channel links, and `UC...` channel IDs.
- Supports latest refresh.
- Supports backfill.
- Latest refresh, backfill, and playlist-tag sync now pass an explicit per-request HTTP proxy dispatcher from `resolveRefreshNetwork`.
- If no proxy env var is exported, YouTube foreign refresh falls back to `http://127.0.0.1:33210`, matching the X foreign-refresh default.
- YouTube network failures are wrapped with Chinese guidance instead of leaking bare `fetch failed`.
- Local verification on 2026-06-11: with dev started from a shell without exported proxy env vars, the `@MeiTouJun` source latest refresh, backfill, and playlist-tag sync all succeeded without bare `fetch failed`.
- G1 retry on 2026-06-11: the same three YouTube latest-refresh bindings that had transiently returned `HTTP 404` / `HTTP 500` were retried successfully; each returned `updated=15` and `lastError=null`.
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

- `@elonmusk` has been fetched successfully with 264 local items after G1 backfill.
- Code can parse text, image, video, link, and quote posts.
- Replies and reposts are filtered by default.
- `AuthProfile` `checkLoginStatus` no longer treats missing SPA account-menu UI as `expired`; uncertain states return `needs_check`.
- `SingletonLock` / profile-busy launch errors now map to a friendly message instead of a long Chromium log.
- Successful X refresh/backfill now marks the X `AuthProfile` as `logged_in` to clear stale expired UI.
- Quote cards now support X's newer `user_results.result.core.{name,screen_name}` structure, prefer `legacy.quoted_status_permalink.expanded` for quoted URLs, normalize `twitter.com` / `x.com` status URLs to `x.com`, dedupe quoted-tweet URLs, prefer quoted `screen_name` for titles, strip trailing bare `t.co` links from excerpts, and render a fallback quote line only when no x.com quote card is present.
- Local verification on 2026-06-11: Settings check shows logged in after refresh, profile-busy shows a friendly message when the X login window is open, and repeated refresh keeps X item `externalId` count equal to distinct count.
- Local G1 verification on 2026-06-11: real `@elonmusk` quote stats moved from `quotedUrlNull=86`, `quotedUrlNormal=0`, `linkCardCount=0` to `quotedUrlNull=0`, `quotedUrlNormal=212`, `linkCardCount=213`, `linkCardDomains={x.com:212,grok.com:1}` after latest + two backfill attempts. Total/distinct X item count is `264/264`.
- DB-bound truncation now uses `src/lib/text.ts` `truncate()` so emoji surrogate pairs are not split before Prisma/SQLite writes.

### Feed-Style Sources

Status: latest refresh is routed through thin platform adapters.

- RSS, podcast, GitHub releases Atom, and arXiv latest refresh now have `PlatformAdapter` entries.
- Feed adapters are latest-only; backfill remains unsupported with the existing user-facing message.
- Fetchable platform membership is derived from the adapter registry instead of a separate fetcher list.
- Local verification on 2026-06-11: a temporary RSS Room/binding refreshed successfully, feed backfill returned the expected unsupported error, full refresh included the RSS binding, and the temporary Room was deleted after validation.

## 5. Current Known Problems

- `npm run build` can warn that Google Fonts CSS download optimization failed when external network access to fonts.googleapis.com is flaky; build still completes.
- X Debug Panel is optional observability work, not the current blocker.
- Remote Fetch Worker has not been implemented.
- P1 availability / unavailable state has not been implemented.
- Backup script has not been implemented.

## 6. Current Next Task

Recommended next task: Phase 2 F4b, legacy result type consolidation / `FetchReport` unification. F4a has already connected Source action UI to the client-safe capability table and extracted result formatters.

Follow-up direction:

- X, Bilibili, YouTube, RSS, podcast, GitHub, and arXiv now have `PlatformAdapter` implementations and registry entries.
- `fetchForBinding` now dispatches through the adapter registry for all fetchable platforms.
- Fetchability is derived from the registry.
- `src/lib/report.ts` now provides shared error-code classification and a future `FetchReport` envelope; legacy result types remain in place until Phase 2 F4b.
- Phase 2 F1 extracted shared card atoms (`CardMedia`, `MediaGrid`, `LinkPreview`, `TagList`) and pure helpers without changing card rendering conditions.
- Phase 2 F2 moved X content blocks (`MediaGrid`, `LinkPreview`, quote fallback) into `XPostCard`; `ItemCard` now mounts the X content area as a single branch.
- Phase 2 F3 moved remaining platform card knowledge into `src/components/cards/registry.tsx` plus pure label helpers. `ItemCard` is now a shell with no platform string literals; rendering class structure was curl-diff checked against the pre-F3 page.
- Phase 2 G1 fixed X quote URL/card extraction in the pure parser after confirming real GraphQL structure: `screen_name` / `name` are under `user_results.result.core`, `legacy.quoted_status_permalink.{url,expanded,display}` exists, and the sampled `quoted_status_result.result` was a direct Tweet object rather than a `TweetWithVisibilityResults` wrapper.
- Phase 2 F4a moved Source action visibility to capabilities and result message formatting to pure helpers. The client-safe capability table is the UI source of truth; the server adapter registry remains the runtime source of truth, with tests enforcing that they stay equal.
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

- Updated by: Claude 20x Web Architect (Claude Code cloud sandbox, branch `claude/amazing-ride-oa1jss`)
- Date: 2026-06-12 (UTC sandbox time)
- Current status: Phase 4 (backup + export) implemented on the branch; awaiting Codex local verification and merge. No schema changes.
- What changed: `npm run backup` — hot SQLite snapshot via `VACUUM INTO` on a read-only connection (physically cannot mutate the source; safe with dev running), written to `data/backups/sourcelens-<ts>.db`, then integrity_check + five-table row-count comparison; never auto-deletes old backups; prints restore instructions. `npm run export` — read-only JSON export of Room/RoomType/SourceBinding/Item to `data/exports/`; AuthProfile excluded entirely (profileDir is machine-local, proxyUrl may embed credentials); a sensitive-key tripwire scans the bindings section only (not items.raw, which is user content and may legitimately contain such substrings). Scripts are `.mts` run via `--env-file=.env` (code never reads `.env` itself); DB path resolution mirrors Prisma file:-URL semantics via pure `resolveSqliteUrl` (tested). `data/backups/` added to `.gitignore`; storage.ts manages the new dir.
- Sandbox rehearsal: backup integrity=ok with row counts matching across Room/RoomType/SourceBinding/Item/AuthProfile; export counts correct with schema fingerprint = latest migration name; exported JSON contains no profileDir/proxyUrl/proxyMode.
- Tests run (sandbox): `npm test` 186/186; `npm run build` passed. Pending Codex: hot backup on the real DB with dev running, export sensitive-key grep, gitignore check.
- Known failures: none in sandbox.
- Next recommended task: Codex verifies and merges to `main`. Afterwards per roadmap: Phase 5 remote fetch worker design review (noAuth/apiKey foreign sources only), or accumulated small items if preferred.
- Summary: Phase 4 — one-command hot backup with verification and a credentials-free archive export; the 3a manual backup procedure is now codified.
