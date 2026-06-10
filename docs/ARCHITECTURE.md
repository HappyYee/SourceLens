# Architecture

## Tech Stack

- Next.js 14 App Router
- React
- TypeScript
- Prisma ORM
- SQLite local database
- Node test runner
- rss-parser
- playwright-core for local read-only browser-profile access
- undici for network and proxy handling

## Directory Structure

```text
src/app/                 App Router pages and API routes
src/components/          Client UI components
src/lib/                 Core logic
src/lib/connectors/      Platform fetch/parse connectors
src/lib/ai/              Lightweight title generation
prisma/                  Schema, migrations, local scripts
tests/                   Unit and integration-style logic tests
docs/                    Collaboration and project docs
reference/               Prototype/spec reference material
scripts/                 Local helper scripts
data/                    Local runtime data; not committed
```

## Core Modules

- `src/lib/data.ts`: database reads and view-model assembly.
- `src/lib/map.ts`: DB row to view model mapping.
- `src/lib/view.ts`: timeline grouping, sorting, formatting, display-title logic.
- `src/lib/fetcher.ts`: refresh/backfill orchestration and item upsert semantics.
- `src/lib/normalize.ts`: feed entry normalization.
- `src/lib/connectors/index.ts`: RSS, arXiv, GitHub, YouTube helpers.
- `src/lib/connectors/bilibili.ts`: Bilibili pure parsing, WBI signing, item mapping.
- `src/lib/connectors/bilibili-net.ts`: Bilibili network and browser-profile fallback.
- `src/lib/connectors/xpost.ts`: X pure parsing and item mapping.
- `src/lib/connectors/x-scrape.ts`: X Playwright GraphQL interception.
- `src/lib/browser.ts`: local persistent browser profile lifecycle.
- `src/lib/network.ts` and `src/lib/proxy.ts`: domestic/foreign refresh channel and proxy behavior.

## Data Flow

1. User creates a Room.
2. User adds one or more SourceBindings to the Room.
3. Refresh or backfill calls an API route.
4. API route calls `refreshBinding`, `refreshDue`, or `backfillBinding`.
5. `fetcher.ts` chooses the connector by platform.
6. Connector returns `NormalizedItem[]`.
7. `fetcher.ts` upserts by `(roomId, externalId)` without deleting missing remote items.
8. Room views query DB rows, map to `ItemVM`, group by day, and render `ItemCard`.

## State Flow

- Durable state: SQLite database under `data/db/`.
- Private browser state: Playwright profiles under `data/browser-profiles/`.
- Runtime build/cache state: `.next/`, `tsconfig.tsbuildinfo`, and caches.
- None of the above should be committed.

## Entry Points

- Home: `src/app/page.tsx`
- Room: `src/app/room/[id]/page.tsx`
- Settings: `src/app/settings/page.tsx`
- Refresh all: `src/app/api/refresh/route.ts`
- Refresh one source: `src/app/api/bindings/[id]/refresh/route.ts`
- Backfill one source: `src/app/api/sources/[id]/backfill/route.ts`
- Auth profile management: `src/app/api/auth-profiles/*`

## Key Dependencies

- `next`, `react`, `react-dom`
- `@prisma/client`, `prisma`
- `rss-parser`
- `playwright-core`
- `undici`

## Architecture Risks

- Browser-profile automation can fail if a login window is still open or a platform changes its UI.
- X scraping depends on current GraphQL response names and timeline structure.
- Bilibili fallback depends on web API behavior and WBI signing details.
- SQLite is local-first and not suitable for multi-user hosted deployments without redesign.
- Missing observability can make platform failures hard to diagnose.
