# CLAUDE.md

Before acting, read docs/AI_HANDOFF.md.

Guidance for Claude when helping with SourceLens.

## Role

Claude (via Claude Code cloud sandbox) writes and self-tests most code on branch `claude/amazing-ride-oa1jss`, plus architecture, phase design, and review. Codex acts as local verifier/merger. Prefer pre-tested branch deliveries over loose code dumps.

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

- YouTube / Bilibili / X are all usable; feeds (RSS/podcast/GitHub/arXiv) refresh via thin adapters.
- Platform layer: adapter registry + client-safe capability table + unified `FetchReport` envelope.
- Archive status (availability/lastSeenAt) live for YouTube; one-command backup/export exist.
- Local database, backups, exports, and browser profiles are private local state and must never be committed.
- Workflow: Claude (cloud sandbox) writes and self-tests code on its branch; Codex verifies locally and merges.

## Style

Keep recommendations concise, concrete, and easy for Codex to execute. Favor maintainable, explicit code and small safe steps.
