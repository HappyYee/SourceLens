# Architecture Decisions

## 2026-06-10: Keep Local Runtime Data Out of Git

- Decision: Ignore `.env`, `data/db/`, `data/browser-profiles/`, SQLite files, browser profiles, build output, and dependency directories.
- Reason: SourceLens stores private API keys, local content history, and logged-in browser state on the user's machine.
- Impact: New contributors must create their own `.env`, run migrations, and log in locally when needed.
- Follow-up: Re-scan staged files before every initial public/private push.

## 2026-06-10: Use Rooms as the Core Product Object

- Decision: A Room represents the object being followed, not the platform.
- Reason: The product goal is source-first attention control, not another platform feed.
- Impact: Multiple platform sources merge into one timeline per Room.
- Follow-up: Keep future features aligned with user-controlled source lists and ordering.

## 2026-06-10: Use Local Browser Profiles for Hard Platforms

- Decision: X and some Bilibili flows may use local Playwright persistent profiles for read-only fetching.
- Reason: Official APIs can be expensive or insufficient for personal P0 needs.
- Impact: Browser profile state is private local runtime data and must not be committed.
- Follow-up: Improve profile-busy and login-check observability.

## 2026-06-10: Keep AI Lightweight

- Decision: AI is optional and should not control ranking or user attention.
- Reason: SourceLens is a user-directed information console.
- Impact: Missing API keys should degrade gracefully.
- Follow-up: Any future AI feature must be explicit, observable, and optional.

## 2026-06-11: Platform Adapters with a Client-Safe Capability Leaf

- Decision: Every fetchable platform implements `PlatformAdapter` behind a server-side registry; UI-facing platform knowledge comes only from the static table in `src/lib/platform/capabilities.ts`.
- Reason: fetcher had become a per-platform switchboard; separately, importing the registry from client code pulled Playwright into the browser bundle (webpack statically analyzes even dynamic imports).
- Impact: adding a platform = adapter file + capability entry + card renderer; table↔registry consistency is pinned by tests.
- Follow-up: keep network modules behind dynamic imports inside adapters.

## 2026-06-11: One Result Envelope (FetchReport)

- Decision: refresh/backfill/tag-sync/auth-check/availability all return `FetchReport` with `errorCode` classification; user-visible strings are produced by pure formatters pinned byte-exact by tests.
- Reason: three result shapes and string-sniffing error handling made X/Bilibili/YouTube diagnostics incongruent.
- Impact: routes pass through; UI consumes one shape; future observability (diagnostics panel, remote worker) rides the same envelope.

## 2026-06-11: Additive-Only Archive Migrations

- Decision: migrations on user-archive tables are `ADD COLUMN` only; columns that would force SQLite table rebuilds (e.g. NOT NULL DEFAULT) are made nullable with code-level defaults (`?? "unknown"`).
- Reason: Prisma's SQLite engine rewrites whole tables for constraint-bearing changes; the first archive migration must be physically incapable of data loss.
- Impact: review gate = generated SQL must contain only ADD COLUMN/UPDATE; mandatory verified backup before applying; rollback = restore file copy.

## 2026-06-12: Availability Accepts Deterministic Evidence Only

- Decision: `availability` is written solely by the availability checker from platform-deterministic signals (YouTube `videos.list` absence). Absence from a refresh window is never evidence. `missingSince` records first sighting once; positive re-sighting self-heals. Bilibili/X/RSS checking is deliberately deferred.
- Reason: feeds are sliding windows; honest `unknown` beats false `unavailable` in a personal archive.
- Impact: unavailable items keep their cards with a 「源头已下架」 badge; write ownership is documented in the schema and pinned by tests.

## 2026-06-12: Backup and Export Boundaries

- Decision: `npm run backup` uses `VACUUM INTO` on a read-only connection (hot-safe, verified, never auto-pruned). `npm run export` excludes the AuthProfile table entirely; scripts receive `DATABASE_URL` via `--env-file` and never read `.env` themselves.
- Reason: profileDir is machine-local state and proxyUrl may embed credentials; backup must be one command and physically unable to mutate the source.
- Impact: restore = copy snapshot over the DB file; exports are credentials-free by construction with a bindings-scoped tripwire.

## 2026-06-12: Cloud-Claude Writes, Local-Codex Verifies

- Decision: Claude (Claude Code cloud sandbox) writes and self-tests most code on branch `claude/amazing-ride-oa1jss`; Codex pulls the branch, runs local/real-machine verification (profiles, real DB, UI), and merges to `main` after user confirmation.
- Reason: sandbox can run the full test/build suite; local quota is better spent on what only the local machine can do.
- Impact: every delivery arrives pre-tested with sandbox-rehearsed migrations; transport-layer git errors are retryable by rule (backoff ×4, HTTP/1.1 single-command fallback), while verification anomalies stop the line.
