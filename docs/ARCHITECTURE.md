# Architecture

Last aligned: 2026-06-12 (post Phase 4). This document describes the system as it is,
not as it was at P0. For the decision history behind this shape, see `DECISIONS.md`.

## Tech Stack

- Next.js 14 App Router, React, TypeScript
- Prisma ORM + SQLite (local file under `data/db/`)
- Node test runner (`--experimental-strip-types`), `node:sqlite` for local scripts
- rss-parser, undici (per-request proxy dispatchers)
- playwright-core for local read-only browser-profile fetching (X, Bilibili fallback)

## Directory Structure

```text
src/app/                  App Router pages and API routes
src/components/           Client UI components
src/components/cards/     Card renderer registry, per-platform cards, shared atoms
src/lib/                  Core logic (orchestration, envelopes, pure helpers)
src/lib/platform/         Platform adapters, registry, client-safe capability table
src/lib/connectors/       Platform fetch/parse internals (pure parse + network split)
src/lib/ai/               Lightweight title generation
prisma/                   Schema and migrations (additive-only discipline)
scripts/                  Local commands (backup/export/fetch), run via --env-file
tests/                    Pure-logic suites (node --test)
docs/                     Collaboration and project docs
data/                     Local runtime data; never committed (db/backups/exports/profiles)
```

## Platform Layer

Every fetchable platform implements `PlatformAdapter` (`src/lib/platform/types.ts`):
`resolveSourceInput` (pure), `refreshLatest`, optional `backfill` / `syncTags` /
`checkAvailability`, plus `getCapabilities()` / `checkAuthRequirement()`.

- Registry: `src/lib/platform/registry.ts` maps platform → adapter; the fetchable
  platform set is derived from it. Adding a platform = one adapter file + one
  capability entry + a card renderer; the orchestrator does not change.
- Adapters keep network modules behind dynamic imports so tests can statically
  import adapter modules without side effects.
- **Client-safe rule**: UI-facing platform knowledge comes only from the static
  table in `src/lib/platform/capabilities.ts` (capabilities + auth requirements).
  Never import the registry/adapters from client code — webpack statically
  analyzes even dynamic imports and would pull server-only deps (Playwright)
  into the browser bundle. Table↔registry consistency is pinned by tests.
- Auth requirements: `x` = browserProfile (required; successful real fetch marks
  the profile `logged_in`), `bilibili` = none with optional profile fallback
  (public success never marks login), `youtube` = apiKeyOptional, feeds = none.

## Orchestration (`src/lib/fetcher.ts`)

Single per-action flow: resolve auth/network context → adapter call → window
filter → `upsertItems` → write binding state → return a `FetchReport`.

- `authCtxFor(platform, explicitProfileId?)`: profile selection is
  explicit binding reference → `isDefault` → `createdAt asc`
  (`pickAuthProfile`, pure). Channel resolution (domestic/foreign/proxy) is
  `resolveRefreshNetwork` in `src/lib/network.ts`; foreign defaults to the
  local HTTP proxy when no env proxy is set.
- `upsertItems` builds row data via pure builders in `src/lib/item-data.ts`,
  dedupes by `(roomId, externalId)`, counts failures (`failedCount`, surfaced
  in `binding.lastError` as a warning) and stamps `lastSeenAt`.
- Field write ownership (enforced by code structure and tests):

| Field | Sole writer |
|---|---|
| `customTitle`, `titleSource=custom` | user actions only; refresh never writes |
| `youtubePlaylistTags` | playlist-tag sync only |
| `lastSeenAt` | refresh/backfill upsert |
| `availability`, `lastCheckedAt`, `missingSince` | availability checker only |

## Result Envelope

`FetchReport` (`src/lib/report.ts`) is the only result type across refresh,
backfill, tag sync, auth check, and availability check. `classifyError` maps
failures to `errorCode` (network / auth_expired / profile_busy / environment /
input / quota / not_found / …). API routes pass reports through; UI strings are
produced by pure formatters (`src/lib/format-result.ts`, `formatOutcome`) and
pinned byte-exact by tests.

## Display Layer

`ItemCard` is a platform-free shell; `src/components/cards/registry.tsx`
provides per-platform hooks (srcLabel / linkLabel / media / metaExtra /
content). Shared atoms: `CardMedia` thumbs, `MediaGrid`, `LinkPreview`,
`TagList`, `StatusBadge`. Source action buttons are driven by
`sourceActionFlags` (capability table), not platform conditionals.

## Archive Status System

Items are the user's archive: refreshes never delete; deleting a Source keeps
items; deleting a Room removes its items.

- `availability` accepts **deterministic platform evidence only** (currently
  YouTube `videos.list` absence = deleted/private). "Absent from a refresh
  window" is never evidence — feeds are sliding windows.
- `missingSince` records first-seen-missing once; a later positive sighting
  self-heals (`available` + cleared `missingSince`). Unevaluated items stay
  null and are never defaulted to unavailable.
- UI: unavailable items keep their card and show a 「源头已下架」 badge.

## Backup & Export

- `npm run backup`: hot snapshot via `VACUUM INTO` on a **read-only**
  connection (safe while dev runs), then integrity_check + five-table row-count
  verification into `data/backups/`. Never auto-prunes.
- `npm run export`: read-only JSON archive (Room/RoomType/SourceBinding/Item)
  into `data/exports/`. AuthProfile is excluded by design (machine paths,
  possibly credentialed proxy URLs); a tripwire scans the bindings section.
- Scripts receive `DATABASE_URL` via `--env-file=.env` (code never reads
  `.env`); `file:` URL resolution mirrors Prisma semantics (pure, tested).

## Data Flow (current)

1. User creates Room → adds SourceBindings (optionally pinned to an AuthProfile).
2. Refresh/backfill API route → `fetcher` → adapter via registry.
3. Adapter returns `NormalizedItem[]`; orchestrator window-filters and upserts.
4. `FetchReport` flows to UI; formatters render result lines; errors carry codes.
5. Views query rows → `toItemVM` → card registry renders the timeline.

## Entry Points

- Home `src/app/page.tsx` · Room `src/app/room/[id]/page.tsx` · Settings `src/app/settings/page.tsx`
- Refresh all `api/refresh` · one source `api/bindings/[id]/refresh`
- Backfill `api/sources/[id]/backfill` · tags `api/sources/[id]/sync-playlist-tags`
- Availability `api/sources/[id]/check-availability` · auth profiles `api/auth-profiles/*`

## Invariants (product law)

1. Sources are user-chosen; nothing is fabricated.
2. The archive is never deleted by refreshes; `customTitle` is never overwritten.
3. Local-first: `data/db`, `data/browser-profiles`, backups and exports stay local.
4. Connectors are read-only; no platform write actions; no media downloading.
5. Schema migrations are additive-only (`ADD COLUMN`); table rebuilds require a
   dedicated reviewed window with a verified backup.

## Architecture Risks

- X scraping depends on current GraphQL shapes (drift is absorbed in
  `xpost.ts` pure parsers with dual-shape fixtures; structural skeleton
  diagnosis is the established playbook).
- Browser-profile automation can fail when a login window holds the profile
  (mapped to friendly `profile_busy` messaging).
- SQLite is local-first; multi-user hosting would need a redesign.
- Remote execution (Phase 5) is not built; foreign refreshes depend on a local
  HTTP proxy today.
