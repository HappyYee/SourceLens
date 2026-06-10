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
