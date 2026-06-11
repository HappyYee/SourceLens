# AGENTS.md

Before acting, read docs/AI_HANDOFF.md.

Rules for Codex and other code-executing AI agents working in SourceLens.

## Read First

Before changing code, read these files:

1. `docs/AI_HANDOFF.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. This `AGENTS.md`

## Project Status

- YouTube / Bilibili / X usable; feeds via thin adapters; adapter registry + `FetchReport` envelope across the stack.
- Archive status (availability) live for YouTube; `npm run backup` / `npm run export` exist.
- Primary code authorship is Claude's cloud branch; local agents verify, merge, and handle anything requiring real profiles or the real DB.

## Safety Rules

- Do not read, print, or commit `.env`.
- Do not read Cookies, Local Storage, browser profile databases, session files, or token stores.
- Do not commit `data/db/`, `data/browser-profiles/`, `.next/`, `node_modules/`, coverage, caches, or local build output.
- Do not commit API keys, tokens, passwords, cookies, sessions, `.pem`, `.key`, or `.p12` files.
- Do not run `npm run reset:user-data`, `npm run seed`, `npm run seed:demo`, or `npm run seed:empty` unless the user explicitly asks.
- Do not perform platform write actions: no posting, liking, replying, reposting, following, messaging, voting, coin/tip actions, or video downloading.
- Do not force push.

## Working Style

- Start by summarizing a short plan before code edits.
- Keep changes scoped to the current task.
- Do not do broad refactors unless explicitly requested.
- Prefer existing patterns and local helpers.
- Add or update focused tests when behavior changes.
- Run the smallest relevant test command after edits. Use `npm test` for broad changes.
- Update `docs/AI_HANDOFF.md` after meaningful work so the next AI can continue cleanly.

## Git and PR Rules

- Commit messages may be clear English or Chinese-English, but must describe the change.
- Before committing, run a staged-file safety check and confirm no secrets or local data are staged.
- Pull request descriptions must include:
  - Summary
  - Changes
  - Tests run and results
  - Risks or follow-up work
  - AI notes when relevant

## Current Product Intent

SourceLens is a source-first attention console. It organizes information by Room, not platform. A Room represents a person, company, lab, or project, and gathers source bindings such as YouTube, Bilibili, X, feeds, arXiv, GitHub, and podcasts into a chronological timeline of launcher cards.
