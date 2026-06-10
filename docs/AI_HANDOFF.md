# AI Handoff

This is the first file every AI collaborator should read.

## Current Project State

SourceLens is a local-first personal information console built around Rooms. A Room represents a person, company, lab, or project and combines multiple source bindings into a chronological timeline of launcher cards.

Current platform state:

- YouTube: usable.
- Bilibili: P0 usable. Recent fixes made browser-profile fallback work and Bilibili thumbnails display correctly.
- X: P0 can fetch `@elonmusk` posts through a local logged-in browser profile. Known issue: X login check can misreport `expired` even when refresh succeeds.
- RSS / Atom, arXiv, GitHub, podcast RSS, and manual items exist in the codebase.

## Main Goal

Prepare SourceLens for safe private GitHub synchronization and multi-AI collaboration, while keeping local secrets, database files, and browser profiles out of version control.

## Completed

- Core Room/source/timeline model exists.
- Prisma + SQLite persistence exists.
- YouTube fetching and enrichment paths exist.
- Bilibili P0 works with login fallback and thumbnail handling.
- X P0 can collect posts into the UI from a local logged-in profile.
- Tests currently pass with `npm test`.

## Todo

- Fix X login status check misreporting `expired`.
- Improve profile-busy error messages for X.
- Consider adding an X Debug Panel later for observability.
- Keep repository hygiene strict before public sharing.
- Add GitHub Issues for focused follow-up tasks.

## Known Issues

- X AuthProfile check can say "expired" while real refresh succeeds.
- Quote posts from X are preserved, but quoted URL/card extraction may need improvement.
- Browser-profile workflows require the login window to be closed before headless checks or refreshes.
- Local data and browser profiles are private and must not be committed.

## Run Commands

```bash
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

## Test Commands

```bash
npm test
npm run build
```

## Important Safety Notes

- Never read or print `.env`.
- Never read Cookies, Local Storage, browser profile databases, or session files.
- Never commit `data/db/`, `data/browser-profiles/`, `.next/`, `node_modules/`, or generated caches.
- Never run `reset:user-data` or seed scripts unless the user explicitly asks.
- Never perform platform write actions.

## Recent Important Change

Repository-initialization documentation and ignore rules were added so SourceLens can be safely synchronized to a private GitHub repository.

## Next Recommended Task

Fix X AuthProfile status checking so a working profile is not shown as expired. Add friendlier profile-busy messages for X.

## Prompt for Claude 20x

Review SourceLens as a source-first Attention OS. Focus on architecture, task decomposition, and review. Do not suggest reading `.env`, cookies, or browser profile data. For implementation tasks, provide goals, files, steps, acceptance criteria, test commands, and risks.

## Prompt for Codex

Work in small scoped patches. Read this file, `README.md`, and `docs/ARCHITECTURE.md` before edits. Do not touch local secrets or profile data. Run focused tests and update this handoff after meaningful work.

## Prompt for ChatGPT Pro Reviewer

Review changes for security, local-data hygiene, browser-profile safety, source fetching correctness, UI regressions, test gaps, and whether the implementation stays source-first rather than feed/recommendation-driven.
