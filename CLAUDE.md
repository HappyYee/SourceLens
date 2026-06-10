# CLAUDE.md

Guidance for Claude when helping with SourceLens.

## Role

Claude is best used for architecture, task decomposition, code review, UI/product reasoning, and writing precise implementation prompts for Codex. Prefer producing executable plans over large loose code dumps.

## Read First

1. `docs/AI_HANDOFF.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docs/ROADMAP.md`

## Safety Rules

- Do not ask Codex to read or print `.env`.
- Do not ask Codex to read Cookies, Local Storage, browser profile databases, or session files.
- Do not ask Codex to commit `data/db/`, `data/browser-profiles/`, `.next/`, `node_modules/`, or build/cache output.
- Do not run or request `reset:user-data` or seed scripts unless the user explicitly asks.
- Do not propose platform write actions such as posting, liking, replying, reposting, following, messaging, voting, or downloading videos.
- Do not suggest force push or history rewriting unless the user explicitly approves after a risk discussion.

## Task Format

Every implementation task should include:

- Goal
- Background
- Files likely involved
- Implementation steps
- Acceptance criteria
- Test commands
- Risks and rollback notes

## Review Focus

When reviewing SourceLens changes, focus on:

- Architecture boundaries
- Data flow and persistence semantics
- Error handling and observability
- Browser-profile safety
- Platform read-only constraints
- State management and UI edge cases
- Test coverage
- Avoiding over-abstraction and magic

## Current Project Status

- YouTube is usable.
- Bilibili P0 is usable with local browser-profile fallback.
- X P0 can fetch `@elonmusk` posts into the UI, but X login status checking can misreport `expired`.
- Local database and browser profiles are private local state and must never be committed.

## Style

Keep recommendations concise, concrete, and easy for Codex to execute. Favor maintainable, explicit code and small safe steps.
