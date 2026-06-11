# SourceLens

SourceLens is a personal source-first information console. A Room represents one object you care about, such as a person, company, lab, or project. Each Room can bind sources from multiple platforms, collect new items, normalize them into launcher cards, and show a chronological timeline controlled by the user rather than by recommendation feeds.

The project is intended to stay private or low-profile until the repository is confirmed clean of secrets and local data.

## Current Platform Support

- YouTube: RSS + optional Data API enrichment, backfill, playlist tags, availability checking (deleted/private videos keep their cards with a 「源头已下架」 badge).
- Bilibili: official web APIs plus local browser-profile fallback.
- X: real post scraping (text/image/video/link/quote) via the local logged-in Playwright profile; truthful login-state reporting.
- RSS / Atom, arXiv, GitHub releases, podcast RSS via thin adapters; manual items supported.

All platforms run through a shared adapter registry with capability-driven UI and a single result envelope. See `docs/ARCHITECTURE.md`.

## Tech Stack

- Next.js 14 App Router
- React
- TypeScript
- Prisma
- SQLite
- Node test runner
- rss-parser
- playwright-core for local read-only browser-profile access
- undici for network/proxy support

## Install

```bash
npm install
```

For reproducible installs in CI or on a clean machine:

```bash
npm ci
```

## Environment

Create a local `.env` from the template:

```bash
cp .env.example .env
```

Do not commit `.env`. Real API keys, local proxy settings, cookies, sessions, and browser profiles must stay local.

## Database

Run Prisma migrations and generate the client:

```bash
npx prisma migrate dev
npx prisma generate
```

The local SQLite database lives under `data/db/` and is intentionally gitignored. Browser login profiles live under `data/browser-profiles/` and are also gitignored.

## Run

```bash
npm run dev
```

Open the printed local URL, usually `http://localhost:3000`.

## Test

```bash
npm test
```

The tests use Node's built-in test runner with TypeScript stripping and experimental SQLite support.

## Backup & Export

```bash
npm run backup   # hot SQLite snapshot (safe while dev runs) -> data/backups/, verified
npm run export   # credentials-free archive JSON -> data/exports/ (AuthProfile excluded)
```

## Build

```bash
npm run build
```

Build output under `.next/` is ignored and should never be committed.

## Project Structure

```text
src/app/                 Next.js pages and API routes
src/components/          UI components for rooms, sources, auth profiles, and item cards
src/lib/                 Core data, fetch, normalize, connector, view, and storage logic
src/lib/platform/        Platform adapters, registry, client-safe capability table
src/lib/connectors/      Platform connectors for YouTube, Bilibili, X, feeds, arXiv, GitHub
prisma/                  Prisma schema and local migration scripts
tests/                   Node test runner suites
docs/                    AI handoff, architecture, roadmap, decisions, and UI notes
reference/               Historical prototype/spec references
scripts/                 Local helper scripts
```

## AI Collaboration

Before making changes, AI agents should read:

1. `docs/AI_HANDOFF.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `AGENTS.md` or `CLAUDE.md`, depending on the tool

Rules:

- Do not read or print `.env`.
- Do not read Cookies, Local Storage, browser profile databases, or session files.
- Do not commit `data/db/`, `data/browser-profiles/`, `.next/`, `node_modules/`, or build/cache output.
- Do not run `reset:user-data` or seed scripts unless the user explicitly asks.
- Do not perform platform write actions such as posting, liking, replying, reposting, following, messaging, voting, or downloading videos.
- Keep changes scoped to the requested task and update `docs/AI_HANDOFF.md` at the end of meaningful work.
